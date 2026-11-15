'use strict';
/* Модуль сервера ALBAKOV — уведомления о поступлении.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    Mail, PUBLIC_URL, Pricing, absUrl, crypto, currentUser, db, fail, mailReady, pushUser, save, sendMail,
    throttle, uid, validEmail
  } = S;

  /* ---------------- Уведомления о поступлении ---------------- */
  function mailCfg() {
    const m = db.secrets.mail || {};
    return { host: process.env.SMTP_HOST || m.host || '', port: Number(process.env.SMTP_PORT || m.port || 465), security: process.env.SMTP_SECURITY || m.security || 'ssl', user: process.env.SMTP_USER || m.user || '', pass: process.env.SMTP_PASS || m.pass || '', fromEmail: process.env.SMTP_FROM || m.fromEmail || m.user || '', fromName: m.fromName || db.settings.storeName,
      // ответы покупателей — на почту для связи (адрес отправителя может быть no-reply@)
      replyTo: process.env.SMTP_REPLY_TO || m.replyTo || (db.settings.contacts || {}).email || '' };
  }
  function brandLogo() {
    const b = db.settings.brand || {}, img = (b.word && b.word.src) ? b.word : (b.mark && b.mark.src) ? b.mark : null;
    const src = img && absUrl(img.src);
    return src ? { src, w: img.w, h: img.h } : null;
  }
  function notifyContext(w, p, c) {
    const pr = Pricing.productPrice(p, db.promotions), cs = db.settings.contacts || {};
    return {
      tpl: Mail.tplOf(db.settings), store: db.settings.storeName, product: p.name, color: c.name, colorHex: c.hex, size: w.size,
      price: Pricing.format(pr.price), oldPrice: pr.oldPrice ? Pricing.format(pr.oldPrice) : '',
      url: `${PUBLIC_URL}/product/${p.slug}?color=${encodeURIComponent(c.id)}`, image: absUrl((c.images || [])[0]),
      unsubscribe: w.id ? `${PUBLIC_URL}/api/notify/cancel?id=${encodeURIComponent(w.id)}&t=${w.token}` : '',
      contacts: [cs.phone, cs.email].filter(Boolean).join(' · '),
      logo: brandLogo()
    };
  }
  let waitlistBusy = false;
  async function processWaitlist() {
    const tpl = Mail.tplOf(db.settings);
    const ready = Mail.readyRequests(db.waitlist, db.products);
    const res = { ready: ready.length, sent: 0, failed: 0, disabled: !tpl.enabled, noMail: !mailReady() };
    // Push тем, у кого есть кабинет с этой почтой и включены уведомления, — сразу, не дожидаясь письма
    for (const w of ready) {
      if (w.pushedAt || res.disabled) continue;
      const u = db.users.find((x) => x.email && x.email.toLowerCase() === String(w.email).toLowerCase()); w.pushedAt = new Date().toISOString();
      const p = db.products.find((x) => x.id === w.productId), c = p && p.colors.find((x) => x.id === w.colorId); if (!u || !p) continue;
      const img = c && c.images && c.images[0];
      pushUser(u, 'stock', { title: 'Снова в наличии', body: p.name + (c ? ', ' + c.name : '') + (w.size ? ', размер ' + w.size : '') + '. Размеры разбирают быстро.', url: '/product/' + (p.slug || p.id) + (c ? '?color=' + c.id : ''), tag: 'stock-' + p.id, icon: img, image: img, actions: [{ action: 'open', title: 'Посмотреть' }] });
    }
    if (!ready.length || res.disabled || res.noMail || waitlistBusy) return res;
    waitlistBusy = true;
    try {
      for (const w of ready) {
        const p = db.products.find((x) => x.id === w.productId), c = p.colors.find((x) => x.id === w.colorId);
        const m = Mail.render(notifyContext(w, p, c));
        try {
          await sendMail({ to: w.email, subject: m.subject, html: m.html, text: m.text, unsubscribe: notifyContext(w, p, c).unsubscribe });
          w.status = 'sent'; w.sentAt = new Date().toISOString(); delete w.error; res.sent++;
        } catch (e) { w.status = 'failed'; w.error = e.message; res.failed++; console.error('Письмо не отправлено:', w.email, e.message); }
        save();
      }
    } finally { waitlistBusy = false; }
    if (res.sent) console.log(`Отправлено уведомлений о поступлении: ${res.sent}`);
    return res;
  }
  function subscribe(req, b) {
    throttle(req, 'notify');
    const tpl = Mail.tplOf(db.settings); if (!tpl.enabled) fail(400, 'Уведомления о поступлении сейчас отключены');
    const p = db.products.find((x) => x.id === b.productId && x.active !== false); if (!p) fail(404, 'Товар не найден');
    const c = Pricing.colorOf(p, b.colorId); if (!c || c.id !== b.colorId) fail(404, 'Цвет не найден');
    const size = String(b.size || '');
    if (size && !(c.sizes || []).some((x) => x.size === size)) fail(400, 'Такого размера нет');
    const inStock = (c.sizes || []).some((x) => x.stock > 0 && (!size || x.size === size));
    if (inStock && size) fail(400, 'Этот размер уже в наличии — его можно добавить в корзину');
    const email = String(b.email || '').trim().toLowerCase();
    if (!validEmail(email)) fail(400, 'Проверьте электронную почту');
    if (!b.consent) fail(400, 'Нужно согласие на обработку адреса почты');
    if (db.waitlist.filter((w) => w.email === email && w.status === 'waiting').length >= 30) fail(429, 'С этой почты уже оставлено много заявок');
    const dup = db.waitlist.find((w) => w.email === email && w.productId === p.id && w.colorId === c.id && w.size === size && (w.status === 'waiting' || w.status === 'failed'));
    if (!dup) {
      const u = currentUser(req);
      db.waitlist.push({ id: uid('w'), token: crypto.randomBytes(12).toString('hex'), productId: p.id, colorId: c.id, size, email, userId: u ? u.id : null, createdAt: new Date().toISOString(), status: 'waiting', consentAt: new Date().toISOString() });
      save();
    }
    return { already: !!dup };
  }
  function htmlPage(title, text) {
    const s = db.settings.storeName;
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400;500&display=swap" rel="stylesheet"></head><body style="margin:0;background:#eeeff1;color:#0d0e10;font-family:Montserrat,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box"><div style="max-width:460px;width:100%;text-align:center;background:#fff;border-radius:28px;padding:44px 32px;box-sizing:border-box;box-shadow:0 0 0 1px rgba(18,20,23,.06),0 40px 80px -40px rgba(18,20,23,.35)"><div style="letter-spacing:8px;font-size:20px;margin-bottom:30px">${s.toUpperCase()}</div><h1 style="font-weight:200;font-size:36px;letter-spacing:-1px;line-height:1.1;margin:0 0 14px">${title}${/[.!?…]$/.test(String(title).trim()) ? '' : '.'}</h1><p style="color:#5b6169;line-height:1.65;margin:0">${text}</p><a href="${PUBLIC_URL}/" style="display:inline-block;margin-top:26px;color:#fff;background:#0d0e10;padding:15px 30px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:500">На сайт &rarr;</a></div></body></html>`;
  }

  return {
    brandLogo, htmlPage, mailCfg, notifyContext, processWaitlist, subscribe
  };
};
