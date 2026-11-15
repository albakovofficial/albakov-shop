'use strict';
/* Модуль сервера ALBAKOV — подарочные сертификаты.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    Mail, PUBLIC_URL, Pricing, crypto, db, mailReady, save, sendMail
  } = S;
  // функции модулей, которые подключаются позже
  const brandLogo = (...a) => S.brandLogo(...a);

  /* ---------------- Подарочные сертификаты ----------------
     Покупатель оплачивает сертификат онлайн → код уходит получателю на почту (сразу или в выбранный день).
     Код вводят при оформлении: сумма сертификата идёт в оплату заказа, остаток сохраняется. */
  const GIFT_DEF = { enabled: true, nominals: [5000, 10000, 20000, 30000], min: 3000, max: 100000, months: 12 };
  function giftCfg() { return Object.assign({}, GIFT_DEF, db.settings.gifts || {}); }
  function giftCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c;
    do { c = 'GIFT-' + [0, 1].map(() => Array.from(crypto.randomBytes(4), (x) => A[x % A.length]).join('')).join('-'); } while (db.giftcards.some((g) => g.code === c));
    return c;
  }
  const normGift = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^GIFT/, '');
  function findGift(code) { const n = normGift(code); return n.length >= 8 ? db.giftcards.find((g) => normGift(g.code) === n) : null; }
  function giftState(g) {
    if (!g) return 'none'; if (g.status === 'canceled') return 'canceled'; if (g.status === 'pending') return 'pending';
    if (g.expiresAt && new Date(g.expiresAt) < new Date()) return 'expired'; return g.balance > 0 ? 'active' : 'used';
  }
  const ruDate = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' }).replace(' г.', '');
  function giftView(g) { return { code: g.code, amount: g.amount, balance: g.balance, expiresAt: g.expiresAt, state: giftState(g) }; }
  function giftSendDue(g) { if (!g.sendAt) return true; const today = new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10), hour = new Date(Date.now() + 3 * 36e5).getUTCHours(); return g.sendAt < today || (g.sendAt === today && hour >= 10); }
  async function sendGift(g) {
    if (!mailReady() || !g.to || !g.to.email) return false;
    const m = Mail.renderGift({ store: db.settings.storeName, logo: brandLogo(), code: g.code, amount: Pricing.format(g.amount), toName: g.to.name, fromName: g.fromName, message: g.message, expires: ruDate(g.expiresAt), url: PUBLIC_URL + '/catalog', siteUrl: PUBLIC_URL });
    try { await sendMail({ to: g.to.email, subject: m.subject, html: m.html, text: m.text }); g.sentAt = new Date().toISOString(); save(); return true; }
    catch (e) { console.error('Письмо с сертификатом не отправлено:', e.message); return false; }
  }
  function giftActivate(order) {
    if (order.kind !== 'gift' || order.payment.status !== 'paid') return;
    const g = db.giftcards.find((x) => x.id === order.giftId); if (!g || g.status !== 'pending') return;
    g.status = 'active'; g.activatedAt = new Date().toISOString(); g.expiresAt = new Date(Date.now() + giftCfg().months * 30.5 * 864e5).toISOString();
    if (order.status === 'new') order.status = 'done';
    save(); if (giftSendDue(g)) sendGift(g);
  }
  // Отменили заказ, оплаченный сертификатом, — возвращаем сумму на сертификат; вернули в работу — списываем снова
  function giftReturn(order) {
    if (!order.giftUsed || order.giftReturned) return;
    const g = findGift(order.giftCode); if (!g) return;
    g.balance += order.giftUsed; (g.log = g.log || []).push({ at: new Date().toISOString(), orderId: order.id, number: order.number, amount: order.giftUsed, type: 'return' });
    order.giftReturned = true;
  }
  function giftReapply(order) {
    if (!order.giftUsed || !order.giftReturned) return;
    const g = findGift(order.giftCode); if (!g) return;
    g.balance = Math.max(0, g.balance - order.giftUsed); g.log.push({ at: new Date().toISOString(), orderId: order.id, number: order.number, amount: -order.giftUsed, type: 'spend' });
    order.giftReturned = false;
  }
  // отложенная отправка (в выбранный день, с 10:00 по Москве)
  setInterval(() => { db.giftcards.filter((g) => g.status === 'active' && !g.sentAt && g.to && g.to.email && giftSendDue(g)).forEach((g) => sendGift(g)); }, 10 * 60e3).unref();

  return {
    findGift, giftActivate, giftCfg, giftCode, giftReapply, giftReturn, giftState, giftView, sendGift
  };
};
