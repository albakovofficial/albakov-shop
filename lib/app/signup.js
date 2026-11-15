'use strict';
/* Модуль сервера ALBAKOV — регистрация с подтверждением почты.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    Mail, PUBLIC_URL, Pricing, brandLogo, createSession, crypto, db, doneAtOf, fail, mailReady, parseCookies,
    requestState, save, sendMail, setCookie, sizeEntry, uid
  } = S;

  /* ---------------- Регистрация с подтверждением почты ---------------- */
  // Пока почта не подтверждена, аккаунта нет: данные формы ждут в памяти сервера 15 минут.
  // Код из 6 цифр храним только в виде отпечатка; 5 неверных попыток — нужен новый код;
  // новый код — не чаще раза в минуту и не больше 5 раз. Если почта магазина не настроена,
  // регистрация работает как раньше — сразу, без кода.
  const VERIFY_MIN = 15, VERIFY_TRIES = 5, VERIFY_RESEND_SEC = 60, VERIFY_SENDS = 5;
  const pendingRegs = new Map(), pendingResets = new Map(), pendingLogins = new Map();
  const codeHash = (id, code) => crypto.createHash('sha256').update(id + ':' + code).digest('hex');
  /* Доверенные устройства сотрудников (13.60): после входа по коду устройство получает cookie «dev» на 90 дней.
     В базе — только хэш, не больше 10 устройств на человека */
  const DEV_DAYS = 90;
  const devHash = (t) => crypto.createHash('sha256').update('dev:' + t).digest('hex');
  function trustedDevice(req, u) {
    const t = parseCookies(req).dev; if (!t || !Array.isArray(u.devices)) return false;
    const h = devHash(t), d = u.devices.find((x) => x.h === h);
    return !!(d && Date.now() - Date.parse(d.at) < DEV_DAYS * 864e5);
  }
  function touchDevice(req, res, u, fresh) {
    let t = parseCookies(req).dev;
    if (!t || !/^[a-f0-9]{64}$/.test(t)) t = crypto.randomBytes(32).toString('hex');
    const h = devHash(t); u.devices = (u.devices || []).filter((x) => Date.now() - Date.parse(x.at) < DEV_DAYS * 864e5);
    let d = u.devices.find((x) => x.h === h);
    if (!d) { if (!fresh) return; d = { h, at: new Date().toISOString(), name: deviceName(req) }; u.devices.push(d); u.devices = u.devices.slice(-10); setCookie(res, 'dev', t, DEV_DAYS * 86400); }
    d.last = new Date().toISOString(); save();
  }
  // «iPhone, Safari» — чтобы в письме и журнале было понятно, что за устройство
  function deviceName(req) {
    const ua = String(req.headers['user-agent'] || '');
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'устройство';
    const br = /YaBrowser/.test(ua) ? 'Яндекс Браузер' : /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'браузер';
    return os + ', ' + br;
  }
  function sweepPending() { const now = Date.now(); for (const m of [pendingRegs, pendingResets, pendingLogins]) for (const [k, r] of m) if (r.exp < now) m.delete(k); }
  const maskEmail = (e) => { const [n, d] = String(e).split('@'); return (n.length <= 2 ? n[0] + '*' : n.slice(0, 2) + '*'.repeat(Math.min(6, n.length - 2))) + '@' + d; };
  async function sendCode(r, purpose) {
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    r.code = codeHash(r.id, code); r.tries = 0; r.sentAt = Date.now(); r.sends = (r.sends || 0) + 1; r.exp = Date.now() + VERIFY_MIN * 60e3;
    const m = Mail.renderCode({ store: db.settings.storeName, logo: brandLogo(), code, minutes: VERIFY_MIN, name: r.f.firstName, purpose, device: r.device });
    try { await sendMail({ to: r.f.email, subject: m.subject, html: m.html, text: m.text }); }
    catch (e) { console.error('Письмо с кодом не отправлено:', e && e.message); fail(502, 'Не удалось отправить письмо с кодом. Проверьте адрес почты или попробуйте ещё раз чуть позже'); }
  }
  function welcomePromo() {
    const now = Date.now();
    const pc = (db.promocodes || []).find((x) => x.active !== false && x.firstOrderOnly && Pricing.inWindow(x, now) && (!x.limit || (x.used || 0) < x.limit));
    if (!pc) return null;
    const what = pc.type === 'percent' ? '−' + pc.value + '%' : pc.type === 'fixed' ? '−' + Pricing.format(pc.value) : 'Бесплатная доставка';
    return { code: pc.code, text: what + ' на первый заказ' + (pc.minTotal ? ' от ' + Pricing.format(pc.minTotal) : '') + '. Введите промокод при оформлении.' };
  }
  function createUser(res, f, hash, extra) {
    if (db.users.some((u) => u.email === f.email)) fail(409, 'Пользователь с такой почтой уже зарегистрирован');
    if (db.users.some((u) => u.phone === f.phone)) fail(409, 'Пользователь с таким телефоном уже зарегистрирован');
    const u = Object.assign({ id: uid('u'), hash, createdAt: new Date().toISOString() }, f, extra);
    db.users.push(u); createSession(res, 'user', u.id); save();
    if (mailReady()) {
      const b = Pricing.bonusConf(db.settings), cs = db.settings.contacts || {};
      const m = Mail.renderWelcome({ store: db.settings.storeName, logo: brandLogo(), name: u.firstName, url: PUBLIC_URL + '/', bonusPercent: b.earn ? String(b.percent).replace('.', ',') : '', promo: welcomePromo(), contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
      sendMail({ to: u.email, subject: m.subject, html: m.html, text: m.text }).catch((e) => console.error('Приветственное письмо не отправлено:', e && e.message));
    }
    return u;
  }
  function welcomeInfo() { const b = Pricing.bonusConf(db.settings); return { bonusPercent: b.earn ? b.percent : 0, promo: welcomePromo() }; }

  function orderView(o) { const c = Object.assign({}, o); delete c.token; c.items = (o.items || []).map((i) => i.sku ? i : Object.assign({}, i, { sku: (db.products.find((p) => p.id === i.productId) || {}).sku || undefined }));
    // время на оплату вышло: сколько каждой вещи в наличии прямо сейчас — по этому приложение и сайт возвращают её в корзину
    if (o.payExpired) c.items = c.items.map((i) => { const p = db.products.find((x) => x.id === i.productId), sz = sizeEntry(i.productId, i.colorId, i.size); return Object.assign({}, i, { stockNow: p && p.active !== false && sz ? Math.max(0, sz.stock || 0) : 0 }); }); c.requestState = requestState(o); c.doneAt = doneAtOf(o) || undefined; return c; }
  // Покупателю — без служебного: заметка магазина и история изменений видны только в панели
  function customerView(o) { const c = orderView(o); delete c.adminNote; delete c.history; delete c.fin; delete c.pushed; delete c.userId; delete c.payMismatch; return c; }

  return {
    VERIFY_MIN, VERIFY_RESEND_SEC, VERIFY_SENDS, VERIFY_TRIES, codeHash, createUser, customerView, deviceName,
    maskEmail, orderView, pendingLogins, pendingRegs, pendingResets, sendCode, sweepPending, touchDevice,
    trustedDevice, welcomeInfo, welcomePromo
  };
};
