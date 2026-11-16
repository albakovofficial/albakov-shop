'use strict';
/* Модуль сервера ALBAKOV — ЮKassa: платежи, чеки, возврат денег, время на оплату, сверка.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    PUBLIC_URL, Pricing, cut, db, fail, mailReady, money, save, syncBonus, uid, userOf
  } = S;
  // функции модулей, которые подключаются позже
  const findGift = (...a) => S.findGift(...a);
  const giftActivate = (...a) => S.giftActivate(...a);
  const giftReapply = (...a) => S.giftReapply(...a);
  const giftReturn = (...a) => S.giftReturn(...a);
  const processWaitlist = (...a) => S.processWaitlist(...a);
  const pushCustomer = (...a) => S.pushCustomer(...a);
  const pushOrderEvent = (...a) => S.pushOrderEvent(...a);
  const pushStaff = (...a) => S.pushStaff(...a);
  const pushStaffOrder = (...a) => S.pushStaffOrder(...a);
  const sendOrderMails = (...a) => S.sendOrderMails(...a);
  const sendRefundMail = (...a) => S.sendRefundMail(...a);
  const stockMail = (...a) => S.stockMail(...a);

  /* ---------------- ЮKassa ---------------- */
  function yk() {
    const cfg = (db.settings.payment && db.settings.payment.yookassa) || {};
    const shopId = process.env.YOOKASSA_SHOP_ID || cfg.shopId;
    const secret = process.env.YOOKASSA_SECRET_KEY || db.secrets.yookassaSecret;
    return { shopId, secret, cfg };
  }
  async function ykRequest(method, url, body, idemKey) {
    const { shopId, secret } = yk();
    if (!shopId || !secret) fail(400, 'Онлайн-оплата не настроена: укажите shopId и секретный ключ ЮKassa в панели управления.');
    const r = await fetch('https://api.yookassa.ru/v3' + url, {
      method,
      headers: Object.assign({ Authorization: 'Basic ' + Buffer.from(shopId + ':' + secret).toString('base64'), 'Content-Type': 'application/json' }, idemKey ? { 'Idempotence-Key': idemKey } : {}),
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('ЮKassa:', r.status, j); fail(502, 'Платёжный сервис отклонил запрос: ' + (j.description || r.status)); }
    return j;
  }
  const rub = (kop) => (kop / 100).toFixed(2);
  /* Сколько реально оплачено деньгами за каждую позицию и доставку (в копейках):
     скидка по промокоду и бонусы распределяются по товарам, остаток бонусов уменьшает доставку */
  function netLines(order) {
    const lines = order.items.map((i, idx) => ({ idx, gift: !!i.gift, name: (i.gift ? i.name : `${i.name}${i.color ? ', ' + i.color : ''}, размер ${i.size}`).slice(0, 128), qty: i.qty, totalK: i.price * i.qty * 100 }));
    const subK = lines.reduce((s, l) => s + l.totalK, 0);
    // бонусы и оплата сертификатом уменьшают сумму позиций в чеке (сначала товары, остаток — доставка)
    const bonusK = ((order.bonusUsed || 0) + (order.giftUsed || 0)) * 100, goodsBonusK = Math.min(bonusK, Math.max(0, subK - order.promoDiscount * 100));
    let discK = order.promoDiscount * 100 + goodsBonusK, left = discK;
    lines.forEach((l, idx) => {
      const share = idx === lines.length - 1 ? left : Math.min(left, Math.round(discK * l.totalK / (subK || 1)));
      left -= share; l.totalK -= share;
    });
    const delivK = order.delivery ? Math.max(0, order.delivery.price * 100 - (bonusK - goodsBonusK)) : 0;
    return { lines, delivK, deliveryName: order.delivery ? order.delivery.name : '' };
  }
  // Позиция чека: если сумма не делится на количество без остатка — одна штука уходит отдельной строкой
  function pushReceipt(out, name, qty, totalK, subject, vatCode, mode) {
    const push = (q, unitK) => out.push({ description: name, quantity: q.toFixed(2), amount: { value: rub(unitK), currency: 'RUB' }, vat_code: vatCode, payment_mode: mode || 'full_payment', payment_subject: subject });
    const unit = Math.floor(totalK / qty), rest = totalK - unit * qty;
    if (rest === 0) push(qty, unit);
    else { if (qty > 1) push(qty - 1, unit); push(1, unit + rest); }
  }
  /* Позиции чека: сумма позиций = сумма платежа */
  function receiptItems(order, vatCode) {
    const n = netLines(order), out = [];
    // продажа подарочного сертификата — аванс (признак расчёта «аванс», предмет «платёж»)
    n.lines.forEach((l) => { if (l.totalK > 0) pushReceipt(out, l.name, l.qty, l.totalK, l.gift ? 'payment' : 'commodity', vatCode, l.gift ? 'advance' : 'full_payment'); });
    if (n.delivK > 0) pushReceipt(out, 'Доставка: ' + n.deliveryName, 1, n.delivK, 'service', vatCode);
    return out.filter((x) => Number(x.amount.value) > 0);
  }
  function receiptCustomer(order) { return { email: order.customer.email, phone: order.customer.phone, full_name: `${order.customer.lastName} ${order.customer.firstName}` }; }
  /* ---------- Возврат денег ---------- */
  const refundedK = (o) => (o.refunds || []).filter((r) => r.status !== 'canceled').reduce((s, r) => s + Math.round(r.amount * 100), 0);
  // Сколько вернуть за выбранные товары и доставку. Доля позиции считается так, чтобы частичные возвраты в сумме дали ровно её стоимость
  function refundPlan(o, b) {
    const n = netLines(o), sel = [], { cfg } = yk(), vat = Number(cfg.vatCode) || 1, items = [], parts = [];
    let amountK = 0;
    for (const x of Array.isArray(b.lines) ? b.lines : []) {
      const l = n.lines[Number(x.idx)], q = Math.floor(Number(x.qty) || 0); if (!l || q <= 0) continue;
      const done = o.items[l.idx].refundedQty || 0;
      if (q > l.qty - done) fail(400, `«${o.items[l.idx].name}»: можно вернуть не больше ${l.qty - done} шт.`);
      const k = Math.round(l.totalK * (done + q) / l.qty) - Math.round(l.totalK * done / l.qty);
      sel.push({ idx: l.idx, qty: q }); amountK += k;
      if (k > 0) parts.push({ name: l.name, q, k, subject: 'commodity' });
    }
    let delivK = 0;
    if (b.delivery) {
      if (o.deliveryRefunded) fail(400, 'Доставка уже возвращена');
      delivK = n.delivK; amountK += delivK;
      if (delivK > 0) parts.push({ name: 'Доставка: ' + n.deliveryName, q: 1, k: delivK, subject: 'service' });
    }
    const leftK = Math.round(o.total * 100) - refundedK(o);
    amountK = Math.min(amountK, leftK);
    // Удержание за обратную доставку СДЭК: уменьшаем позиции чека, начиная с самой дорогой
    let deductK = Math.max(0, Math.min(Math.round((Number(b.deduct) || 0) * 100), amountK - 100));
    const deducted = deductK;
    parts.sort((a, c) => c.k - a.k).forEach((x) => { const cut = Math.min(deductK, x.k - x.q); if (cut > 0) { x.k -= cut; deductK -= cut; } });
    amountK -= deducted - deductK;
    parts.forEach((x) => pushReceipt(items, x.name, x.q, x.k, x.subject, vat));
    return { sel, delivery: !!b.delivery && delivK >= 0, amountK, leftK, items, sendReceipt: !!cfg.sendReceipt, deducted: (deducted - deductK) / 100 };
  }
  // Возврат из кабинета ЮKassa (без выбора товаров): записываем сумму и меняем статус
  function recordRefund(r) {
    if (!r || r.status !== 'succeeded') return;
    const o = db.orders.find((x) => x.payment.providerId === r.payment_id); if (!o) return;
    o.refunds = o.refunds || [];
    // уже записан (оформлен из панели): только обновляем статус, второй раз сумму не добавляем
    const known = o.refunds.find((x) => x.id === r.id); if (known) { if (known.status !== r.status) { known.status = r.status; save(); } return; }
    o.refunds.push({ id: r.id, status: r.status, amount: Number(r.amount.value), at: r.created_at || new Date().toISOString(), reason: 'Оформлен в кабинете ЮKassa', items: [], delivery: false, external: true });
    o.refunded = refundedK(o) / 100;
    if (refundedK(o) >= Math.round(o.total * 100)) { o.payment.status = 'refunded'; if (o.status !== 'returned' && o.status !== 'canceled') { o.statusBefore = o.status; o.status = 'returned'; } }
    syncBonus(o); save();
  }
  async function refundOrder(o, b) {
    if (o.payment.method !== 'online' || !o.payment.providerId) fail(400, 'Заказ оплачен не онлайн — деньги возвращаются вручную');
    if (o.payment.status !== 'paid') fail(400, o.payment.status === 'refunded' ? 'Деньги по заказу уже возвращены полностью' : 'Заказ ещё не оплачен — возвращать нечего');
    const plan = refundPlan(o, b);
    if (!plan.sel.length && !plan.delivery) fail(400, 'Отметьте товары или доставку, за которые возвращаете деньги');
    if (plan.amountK <= 0) fail(400, 'Сумма возврата получилась 0 ₽ — эти позиции были оплачены бонусами');
    if (b.dry) return { amount: plan.amountK / 100, left: plan.leftK / 100, deducted: plan.deducted };
    const key = String(b.key || '').replace(/[^\w-]/g, '').slice(0, 60);
    if (!key) fail(400, 'Обновите страницу и повторите возврат');
    const body = { payment_id: o.payment.providerId, amount: { value: rub(plan.amountK), currency: 'RUB' }, description: `Возврат по заказу № ${o.number}`.slice(0, 250) };
    // Чек возврата: сумма позиций должна совпасть с суммой возврата
    if (plan.sendReceipt && plan.items.length && plan.items.reduce((s, x) => s + Math.round(Number(x.amount.value) * 100) * Number(x.quantity), 0) === plan.amountK) {
      body.receipt = { customer: receiptCustomer(o), items: plan.items, tax_system_code: Number(yk().cfg.taxSystem) || 1 };
    }
    const r = await ykRequest('POST', '/refunds', body, 'rf-' + o.id + '-' + key);
    if (r.status === 'canceled') fail(502, 'ЮKassa отклонила возврат' + (r.cancellation_details && r.cancellation_details.reason ? ': ' + r.cancellation_details.reason : ''));
    if ((o.refunds || []).some((x) => x.id === r.id)) return { refund: o.refunds.find((x) => x.id === r.id), repeated: true };
    const refund = {
      id: r.id, status: r.status, amount: plan.amountK / 100, at: new Date().toISOString(), reason: String(b.reason || '').trim().slice(0, 300),
      items: plan.sel.map((x) => ({ name: o.items[x.idx].name, color: o.items[x.idx].color || '', size: o.items[x.idx].size, qty: x.qty })), delivery: plan.delivery, restocked: !!b.restock && o.status !== 'canceled',
      deducted: plan.deducted || 0
    };
    if (plan.deducted && Array.isArray(o.returns)) o.returns.forEach((r) => { if (r.cost && !r.deducted) r.deducted = true; });
    o.refunds = o.refunds || []; o.refunds.push(refund); hist(o, 'Возврат денег: ' + Pricing.format(refund.amount) + (refund.reason ? ' — ' + refund.reason : ''), 'admin');
    plan.sel.forEach((x) => {
      const it = o.items[x.idx]; it.refundedQty = (it.refundedQty || 0) + x.qty;
      // заказ отменён — товар вернулся на склад ещё при отмене, второй раз не прибавляем (аудит H-2)
      if (b.restock && o.status !== 'canceled') { const st = sizeEntry(it.productId, it.colorId, it.size); if (st) st.stock += x.qty; }
    });
    if (plan.delivery) o.deliveryRefunded = true;
    // заявка покупателя на возврат денег закрывается вместе с возвратом
    (o.requests || []).forEach((q) => { if (q.kind === 'refund' && (q.status === 'new' || q.status === 'received')) { q.status = 'done'; q.refundId = r.id; } });
    o.refunded = refundedK(o) / 100;
    // Полный возврат: заказ становится «Возврат», чтобы его нельзя было спутать с действующим
    if (refundedK(o) >= Math.round(o.total * 100)) { o.payment.status = 'refunded'; if (o.status !== 'returned' && o.status !== 'canceled') { o.statusBefore = o.status; o.status = 'returned'; } }
    else if (o.bonusEarn > 0) {
      // частичный возврат: бонусы за возвращённую часть забираем
      const share = Math.floor(o.bonusEarn * plan.amountK / Math.round(o.total * 100)), u = userOf(o);
      if (share > 0) { o.bonusEarn -= share; if (o.bonusCredited && u) Pricing.bonusMove(u, -Math.min(u.bonus || 0, share), 'revoke', o, uid); }
    }
    syncBonus(o);
    save();
    if (!o.test) pushOrderEvent(o, 'refund', { amount: refund.amount });
    if (mailReady()) { try { await sendRefundMail(o, refund); refund.mailedAt = new Date().toISOString(); save(); } catch (e) { console.error('Письмо о возврате не отправлено:', e.message); } }
    if (b.restock && o.status !== 'canceled') processWaitlist().catch(() => {});
    return { refund };
  }
  async function createPayment(order) {
    const { cfg, secret } = yk();
    // Тестовый ключ ЮKassa — заказ тестовый: в панели и статистике не считается
    if (/^test_/.test(String(secret || ''))) order.test = true;
    const body = {
      amount: { value: rub(order.total * 100), currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: `${PUBLIC_URL}/order/${order.id}?t=${order.token}` },
      description: `Заказ № ${order.number}`,
      metadata: { orderId: order.id }
    };
    if (cfg.sendReceipt) {
      body.receipt = {
        customer: receiptCustomer(order),
        items: receiptItems(order, Number(cfg.vatCode) || 1),
        tax_system_code: Number(cfg.taxSystem) || 1
      };
    }
    const p = await ykRequest('POST', '/payments', body, order.id);
    order.payment.providerId = p.id;
    order.payUrl = p.confirmation && p.confirmation.confirmation_url;
    // срок оплаты — как у страницы ЮKassa: от момента создания платежа
    order.payBy = new Date((Date.parse(p.created_at) || Date.now()) + PAY_WINDOW_MIN * 60e3).toISOString();
    return order.payUrl;
  }
  // История заказа: что и когда менялось (статус, оплата, трек-номер, возвраты) — видна в карточке заказа в панели
  const ST_RU = { new: 'Новый', processing: 'Собирается', shipped: 'Передан в доставку', done: 'Выполнен', canceled: 'Отменён', returned: 'Возврат' };
  const PAY_RU = { pending: 'ожидает оплаты', paid: 'оплачен', canceled: 'оплата не прошла', refunded: 'деньги возвращены' };
  function hist(o, text, by) { (o.history = o.history || []).push({ at: new Date().toISOString(), text: String(text).slice(0, 300), by: by || 'system' }); if (o.history.length > 200) o.history = o.history.slice(-200); }
  function applyPayment(order, p) {
    if (!order || !p) return;
    if (p.test) order.test = true;
    if (p.status === 'succeeded' && p.paid) {
      // Сверка: платёж именно по этому заказу и на всю сумму в рублях (аудит L-2)
      const sumOk = p.amount && p.amount.currency === 'RUB' && Math.round(Number(p.amount.value) * 100) === Math.round(order.total * 100);
      const idOk = !p.metadata || !p.metadata.orderId || p.metadata.orderId === order.id;
      if (!sumOk || !idOk) {
        if (!order.payMismatch) {
          order.payMismatch = true;
          hist(order, 'ЮKassa сообщила об оплате, но ' + (!idOk ? 'платёж от другого заказа' : 'сумма не совпадает: ' + (p.amount ? p.amount.value + ' ' + p.amount.currency : '—')) + ' — проверьте в личном кабинете ЮKassa');
          pushStaff('paid', { title: 'Проверьте оплату заказа № ' + order.number, body: 'Сумма или заказ в ЮKassa не совпадают с заказом — заказ не отмечен оплаченным', url: '/admin?s=orders&id=' + order.id, tag: 'order-' + order.id, urgent: true });
        }
        return;
      }
      // способ оплаты нужен для комиссии в «Финансах»: у СБП она ниже
      if (p.payment_method && p.payment_method.type) order.payment.type = String(p.payment_method.type).slice(0, 30);
      if (order.payment.status !== 'paid') {
        order.payment.status = 'paid'; order.payment.paidAt = p.captured_at || new Date().toISOString();
        if (order.status === 'canceled' && order.payExpired && resumePaid(order)) {
          // Оплата пришла чуть позже срока, а вещи ещё в наличии — заказ оформляется сам, как будто оплатили вовремя
          hist(order, 'Оплата пришла после срока — вещи в наличии, заказ возобновлён');
          const twin = db.orders.find((x) => x.id !== order.id && x.status !== 'canceled' && Date.parse(x.createdAt) > Date.parse(order.createdAt) &&
            ((x.customer || {}).phone === (order.customer || {}).phone) && x.items.some((i) => order.items.some((j) => j.productId === i.productId && j.colorId === i.colorId && j.size === i.size)));
          if (twin) {
            hist(order, 'У покупателя есть заказ № ' + twin.number + ' на те же вещи — проверьте, не лишний ли он');
            pushStaff('order', { title: 'Два заказа на те же вещи: № ' + order.number + ' и № ' + twin.number, body: 'Оплата № ' + order.number + ' пришла после срока, а покупатель уже оформил № ' + twin.number + '. Свяжитесь и отмените лишний', url: '/admin?s=orders&id=' + twin.id, tag: 'twin-' + order.id, urgent: true });
          }
          sendOrderMails(order); giftActivate(order); if (order.kind !== 'gift') stockMail(order.items);
          pushCustomer(order, 'orders', { title: 'Оплата получена', body: 'Заказ № ' + order.number + ' оформлен — начинаем собирать', url: '/order/' + order.id, tag: 'pay-' + order.id, urgent: true }).catch(() => {});
        } else if (order.status === 'canceled' && order.payExpired) {
          // Оплата пришла после срока, а вещь за это время купили. Деньги возвращает владелец сам — кнопкой «Вернуть деньги» в заказе
          order.paidAfterCancel = true;
          hist(order, 'Оплата пришла после срока, а вещей уже нет' + (order.resumeMissing && order.resumeMissing.length ? ': ' + order.resumeMissing.join(', ') : '') + ' — верните деньги в заказе');
          pushStaff('paid', { title: 'Верните деньги по заказу № ' + order.number, body: 'Оплатили после срока, а вещи уже купили — ' + money(order.total) + '. Возврат — кнопкой в заказе', url: '/admin?s=orders&id=' + order.id, tag: 'order-' + order.id, urgent: true });
          pushCustomer(order, 'orders', { title: 'Оплата пришла после отмены', body: 'Заказ № ' + order.number + ' уже отменён, а вещь купили. Мы вернём деньги на карту, с которой вы платили', url: '/order/' + order.id, tag: 'pay-' + order.id, urgent: true }).catch(() => {});
        } else if (order.status === 'canceled') {
          // Оплатили заказ, отменённый вручную: деньги вернуть или возобновить заказ — решает владелец в панели
          order.paidAfterCancel = true;
          hist(order, 'Оплата пришла на отменённый заказ — верните деньги или возобновите заказ');
          pushStaff('paid', { title: 'Оплачен отменённый заказ № ' + order.number, body: money(order.total) + ' — верните деньги или возобновите заказ', url: '/admin?s=orders&id=' + order.id, tag: 'order-' + order.id, urgent: true });
        } else { hist(order, 'Оплата получена онлайн'); sendOrderMails(order); giftActivate(order); if (order.kind !== 'gift') stockMail(order.items); }
      }
    }
    else if (p.status === 'canceled' && order.payment.status !== 'paid') {
      // оплата не прошла: возвращаем товар и промокод, если заказ ещё не был отменён вручную
      const late = p.cancellation_details && p.cancellation_details.reason === 'expired_on_confirmation';
      if (late && order.status !== 'canceled') order.payExpired = true;   // ЮKassa закрыла страницу оплаты по времени
      if (order.status !== 'canceled') {
        hist(order, late ? 'Время на оплату вышло — заказ отменён, товар вернулся на склад' : 'Онлайн-оплата не прошла — заказ отменён, товар вернулся на склад');
        restock(order); giftReturn(order);
        if (order.kind === 'gift') { const g = db.giftcards.find((x) => x.id === order.giftId); if (g && g.status === 'pending') g.status = 'canceled'; }
        const pc = order.promoCode && db.promocodes.find((x) => x.code === order.promoCode);
        if (pc) pc.used = Math.max(0, (pc.used || 0) - 1);
        processWaitlist().catch(() => {});
      }
      order.payment.status = 'canceled'; order.status = 'canceled';
    }
    syncBonus(order);
    save();
  }
  /* Оплата после срока (15.11.2026): заказ, отменённый таймером, возобновляется, если всё на месте —
     вещи на складе, остаток сертификата и бонусов. Иначе не трогаем: владелец вернёт деньги. */
  function resumePaid(order) {
    const missing = [];
    order.items.forEach((i) => {
      if (i.gift || i.preorder) return;
      const s = sizeEntry(i.productId, i.colorId, i.size);
      if (!s || s.stock < i.qty) missing.push([i.name, i.color, i.size].filter(Boolean).join(' · '));
    });
    if (order.giftUsed && order.giftReturned) { const g = findGift(order.giftCode); if (!g || g.balance < order.giftUsed) missing.push('остаток сертификата'); }
    const u = order.bonusUsed > 0 && order.bonusReturned ? userOf(order) : null;
    if (u && (u.bonus || 0) < order.bonusUsed) missing.push('бонусы на счёте');
    if (missing.length) { order.resumeMissing = missing; return false; }
    unrestock(order); giftReapply(order);
    const pc = order.promoCode && db.promocodes.find((x) => x.code === order.promoCode); if (pc) pc.used = (pc.used || 0) + 1;
    if (order.kind === 'gift') { const g = db.giftcards.find((x) => x.id === order.giftId); if (g && g.status === 'canceled') g.status = 'pending'; }
    order.status = 'new'; order.payExpired = false; order.resumedAt = new Date().toISOString(); delete order.resumeMissing;
    return true;
  }
  // Сверка с ЮKassa (15.11.2026): если уведомление ЮKassa не дошло, неоплаченные заказы старше 20 минут
  // проверяются раз в 15 минут (до 7 дней), по одному — оплаченный станет оплаченным, отменённый вернёт товар на склад
  setInterval(async () => {
    const now = Date.now();
    const list = db.orders.filter((o) => o.payment && o.payment.method === 'online' && o.payment.status === 'pending' && o.payment.providerId && o.status !== 'canceled' &&
      now - Date.parse(o.createdAt) > 20 * 60e3 && now - Date.parse(o.createdAt) < 7 * 864e5).slice(0, 50);
    for (const o of list) { await syncPayment(o); }
    // заказы, отменённые таймером за последние сутки: вдруг оплата всё-таки прошла, а уведомление ЮKassa потерялось (аудит L-8)
    const late = db.orders.filter((o) => o.payExpired && o.status === 'canceled' && o.payment.method === 'online' && o.payment.status === 'canceled' && o.payment.providerId &&
      now - Date.parse(o.createdAt) < 864e5).slice(0, 50);
    for (const o of late) {
      try { const p = await ykRequest('GET', '/payments/' + o.payment.providerId); if (p.status === 'succeeded' && p.paid) applyPayment(o, p); } catch (e) { /* не критично */ }
    }
  }, 15 * 60e3).unref();
  /* Время на оплату (13.64.7): онлайн-заказ ждёт оплаты 15 минут. За 5 минут до конца — пуш покупателю;
     срок вышел — сначала спрашиваем ЮKassa (вдруг оплата прошла), иначе заказ отменяется: вещи, промокод,
     сертификат и бонусы возвращаются. Оплатили позже — владелец получит уведомление (оплата отменённого заказа) */
  // 10 минут — столько же, сколько живёт страница оплаты ЮKassa («Завершите платёж в течение…»); отсчёт — от создания платежа.
  // Минуту после срока ждём ответа ЮKassa: покупатель мог нажать «Оплатить» в последние секунды.
  const PAY_WINDOW_MIN = 10, PAY_GRACE = 60e3;
  const OPEN_ORDERS_MAX = 3;
  // Всплеск заказов: 10 и больше за 15 минут — push владельцу, не чаще раза в час (аудит M-2)
  let surgeAt = 0;
  function orderSurge() {
    const since = Date.now() - 15 * 60e3, n = db.orders.filter((o) => !o.test && o.kind !== 'gift' && Date.parse(o.createdAt) > since).length;
    if (n >= 10 && Date.now() - surgeAt > 60 * 60e3) { surgeAt = Date.now(); pushStaff('order', { title: 'Много заказов за 15 минут: ' + n, body: 'Проверьте, нет ли среди них ненастоящих — неподтверждённые можно отменить в панели', url: '/admin?s=orders', tag: 'surge', urgent: true }); }
  }
  function expireUnpaid(o) {
    if (o.status === 'canceled' || o.payment.status !== 'pending') return;
    hist(o, 'Время на оплату вышло — заказ отменён, товар вернулся на склад');
    restock(o); giftReturn(o);
    if (o.kind === 'gift') { const g = db.giftcards.find((x) => x.id === o.giftId); if (g && g.status === 'pending') g.status = 'canceled'; }
    const pc = o.promoCode && db.promocodes.find((x) => x.code === o.promoCode);
    if (pc) pc.used = Math.max(0, (pc.used || 0) - 1);
    o.payment.status = 'canceled'; o.status = 'canceled'; o.payExpired = true;
    syncBonus(o); save();
    processWaitlist().catch(() => {});
    pushStaffOrder(o, 'expired'); save();
    // вещи возвращаются в корзину покупателя (приложение и сайт кладут их сами, когда открывается заказ)
    if (o.kind === 'gift') pushCustomer(o, 'orders', { title: 'Сертификат не оплачен', body: 'Время на оплату вышло, деньги не списаны — оформите сертификат заново', url: '/order/' + o.id, tag: 'pay-' + o.id }).catch(() => {});
    else pushCustomer(o, 'orders', { title: 'Время на оплату вышло', body: 'Заказ № ' + o.number + ' отменён, вещи вернулись в корзину — оформите заново, пока они в наличии', url: '/order/' + o.id, tag: 'pay-' + o.id }).catch(() => {});
  }
  // заказы, оформленные до срока на оплату, получают те же 10 минут с момента обновления сервера
  db.orders.forEach((o) => { if (o.payment && o.payment.method === 'online' && o.payment.status === 'pending' && o.status !== 'canceled' && !o.payBy) o.payBy = new Date(Date.now() + PAY_WINDOW_MIN * 60e3).toISOString(); });
  setInterval(async () => {
    const now = Date.now();
    for (const o of db.orders.filter((x) => x.payBy && x.payment && x.payment.status === 'pending' && x.status !== 'canceled')) {
      const left = Date.parse(o.payBy) - now;
      if (left <= 5 * 60e3 && left > 0 && !o.payReminded) {
        o.payReminded = true; save();
        pushCustomer(o, 'orders', { title: 'Заказ № ' + o.number + ' ждёт оплаты', body: 'Осталось 5 минут — потом заказ отменится, а вещи вернутся в корзину', url: '/order/' + o.id, tag: 'pay-' + o.id, urgent: true });
      }
      if (left <= 0) {
        await syncPayment(o, true);   // оплата могла пройти, а уведомление ЮKassa — задержаться
        if (left <= -PAY_GRACE && o.payment.status === 'pending' && o.status !== 'canceled') expireUnpaid(o);
      }
    }
  }, 15e3).unref();
  const paySyncAt = new Map();     // заказ → время последней сверки с ЮKassa (аудит L-4)
  async function syncPayment(order, force) {
    if (order.payment.method !== 'online' || order.payment.status !== 'pending' || !order.payment.providerId) return;
    const now = Date.now(); if (!force && now - (paySyncAt.get(order.id) || 0) < 10e3) return;
    paySyncAt.set(order.id, now); if (paySyncAt.size > 2000) paySyncAt.clear();
    try { applyPayment(order, await ykRequest('GET', '/payments/' + order.payment.providerId)); } catch (e) { /* не критично */ }
  }
  function sizeEntry(productId, colorId, size) {
    const p = db.products.find((x) => x.id === productId); if (!p) return null;
    const c = Pricing.colorOf(p, colorId);
    return c && (c.sizes || []).find((x) => x.size === size) || null;
  }
  function restock(order) {
    order.items.forEach((i) => {
      if (i.preorder) { const p = db.products.find((x) => x.id === i.productId); if (p) p.preorderSold = Math.max(0, (p.preorderSold || 0) - i.qty); return; }
      const s = sizeEntry(i.productId, i.colorId, i.size);
      if (s) s.stock += i.qty;
    });
  }
  // Обратно к restock: заказ снова в работе — списываем остаток или место в партии
  function unrestock(order) {
    order.items.forEach((i) => {
      if (i.preorder) { const p = db.products.find((x) => x.id === i.productId); if (p) p.preorderSold = (p.preorderSold || 0) + i.qty; return; }
      const s = sizeEntry(i.productId, i.colorId, i.size); if (s) s.stock = Math.max(0, s.stock - i.qty);
    });
  }

  return {
    OPEN_ORDERS_MAX, PAY_RU, PAY_WINDOW_MIN, ST_RU, applyPayment, createPayment, hist, netLines, orderSurge,
    receiptItems, recordRefund, refundOrder, restock, sizeEntry, syncPayment, unrestock, yk, ykRequest
  };
};
