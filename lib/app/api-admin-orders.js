'use strict';
/* Модуль сервера ALBAKOV — маршруты API панели: заказы, сертификаты, возвраты, бонусы.
   Вынесен из функции api() в server.js 16.11.2026: код маршрутов без изменений, порядок проверки прежний.
   Если ни один маршрут не подошёл, возвращается NEXT — запрос идёт к следующему разделу. */
module.exports = function install(S) {
  const {
    CDEK_TRACK, CDEK_WAIT, HttpError, NEXT, PAY_RU, Pricing, ST_RU, cdek, cdekCalcAny, cdekCfg, cdekOrderBody,
    cdekPkg, createReturnShip, db, fail, giftActivate, giftCfg, giftCode, giftReapply, giftReturn, giftState, hist,
    mailReady, orderView, processWaitlist, publicUser, pushOrderEvent, pushUser, refundOrder, requestAdmin,
    restock, save, sendGift, sendTrackingMail, syncBonus, syncCdek, syncReturns, uid, unrestock, validEmail
  } = S;

  async function adminOrderRoutes(req, res, url, body, p, M, user) {
    // Подарочные сертификаты: выпустить вручную (подарок блогеру, розыгрыш), отменить, отправить письмо ещё раз
    if (p[1] === 'gifts' && !p[2] && M === 'POST') {
      const amount = Math.round(Number(body.amount) || 0); if (!(amount >= 100 && amount <= 1000000)) fail(400, 'Укажите сумму');
      const to = { name: String(body.toName || '').trim().slice(0, 60), email: String(body.toEmail || '').trim().toLowerCase().slice(0, 120) };
      if (to.email && !validEmail(to.email)) fail(400, 'Проверьте почту получателя');
      const now = new Date().toISOString();
      const g = { id: uid('g'), code: giftCode(), amount, balance: amount, status: 'active', manual: true, createdAt: now, activatedAt: now, expiresAt: new Date(Date.now() + giftCfg().months * 30.5 * 864e5).toISOString(), to, fromName: String(body.fromName || db.settings.storeName).slice(0, 60), message: String(body.message || '').slice(0, 300), sendAt: '', log: [] };
      db.giftcards.push(g); save();
      let sent = false; if (to.email && body.send !== false) sent = await sendGift(g);
      return { gift: g, sent };
    }
    if (p[1] === 'gifts' && p[2] && M === 'POST') {
      const g = db.giftcards.find((x) => x.id === p[2]); if (!g) fail(404, 'Сертификат не найден');
      if (p[3] === 'cancel') { g.status = 'canceled'; save(); return { gift: g }; }
      if (p[3] === 'resend') { if (giftState(g) !== 'active') fail(400, 'Сертификат не активен'); if (!(await sendGift(g))) fail(400, mailReady() ? 'Письмо не отправилось — проверьте почту получателя' : 'Почта для отправки не настроена'); return { gift: g }; }
      fail(404, 'Неизвестное действие');
    }
    // Удаление заказа: товар возвращается на склад, промокод и бонусы — как при отмене
    if (p[1] === 'orders' && p[2] && M === 'DELETE') {
      const drop = p[2] === 'test' ? db.orders.filter((o) => o.test) : db.orders.filter((o) => o.id === p[2]);
      if (!drop.length) fail(404, p[2] === 'test' ? 'Тестовых заказов нет' : 'Заказ не найден');
      for (const o of drop) {
        if (o.status !== 'canceled') {
          restock(o); giftReturn(o);
          const pc = o.promoCode && db.promocodes.find((x) => x.code === o.promoCode);
          if (pc) pc.used = Math.max(0, (pc.used || 0) - 1);
          o.status = 'canceled';
        }
        syncBonus(o);
      }
      const ids = new Set(drop.map((o) => o.id));
      db.orders = db.orders.filter((o) => !ids.has(o.id));
      db.tickets.forEach((t) => { if (ids.has(t.orderId)) { t.orderId = ''; } });
      save(); const notify = await processWaitlist(); return { deleted: ids.size, notify };
    }
    // Проверка расчёта доставки СДЭК до города (для настройки)
    if (p[1] === 'cdek-calc' && M === 'POST') {
      const from = cdekCfg().shipmentPoint && cdekCfg().shipmentPoint.cityCode; if (!from) fail(400, 'Не выбран пункт отгрузки');
      const log = []; try { await cdekCalcAny(from, body.city, body.type || 'pvz', cdekPkg(), log); } catch (e) { /* в log */ }
      return { log };
    }
    // Отправление СДЭК: создать, обновить статус, отменить, распечатать
    if (p[1] === 'orders' && p[2] && /^(cdek|return)/.test(p[3] || '')) {
      const o = db.orders.find((x) => x.id === p[2]); if (!o) fail(404, 'Заказ не найден');
      if (!cdek.ready()) fail(400, 'СДЭК не подключён — введите ключи в «Оплата и доставка»');
      if (p[3] === 'cdek' && M === 'POST') {
        if (o.cdek && o.cdek.uuid) fail(400, 'Отправление уже создано');
        if (o.payment.method === 'online' && o.payment.status !== 'paid') fail(400, 'Заказ ещё не оплачен');
        if (['canceled', 'returned'].includes(o.status)) fail(400, 'Заказ отменён');
        // Посылка: из окна в панели, иначе — по весу и размерам товаров заказа
        const pkg = cdekPkg(body.pkg || Pricing.parcelFor(o.items.map((x) => ({ productId: x.productId, qty: x.qty - (x.refundedQty || 0) })), db.products, cdekCfg()));
        let uuid;
        try { uuid = await cdek.createOrder(cdekOrderBody(o, pkg)); }
        catch (e) { if (e instanceof HttpError) throw e; o.cdekTry = (o.cdekTry || 0) + 1; save(); fail(502, 'СДЭК: ' + e.message); }
        o.cdekTry = (o.cdekTry || 0) + 1;
        o.cdek = { uuid, number: '', status: 'ACCEPTED', statusName: 'Заявка принята', createdAt: new Date().toISOString(), pkg };
        if (o.status === 'new') o.status = 'processing';
        save();
        // номер СДЭК присваивает через пару секунд
        for (let i = 0; i < 4 && !o.cdek.number; i++) { await new Promise((r) => setTimeout(r, 1500)); try { await syncCdek(o); } catch (e) { /* дождёмся уведомления */ } }
        if (o.cdek.error) { const err = o.cdek.error; delete o.cdek; if (o.fin) delete o.fin.cdekCost; save(); fail(400, 'СДЭК отклонил заявку: ' + err); }
        return { order: orderView(o) };
      }
      if (p[3] === 'return-ship' && M === 'POST') { const r = await createReturnShip(o, body); return { order: orderView(o), ret: r }; }
      if (p[3] === 'return-sync' && M === 'POST') { try { await syncReturns(o); } catch (e) { fail(502, 'СДЭК: ' + e.message); } return { order: orderView(o) }; }
      if (p[3] === 'return-cancel' && M === 'POST') {
        const r = (o.returns || []).find((x) => x.uuid === body.uuid); if (!r) fail(404, 'Возврат не найден');
        if (!CDEK_WAIT.includes(r.status)) fail(400, 'Посылка уже у СДЭК — отменить можно только через СДЭК');
        try { await cdek.cancel(r.uuid); } catch (e) { fail(502, 'СДЭК: ' + e.message); }
        o.returns = o.returns.filter((x) => x !== r); save(); return { order: orderView(o) };
      }
      if (p[3] === 'cdek-sync' && M === 'POST') {
        if (!o.cdek) fail(400, 'Отправления нет');
        try { await syncCdek(o); } catch (e) { fail(502, 'СДЭК: ' + e.message); }
        return { order: orderView(o) };
      }
      if (p[3] === 'cdek' && M === 'DELETE') {
        if (!o.cdek) fail(400, 'Отправления нет');
        if (!CDEK_WAIT.includes(o.cdek.status)) fail(400, 'Посылка уже у СДЭК — отменить можно только через СДЭК');
        try { await cdek.cancel(o.cdek.uuid); } catch (e) { fail(502, 'СДЭК: ' + e.message); }
        delete o.cdek; if (o.fin) delete o.fin.cdekCost; if (o.status === 'processing') o.status = 'new'; save(); // отменённая заявка — СДЭК за неё не берёт
        return { order: orderView(o) };
      }
      if (p[3] === 'cdek-print' && M === 'GET') {
        if (!o.cdek) fail(400, 'Отправления нет');
        const kind = url.searchParams.get('kind') === 'barcode' ? 'barcode' : 'waybill';
        let buf; try { buf = await cdek.print(o.cdek.uuid, kind); } catch (e) { fail(502, 'СДЭК: ' + e.message); }
        return { __file: { buf, type: 'application/pdf', name: (kind === 'barcode' ? 'naklejka-' : 'nakladnaya-') + o.number + '.pdf' } };
      }
    }
    // Возврат денег через ЮKassa: dry — только посчитать сумму
    if (p[1] === 'orders' && p[2] && p[3] === 'request' && M === 'POST') {
      const o = db.orders.find((x) => x.id === p[2]); if (!o) fail(404, 'Заказ не найден');
      return requestAdmin(o, body);
    }
    if (p[1] === 'orders' && p[2] && p[3] === 'refund' && M === 'POST') {
      const o = db.orders.find((x) => x.id === p[2]); if (!o) fail(404, 'Заказ не найден');
      const r = await refundOrder(o, body);
      return Object.assign({ order: orderView(o) }, r);
    }
    if (p[1] === 'orders' && p[2] && M === 'PATCH') {
      const o = db.orders.find((x) => x.id === p[2]); if (!o) fail(404, 'Заказ не найден');
      const statuses = ['new', 'processing', 'shipped', 'done', 'canceled', 'returned'], pays = ['pending', 'paid', 'canceled', 'refunded'];
      if (body.status && statuses.includes(body.status)) {
        const pc = o.promoCode && db.promocodes.find((x) => x.code === o.promoCode);
        if (body.status === 'canceled' && o.status !== 'canceled') { restock(o); giftReturn(o); if (pc) pc.used = Math.max(0, (pc.used || 0) - 1); }
        if (body.status !== 'canceled' && o.status === 'canceled' && pc) pc.used = (pc.used || 0) + 1;
        if (o.status === 'canceled' && body.status !== 'canceled') { unrestock(o); giftReapply(o); }
        if (body.status === 'done' && o.status !== 'done') o.doneAt = new Date().toISOString();
        if (o.status !== body.status) hist(o, 'Статус: ' + (ST_RU[o.status] || o.status) + ' → ' + (ST_RU[body.status] || body.status) + (body.status === 'canceled' ? ' (товар вернулся на склад)' : ''), 'admin');
        o.status = body.status;
      }
      if (body.paymentStatus && pays.includes(body.paymentStatus)) { if (o.payment.status !== body.paymentStatus) { hist(o, 'Оплата: ' + (PAY_RU[body.paymentStatus] || body.paymentStatus), 'admin'); if (body.paymentStatus === 'paid' && !o.payment.paidAt) o.payment.paidAt = new Date().toISOString(); } o.payment.status = body.paymentStatus; giftActivate(o); }
      // Трек-номер СДЭК: сохраняем, ставим «Передан в доставку» и пишем покупателю
      let tracked = false;
      if (typeof body.track === 'string') {
        const t = body.track.replace(/\s+/g, '').slice(0, 40);
        if (t && !/^[A-Za-z0-9-]{4,40}$/.test(t)) fail(400, 'Трек-номер: только цифры и латинские буквы');
        const prev = o.tracking && o.tracking.number;
        if (!t) delete o.tracking;
        else if (t !== prev) {
          o.tracking = { carrier: 'СДЭК', number: t, url: CDEK_TRACK + encodeURIComponent(t), at: new Date().toISOString() };
          hist(o, 'Трек-номер СДЭК: ' + t, 'admin');
          if (o.status === 'new' || o.status === 'processing') { hist(o, 'Статус: ' + (ST_RU[o.status] || o.status) + ' → Передан в доставку', 'admin'); o.status = 'shipped'; }
          tracked = true;
        }
      }
      if (typeof body.note === 'string') { if ((o.adminNote || '') !== body.note.slice(0, 2000)) hist(o, 'Изменена заметка к заказу', 'admin'); o.adminNote = body.note.slice(0, 2000); }
      syncBonus(o);
      if (tracked && body.notify !== false && !o.test) { o.pushed = Object.assign({}, o.pushed, { shipped: new Date().toISOString() }); pushOrderEvent(o, 'shipped'); }
      save();
      let mailed = false;
      if (tracked && body.notify !== false && mailReady()) { try { await sendTrackingMail(o); o.tracking.mailedAt = new Date().toISOString(); hist(o, 'Покупателю отправлено письмо с трек-номером'); save(); mailed = true; } catch (e) { console.error('Письмо с трек-номером не отправлено:', e.message); } }
      const notify = await processWaitlist(); return { order: orderView(o), notify, trackMailed: mailed };
    }
    if (p[1] === 'users' && p[2] && p[3] === 'bonus' && M === 'POST') {
      // Ручная корректировка баланса: +начислить, −списать (не ниже нуля)
      const u = db.users.find((x) => x.id === p[2]); if (!u) fail(404, 'Покупатель не найден');
      let amount = Math.round(Number(body.amount) || 0);
      if (!amount || Math.abs(amount) > 10000000) fail(400, 'Укажите количество бонусов');
      if (amount < 0) amount = -Math.min(u.bonus || 0, -amount);
      if (!amount) fail(400, 'На счёте покупателя нет бонусов');
      Pricing.bonusMove(u, amount, 'manual', null, uid, String(body.note || '').trim());
      if (amount > 0) pushUser(u, 'bonus', { title: '+' + amount + ' бонусов на счёте', body: (String(body.note || '').trim() ? String(body.note).trim().slice(0, 100) + '. ' : '') + 'Теперь у вас ' + (u.bonus || 0) + ' — оплачивайте ими часть следующего заказа.', url: '/account?tab=bonus', tag: 'bonus' });
      save(); return { user: Object.assign(publicUser(u), { bonusLog: (u.bonusLog || []).slice(0, 100) }) };
    }
    if (p[1] === 'waitlist') {
      if (p[2] === 'send' && M === 'POST') return { notify: await processWaitlist() };
      if (p[2] && M === 'DELETE') { db.waitlist = db.waitlist.filter((w) => w.id !== p[2]); save(); return {}; }
    }
    return NEXT;
  }

  return { adminOrderRoutes };
};
