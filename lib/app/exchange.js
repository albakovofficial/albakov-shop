'use strict';
/* Модуль сервера ALBAKOV — обмен и возврат по заявке покупателя.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    PUBLIC_URL, can, cdek, createReturnShip, crypto, db, fail, firstImg, hist, mailReady, pushStaff, returnedQty,
    save, sendMail, sendOrderMails, sizeEntry, supportMail, uid
  } = S;
  // функции модулей, которые подключаются позже
  const mailCfg = (...a) => S.mailCfg(...a);
  const orderView = (...a) => S.orderView(...a);

  /* ---------------- Обмен и возврат по заявке покупателя ----------------
     Покупатель в карточке заказа выбирает вещь и причину. Если размер не подошёл — предлагаем обмен:
     новый размер резервируем сразу, а отправляем, когда вещь вернётся к нам и мы её проверим. */
  const REQ_REASONS = { small: 'Маловата', big: 'Великовата', color: 'Не тот цвет', defect: 'Брак', other: 'Передумал' };
  function exchangeCfg() { const e = db.settings.exchange || {}; return { enabled: e.enabled !== false, days: Math.max(1, Math.min(60, Math.round(Number(e.days) || 14))), free: e.free !== false }; }
  const doneAtOf = (o) => o.doneAt || (o.cdek && o.cdek.status === 'DELIVERED' && o.cdek.statusAt) || '';
  const activeRequest = (o) => (o.requests || []).find((r) => r.status === 'new' || r.status === 'received');
  function requestState(o) {
    const c = exchangeCfg();
    if (!c.enabled) return { ok: false, why: 'Заявки на обмен и возврат через сайт сейчас не принимаются — напишите нам в поддержку' };
    if (o.payment && o.payment.method === 'exchange') return { ok: false, why: 'Это заказ-обмен. Если размер снова не подошёл — напишите в поддержку' };
    if (o.status !== 'done') return { ok: false, why: 'Обменять или вернуть вещь можно после получения заказа' };
    if (activeRequest(o)) return { ok: false, why: 'По заказу уже есть заявка — мы её обрабатываем' };
    const until = (Date.parse(doneAtOf(o)) || Date.parse(o.createdAt)) + c.days * 864e5;
    if (Date.now() > until) return { ok: false, why: 'Срок обмена и возврата — ' + c.days + ' дней после получения — прошёл. Напишите в поддержку, разберёмся' };
    const can = o.items.map((_, i) => requestableQty(o, i));
    if (!can.some((n) => n > 0)) return { ok: false, why: 'Все вещи из заказа уже возвращены или обменены' };
    return { ok: true, until: new Date(until).toISOString(), days: c.days, free: c.free, can };
  }
  // Сколько штук позиции ещё можно вернуть: минус возвращённые деньгами, отправленные возвратом СДЭК и заявки без возврата СДЭК
  function requestableQty(o, idx) {
    const it = o.items[idx]; if (!it) return 0;
    const pending = (o.requests || []).filter((r) => r.status !== 'declined' && !r.returnUuid).reduce((s, r) => s + r.lines.filter((l) => l.idx === idx).reduce((a, l) => a + l.qty, 0), 0);
    return Math.max(0, it.qty - (it.refundedQty || 0) - returnedQty(o, idx) - pending);
  }
  function requestText(o, r) {
    const what = r.lines.map((l) => `${l.name}${l.color ? ', ' + l.color : ''}, ${l.size}${r.kind === 'exchange' ? ' → ' + l.toSize : ''} (${l.qty} шт.)`).join('; ');
    return (r.kind === 'exchange' ? 'Заявка на обмен' : 'Заявка на возврат') + ` по заказу № ${o.number}: ${what}. Причина: ${r.reasonLabel}.` +
      (r.comment ? ` Комментарий: ${r.comment}` : '') + (r.returnNumber ? ` Номер возврата СДЭК: ${r.returnNumber}.` : '');
  }
  function requestTicket(o, r) {
    const u = o.userId && db.users.find((x) => x.id === o.userId);
    pushStaff('request', { title: (r.kind === 'refund' ? 'Заявка на возврат' : 'Заявка на обмен') + ' · заказ № ' + o.number, body: requestText(o, r).replace(/\s+/g, ' ').slice(0, 200), url: '/admin?s=orders&id=' + o.id, tag: 'req-' + o.id, icon: firstImg(o), urgent: true, actions: [{ action: 'open', title: 'Открыть заявку' }] });
    if (!u) { // заказ без личного кабинета: просто пишем магазину
      const cs = db.settings.contacts || {}, to = cs.email || mailCfg().fromEmail;
      if (mailReady() && to) sendMail({ to, subject: `Заявка по заказу № ${o.number}`, text: requestText(o, r) + `\n\n${PUBLIC_URL}/admin?s=orders&id=${o.id}`, html: '<p>' + requestText(o, r).replace(/[<>&]/g, '') + `</p><p><a href="${PUBLIC_URL}/admin?s=orders&id=${o.id}">Открыть заказ</a></p>` }).catch((e) => console.error('Письмо о заявке не отправлено:', e.message));
      return;
    }
    const now = new Date().toISOString();
    db.ticketSeq = (db.ticketSeq || 1000) + 1;
    const t = { id: uid('t'), number: String(db.ticketSeq), userId: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' '), email: u.email, phone: u.phone,
      topic: 'Возврат и обмен', orderId: o.id, orderNumber: o.number, status: 'open', createdAt: now, updatedAt: now, unreadUser: false, unreadShop: true,
      messages: [{ id: uid('m'), from: 'user', text: requestText(o, r), at: now }], request: true };
    db.tickets.push(t); r.ticketId = t.id; supportMail(t, 'shop');
  }
  // Ответ магазина в переписке по заявке (и письмо покупателю)
  function requestReply(r, text) {
    const t = r.ticketId && db.tickets.find((x) => x.id === r.ticketId); if (!t) return;
    const now = new Date().toISOString();
    t.messages.push({ id: uid('m'), from: 'shop', text, at: now }); t.status = 'answered'; t.unreadUser = true; t.unreadShop = false; t.updatedAt = now;
    supportMail(t, 'customer');
  }
  async function createRequest(o, b) {
    const st = requestState(o); if (!st.ok) fail(400, st.why);
    const kind = b.kind === 'refund' ? 'refund' : 'exchange';
    if (!REQ_REASONS[b.reason]) fail(400, 'Выберите, что не так');
    const lines = [], need = new Map();
    for (const x of Array.isArray(b.lines) ? b.lines.slice(0, 50) : []) {
      const idx = Number(x.idx), it = o.items[idx], q = Math.floor(Number(x.qty) || 0);
      if (!it || q <= 0) continue;
      const can = requestableQty(o, idx);
      if (q > can) fail(400, can ? `«${it.name}»: можно оформить не больше ${can} шт.` : `«${it.name}» уже возвращается`);
      const line = { idx, qty: q, name: it.name, color: it.color || '', size: it.size };
      if (kind === 'exchange') {
        const to = String(x.toSize || '');
        if (!to || to === it.size) fail(400, 'Выберите размер, на который поменять');
        const se = sizeEntry(it.productId, it.colorId, to); if (!se) fail(400, `Размера ${to} у этой вещи нет`);
        const k = it.productId + '|' + it.colorId + '|' + to; need.set(k, (need.get(k) || 0) + q);
        if (se.stock < need.get(k)) fail(409, `Размера ${to} сейчас нет в наличии — выберите другой или оформите возврат денег`);
        line.toSize = to;
      }
      lines.push(line);
    }
    if (!lines.length) fail(400, 'Отметьте вещь, которую хотите ' + (kind === 'exchange' ? 'обменять' : 'вернуть'));
    if (kind === 'exchange') lines.forEach((l) => { sizeEntry(o.items[l.idx].productId, o.items[l.idx].colorId, l.toSize).stock -= l.qty; }); // резерв нового размера
    const r = { id: uid('rq'), kind, reason: b.reason, reasonLabel: REQ_REASONS[b.reason], comment: String(b.comment || '').trim().slice(0, 500), lines, status: 'new', createdAt: new Date().toISOString(), free: kind === 'exchange' && exchangeCfg().free };
    o.requests = o.requests || []; o.requests.push(r); save();
    // сразу оформляем возврат через СДЭК — покупатель получает номер, который назвать в пункте
    const pv = o.delivery && (o.delivery.pvz || o.delivery.door);
    if (cdek.ready() && pv) {
      try { const ret = await createReturnShip(o, { lines: lines.map((l) => ({ idx: l.idx, qty: l.qty })) }); r.returnUuid = ret.uuid; r.returnNumber = ret.number || ''; if (r.free) ret.free = true; }
      catch (e) { r.returnError = String(e.message || e).slice(0, 300); console.error('Возврат СДЭК по заявке не создан:', r.returnError); }
    }
    requestTicket(o, r); save();
    return r;
  }
  // Заказ-обмен: новый размер бесплатно, тот же адрес; резерв сделан при заявке
  function createExchangeOrder(o, r) {
    db.orderSeq = Number(db.orderSeq) || 0;
    do { db.orderSeq++; } while (db.orders.some((x) => x.number === String(db.orderSeq)));
    const now = new Date().toISOString();
    const order = {
      id: uid('o'), number: String(db.orderSeq), token: crypto.randomBytes(16).toString('hex'), createdAt: now, userId: o.userId || null, customer: Object.assign({}, o.customer), consentAt: o.consentAt || now,
      items: r.lines.map((l) => { const it = o.items[l.idx]; return Object.assign({}, it, { size: l.toSize, qty: l.qty, price: 0, oldPrice: 0, exchangeFrom: it.size, exchangePrice: it.price }); }),
      subtotal: 0, saleDiscount: 0, promoCode: '', promoDiscount: 0, delivery: Object.assign({}, o.delivery, { price: 0, free: true }), comment: 'Обмен по заказу № ' + o.number,
      total: 0, payment: { method: 'exchange', status: 'paid', provider: null }, status: 'new', bonusUsed: 0, bonusEarn: 0, exchangeOf: { id: o.id, number: o.number }
    };
    delete order.delivery.tariff;
    hist(order, 'Создан заказ-обмен по заказу № ' + o.number, 'admin');
    db.orders.push(order);
    return order;
  }
  function requestAdmin(o, body) {
    const r = (o.requests || []).find((x) => x.id === body.id); if (!r) fail(404, 'Заявка не найдена');
    const act = body.action;
    const unreserve = () => { if (r.kind === 'exchange' && !r.exchangeOrderId && !r.unreserved) { r.lines.forEach((l) => { const s = sizeEntry(o.items[l.idx].productId, o.items[l.idx].colorId, l.toSize); if (s) s.stock += l.qty; }); r.unreserved = true; } };
    if (act === 'exchange') {
      if (r.kind !== 'exchange' || r.exchangeOrderId) fail(400, 'Обмен уже отправлен');
      if (r.status === 'declined') fail(400, 'Заявка отклонена');
      const n = createExchangeOrder(o, r);
      // вернувшаяся вещь проверена — снова в продаже
      r.lines.forEach((l) => { const it = o.items[l.idx], se = sizeEntry(it.productId, it.colorId, it.size); if (se) se.stock += l.qty; });
      Object.assign(r, { status: 'done', exchangeOrderId: n.id, exchangeNumber: n.number, checkedAt: new Date().toISOString() });
      requestReply(r, `Вещь пришла, мы её проверили. Отправляем размер ${r.lines.map((l) => l.toSize).join(', ')} — это заказ № ${n.number}, доставка бесплатно. Трек-номер придёт на почту.`);
      save(); sendOrderMails(n);
      return { order: orderView(o), exchange: orderView(n) };
    }
    if (act === 'received') { if (r.status !== 'new') fail(400, 'Заявка уже обработана'); r.status = 'received'; r.checkedAt = new Date().toISOString(); requestReply(r, 'Вещь пришла и проверена. ' + (r.kind === 'refund' ? 'Возвращаем деньги — обычно они приходят за 1–3 рабочих дня.' : '')); }
    else if (act === 'done') { r.status = 'done'; }
    else if (act === 'decline') {
      if (r.exchangeOrderId) fail(400, 'Обмен уже отправлен — отмените заказ-обмен');
      unreserve(); r.status = 'declined'; r.declineNote = String(body.note || '').slice(0, 500);
      requestReply(r, 'Заявку не можем принять' + (r.declineNote ? ': ' + r.declineNote : '.') + ' Если есть вопросы — ответьте здесь.');
    } else fail(400, 'Неизвестное действие');
    save(); return { order: orderView(o) };
  }

  return {
    createRequest, doneAtOf, requestAdmin, requestState
  };
};
