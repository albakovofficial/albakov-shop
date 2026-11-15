'use strict';
/* Модуль сервера ALBAKOV — push-уведомления в приложение iPhone.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    Apns, ROLES, absUrl, currentUser, db, fail, firstImg, money, safeEqual, save, staffRole, throttle, uid
  } = S;

  /* ---------------- Push-уведомления (13.60) ----------------
     Покупателю — о его заказе, ответах поддержки, обмене и возврате, поступлении, бонусах и (по желанию) акциях.
     Владельцу и сотрудникам — по их роли: новые заказы, оплаты, вопросы, заявки, возвраты, остатки, входы в панель, итоги дня.
     Подписка — это устройство: телефон или браузер. Ключи VAPID создаются один раз и хранятся в базе. */
  // Push браузера и веб-приложения убран полностью (13.64.6): подписки браузеров и ключи VAPID удаляются —
  // уведомления приходят только в приложение ALBAKOV для iPhone (через Apple)
  if (db.secrets.vapid || (db.pushsubs || []).some((x) => !String(x.endpoint || '').startsWith('apns:'))) {
    db.pushsubs = (db.pushsubs || []).filter((x) => String(x.endpoint || '').startsWith('apns:')); delete db.secrets.vapid; db.webPushOff = 1; save();
  }
  // Приложение на iPhone: ключ Apple для push (панель → «Push-уведомления» → «Приложение iPhone»)
  const IOS_BUNDLE = process.env.IOS_BUNDLE_ID || 'ru.albakovofficial.app';
  function apnsCfg() { const a = db.secrets.apns; return a && a.p8 && a.keyId && a.teamId ? Object.assign({ bundleId: IOS_BUNDLE }, a) : null; }
  // Что можно включать покупателю (по умолчанию всё, кроме акций)
  const PUSH_CUSTOMER = { orders: true, support: true, returns: true, stock: true, bonus: true, promo: false };
  // Что приходит сотрудникам и кому по праву роли
  const PUSH_STAFF = {
    order: { perm: 'orders', on: true }, paid: { perm: 'orders', on: true }, support: { perm: 'orders', on: true }, request: { perm: 'orders', on: true },
    returnIn: { perm: 'orders', on: true }, stock: { perm: 'content', on: true }, digest: { perm: 'finance', on: true }, security: { perm: 'staff', on: true }
  };
  const pushPrefsOf = (u) => Object.assign({}, PUSH_CUSTOMER, (u && u.pushPrefs) || {});
  function staffPushPrefs(u) {
    const role = staffRole(u); if (!role) return null;
    const has = ROLES[role].perms, out = {};
    for (const k of Object.keys(PUSH_STAFF)) if (has.includes(PUSH_STAFF[k].perm)) out[k] = !(u.staffPush && u.staffPush[k] === false);
    return out;
  }
  const pushIcon = (src) => absUrl(src) || absUrl('img/icon-192.png');
  function pushPayload(m) {
    return { title: String(m.title || db.settings.storeName || 'ALBAKOV').slice(0, 80), body: String(m.body || '').slice(0, 240), url: m.url || '/',
      tag: m.tag || '', icon: pushIcon(m.icon), image: m.image ? absUrl(m.image) : '', badge: absUrl('img/push-badge.png'),
      actions: (m.actions || []).slice(0, 2), links: m.links || {}, renotify: !!m.tag, urgent: !!m.urgent };
  }
  const pushStats = { sent: 0, failed: 0, gone: 0 };
  async function pushTo(subs, m) {
    // Одно устройство бывает подписано дважды — как покупатель и как сотрудник: одно сообщение уходит на него один раз
    const seen = new Set(); subs = subs.filter((x) => !seen.has(x.endpoint) && seen.add(x.endpoint));
    // Уведомления — только в приложение ALBAKOV (Apple). Push браузера и веб-приложения убраны (13.64.6)
    subs = subs.filter((x) => x.endpoint.startsWith('apns:'));
    if (!subs.length) return 0;
    const data = pushPayload(m);
    let ok = 0, dirty = false;
    const ac = apnsCfg();
    await Promise.all(subs.map(async (x) => {
      // Приложение ALBAKOV на iPhone — через Apple (адрес «apns:<токен>»)
      if (!ac) return;
      const r = await Apns.send(x.endpoint.slice(5), data, ac, { env: x.env, ttl: m.ttl });
      if (Apns.gone(r)) r.status = 410;
      if (r.status >= 200 && r.status < 300) { ok++; pushStats.sent++; x.lastOk = new Date().toISOString(); x.fails = 0; dirty = true; }
      else if (r.status === 404 || r.status === 410) { db.pushsubs = db.pushsubs.filter((y) => y !== x); pushStats.gone++; dirty = true; }
      else { pushStats.failed++; x.fails = (x.fails || 0) + 1; dirty = true; if (x.fails >= 20) db.pushsubs = db.pushsubs.filter((y) => y !== x); console.error('Push не доставлен:', r.status, r.reason || r.error || ''); }
    }));
    if (dirty) save();
    return ok;
  }
  // Покупателю: его устройства и устройства, подписанные на этот заказ без входа в кабинет
  function pushCustomer(o, kind, m) {
    const u = o && o.userId && db.users.find((x) => x.id === o.userId);
    if (u && pushPrefsOf(u)[kind] === false) return Promise.resolve(0);
    const subs = db.pushsubs.filter((x) => x.scope !== 'staff' && ((u && x.userId === u.id) || (o && (x.orderIds || []).includes(o.id))));
    return pushTo(subs, m).catch((e) => { console.error('Push покупателю:', e.message); return 0; });
  }
  function pushUser(u, kind, m) {
    if (!u || pushPrefsOf(u)[kind] === false) return Promise.resolve(0);
    return pushTo(db.pushsubs.filter((x) => x.scope !== 'staff' && x.userId === u.id), m).catch(() => 0);
  }
  // Сотрудникам с подходящей ролью, у кого это уведомление включено
  function pushStaff(kind, m) {
    const ids = [db.secrets.ownerId].concat(db.secrets.staff.map((x) => x.userId)).filter(Boolean);
    const to = [];
    for (const id of ids) { const u = db.users.find((x) => x.id === id), pr = u && staffPushPrefs(u); if (pr && pr[kind]) to.push(u.id); }
    const subs = db.pushsubs.filter((x) => x.scope === 'staff' && to.includes(x.userId));
    return pushTo(subs, m).catch((e) => { console.error('Push сотрудникам:', e.message); return 0; });
  }
  // --- События заказа для покупателя ---
  function pushOrderEvent(o, ev, extra) {
    if (ev === 'shipped' && o.payment && o.payment.method === 'exchange') { ev = 'exchange'; extra = { text: 'Отправили новый размер' + (o.exchangeOf ? ' по заказу № ' + o.exchangeOf.number : '') + (o.tracking ? ', трек ' + o.tracking.number : '') + '. Сообщим, когда приедет.' }; }
    const n = o.number, url = '/order/' + o.id, img = firstImg(o), d = o.delivery || {};
    const pv = d.pvz, where = pv ? (pv.type === 'postamat' ? 'Постамат' : 'Пункт СДЭК') + ' · ' + (pv.address || d.address || '') : (d.address || '');
    const M = {
      shipped: { title: 'Заказ № ' + n + ' в пути', body: 'Передали в СДЭК' + (o.tracking ? ', трек ' + o.tracking.number : '') + '. Сообщим, когда приедет.', actions: [{ action: 'track', title: 'Отследить' }] },
      pickup: { title: pv && pv.type === 'postamat' ? 'Заказ ждёт в постамате' : 'Заказ ждёт в пункте выдачи', body: where + (o.cdek && o.cdek.number ? '\nНазовите номер ' + o.cdek.number : '') + (pv && pv.fitting && pv.type !== 'postamat' ? '. Можно примерить на месте' : ''), urgent: true, actions: [{ action: 'route', title: 'Как добраться' }] },
      courier: { title: 'Курьер везёт заказ № ' + n, body: 'Сегодня привезём по адресу ' + (d.address || '') + '. Курьер позвонит перед приездом.', urgent: true },
      remind: { title: 'Заказ ещё ждёт вас', body: where + '. Заберите в ближайшие дни — потом СДЭК вернёт посылку нам.', urgent: true },
      done: { title: 'Спасибо за покупку', body: 'Заказ № ' + n + ' получен.' + (o.bonusEarn > 0 ? ' +' + o.bonusEarn + ' бонусов на ваш счёт.' : '') + ' Если размер не подошёл — обменяем в пару нажатий.' },
      refund: { title: 'Деньги возвращены', body: money((extra && extra.amount) || 0) + ' по заказу № ' + n + '. На карту обычно приходят за 1–3 рабочих дня.' },
      exchange: { title: 'Новый размер уже едет', body: (extra && extra.text) || 'Отправили обмен по заказу № ' + n + '.' }
    }[ev];
    if (!M) return Promise.resolve(0);
    const kind = ev === 'refund' || ev === 'exchange' ? 'returns' : 'orders';
    const links = { track: o.tracking ? o.tracking.url : '', route: where ? 'https://yandex.ru/maps/?text=' + encodeURIComponent((pv && pv.city ? pv.city + ', ' : '') + (pv ? pv.address : d.address || '')) : '' };
    return pushCustomer(o, kind, Object.assign({ url, links, tag: 'order-' + o.id, icon: img, image: ev === 'pickup' || ev === 'done' ? img : '' }, M));
  }
  // --- Напоминания забрать заказ: через 3 и через 6 дней в пункте ---
  setInterval(() => {
    const now = Date.now();
    for (const o of db.orders) {
      if (!o.pickupAt || o.status === 'done' || o.status === 'canceled' || o.status === 'returned') continue;
      if (!o.cdek || !['ACCEPTED_AT_PICK_UP_POINT', 'POSTOMAT_POSTED'].includes(o.cdek.status)) continue;
      const days = (now - Date.parse(o.pickupAt)) / 864e5; o.pickupReminders = o.pickupReminders || [];
      for (const d of [3, 6]) if (days >= d && !o.pickupReminders.includes(d)) { o.pickupReminders.push(d); save(); pushOrderEvent(o, 'remind'); }
    }
  }, 30 * 60e3).unref();
  // --- Итоги дня владельцу и финансам: в 21:00 по Москве ---
  // День последней отправки хранится в базе: после перезапуска сервера (выпуск сайта) в 21:xx итоги не уходят второй раз
  // (сегодня итоги уже уходили до этой версии — если сервер обновится в 21:xx, третьего раза не будет)
  if (!db.digestDay && new Date(Date.now() + 3 * 3600e3).getUTCHours() === 21) db.digestDay = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  setInterval(() => {
    const msk = new Date(Date.now() + 3 * 3600e3), day = msk.toISOString().slice(0, 10);
    if (msk.getUTCHours() !== 21 || db.digestDay === day) return;
    db.digestDay = day; save();
    const from = Date.parse(day + 'T00:00:00+03:00');
    const list = db.orders.filter((o) => !o.test && Date.parse(o.createdAt) >= from && o.status !== 'canceled' && (!o.payment || o.payment.method !== 'exchange'));
    const sum = list.reduce((a, o) => a + (o.total || 0), 0), q = db.tickets.filter((t) => t.unreadShop).length;
    const reqs = db.orders.reduce((a, o) => a + (o.requests || []).filter((r) => r.status === 'new').length, 0);
    pushStaff('digest', { title: 'Итоги дня', body: (list.length ? list.length + ' ' + (list.length === 1 ? 'заказ' : list.length < 5 ? 'заказа' : 'заказов') + ' на ' + money(sum) : 'Сегодня заказов не было') + (q ? ' · вопросов без ответа: ' + q : '') + (reqs ? ' · заявок на обмен и возврат: ' + reqs : ''), url: '/admin', tag: 'digest' });
  }, 5 * 60e3).unref();
  function pushSubscribe(req, b) {
    throttle(req, 'push', 60);
    // Приложение на iPhone присылает адрес устройства Apple (b.apns = { token, env }) вместо подписки браузера
    const ap = b.apns && /^[a-f0-9]{64,200}$/i.test(String(b.apns.token || '')) ? b.apns : null;
    if (!ap && !b.old) fail(400, 'Уведомления приходят в приложении ALBAKOV для iPhone');
    if (!ap) return { ok: true, moved: 0 }; // браузер сменил ключи старой подписки — она больше не нужна
    const sub = ap ? { endpoint: 'apns:' + String(ap.token).toLowerCase(), keys: { p256dh: '', auth: '' } } : (b.sub || {}), keys = sub.keys || {};
    const endpoint = String(sub.endpoint || '');
    if (!ap && (!/^https:\/\/[^\s]{10,1000}$/.test(endpoint) || !keys.p256dh || !keys.auth || String(keys.p256dh).length > 200 || String(keys.auth).length > 100)) fail(400, 'Неверная подписка');
    // Браузер сменил ключи (pushsubscriptionchange): переносим все прежние подписки устройства на новый адрес
    if (b.old) {
      const olds = db.pushsubs.filter((y) => y.endpoint === String(b.old));
      olds.forEach((y) => { if (!db.pushsubs.some((z) => z !== y && z.endpoint === endpoint && z.scope === y.scope)) Object.assign(y, { endpoint, p256dh: String(keys.p256dh), auth: String(keys.auth) }); });
      db.pushsubs = db.pushsubs.filter((y) => y.endpoint !== String(b.old));
      save(); return { ok: true, moved: olds.length };
    }
    const u = currentUser(req), staff = b.scope === 'staff';
    if (staff && !(u && staffRole(u))) fail(403, 'Уведомления панели — только для сотрудников');
    let x = db.pushsubs.find((y) => y.endpoint === endpoint && (y.scope === 'staff') === staff);
    if (!x) { x = { id: uid('ps'), endpoint, at: new Date().toISOString(), orderIds: [] }; db.pushsubs.push(x); }
    Object.assign(x, { p256dh: String(keys.p256dh), auth: String(keys.auth), scope: staff ? 'staff' : 'customer', ua: String(req.headers['user-agent'] || '').slice(0, 160) });
    if (ap) x.env = ap.env === 'development' ? 'development' : 'production';
    if (staff) x.userId = u.id; else x.userId = u ? u.id : null; // вышел из кабинета — уведомления аккаунта сюда больше не идут
    if (!staff && b.orderId) {
      const o = db.orders.find((y) => y.id === b.orderId);
      if (o && ((u && o.userId === u.id) || safeEqual(String(b.t || ''), o.token))) { if (!x.orderIds.includes(o.id)) x.orderIds.push(o.id); x.orderIds = x.orderIds.slice(-30); }
    }
    if (db.pushsubs.length > 20000) db.pushsubs.splice(0, db.pushsubs.length - 20000);
    save();
    return { ok: true, id: x.id };
  }

  return {
    IOS_BUNDLE, PUSH_CUSTOMER, PUSH_STAFF, apnsCfg, pushCustomer, pushOrderEvent, pushPrefsOf, pushStaff,
    pushSubscribe, pushTo, pushUser, staffPushPrefs
  };
};
