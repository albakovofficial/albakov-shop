'use strict';
/* Модуль сервера ALBAKOV — уведомления владельцу на почту.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    Mail, PUBLIC_URL, db, mailReady, pushStaff, sendMail, sizeEntry
  } = S;
  // функции модулей, которые подключаются позже
  const brandLogo = (...a) => S.brandLogo(...a);
  const mailCfg = (...a) => S.mailCfg(...a);

  /* ---------------- Уведомления владельцу на почту ----------------
     Новые заказы, вопросы покупателей и заканчивающиеся размеры — письмом на основную почту магазина.
     Адрес и что присылать — в панели, раздел «Уведомления на почту». */
  const OWNER_EVENTS = { order: true, support: true, stock: true, system: true };
  function ownerCfg() { const n = db.settings.ownerNotify || {}; return { email: String(n.email || '').trim(), events: Object.assign({}, OWNER_EVENTS, n.events || {}) }; }
  function ownerTo(kind) {
    const c = ownerCfg(); if (kind && c.events[kind] === false) return '';
    return c.email || (db.settings.contacts || {}).email || mailCfg().fromEmail || '';
  }
  // После заказа: размеры, где осталось 0–2 штуки
  function stockMail(lines, sample) {
    const low = sample || [];
    if (!sample) lines.forEach((l) => { const sz = sizeEntry(l.productId, l.colorId, l.size); if (sz && sz.stock <= 2 && !l.preorder) low.push([l.name, [l.color, l.size].filter(Boolean).join(' · '), sz.stock > 0 ? 'осталось ' + sz.stock + ' шт.' : 'закончился']); });
    if (low.length && !sample) pushStaff('stock', { title: low.length === 1 ? 'Заканчивается размер' : 'Заканчиваются размеры', body: low.slice(0, 4).map((x) => x[0] + ' ' + x[1] + ' — ' + x[2]).join('\n') + (low.length > 4 ? '\nи ещё ' + (low.length - 4) : ''), url: '/admin?s=products', tag: 'stock' });
    const to = ownerTo('stock'); if (!low.length || !to || !mailReady()) return Promise.resolve(false);
    const m = Mail.renderNotice({ store: db.settings.storeName, logo: brandLogo(), test: !!sample, subject: 'Заканчивается: ' + low.map((x) => x[0] + ' ' + x[1]).slice(0, 2).join(', ') + (low.length > 2 ? ' и ещё ' + (low.length - 2) : ''),
      eyebrow: 'Остатки', title: low.length === 1 ? 'Заканчивается размер' : 'Заканчиваются размеры', lead: 'После последнего заказа на складе осталось совсем немного — пора пополнить или снять с продажи.', rows: low, button: 'Открыть товары', url: PUBLIC_URL + '/admin?s=products' });
    return sendMail({ to, subject: m.subject, html: m.html, text: m.text }).then(() => true, (e) => { console.error('Письмо об остатках не отправлено:', e.message); return false; });
  }

  return {
    ownerTo, stockMail
  };
};
