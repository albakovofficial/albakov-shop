/* Сервер интернет-магазина. Без внешних зависимостей: нужен только Node.js 18+.
   Запуск: node server.js   (переменные окружения — см. .env.example) */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Pricing = require('./public/js/pricing.js');
const SEED = require('./public/js/seed.js');
const Mail = require('./public/js/mail.js');
const smtp = require('./lib/smtp.js');
const Store = require('./lib/db.js');

loadEnv(path.join(__dirname, '.env'));
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const COOKIE_SECURE = PUBLIC_URL.startsWith('https://');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'albakov.sqlite');
const JSON_FILE = path.join(DATA_DIR, 'db.json'); // прежний формат хранения (до ALBAKOV11) — переносится в базу сам
const COLLECTIONS = ['categories', 'sizeCharts', 'products', 'promotions', 'promocodes', 'pages'];

/* ---------------- Хранилище ---------------- */
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const store = Store.open(DB_FILE);
let db = store.load();
if (!db && fs.existsSync(JSON_FILE)) {
  // Перенос из файла db.json: всё попадает в SQLite, старый файл остаётся рядом как копия
  db = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  store.save(db);
  fs.renameSync(JSON_FILE, JSON_FILE + '.imported-' + new Date().toISOString().slice(0, 10));
  console.log('Данные перенесены из db.json в базу SQLite: ' + DB_FILE);
}
if (!db) {
  db = JSON.parse(JSON.stringify(SEED));
  db.sessions = {};
  db.secrets = {};
  db.orderSeq = 100000;
}
db.sessions = db.sessions || {};
Pricing.migrateData(db, SEED); // цвета товаров, логотип — для данных, созданных до обновления
db.secrets = db.secrets || {};
db.waitlist = db.waitlist || [];
if (!db.secrets.adminHash) {
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('base64url');
  db.secrets.adminHash = hashPassword(pw);
  if (!process.env.ADMIN_PASSWORD) console.log('\n  Пароль администратора: ' + pw + '\n  Смените его в разделе «Настройки» панели управления.\n');
}
// Изменения копятся 50 мс и пишутся в базу одной транзакцией
let saveTimer = null;
function flush() {
  clearTimeout(saveTimer); saveTimer = null;
  try { store.save(db); } catch (e) { console.error('Не удалось сохранить данные в базу:', e.message); setTimeout(save, 1000); }
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 50); }
flush();

/* ---------------- Утилиты ---------------- */
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pw), salt, 64).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  return safeEqual(crypto.scryptSync(String(pw), salt, 64), Buffer.from(hash, 'hex'));
}
// Сравнение секретов без утечки по времени; разная длина — просто «не равно», без исключения
function safeEqual(a, b) {
  a = Buffer.isBuffer(a) ? a : Buffer.from(String(a || ''));
  b = Buffer.isBuffer(b) ? b : Buffer.from(String(b || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return null; } };
const uid = (p) => (p || '') + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const normPhone = (p) => { let d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && (d[0] === '8' || d[0] === '7')) d = '7' + d.slice(1); if (d.length === 10) d = '7' + d; return d; };
const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
// bonusNews — свежие начисления, о которых покупатель ещё не знает (показываем уведомление)
const publicUser = (u) => u && { id: u.id, firstName: u.firstName, lastName: u.lastName, phone: u.phone, email: u.email, createdAt: u.createdAt, bonus: u.bonus || 0,
  bonusNews: (u.bonusLog || []).filter((e) => !e.seen).slice(0, 5).map((e) => ({ id: e.id, amount: e.amount, type: e.type, orderNumber: e.orderNumber || '', note: e.note || '' })) };
const userOf = (order) => order && order.userId ? db.users.find((u) => u.id === order.userId) || null : null;
// Бонусы заказа после смены статуса или оплаты (начислить, вернуть, забрать)
function syncBonus(order) { return Pricing.syncOrderBonus(order, userOf(order), db.settings, uid); }
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
// Очень длинный пароль заставил бы сервер долго считать хэш — ограничиваем
const pwOk = (pw) => typeof pw === 'string' && pw.length <= 200;

// ЮKassa подключена: выбран провайдер и есть оба ключа
function payReady() { const p = db.settings.payment || {}, k = yk(); return p.provider === 'yookassa' && !!(k.shopId && k.secret); }
// Хиты продаж: товары, которых больше всего купили за 90 дней (без отменённых и неоплаченных онлайн-заказов).
// Наружу уходит только порядок товаров — без количества продаж. Выключается в «Главной странице» панели.
const HITS_DAYS = 90;
function hitIds() {
  const home = (db.settings && db.settings.home) || {};
  if (home.hitsAuto === false) return [];
  const since = Date.now() - HITS_DAYS * 864e5, sold = new Map();
  for (const o of db.orders) {
    if (o.status === 'canceled' || Date.parse(o.createdAt) < since) continue;
    if (o.payment && o.payment.method === 'online' && o.payment.status !== 'paid') continue;
    for (const i of o.items || []) sold.set(i.productId, (sold.get(i.productId) || 0) + (Number(i.qty) || 0));
  }
  const live = new Set(db.products.filter((p) => p.active !== false).map((p) => p.id));
  return [...sold].filter(([id, n]) => n > 0 && live.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([id]) => id);
}
function publicState() {
  return {
    hits: hitIds(),
    payReady: payReady(),
    mailReady: mailReady(),
    settings: db.settings,
    categories: db.categories,
    sizeCharts: db.sizeCharts,
    products: db.products.filter((p) => p.active !== false),
    promotions: db.promotions,
    pages: db.pages
  };
}

/* ---------------- Сессии ---------------- */
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = safeDecode(c.slice(i + 1).trim()) || ''; });
  return out;
}
function setCookie(res, name, value, maxAgeSec) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (COOKIE_SECURE) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', prev.concat(parts.join('; ')));
}
function createSession(res, kind, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const days = kind === 'admin' ? 7 : 60;
  db.sessions[token] = { kind, userId: userId || null, exp: Date.now() + days * 864e5 };
  setCookie(res, kind === 'admin' ? 'asid' : 'sid', token, days * 86400);
  save();
}
function getSession(req, kind) {
  const token = parseCookies(req)[kind === 'admin' ? 'asid' : 'sid'];
  const s = token && db.sessions[token];
  if (!s || s.kind !== kind || s.exp < Date.now()) return null;
  return Object.assign({ token }, s);
}
function currentUser(req) { const s = getSession(req, 'user'); return s ? db.users.find((u) => u.id === s.userId) || null : null; }
function requireAdmin(req) { if (!getSession(req, 'admin')) fail(401, 'Войдите в панель управления'); }
setInterval(() => {
  const now = Date.now(); let ch = false;
  for (const k in db.sessions) if (db.sessions[k].exp < now) { delete db.sessions[k]; ch = true; }
  if (ch) save();
  for (const [k, a] of attempts) if (now - a.t > 15 * 60e3) attempts.delete(k);
}, 36e5).unref();

/* Защита от подбора пароля */
const attempts = new Map();
// Старые счётчики попыток убираем, чтобы память не росла от потока разных адресов
setInterval(() => { const old = Date.now() - 15 * 60e3; for (const [k, a] of attempts) if (a.t < old) attempts.delete(k); }, 10 * 60e3).unref();
// Адрес покупателя. Заголовку X-Forwarded-For верим, только если запрос пришёл от своего nginx на этом же сервере
function clientIp(req) {
  const direct = req.socket.remoteAddress || '';
  const local = direct === '127.0.0.1' || direct === '::1' || direct === '::ffff:127.0.0.1';
  return (local && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0] : direct).trim();
}
function throttle(req, key, limit) {
  const ip = clientIp(req);
  const k = key + '|' + ip, now = Date.now(), a = attempts.get(k) || { n: 0, t: now };
  if (now - a.t > 15 * 60e3) { a.n = 0; a.t = now; }
  a.n++; attempts.set(k, a);
  if (a.n > (limit || 10)) fail(429, 'Слишком много попыток. Попробуйте через 15 минут.');
  return k;
}
// Удачный вход обнуляет счётчик: блокируются только неверные пароли, а не частые входы
function throttleOk(k) { attempts.delete(k); }

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
/* Позиции чека: скидка по промокоду распределяется по товарам, сумма позиций = сумма платежа */
function receiptItems(order, vatCode) {
  const lines = order.items.map((i) => ({ name: `${i.name}${i.color ? ', ' + i.color : ''}, размер ${i.size}`.slice(0, 128), qty: i.qty, totalK: i.price * i.qty * 100 }));
  const subK = lines.reduce((s, l) => s + l.totalK, 0);
  // Скидка по промокоду и оплата бонусами распределяются по товарам; если бонусов больше суммы товаров — остаток уменьшает доставку
  const bonusK = (order.bonusUsed || 0) * 100, goodsBonusK = Math.min(bonusK, Math.max(0, subK - order.promoDiscount * 100));
  let discK = order.promoDiscount * 100 + goodsBonusK, left = discK;
  lines.forEach((l, idx) => {
    const share = idx === lines.length - 1 ? left : Math.min(left, Math.round(discK * l.totalK / (subK || 1)));
    left -= share; l.totalK -= share;
  });
  const out = [];
  const push = (name, qty, unitK, subject) => out.push({ description: name, quantity: qty.toFixed(2), amount: { value: rub(unitK), currency: 'RUB' }, vat_code: vatCode, payment_mode: 'full_payment', payment_subject: subject });
  lines.forEach((l) => {
    const unit = Math.floor(l.totalK / l.qty), rest = l.totalK - unit * l.qty;
    if (rest === 0) push(l.name, l.qty, unit, 'commodity');
    else { if (l.qty > 1) push(l.name, l.qty - 1, unit, 'commodity'); push(l.name, 1, unit + rest, 'commodity'); }
  });
  const delivK = order.delivery ? order.delivery.price * 100 - (bonusK - goodsBonusK) : 0;
  if (delivK > 0) push('Доставка: ' + order.delivery.name, 1, delivK, 'service');
  return out.filter((x) => Number(x.amount.value) > 0);
}
async function createPayment(order) {
  const { cfg } = yk();
  const body = {
    amount: { value: rub(order.total * 100), currency: 'RUB' },
    capture: true,
    confirmation: { type: 'redirect', return_url: `${PUBLIC_URL}/#/order/${order.id}` },
    description: `Заказ № ${order.number}`,
    metadata: { orderId: order.id }
  };
  if (cfg.sendReceipt) {
    body.receipt = {
      customer: { email: order.customer.email, phone: order.customer.phone, full_name: `${order.customer.lastName} ${order.customer.firstName}` },
      items: receiptItems(order, Number(cfg.vatCode) || 1),
      tax_system_code: Number(cfg.taxSystem) || 1
    };
  }
  const p = await ykRequest('POST', '/payments', body, order.id);
  order.payment.providerId = p.id;
  order.payUrl = p.confirmation && p.confirmation.confirmation_url;
  return order.payUrl;
}
function applyPayment(order, p) {
  if (!order || !p) return;
  if (p.status === 'succeeded' && p.paid) { if (order.payment.status !== 'paid') { order.payment.status = 'paid'; sendOrderMails(order); } }
  else if (p.status === 'canceled') {
    // оплата не прошла: возвращаем товар и промокод, если заказ ещё не был отменён вручную
    if (order.status !== 'canceled') {
      restock(order);
      const pc = order.promoCode && db.promocodes.find((x) => x.code === order.promoCode);
      if (pc) pc.used = Math.max(0, (pc.used || 0) - 1);
      processWaitlist().catch(() => {});
    }
    order.payment.status = 'canceled'; order.status = 'canceled';
  }
  syncBonus(order);
  save();
}
async function syncPayment(order) {
  if (order.payment.method !== 'online' || order.payment.status !== 'pending' || !order.payment.providerId) return;
  try { applyPayment(order, await ykRequest('GET', '/payments/' + order.payment.providerId)); } catch (e) { /* не критично */ }
}
function sizeEntry(productId, colorId, size) {
  const p = db.products.find((x) => x.id === productId); if (!p) return null;
  const c = Pricing.colorOf(p, colorId);
  return c && (c.sizes || []).find((x) => x.size === size) || null;
}
function restock(order) {
  order.items.forEach((i) => {
    const s = sizeEntry(i.productId, i.colorId, i.size);
    if (s) s.stock += i.qty;
  });
}

/* ---------------- Заказы ---------------- */
function usedByCustomer(code, user, email, phone) {
  return db.orders.some((o) => o.promoCode && o.promoCode.toUpperCase() === String(code).toUpperCase() && o.status !== 'canceled' &&
    ((user && o.userId === user.id) || (email && o.customer.email === email) || (phone && o.customer.phone === phone)));
}
function quote(req, b) {
  const user = currentUser(req), c = b.contact || {};
  const email = String(c.email || '').trim().toLowerCase(), phone = normPhone(c.phone);
  return Pricing.calcCart(Array.isArray(b.lines) ? b.lines.slice(0, 100) : [], db, {
    code: b.code ? String(b.code).slice(0, 40) : '', deliveryId: b.deliveryId, registered: !!user,
    hasOrders: !!user && db.orders.some((o) => o.userId === user.id && o.status !== 'canceled'),
    usedByCustomer: b.code ? usedByCustomer(b.code, user, email, phone) : false,
    bonusBalance: user ? user.bonus || 0 : 0, useBonus: !!(user && b.useBonus)
  });
}
async function placeOrder(req, b) {
  const user = currentUser(req), c = b.customer || {};
  const customer = { firstName: String(c.firstName || '').trim().slice(0, 60), lastName: String(c.lastName || '').trim().slice(0, 60), phone: normPhone(c.phone), email: String(c.email || '').trim().toLowerCase().slice(0, 120) };
  if (!customer.firstName || !customer.lastName) fail(400, 'Укажите имя и фамилию');
  if (customer.phone.length !== 11) fail(400, 'Проверьте номер телефона');
  if (!validEmail(customer.email)) fail(400, 'Проверьте электронную почту');
  if (!b.consent) fail(400, 'Нужно согласие на обработку персональных данных');
  const pay = db.settings.payment || {};
  const method = b.payment === 'online' ? 'online' : 'cod';
  if ((method === 'online' && !pay.online) || (method === 'cod' && !pay.cod)) fail(400, 'Этот способ оплаты недоступен');
  // Без подключённой ЮKassa заказ «с онлайн-оплатой» повис бы неоплаченным — не принимаем такой
  if (method === 'online' && !payReady()) fail(400, 'Онлайн-оплата пока не подключена. Выберите оплату при получении.');
  const q = quote(req, { lines: b.lines, code: b.code, deliveryId: b.deliveryId, contact: customer, useBonus: b.useBonus });
  if (!q.lines.length) fail(400, 'Корзина пуста');
  if (!q.delivery) fail(400, 'Выберите способ доставки');
  const bad = q.lines.find((l) => l.problem); if (bad) fail(409, `${bad.name}: ${bad.problem.toLowerCase()}`);
  if (b.code && !(q.promo && q.promo.ok)) fail(400, q.promo ? q.promo.message : 'Промокод не применён');
  const m = db.settings.delivery.methods.find((x) => x.id === b.deliveryId);
  if (m && m.needsAddress !== false && (!String(b.city || '').trim() || !String(b.address || '').trim())) fail(400, 'Укажите город и адрес доставки');

  q.lines.forEach((l) => { sizeEntry(l.productId, l.colorId, l.size).stock -= l.qty; });
  if (q.promo && q.promo.ok) { const pc = db.promocodes.find((x) => x.code === q.promo.code); if (pc) pc.used = (pc.used || 0) + 1; }
  db.orderSeq = (db.orderSeq || 100000) + 1;
  const order = {
    id: uid('o'), number: String(db.orderSeq), token: crypto.randomBytes(16).toString('hex'), createdAt: new Date().toISOString(), userId: user ? user.id : null, customer, consentAt: new Date().toISOString(),
    items: q.lines.map((l) => ({ productId: l.productId, slug: l.slug, name: l.name, colorId: l.colorId, color: l.color, size: l.size, qty: l.qty, price: l.price, oldPrice: l.oldPrice, image: l.image, art: l.art })),
    subtotal: q.subtotal, saleDiscount: q.saleDiscount, promoCode: q.promo && q.promo.ok ? q.promo.code : '', promoDiscount: q.promoDiscount,
    delivery: Object.assign({}, q.delivery, { city: String(b.city || '').slice(0, 100), address: String(b.address || '').slice(0, 300) }), comment: String(b.comment || '').slice(0, 1000),
    total: q.total, payment: { method, status: 'pending', provider: method === 'online' ? pay.provider : null }, status: 'new',
    bonusUsed: q.bonusUsed, bonusEarn: user ? q.bonusEarn : 0
  };
  // Весь заказ оплачен бонусами — платить деньгами нечего
  if (order.total === 0) order.payment = { method: 'bonus', status: 'paid', provider: null };
  db.orders.push(order);
  const spent = q.bonusUsed ? Pricing.bonusMove(user, -q.bonusUsed, 'spend', order, uid) : null;
  let payUrl = null;
  if (order.payment.method === 'online' && pay.provider === 'yookassa') {
    try { payUrl = await createPayment(order); }
    catch (e) {
      restock(order); db.orders = db.orders.filter((o) => o.id !== order.id);
      if (order.promoCode) { const pc = db.promocodes.find((x) => x.code === order.promoCode); if (pc) pc.used--; }
      if (spent) { user.bonus += q.bonusUsed; user.bonusLog = user.bonusLog.filter((x) => x !== spent); }
      save(); throw e;
    }
  }
  syncBonus(order);
  save();
  if (order.payment.method !== 'online') sendOrderMails(order); // при онлайн-оплате письмо уйдёт после оплаты
  console.log(`Новый заказ № ${order.number} на ${order.total} ₽`);
  return { order: orderView(order), token: order.token, payUrl, user: publicUser(user) };
}
/* Отправка письма: картинки с нашего сайта (логотип, фото товаров) вкладываем в само письмо,
   иначе Mail.ru, Яндекс и другие прячут их, пока получатель не нажмёт «Показать изображения» */
const IMG_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
function embedImages(html) {
  const inline = [], seen = new Map(); let total = 0;
  const base = PUBLIC_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out = String(html || '').replace(new RegExp('src="' + base + '/([^"?#]+)"', 'g'), (m, rel) => {
    try {
      rel = decodeURIComponent(rel.replace(/&amp;/g, '&'));
      if (seen.has(rel)) return 'src="cid:' + seen.get(rel) + '"';
      const file = path.normalize(path.join(PUBLIC_DIR, rel)), type = IMG_TYPES[path.extname(file).toLowerCase()];
      if (!type || !file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file)) return m;
      const size = fs.statSync(file).size;
      if (size > 700 * 1024 || total + size > 2 * 1024 * 1024) return m; // слишком тяжёлое — оставляем ссылкой
      const cid = 'img' + inline.length + '.' + crypto.randomBytes(6).toString('hex') + '@albakov';
      inline.push({ cid, type, filename: path.basename(file), content: fs.readFileSync(file) }); total += size; seen.set(rel, cid);
      return 'src="cid:' + cid + '"';
    } catch (e) { return m; }
  });
  return { html: out, inline };
}
function sendMail(msg) { const e = embedImages(msg.html); return smtp.send(mailCfg(), Object.assign({}, msg, e)); }

/* ---------------- Письма о заказе: покупателю и магазину ---------------- */
function sendOrderMails(order) {
  if (!mailReady()) return;
  const pay = db.settings.payment || {}, cs = db.settings.contacts || {};
  const m = order.payment.method;
  const base = {
    store: db.settings.storeName, logo: brandLogo(), order: Object.assign({}, order, { items: order.items.map((i) => Object.assign({}, i, { image: absUrl(i.image) })) }),
    money: Pricing.format, payLabel: m === 'bonus' ? 'оплачено бонусами' : m === 'online' ? (order.payment.status === 'paid' ? 'оплачено онлайн' : 'онлайн') : (pay.codLabel || 'при получении'),
    contacts: [cs.phone, cs.email].filter(Boolean).join(' · ')
  };
  const jobs = [];
  const mc = Mail.renderOrder(Object.assign({ kind: 'customer', url: `${PUBLIC_URL}/#/order/${order.id}` }, base));
  jobs.push(sendMail({ to: order.customer.email, subject: mc.subject, html: mc.html, text: mc.text }).then(() => { order.mailedAt = new Date().toISOString(); save(); }));
  const shopTo = cs.email || mailCfg().fromEmail;
  if (shopTo) {
    const ms = Mail.renderOrder(Object.assign({ kind: 'shop', url: `${PUBLIC_URL}/#/admin?s=orders&id=${order.id}` }, base));
    jobs.push(sendMail({ to: shopTo, subject: ms.subject, html: ms.html, text: ms.text }));
  }
  Promise.allSettled(jobs).then((r) => r.forEach((x) => { if (x.status === 'rejected') console.error('Письмо о заказе не отправлено:', x.reason && x.reason.message); }));
}

/* ---------------- Уведомления о поступлении ---------------- */
function mailCfg() {
  const m = db.secrets.mail || {};
  return { host: process.env.SMTP_HOST || m.host || '', port: Number(process.env.SMTP_PORT || m.port || 465), security: process.env.SMTP_SECURITY || m.security || 'ssl', user: process.env.SMTP_USER || m.user || '', pass: process.env.SMTP_PASS || m.pass || '', fromEmail: process.env.SMTP_FROM || m.fromEmail || m.user || '', fromName: m.fromName || db.settings.storeName };
}
const mailReady = () => { const c = mailCfg(); return !!(c.host && c.fromEmail); };
const absUrl = (u) => !u ? '' : /^https?:/.test(u) ? u : /^data:/.test(u) ? '' : PUBLIC_URL + '/' + String(u).replace(/^\//, '');
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
    url: `${PUBLIC_URL}/#/product/${p.slug}?color=${encodeURIComponent(c.id)}`, image: absUrl((c.images || [])[0]),
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
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#100f0e;color:#ece6dc;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box"><div style="max-width:440px;text-align:center"><div style="font-family:Georgia,serif;letter-spacing:8px;font-size:24px;margin-bottom:32px">${s.toUpperCase()}</div><h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 14px">${title}</h1><p style="color:#9a9286;line-height:1.6">${text}</p><a href="${PUBLIC_URL}/" style="display:inline-block;margin-top:20px;color:#100f0e;background:#ece6dc;padding:14px 26px;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase">На сайт</a></div></body></html>`;
}

/* ---------------- Регистрация с подтверждением почты ---------------- */
// Пока почта не подтверждена, аккаунта нет: данные формы ждут в памяти сервера 15 минут.
// Код из 6 цифр храним только в виде отпечатка; 5 неверных попыток — нужен новый код;
// новый код — не чаще раза в минуту и не больше 5 раз. Если почта магазина не настроена,
// регистрация работает как раньше — сразу, без кода.
const VERIFY_MIN = 15, VERIFY_TRIES = 5, VERIFY_RESEND_SEC = 60, VERIFY_SENDS = 5;
const pendingRegs = new Map();
const codeHash = (id, code) => crypto.createHash('sha256').update(id + ':' + code).digest('hex');
function sweepPending() { const now = Date.now(); for (const [k, r] of pendingRegs) if (r.exp < now) pendingRegs.delete(k); }
const maskEmail = (e) => { const [n, d] = String(e).split('@'); return (n.length <= 2 ? n[0] + '*' : n.slice(0, 2) + '*'.repeat(Math.min(6, n.length - 2))) + '@' + d; };
async function sendCode(r) {
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  r.code = codeHash(r.id, code); r.tries = 0; r.sentAt = Date.now(); r.sends = (r.sends || 0) + 1; r.exp = Date.now() + VERIFY_MIN * 60e3;
  const m = Mail.renderCode({ store: db.settings.storeName, logo: brandLogo(), code, minutes: VERIFY_MIN, name: r.f.firstName });
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

function orderView(o) { const c = Object.assign({}, o); delete c.token; return c; }

/* ---------------- Маршруты API ---------------- */
async function api(req, res, url, body) {
  const p = url.pathname.replace(/^\/api\//, '').split('/').map(safeDecode);
  if (p.includes(null)) fail(400, 'Неверный адрес');
  const M = req.method;
  const user = () => currentUser(req);

  if (p[0] === 'state' && M === 'GET') return { data: publicState(), user: publicUser(user()), isAdmin: !!getSession(req, 'admin') };

  if (p[0] === 'auth') {
    if (p[1] === 'register' && M === 'POST') {
      throttle(req, 'reg');
      const f = { firstName: String(body.firstName || '').trim().slice(0, 60), lastName: String(body.lastName || '').trim().slice(0, 60), phone: normPhone(body.phone), email: String(body.email || '').trim().toLowerCase().slice(0, 120) };
      if (!f.firstName || !f.lastName) fail(400, 'Укажите имя и фамилию');
      if (f.phone.length !== 11) fail(400, 'Укажите номер телефона полностью');
      if (!validEmail(f.email)) fail(400, 'Проверьте электронную почту');
      if (String(body.password || '').length < 6) fail(400, 'Пароль должен быть не короче 6 символов');
      if (!pwOk(body.password)) fail(400, 'Слишком длинный пароль');
      if (!body.consent) fail(400, 'Нужно согласие на обработку персональных данных');
      if (db.users.some((u) => u.email === f.email)) fail(409, 'Пользователь с такой почтой уже зарегистрирован');
      if (db.users.some((u) => u.phone === f.phone)) fail(409, 'Пользователь с таким телефоном уже зарегистрирован');
      // согласие на обработку персональных данных: когда дано и с какого адреса — для подтверждения по закону
      const consent = { consentAt: new Date().toISOString(), consentIp: clientIp(req) };
      if (!mailReady()) { const u = createUser(res, f, hashPassword(body.password), consent); return { user: publicUser(u), welcome: welcomeInfo() }; }
      sweepPending();
      for (const [k, r] of pendingRegs) if (r.f.email === f.email) pendingRegs.delete(k);
      if (pendingRegs.size > 2000) fail(429, 'Слишком много регистраций. Попробуйте через несколько минут');
      const r = { id: crypto.randomBytes(16).toString('hex'), f, hash: hashPassword(body.password), consent };
      await sendCode(r);
      pendingRegs.set(r.id, r);
      return { pending: { id: r.id, email: maskEmail(f.email), minutes: VERIFY_MIN, resendIn: VERIFY_RESEND_SEC } };
    }
    if (p[1] === 'verify' && M === 'POST') {
      throttle(req, 'verify', 40);
      sweepPending();
      const r = pendingRegs.get(String(body.id || ''));
      if (!r) fail(410, 'Код устарел. Зарегистрируйтесь ещё раз — мы пришлём новый');
      const code = String(body.code || '').replace(/\D/g, '');
      if (code.length !== 6) fail(400, 'Введите все 6 цифр кода');
      if (r.tries >= VERIFY_TRIES) fail(429, 'Слишком много неверных попыток. Запросите новый код');
      if (!safeEqual(codeHash(r.id, code), r.code)) {
        r.tries++;
        const left = VERIFY_TRIES - r.tries;
        fail(400, left > 0 ? 'Неверный код. Осталось попыток: ' + left : 'Слишком много неверных попыток. Запросите новый код');
      }
      pendingRegs.delete(r.id);
      const u = createUser(res, r.f, r.hash, Object.assign({ emailVerifiedAt: new Date().toISOString() }, r.consent));
      return { user: publicUser(u), welcome: welcomeInfo() };
    }
    if (p[1] === 'resend' && M === 'POST') {
      throttle(req, 'resend', 20);
      sweepPending();
      const r = pendingRegs.get(String(body.id || ''));
      if (!r) fail(410, 'Код устарел. Зарегистрируйтесь ещё раз — мы пришлём новый');
      const wait = Math.ceil((r.sentAt + VERIFY_RESEND_SEC * 1000 - Date.now()) / 1000);
      if (wait > 0) fail(429, 'Новый код можно запросить через ' + wait + ' с');
      if (r.sends >= VERIFY_SENDS) fail(429, 'Код уже отправлялся несколько раз. Проверьте папку «Спам» или зарегистрируйтесь заново');
      await sendCode(r);
      return { resendIn: VERIFY_RESEND_SEC };
    }
    if (p[1] === 'login' && M === 'POST') {
      const tk = throttle(req, 'login');
      const l = String(body.login || '').trim().toLowerCase(), ph = normPhone(l);
      const u = db.users.find((x) => x.email === l || (ph.length === 11 && x.phone === ph));
      if (!u || !pwOk(body.password) || !checkPassword(body.password, u.hash)) fail(401, 'Неверный логин или пароль');
      throttleOk(tk); createSession(res, 'user', u.id);
      return { user: publicUser(u) };
    }
    if (p[1] === 'logout' && M === 'POST') { const s = getSession(req, 'user'); if (s) { delete db.sessions[s.token]; save(); } setCookie(res, 'sid', '', 0); return {}; }
  }

  if (p[0] === 'me' && M === 'GET') {
    const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
    return { user: publicUser(u), bonusLog: (u.bonusLog || []).slice(0, 100) };
  }
  if (p[0] === 'me' && p[1] === 'bonus-seen' && M === 'POST') {
    const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
    (u.bonusLog || []).forEach((e) => { e.seen = true; }); save();
    return { user: publicUser(u) };
  }
  if (p[0] === 'me' && !p[1] && M === 'PUT') {
    const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
    const email = String(body.email || '').trim().toLowerCase(), phone = normPhone(body.phone);
    if (!String(body.firstName || '').trim() || !String(body.lastName || '').trim()) fail(400, 'Укажите имя и фамилию');
    if (phone.length !== 11) fail(400, 'Проверьте номер телефона');
    if (!validEmail(email)) fail(400, 'Проверьте электронную почту');
    if (db.users.some((x) => x.id !== u.id && x.email === email)) fail(409, 'Эта почта уже используется');
    if (db.users.some((x) => x.id !== u.id && x.phone === phone)) fail(409, 'Этот телефон уже используется');
    Object.assign(u, { firstName: body.firstName.trim().slice(0, 60), lastName: body.lastName.trim().slice(0, 60), email, phone });
    if (body.newPassword) { if (String(body.newPassword).length < 6) fail(400, 'Пароль должен быть не короче 6 символов'); if (!pwOk(body.newPassword)) fail(400, 'Слишком длинный пароль'); u.hash = hashPassword(body.newPassword); }
    save(); return { user: publicUser(u) };
  }

  if (p[0] === 'orders') {
    if (!p[1] && M === 'GET') { const u = user(); if (!u) fail(401, 'Войдите в личный кабинет'); return { orders: db.orders.filter((o) => o.userId === u.id).reverse().map(orderView) }; }
    if (!p[1] && M === 'POST') { throttle(req, 'order', 20); return await placeOrder(req, body); }
    if (p[1] && M === 'GET') {
      const o = db.orders.find((x) => x.id === p[1]); const u = user();
      const t = url.searchParams.get('t') || '';
      const allowed = o && ((u && o.userId === u.id) || safeEqual(t, o.token) || getSession(req, 'admin'));
      if (!allowed) fail(404, 'Заказ не найден');
      await syncPayment(o);
      return { order: orderView(o) };
    }
  }

  if (p[0] === 'quote' && M === 'POST') return { quote: quote(req, body) };

  if (p[0] === 'notify' && !p[1] && M === 'POST') return subscribe(req, body);

  if (p[0] === 'payments' && p[1] === 'yookassa' && M === 'POST') {
    // Уведомление ЮKassa. Статус не берём из тела запроса, а перепроверяем через API.
    const id = body && body.object && body.object.id;
    const order = id && db.orders.find((o) => o.payment.providerId === id);
    if (order) { try { applyPayment(order, await ykRequest('GET', '/payments/' + id)); } catch (e) { console.error(e.message); } }
    return {};
  }

  /* ----- Админ ----- */
  if (p[0] === 'admin') {
    if (p[1] === 'login' && M === 'POST') {
      const tk = throttle(req, 'admin');
      if (!pwOk(body.password) || !checkPassword(body.password, db.secrets.adminHash)) fail(401, 'Неверный пароль');
      throttleOk(tk); createSession(res, 'admin'); return {};
    }
    if (p[1] === 'logout' && M === 'POST') { const s = getSession(req, 'admin'); if (s) { delete db.sessions[s.token]; save(); } setCookie(res, 'asid', '', 0); return {}; }
    requireAdmin(req);
    if (p[1] === 'data' && M === 'GET') {
      const d = {}; for (const k of ['settings', ...COLLECTIONS, 'orders']) d[k] = db[k];
      d.orders = db.orders.map(orderView); d.users = db.users.map((u) => Object.assign(publicUser(u), { bonusLog: (u.bonusLog || []).slice(0, 100) }));
      d.waitlist = db.waitlist.map((w) => { const c = Object.assign({}, w); delete c.token; return c; });
      // Состояние ночных резервных копий (файл пишет tools/backup.js)
      try { d.backup = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'backup-status.json'), 'utf8')); } catch (e) { d.backup = null; }
      // Автообновление из GitHub (файл пишет deploy/autoupdate.sh)
      try { d.update = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'update-status.json'), 'utf8')); } catch (e) { d.update = null; }
      return { data: d };
    }
    if (p[1] === 'health' && M === 'GET') return { health: health() };
    if (p[1] === 'password' && M === 'POST') {
      if (String(body.password || '').length < 8) fail(400, 'Пароль должен быть не короче 8 символов');
      if (!pwOk(body.password)) fail(400, 'Слишком длинный пароль');
      db.secrets.adminHash = hashPassword(body.password);
      const keep = getSession(req, 'admin').token;
      for (const k in db.sessions) if (db.sessions[k].kind === 'admin' && k !== keep) delete db.sessions[k];
      save(); return {};
    }
    if (p[1] === 'payment-secret' && M === 'POST') {
      if (typeof body.secret === 'string') { if (body.secret && !/^(live|test)_[\w-]{10,}$/.test(body.secret)) fail(400, 'Ключ должен начинаться с live_ или test_'); db.secrets.yookassaSecret = body.secret; save(); }
      const s = process.env.YOOKASSA_SECRET_KEY || db.secrets.yookassaSecret || '';
      return { hasSecret: !!s, mask: s ? s.slice(0, 5) + '…' + s.slice(-4) : '' };
    }
    if (p[1] === 'upload' && M === 'POST') {
      const m = String(body.dataUrl || '').match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
      if (!m) fail(400, 'Нужно изображение JPEG, PNG или WebP');
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 8 * 1024 * 1024) fail(400, 'Файл больше 8 МБ');
      const magic = { jpeg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47], webp: [0x52, 0x49, 0x46, 0x46] }[m[1]];
      if (!magic.every((b, i) => buf[i] === b) || (m[1] === 'webp' && buf.toString('latin1', 8, 12) !== 'WEBP')) fail(400, 'Файл не похож на изображение');
      const name = uid('img') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
      fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
      return { url: 'uploads/' + name };
    }
    if (p[1] === 'orders' && p[2] && M === 'PATCH') {
      const o = db.orders.find((x) => x.id === p[2]); if (!o) fail(404, 'Заказ не найден');
      const statuses = ['new', 'processing', 'shipped', 'done', 'canceled'], pays = ['pending', 'paid', 'canceled', 'refunded'];
      if (body.status && statuses.includes(body.status)) {
        const pc = o.promoCode && db.promocodes.find((x) => x.code === o.promoCode);
        if (body.status === 'canceled' && o.status !== 'canceled') { restock(o); if (pc) pc.used = Math.max(0, (pc.used || 0) - 1); }
        if (body.status !== 'canceled' && o.status === 'canceled' && pc) pc.used = (pc.used || 0) + 1;
        if (o.status === 'canceled' && body.status !== 'canceled') o.items.forEach((i) => { const s = sizeEntry(i.productId, i.colorId, i.size); if (s) s.stock = Math.max(0, s.stock - i.qty); });
        o.status = body.status;
      }
      if (body.paymentStatus && pays.includes(body.paymentStatus)) o.payment.status = body.paymentStatus;
      if (typeof body.note === 'string') o.adminNote = body.note.slice(0, 2000);
      syncBonus(o);
      save(); const notify = await processWaitlist(); return { order: orderView(o), notify };
    }
    if (p[1] === 'users' && p[2] && p[3] === 'bonus' && M === 'POST') {
      // Ручная корректировка баланса: +начислить, −списать (не ниже нуля)
      const u = db.users.find((x) => x.id === p[2]); if (!u) fail(404, 'Покупатель не найден');
      let amount = Math.round(Number(body.amount) || 0);
      if (!amount || Math.abs(amount) > 10000000) fail(400, 'Укажите количество бонусов');
      if (amount < 0) amount = -Math.min(u.bonus || 0, -amount);
      if (!amount) fail(400, 'На счёте покупателя нет бонусов');
      Pricing.bonusMove(u, amount, 'manual', null, uid, String(body.note || '').trim());
      save(); return { user: Object.assign(publicUser(u), { bonusLog: (u.bonusLog || []).slice(0, 100) }) };
    }
    if (p[1] === 'waitlist') {
      if (p[2] === 'send' && M === 'POST') return { notify: await processWaitlist() };
      if (p[2] && M === 'DELETE') { db.waitlist = db.waitlist.filter((w) => w.id !== p[2]); save(); return {}; }
    }
    if (p[1] === 'mail') {
      if (!p[2] && M === 'GET') { const c = mailCfg(); return { mail: { host: c.host, port: c.port, security: c.security, user: c.user, fromEmail: c.fromEmail, fromName: (db.secrets.mail || {}).fromName || '', hasPass: !!c.pass, ready: mailReady() } }; }
      if (!p[2] && M === 'POST') {
        const m = body.mail || {}, prev = db.secrets.mail || {};
        if (m.fromEmail && !validEmail(m.fromEmail)) fail(400, 'Проверьте адрес отправителя');
        db.secrets.mail = { host: String(m.host || '').trim(), port: Number(m.port) || 465, security: ['ssl', 'starttls', 'none'].includes(m.security) ? m.security : 'ssl', user: String(m.user || '').trim(), pass: m.pass ? String(m.pass) : prev.pass || '', fromEmail: String(m.fromEmail || '').trim(), fromName: String(m.fromName || '').trim() };
        save(); return { ok: true };
      }
      if (p[2] === 'test' && M === 'POST') {
        if (!mailReady()) fail(400, 'Сначала заполните и сохраните настройки почты');
        const to = String(body.to || '').trim(); if (!validEmail(to)) fail(400, 'Укажите почту, на которую отправить пример');
        const pr = db.products.find((x) => x.active !== false && x.colors && x.colors.length); if (!pr) fail(400, 'Добавьте хотя бы один товар');
        const c = pr.colors[0], ctx = notifyContext({ size: (c.sizes[0] || {}).size || '' }, pr, c);
        const m = Mail.render(ctx);
        // Ошибку почтового сервера показываем администратору как есть — по ней видно, что не так (пароль, порт, адрес)
        try { await sendMail({ to, subject: '[Пример] ' + m.subject, html: m.html, text: m.text }); }
        catch (e) { console.error('Пробное письмо не отправлено:', e.message); fail(502, e.message); }
        return {};
      }
      // Пример писем регистрации: код подтверждения и «Добро пожаловать» — чтобы увидеть их в своём ящике
      if (p[2] === 'test-account' && M === 'POST') {
        if (!mailReady()) fail(400, 'Сначала заполните и сохраните настройки почты');
        const to = String(body.to || '').trim(); if (!validEmail(to)) fail(400, 'Укажите почту, на которую отправить пример');
        const b = Pricing.bonusConf(db.settings), cs = db.settings.contacts || {};
        const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
        const mc = Mail.renderCode({ store: db.settings.storeName, logo: brandLogo(), code, minutes: VERIFY_MIN, name: '' });
        const mw = Mail.renderWelcome({ store: db.settings.storeName, logo: brandLogo(), name: '', url: PUBLIC_URL + '/', bonusPercent: b.earn ? String(b.percent).replace('.', ',') : '', promo: welcomePromo(), contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
        try {
          await sendMail({ to, subject: '[Пример] ' + mc.subject, html: mc.html, text: mc.text });
          await sendMail({ to, subject: '[Пример] ' + mw.subject, html: mw.html, text: mw.text });
        } catch (e) { console.error('Пример писем регистрации не отправлен:', e.message); fail(502, e.message); }
        return {};
      }
    }
    if (p[1] === 'settings' && M === 'PUT') {
      if (!body.value || typeof body.value !== 'object') fail(400, 'Пустые настройки');
      db.settings = body.value; save(); return {};
    }
    if (COLLECTIONS.includes(p[1])) {
      const arr = db[p[1]];
      // Удаление нескольких записей сразу (в панели — «Удалить выбранные»)
      if (p[2] === 'delete-many' && M === 'POST') {
        const ids = body.ids;
        if (!Array.isArray(ids) || !ids.length || ids.length > 5000 || ids.some((x) => typeof x !== 'string')) fail(400, 'Не выбрано, что удалить');
        const drop = new Set(ids), before = arr.length;
        db[p[1]] = arr.filter((x) => !drop.has(x.id));
        save(); return { deleted: before - db[p[1]].length };
      }
      if (!p[2] && M === 'PUT') { if (!Array.isArray(body.value)) fail(400, 'Нужен список'); if (p[1] === 'products') body.value.forEach(Pricing.migrateProduct); db[p[1]] = body.value; save(); return p[1] === 'products' ? { notify: await processWaitlist() } : {}; }
      if (p[2] && M === 'PUT') {
        const item = body.value; if (!item || item.id !== p[2]) fail(400, 'Неверные данные');
        if (p[1] === 'products') Pricing.migrateProduct(item);
        const i = arr.findIndex((x) => x.id === item.id);
        if (i === -1) arr.push(item); else arr[i] = item;
        save(); return p[1] === 'products' ? { notify: await processWaitlist() } : {};
      }
      if (p[2] && M === 'DELETE') { db[p[1]] = arr.filter((x) => x.id !== p[2]); save(); return {}; }
    }
  }
  fail(404, 'Не найдено');
}

/* Состояние магазина для панели: целостность базы, размеры, место на диске, давность копии */
function health() {
  const out = { at: new Date().toISOString(), node: process.version, uptimeH: Math.round(process.uptime() / 360) / 10, memMB: Math.round(process.memoryUsage().rss / 1048576) };
  try {
    flush();
    out.db = { integrity: Object.values(store.sql.prepare('PRAGMA quick_check').get())[0] };
    const size = (f) => { try { return fs.statSync(f).size; } catch (e) { return 0; } };
    out.db.sizeMB = Math.round((size(DB_FILE) + size(DB_FILE + '-wal')) / 10485.76) / 100;
    out.db.counts = {};
    for (const r of store.sql.prepare('SELECT coll, COUNT(*) AS n FROM records GROUP BY coll').all()) out.db.counts[r.coll] = r.n;
  } catch (e) { out.db = { integrity: 'ошибка: ' + e.message }; }
  try { const st = fs.statfsSync(DATA_DIR); out.disk = { freeGB: Math.round(st.bavail * st.bsize / 1e8) / 10, totalGB: Math.round(st.blocks * st.bsize / 1e8) / 10 }; } catch (e) {}
  try { let n = 0, b = 0; for (const f of fs.readdirSync(UPLOAD_DIR)) { const st = fs.statSync(path.join(UPLOAD_DIR, f)); if (st.isFile()) { n++; b += st.size; } } out.uploads = { files: n, sizeMB: Math.round(b / 10485.76) / 100 }; } catch (e) {}
  out.mail = mailReady(); out.pay = payReady(); out.https = COOKIE_SECURE; out.publicUrl = PUBLIC_URL;
  return out;
}

/* ---------------- HTTP ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8' };
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Слишком большой запрос')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new HttpError(400, 'Неверный формат данных')); } });
    req.on('error', reject);
  });
}
function send(res, status, obj) {
  const b = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(b);
}
function serveStatic(req, res, pathname) {
  const rel = safeDecode(pathname);
  if (rel === null || rel.includes('\0')) { res.writeHead(400); return res.end(); }
  let file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  // Скрытые файлы (.env, .git …) и несуществующие файлы с расширением — честный 404, а не главная страница
  if (rel.split('/').some((seg) => seg.startsWith('.'))) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Не найдено'); }
  const exists = pathname !== '/' && fs.existsSync(file) && fs.statSync(file).isFile();
  if (!exists && path.extname(rel) && path.extname(rel) !== '.html') { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Не найдено'); }
  if (!exists) file = path.join(PUBLIC_DIR, 'index.html');
  const ext = path.extname(file).toLowerCase();
  // Фото товаров не меняются (новое фото — новый файл) — кэшируем надолго. Остальное браузер перепроверяет
  // при каждом заходе (ответ 304 без загрузки), поэтому новая версия сайта видна сразу после обновления
  const immutable = file.includes(path.sep + 'uploads' + path.sep) || ext === '.woff2';
  const st = fs.statSync(file), lm = new Date(Math.floor(st.mtimeMs / 1000) * 1000).toUTCString();
  if (!immutable && req.headers['if-modified-since'] === lm) { res.writeHead(304, { 'Cache-Control': 'no-cache', 'Last-Modified': lm }); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache', 'Last-Modified': lm });
  fs.createReadStream(file).on('error', () => res.end()).pipe(res);
}
// Откуда странице можно загружать скрипты, стили, шрифты и картинки. Скрипты — только свои
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:", "img-src 'self' data: blob: https:", "connect-src 'self'",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'"
].join('; ');
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (COOKIE_SECURE) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  let url;
  try { url = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
  if (url.pathname === '/api/notify/cancel' && req.method === 'GET') {
    const w = db.waitlist.find((x) => x.id === url.searchParams.get('id'));
    const t = url.searchParams.get('t') || '';
    const ok = !!(w && safeEqual(t, w.token));
    if (ok && w.status !== 'sent') { w.status = 'canceled'; save(); }
    res.writeHead(ok ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(ok ? htmlPage('Уведомление отменено', 'Мы не будем писать вам об этом товаре.') : htmlPage('Ссылка устарела', 'Это уведомление уже отменено или не найдено.'));
  }
  if (url.pathname.startsWith('/api/')) {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && !url.pathname.startsWith('/api/payments/')) {
        // Защита от CSRF: запросы, меняющие данные, принимаем только с нашего сайта
        const origin = req.headers.origin;
        if (origin && origin !== PUBLIC_URL && !origin.endsWith('//' + req.headers.host)) fail(403, 'Запрос с чужого сайта отклонён');
      }
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req, url.pathname === '/api/admin/upload' ? 12 * 1024 * 1024 : 2 * 1024 * 1024) : {};
      const out = await api(req, res, url, body || {});
      send(res, 200, Object.assign({ ok: true }, out));
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      send(res, e.status || 500, { ok: false, error: e instanceof HttpError ? e.message : 'Ошибка сервера' });
    }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  if (url.pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
    return res.end('User-agent: *\nAllow: /\nDisallow: /api/\n');
  }
  if (url.pathname === '/favicon.ico') { res.writeHead(301, { Location: '/img/favicon.png', 'Cache-Control': 'public, max-age=86400' }); return res.end(); }
  try { serveStatic(req, res, url.pathname); } catch (e) { console.error(e); if (!res.headersSent) res.writeHead(500); res.end(); }
});
// Ни одна ошибка в обработке запроса не должна останавливать магазин
process.on('unhandledRejection', (e) => console.error('Необработанная ошибка:', e));
// HOST=127.0.0.1 — сервер слушает только свой компьютер, снаружи сайт открывается через nginx
const HOST = process.env.HOST || undefined;
if (require.main === module) server.listen(PORT, HOST, () => console.log(`Магазин запущен: ${PUBLIC_URL} (порт ${PORT})`));
function shutdown() { flush(); store.close(); process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { receiptItems };
