'use strict';
/* Модуль сервера ALBAKOV — напоминание о брошенной корзине.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    Mail, PUBLIC_URL, Pricing, absUrl, crypto, db, mailReady, save, sendMail
  } = S;
  // функции модулей, которые подключаются позже
  const brandLogo = (...a) => S.brandLogo(...a);

  /* ---------------- Напоминание о брошенной корзине ----------------
     Только для вошедших покупателей, которые сами включили напоминания. Одно письмо на корзину:
     через 3 часа после последнего изменения, если заказ так и не оформлен. Отписка — в один клик из письма. */
  function linkKey() { if (!db.secrets.linkKey) { db.secrets.linkKey = crypto.randomBytes(24).toString('hex'); save(); } return db.secrets.linkKey; }
  const cartOffSig = (id) => crypto.createHmac('sha256', linkKey()).update('cart-off:' + id).digest('hex').slice(0, 32);
  function cleanCartLines(list) {
    return (Array.isArray(list) ? list : []).slice(0, 50).map((l) => ({ productId: String(l && l.productId || '').slice(0, 40), colorId: String(l && l.colorId || '').slice(0, 40), size: String(l && l.size || '').slice(0, 20), qty: Math.max(1, Math.min(99, Math.floor(Number(l && l.qty) || 1))) }))
      .filter((l) => db.products.some((p) => p.id === l.productId));
  }
  async function cartReminders() {
    if (!mailReady()) return;
    const now = Date.now();
    for (const u of db.users) {
      const c = u.cart; if (!u.cartRemind || !c || !c.lines || !c.lines.length || c.reminded) continue;
      const age = now - Date.parse(c.updatedAt || 0); if (age < REMIND_AFTER || age > 72 * 36e5) continue;
      if (db.orders.some((o) => o.userId === u.id && Date.parse(o.createdAt) > Date.parse(c.updatedAt))) { c.reminded = true; continue; }
      const items = c.lines.map((l) => {
        const p = db.products.find((x) => x.id === l.productId && x.active !== false); if (!p) return null;
        const col = Pricing.colorOf(p, l.colorId), sz = (col.sizes || []).find((x) => x.size === l.size); if (!sz || sz.stock <= 0) return null;
        return { name: p.name, color: col.name, size: l.size, qty: l.qty, price: Pricing.format(Pricing.productPrice(p, db.promotions).price * l.qty), image: absUrl(col.images && col.images[0]), left: sz.stock <= 2 ? sz.stock : 0 };
      }).filter(Boolean);
      c.reminded = true;
      if (!items.length) continue;
      const m = Mail.renderCartReminder({ store: db.settings.storeName, logo: brandLogo(), name: u.firstName, items, url: PUBLIC_URL + '/cart', off: PUBLIC_URL + '/api/cart-remind/off?u=' + u.id + '&t=' + cartOffSig(u.id) });
      try { await sendMail({ to: u.email, subject: m.subject, html: m.html, text: m.text }); c.remindedAt = new Date().toISOString(); } catch (e) { console.error('Напоминание о корзине не отправлено:', e.message); }
    }
    save();
  }
  const REMIND_AFTER = Number(process.env.CART_REMIND_AFTER_MIN || 180) * 60e3;   // через сколько после последнего изменения корзины
  setInterval(() => { cartReminders().catch((e) => console.error(e)); }, Number(process.env.CART_REMIND_EVERY_SEC || 900) * 1000).unref();

  return {
    cartOffSig, cleanCartLines
  };
};
