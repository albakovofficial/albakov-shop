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
const CdekLib = require('./lib/cdek.js');

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
  db.orderSeq = 0;
}
db.sessions = db.sessions || {};
// Нумерация заказов с № 1 (13.12): один раз переводим счётчик со старого начала 100000.
// Прежние заказы сохраняют свои номера, повторов не будет — занятые номера пропускаются.
if (!db.orderNumbering) { db.orderSeq = 0; db.orderNumbering = 1; }
Pricing.migrateData(db, SEED); // цвета товаров, логотип — для данных, созданных до обновления
db.secrets = db.secrets || {};
db.waitlist = db.waitlist || [];
db.tickets = db.tickets || [];
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
  supportUnread: db.tickets.filter((t) => t.userId === u.id && t.unreadUser).length,
  bonusNews: (u.bonusLog || []).filter((e) => !e.seen).slice(0, 5).map((e) => ({ id: e.id, amount: e.amount, type: e.type, orderNumber: e.orderNumber || '', note: e.note || '' })) };
const userOf = (order) => order && order.userId ? db.users.find((u) => u.id === order.userId) || null : null;
// Бонусы заказа после смены статуса или оплаты (начислить, вернуть, забрать)
function syncBonus(order) { return Pricing.syncOrderBonus(order, userOf(order), db.settings, uid); }
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
// Очень длинный пароль заставил бы сервер долго считать хэш — ограничиваем
const pwOk = (pw) => typeof pw === 'string' && pw.length <= 200;

// ЮKassa подключена: выбран провайдер и есть оба ключа
/* СДЭК: подбор населённого пункта и пункта выдачи при оформлении */
const cdek = CdekLib.create(() => {
  const c = (db.settings && db.settings.cdek) || {};
  return { id: process.env.CDEK_CLIENT_ID || c.clientId || '', secret: process.env.CDEK_CLIENT_SECRET || db.secrets.cdekSecret || '', test: !!c.test };
});
const cdekCfg = () => (db.settings && db.settings.cdek) || {};
const CDEK_PKG = { weight: 1000, length: 30, width: 25, height: 10 };
const cdekPkg = (x) => { const d = Object.assign({}, CDEK_PKG, cdekCfg().pkg, x); const n = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0))); return { weight: n(d.weight, 50, 30000), length: n(d.length, 1, 150), width: n(d.width, 1, 150), height: n(d.height, 1, 150) }; };
// Заявка на отправление: товары с объявленной стоимостью, оплата уже получена онлайн (к оплате при получении — 0)
function cdekOrderBody(o, pkg) {
  const c = cdekCfg(), pv = o.delivery && o.delivery.pvz, dr = o.delivery && o.delivery.door;
  if ((!pv || !pv.code) && (!dr || !dr.cityCode)) fail(400, 'У заказа нет пункта выдачи или адреса из подсказок СДЭК — создайте отправление в личном кабинете СДЭК вручную');
  if (!c.shipmentPoint || !c.shipmentPoint.code) fail(400, 'Укажите в «Оплата и доставка» пункт СДЭК, куда вы сдаёте посылки');
  const paid = o.payment.status === 'paid' || o.payment.method === 'bonus';
  if (!paid && o.payment.method === 'cod' && pv && pv.cod === false) fail(400, 'Покупатель выбрал пункт без оплаты при получении — свяжитесь с ним или примите оплату онлайн');
  // Оплата при получении: СДЭК возьмёт с покупателя ровно сумму заказа — цену каждой вещи со скидками и бонусами плюс доставку
  const net = netLines(o);
  const items = [];
  o.items.forEach((it, idx) => {
    const qty = it.qty - (it.refundedQty || 0); if (qty <= 0) return;
    const lineK = Math.round(net.lines[idx].totalK * qty / it.qty), unit = Math.floor(lineK / qty), rest = lineK - unit * qty;
    const add = (q, payK, suffix) => items.push({ i: it, qty: q, payK, suffix });
    if (paid || rest === 0) add(qty, paid ? 0 : unit, '');
    else { if (qty > 1) add(qty - 1, unit, '-a'); add(1, unit + rest, '-b'); }
  });
  if (!items.length) fail(400, 'В заказе не осталось товаров для отправки');
  // вес каждой вещи — из карточки товара (или поровну, если не указан), но не больше веса посылки
  const count = items.reduce((s, x) => s + x.qty, 0), even = Math.max(1, Math.floor(pkg.weight / count));
  const prodW = (x) => { const pr = db.products.find((p) => p.id === x.i.productId); return pr && Number(pr.weight) > 0 ? Math.round(Number(pr.weight)) : 0; };
  const known = items.reduce((s, x) => s + prodW(x) * x.qty, 0);
  const unitWOf = (x) => (known > 0 && known <= pkg.weight ? prodW(x) || Math.max(1, Math.floor((pkg.weight - known) / Math.max(1, items.filter((y) => !prodW(y)).reduce((s, y) => s + y.qty, 0)))) : even);
  const services = [];
  if (c.services && c.services.partDeliv) services.push({ code: 'PART_DELIV' });
  if (c.services && c.services.tryOn) services.push({ code: 'TRYING_ON' });
  return {
    type: 1, number: 'ALB-' + o.number + (o.cdekTry ? '-' + o.cdekTry : ''),
    tariff_code: Number(o.delivery.tariff) || (dr ? Number(c.tariffDoor) || 137 : pv.type === 'postamat' ? Number(c.tariffPostamat) || 368 : Number(c.tariff) || 136),
    shipment_point: c.shipmentPoint.code,
    delivery_point: pv ? pv.code : undefined,
    to_location: dr ? { code: Number(dr.cityCode), address: dr.address } : undefined,
    recipient: { name: `${o.customer.lastName} ${o.customer.firstName}`.trim(), email: o.customer.email, phones: [{ number: '+' + o.customer.phone }] },
    packages: [{ number: '1', weight: pkg.weight, length: pkg.length, width: pkg.width, height: pkg.height, comment: 'Одежда',
      items: items.map((x) => ({ name: `${x.i.name}${x.i.color ? ', ' + x.i.color : ''}, ${x.i.size}`.slice(0, 255), ware_key: `${x.i.productId}-${x.i.size}${x.suffix}`.slice(0, 50), payment: { value: x.payK / 100 }, cost: x.i.price, weight: unitWOf(x), amount: x.qty })) }],
    delivery_recipient_cost: !paid && net.delivK > 0 && !o.deliveryRefunded ? { value: net.delivK / 100 } : undefined,
    services: services.length ? services : undefined,
    comment: o.comment ? o.comment.slice(0, 255) : undefined
  };
}
// Посылку сдали в СДЭК: дальше статусы, кроме «создан», значат «в пути»
const CDEK_WAIT = ['', 'ACCEPTED', 'CREATED', 'INVALID', 'REMOVED'];
async function applyCdek(o, info) {
  if (!o.cdek || !info) return;
  Object.assign(o.cdek, { number: info.number || o.cdek.number || '', status: info.status || o.cdek.status, statusName: info.statusName || o.cdek.statusName, statusAt: info.statusAt || o.cdek.statusAt, error: info.error || '' });
  let mail = false;
  if (o.cdek.number && !CDEK_WAIT.includes(o.cdek.status) && (!o.tracking || o.tracking.number !== o.cdek.number)) {
    o.tracking = { carrier: 'СДЭК', number: o.cdek.number, url: CDEK_TRACK + encodeURIComponent(o.cdek.number), at: new Date().toISOString() };
    if (['new', 'processing'].includes(o.status)) o.status = 'shipped';
    mail = true;
  }
  if (o.cdek.status === 'DELIVERED' && o.status !== 'done' && o.status !== 'returned') o.status = 'done';
  // при получении покупатель заплатил СДЭК — отмечаем оплату (деньги придут от СДЭК по договору)
  if (o.cdek.status === 'DELIVERED' && o.payment.method === 'cod' && o.payment.status === 'pending') { o.payment.status = 'paid'; o.payment.collectedBy = 'cdek'; }
  syncBonus(o); save();
  if (mail && mailReady()) { try { await sendTrackingMail(o); o.tracking.mailedAt = new Date().toISOString(); save(); } catch (e) { console.error('Письмо с трек-номером не отправлено:', e.message); } }
}
/* ---------- Возврат через СДЭК: обратная заявка от покупателя на ваш пункт ---------- */
const returnedQty = (o, idx) => (o.returns || []).filter((r) => r.status !== 'REMOVED').reduce((s, r) => s + ((r.items.find((x) => x.idx === idx) || {}).qty || 0), 0);
async function createReturnShip(o, b) {
  const c = cdekCfg(), sp = c.shipmentPoint, rt = c.returnTo || {}, cs = db.settings.contacts || {};
  if (!sp || !sp.code) fail(400, 'Укажите пункт отгрузки в «Отправка заказов в СДЭК» — туда придёт возврат');
  const shopPhone = normPhone(rt.phone || cs.phone || '');
  if (shopPhone.length !== 11) fail(400, 'Укажите телефон для возвратов в «Отправка заказов в СДЭК» — СДЭК позвонит, когда посылка придёт');
  const shopName = String(rt.name || String(db.settings.legal || '').split(/[,\n]/)[0] || db.settings.storeName || 'ALBAKOV').slice(0, 120);
  const pv = o.delivery && o.delivery.pvz, dr = o.delivery && o.delivery.door, fromCity = (pv && pv.cityCode) || (dr && dr.cityCode);
  if (!fromCity) fail(400, 'Город покупателя неизвестен — оформите возврат в личном кабинете СДЭК');
  const sel = [];
  for (const x of Array.isArray(b.lines) ? b.lines : []) {
    const idx = Number(x.idx), it = o.items[idx], q = Math.floor(Number(x.qty) || 0); if (!it || q <= 0) continue;
    const can = it.qty - (it.refundedQty || 0) - returnedQty(o, idx);
    if (q > can) fail(400, `«${it.name}»: можно вернуть не больше ${can} шт.`);
    sel.push({ idx, qty: q });
  }
  if (!sel.length) fail(400, 'Отметьте вещи, которые покупатель возвращает');
  const pkg = Pricing.parcelFor(sel.map((x) => ({ productId: o.items[x.idx].productId, qty: x.qty })), db.products, c);
  // откуда: пункт, где покупатель забирал заказ, или любой пункт в его городе (сдать можно в любой)
  let from = pv && pv.code;
  if (!from) { const pts = await cdek.points(fromCity).catch(() => []); const p0 = pts.find((p) => p.type === 'pvz'); if (!p0) fail(400, 'В городе покупателя нет пунктов СДЭК'); from = p0.code; }
  let cost = 0, tariff = Number(c.tariff) || 136;
  try { const r = await cdekCalcAny(fromCity, sp.cityCode, 'pvz', pkg); cost = Math.ceil(r.sum); tariff = r.tariff; } catch (e) { /* стоимость не узнали — заявку всё равно создаём */ }
  const n = (o.returns || []).length + 1;
  const body = {
    type: 1, is_client_return: true, number: 'ALB-' + o.number + '-R' + n + (o.returnTry ? '-' + o.returnTry : ''), tariff_code: tariff,
    shipment_point: from, delivery_point: sp.code,
    sender: { name: `${o.customer.lastName} ${o.customer.firstName}`.trim(), phones: [{ number: '+' + o.customer.phone }] },
    recipient: { name: shopName, phones: [{ number: '+' + shopPhone }] },
    packages: [{ number: '1', weight: pkg.weight, length: pkg.length, width: pkg.width, height: pkg.height, comment: 'Возврат одежды',
      items: sel.map((x) => { const it = o.items[x.idx]; return { name: `${it.name}${it.color ? ', ' + it.color : ''}, ${it.size}`.slice(0, 255), ware_key: `${it.productId}-${it.size}`.slice(0, 50), payment: { value: 0 }, cost: it.price, weight: Math.max(1, Math.floor(pkg.weight / sel.reduce((s, y) => s + y.qty, 0))), amount: x.qty }; }) }],
    comment: 'Возврат по заказу № ' + o.number
  };
  let uuid;
  try { uuid = await cdek.createOrder(body); } catch (e) { o.returnTry = (o.returnTry || 0) + 1; save(); fail(502, 'СДЭК: ' + e.message); }
  const ret = { uuid, number: '', status: 'ACCEPTED', statusName: 'Заявка принята', createdAt: new Date().toISOString(), cost, from, items: sel.map((x) => ({ idx: x.idx, name: o.items[x.idx].name, color: o.items[x.idx].color || '', size: o.items[x.idx].size, qty: x.qty })) };
  o.returns = o.returns || []; o.returns.push(ret); save();
  for (let i = 0; i < 4 && !ret.number; i++) { await new Promise((r) => setTimeout(r, 1500)); try { await syncReturns(o); } catch (e) { /* дождёмся уведомления */ } }
  if (ret.error) { o.returns = o.returns.filter((x) => x !== ret); save(); fail(400, 'СДЭК отклонил заявку: ' + ret.error); }
  return ret;
}
async function syncReturns(o) {
  for (const r of o.returns || []) {
    if (!r.uuid || r.status === 'DELIVERED' || r.status === 'REMOVED') continue;
    const info = await cdek.order(r.uuid);
    Object.assign(r, { number: info.number || r.number, status: info.status || r.status, statusName: info.statusName || r.statusName, statusAt: info.statusAt || r.statusAt, error: info.error || '' });
    if (r.number && !r.mailedAt && mailReady()) { try { await sendReturnShipMail(o, r); r.mailedAt = new Date().toISOString(); } catch (e) { console.error('Письмо о возврате не отправлено:', e.message); } }
  }
  save();
}
async function syncCdek(o) {
  if (!o.cdek || !o.cdek.uuid || !cdek.ready()) return;
  await applyCdek(o, await cdek.order(o.cdek.uuid));
}
function payReady() { const p = db.settings.payment || {}, k = yk(); return p.provider === 'yookassa' && !!(k.shopId && k.secret); }
// Хиты продаж: товары, которых больше всего купили за 90 дней (без отменённых и неоплаченных онлайн-заказов).
// Наружу уходит только порядок товаров — без количества продаж. Выключается в «Главной странице» панели.
const HITS_DAYS = 90;
function hitIds() {
  const home = (db.settings && db.settings.home) || {};
  if (home.hitsAuto === false) return [];
  const since = Date.now() - HITS_DAYS * 864e5, sold = new Map();
  for (const o of db.orders) {
    if (o.test || o.status === 'canceled' || o.status === 'returned' || Date.parse(o.createdAt) < since) continue;
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
    cdekReady: cdek.ready(),
    // ключ СДЭК и пункт отгрузки покупателям не нужны — наружу только услуги
    settings: Object.assign({}, db.settings, { cdek: { services: (cdekCfg().services) || {} } }),
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
/* Сколько реально оплачено деньгами за каждую позицию и доставку (в копейках):
   скидка по промокоду и бонусы распределяются по товарам, остаток бонусов уменьшает доставку */
function netLines(order) {
  const lines = order.items.map((i, idx) => ({ idx, name: `${i.name}${i.color ? ', ' + i.color : ''}, размер ${i.size}`.slice(0, 128), qty: i.qty, totalK: i.price * i.qty * 100 }));
  const subK = lines.reduce((s, l) => s + l.totalK, 0);
  const bonusK = (order.bonusUsed || 0) * 100, goodsBonusK = Math.min(bonusK, Math.max(0, subK - order.promoDiscount * 100));
  let discK = order.promoDiscount * 100 + goodsBonusK, left = discK;
  lines.forEach((l, idx) => {
    const share = idx === lines.length - 1 ? left : Math.min(left, Math.round(discK * l.totalK / (subK || 1)));
    left -= share; l.totalK -= share;
  });
  const delivK = order.delivery ? Math.max(0, order.delivery.price * 100 - (bonusK - goodsBonusK)) : 0;
  return { lines, delivK, deliveryName: order.delivery ? order.delivery.name : '' };
}
// Позиция чека: если сумма не делится на количество без остатка — одна штука уходит отдельной строкой
function pushReceipt(out, name, qty, totalK, subject, vatCode) {
  const push = (q, unitK) => out.push({ description: name, quantity: q.toFixed(2), amount: { value: rub(unitK), currency: 'RUB' }, vat_code: vatCode, payment_mode: 'full_payment', payment_subject: subject });
  const unit = Math.floor(totalK / qty), rest = totalK - unit * qty;
  if (rest === 0) push(qty, unit);
  else { if (qty > 1) push(qty - 1, unit); push(1, unit + rest); }
}
/* Позиции чека: сумма позиций = сумма платежа */
function receiptItems(order, vatCode) {
  const n = netLines(order), out = [];
  n.lines.forEach((l) => { if (l.totalK > 0) pushReceipt(out, l.name, l.qty, l.totalK, 'commodity', vatCode); });
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
  if (o.refunds.some((x) => x.id === r.id)) return;
  o.refunds.push({ id: r.id, status: r.status, amount: Number(r.amount.value), at: r.created_at || new Date().toISOString(), reason: 'Оформлен в кабинете ЮKassa', items: [], delivery: false, external: true });
  o.refunded = refundedK(o) / 100;
  if (refundedK(o) >= Math.round(o.total * 100)) { o.payment.status = 'refunded'; if (o.status !== 'returned') { o.statusBefore = o.status; o.status = 'returned'; } }
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
    items: plan.sel.map((x) => ({ name: o.items[x.idx].name, color: o.items[x.idx].color || '', size: o.items[x.idx].size, qty: x.qty })), delivery: plan.delivery, restocked: !!b.restock,
    deducted: plan.deducted || 0
  };
  if (plan.deducted && Array.isArray(o.returns)) o.returns.forEach((r) => { if (r.cost && !r.deducted) r.deducted = true; });
  o.refunds = o.refunds || []; o.refunds.push(refund);
  plan.sel.forEach((x) => {
    const it = o.items[x.idx]; it.refundedQty = (it.refundedQty || 0) + x.qty;
    if (b.restock) { const st = sizeEntry(it.productId, it.colorId, it.size); if (st) st.stock += x.qty; }
  });
  if (plan.delivery) o.deliveryRefunded = true;
  o.refunded = refundedK(o) / 100;
  // Полный возврат: заказ становится «Возврат», чтобы его нельзя было спутать с действующим
  if (refundedK(o) >= Math.round(o.total * 100)) { o.payment.status = 'refunded'; if (o.status !== 'returned') { o.statusBefore = o.status; o.status = 'returned'; } }
  else if (o.bonusEarn > 0) {
    // частичный возврат: бонусы за возвращённую часть забираем
    const share = Math.floor(o.bonusEarn * plan.amountK / Math.round(o.total * 100)), u = userOf(o);
    if (share > 0) { o.bonusEarn -= share; if (o.bonusCredited && u) Pricing.bonusMove(u, -Math.min(u.bonus || 0, share), 'revoke', o, uid); }
  }
  syncBonus(o);
  save();
  if (mailReady()) { try { await sendRefundMail(o, refund); refund.mailedAt = new Date().toISOString(); save(); } catch (e) { console.error('Письмо о возврате не отправлено:', e.message); } }
  if (b.restock) processWaitlist().catch(() => {});
  return { refund };
}
async function createPayment(order) {
  const { cfg, secret } = yk();
  // Тестовый ключ ЮKassa — заказ тестовый: в панели и статистике не считается
  if (/^test_/.test(String(secret || ''))) order.test = true;
  const body = {
    amount: { value: rub(order.total * 100), currency: 'RUB' },
    capture: true,
    confirmation: { type: 'redirect', return_url: `${PUBLIC_URL}/#/order/${order.id}` },
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
  return order.payUrl;
}
function applyPayment(order, p) {
  if (!order || !p) return;
  if (p.test) order.test = true;
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
// Цена доставки до пункта выдачи по тарифу СДЭК (+ наценка, округление до 10 ₽ вверх)
async function cdekShipPrice(m, cityCode, type, lines) {
  const c = cdekCfg(), from = c.shipmentPoint && c.shipmentPoint.cityCode;
  if (!from || !cityCode) return null;
  const pkg = Pricing.parcelFor(lines, db.products, c);
  const r = await cdekCalcAny(from, cityCode, type, pkg);
  return { price: Math.ceil((r.sum + Math.max(0, Number(m.markup) || 0)) / 10) * 10, days: r.max ? (r.min && r.min !== r.max ? r.min + '–' + r.max : String(r.max)) : '', tariff: r.tariff };
}
// Выбранный тариф доступен не на всех направлениях — пробуем следующий подходящий
function cdekTariffs(type) {
  const c = cdekCfg();
  const list = type === 'postamat' ? [Number(c.tariffPostamat) || 368, 368] : type === 'door' ? [Number(c.tariffDoor) || 137, 137] : [Number(c.tariff) || 136, 136, 234];
  return [...new Set(list)];
}
async function cdekCalcAny(from, to, type, pkg, log) {
  let last = null;
  for (const t of cdekTariffs(type)) {
    try { const r = await cdek.calc(from, to, t, pkg); if (log) log.push({ tariff: t, sum: r.sum, days: [r.min, r.max] }); return Object.assign({ tariff: t }, r); }
    catch (e) { last = e; if (log) log.push({ tariff: t, error: e.message }); }
  }
  throw last || new Error('СДЭК не рассчитал доставку');
}
// Расчёт корзины с ценой доставки СДЭК для выбранного города
async function quoteFull(req, b, strict) {
  const m = (db.settings.delivery.methods || []).find((x) => x.id === b.deliveryId);
  const mode = Pricing.cdekMode(m);
  const auto = !!(m && m.priceAuto && mode && cdek.ready() && cdekCfg().shipmentPoint && cdekCfg().shipmentPoint.cityCode);
  let extra = { cdekAuto: auto };
  if (auto && b.cityCode) {
    const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 100);
    try { const p = await cdekShipPrice(m, b.cityCode, mode === 'door' ? 'door' : b.pvzType, lines); if (p) extra = { cdekAuto: true, deliveryPrice: p.price, deliveryDays: p.days, deliveryTariff: p.tariff }; }
    catch (e) {
      console.error('СДЭК расчёт:', e.message);
      // СДЭК не ответил: берём запасную цену из настроек способа
      extra = { cdekAuto: true, deliveryPrice: Math.round(Number(m.price) || 0) };
    }
  }
  if (auto && strict && typeof extra.deliveryPrice !== 'number') fail(400, mode === 'door' ? 'Выберите город из подсказок — по нему рассчитаем доставку' : 'Выберите пункт выдачи — по нему рассчитаем доставку');
  const q = quote(req, b, extra);
  if (q.delivery && extra.deliveryTariff) q.delivery.tariff = extra.deliveryTariff;
  return q;
}
function quote(req, b, extra) {
  const user = currentUser(req), c = b.contact || {};
  const email = String(c.email || '').trim().toLowerCase(), phone = normPhone(c.phone);
  return Pricing.calcCart(Array.isArray(b.lines) ? b.lines.slice(0, 100) : [], db, {
    code: b.code ? String(b.code).slice(0, 40) : '', deliveryId: b.deliveryId, registered: !!user,
    hasOrders: !!user && db.orders.some((o) => o.userId === user.id && o.status !== 'canceled'),
    usedByCustomer: b.code ? usedByCustomer(b.code, user, email, phone) : false,
    bonusBalance: user ? user.bonus || 0 : 0, useBonus: !!(user && b.useBonus),
    cdekAuto: !!(extra && extra.cdekAuto), deliveryPrice: extra ? extra.deliveryPrice : undefined, deliveryDays: extra ? extra.deliveryDays : undefined
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
  const q = await quoteFull(req, { lines: b.lines, code: b.code, deliveryId: b.deliveryId, contact: customer, useBonus: b.useBonus, cityCode: b.cityCode, pvzType: b.pvzType }, true);
  if (!q.lines.length) fail(400, 'Корзина пуста');
  if (!q.delivery) fail(400, 'Выберите способ доставки');
  const bad = q.lines.find((l) => l.problem); if (bad) fail(409, `${bad.name}: ${bad.problem.toLowerCase()}`);
  if (b.code && !(q.promo && q.promo.ok)) fail(400, q.promo ? q.promo.message : 'Промокод не применён');
  const m = db.settings.delivery.methods.find((x) => x.id === b.deliveryId);
  // Пункт выдачи СДЭК выбирают из списка: адрес и населённый пункт берём из данных СДЭК, а не из того, что набрал покупатель
  let pvz = null, door = null;
  if (m && Pricing.isPvzMethod(m) && cdek.ready()) {
    if (!b.pvz || !b.cityCode) fail(400, 'Выберите пункт выдачи СДЭК из списка');
    let list = [];
    try { list = await cdek.points(b.cityCode); } catch (e) { fail(502, 'СДЭК сейчас не отвечает. Попробуйте оформить заказ через минуту.'); }
    pvz = list.find((x) => x.code === String(b.pvz));
    if (!pvz) fail(400, 'Этот пункт выдачи больше не работает — выберите другой');
    if (Number(pvz.cityCode) !== Number(b.cityCode)) fail(400, 'Пункт выдачи не из выбранного города — выберите пункт заново');
    if (method === 'cod' && !pvz.cod) fail(400, 'В этом пункте нельзя оплатить при получении — выберите другой пункт или оплату онлайн');
  } else if (m && Pricing.isDoorMethod(m) && cdek.ready()) {
    // Курьер: город — только из подсказок СДЭК (с областью), адрес — улица, дом, квартира
    const addr = String(b.address || '').replace(/\s+/g, ' ').trim().slice(0, 250);
    if (!b.cityCode) fail(400, 'Выберите город из подсказок');
    if (addr.length < 5) fail(400, 'Укажите улицу, дом и квартиру');
    let city = null;
    try { city = await cdek.cityByCode(b.cityCode); } catch (e) { fail(502, 'СДЭК сейчас не отвечает. Попробуйте оформить заказ через минуту.'); }
    if (!city) fail(400, 'Город не найден — выберите его из подсказок');
    door = Object.assign({}, city, { address: addr });
  } else if (m && m.needsAddress !== false && (!String(b.city || '').trim() || !String(b.address || '').trim())) fail(400, 'Укажите город и адрес доставки');

  q.lines.forEach((l) => { sizeEntry(l.productId, l.colorId, l.size).stock -= l.qty; });
  if (q.promo && q.promo.ok) { const pc = db.promocodes.find((x) => x.code === q.promo.code); if (pc) pc.used = (pc.used || 0) + 1; }
  db.orderSeq = Number(db.orderSeq) || 0;
  do { db.orderSeq++; } while (db.orders.some((o) => o.number === String(db.orderSeq)));
  const order = {
    id: uid('o'), number: String(db.orderSeq), token: crypto.randomBytes(16).toString('hex'), createdAt: new Date().toISOString(), userId: user ? user.id : null, customer, consentAt: new Date().toISOString(),
    items: q.lines.map((l) => ({ productId: l.productId, slug: l.slug, name: l.name, colorId: l.colorId, color: l.color, size: l.size, qty: l.qty, price: l.price, oldPrice: l.oldPrice, image: l.image, art: l.art })),
    subtotal: q.subtotal, saleDiscount: q.saleDiscount, promoCode: q.promo && q.promo.ok ? q.promo.code : '', promoDiscount: q.promoDiscount,
    delivery: Object.assign({}, q.delivery, pvz
      ? { city: pvz.city + (pvz.region ? ' (' + pvz.region + ')' : ''), address: (pvz.type === 'postamat' ? 'Постамат СДЭК ' : 'ПВЗ СДЭК ') + pvz.code + ': ' + pvz.address, pvz: { code: pvz.code, type: pvz.type, cityCode: pvz.cityCode, city: pvz.city, region: pvz.region, address: pvz.address, full: pvz.full, hours: pvz.hours, cod: !!pvz.cod } }
      : door ? { city: door.city + (door.region ? ' (' + door.region + ')' : ''), address: door.address, door: { cityCode: door.code, city: door.city, region: door.region, address: door.address } }
      : { city: String(b.city || '').slice(0, 100), address: String(b.address || '').slice(0, 300) }), comment: String(b.comment || '').slice(0, 1000),
    total: q.total, payment: { method, status: 'pending', provider: method === 'online' ? pay.provider : null }, status: 'new',
    test: method === 'online' && pay.provider !== 'yookassa' ? true : undefined,
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

/* ---------------- Трек-номер ---------------- */
const CDEK_TRACK = 'https://www.cdek.ru/ru/tracking/?order_id=';
function sendReturnShipMail(o, r) {
  const cs = db.settings.contacts || {}, sp = cdekCfg().shipmentPoint || {};
  const m = Mail.renderReturnShip({ store: db.settings.storeName, logo: brandLogo(), name: o.customer.firstName, number: o.number, track: r.number, items: r.items,
    to: [sp.address, sp.city].filter(Boolean).join(', '), cost: r.cost, url: `${PUBLIC_URL}/#/order/${o.id}`, contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
  return sendMail({ to: o.customer.email, subject: m.subject, html: m.html, text: m.text });
}
function sendRefundMail(o, r) {
  const cs = db.settings.contacts || {};
  const m = Mail.renderRefund({ store: db.settings.storeName, logo: brandLogo(), name: o.customer.firstName, number: o.number, amount: r.amount, items: r.items, delivery: r.delivery,
    full: o.payment.status === 'refunded', url: `${PUBLIC_URL}/#/order/${o.id}`, contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
  return sendMail({ to: o.customer.email, subject: m.subject, html: m.html, text: m.text });
}
function sendTrackingMail(o) {
  const cs = db.settings.contacts || {};
  const m = Mail.renderTracking({ store: db.settings.storeName, logo: brandLogo(), name: o.customer.firstName, number: o.number, carrier: o.tracking.carrier, track: o.tracking.number,
    trackUrl: o.tracking.url, url: `${PUBLIC_URL}/#/order/${o.id}`, contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
  return sendMail({ to: o.customer.email, subject: m.subject, html: m.html, text: m.text });
}

/* ---------------- Поддержка: переписка покупателя с магазином ---------------- */
const SUPPORT_TOPICS = ['Заказ', 'Доставка', 'Размер и посадка', 'Возврат и обмен', 'Другое'];
const ticketText = (v) => String(v || '').replace(/\r\n?/g, '\n').trim().slice(0, 2000);
// Покупателю — без служебных пометок магазина
function ticketForUser(t) {
  return { id: t.id, number: t.number, topic: t.topic, orderId: t.orderId || '', orderNumber: t.orderNumber || '', status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt,
    unread: !!t.unreadUser, messages: t.messages.map((m) => ({ id: m.id, from: m.from, text: m.text, at: m.at })) };
}
function supportMail(t, kind) {
  if (!mailReady()) return;
  const cs = db.settings.contacts || {}, last = t.messages[t.messages.length - 1];
  const to = kind === 'customer' ? t.email : (cs.email || mailCfg().fromEmail);
  if (!to) return;
  const url = kind === 'customer' ? `${PUBLIC_URL}/#/account?tab=support&id=${t.id}` : `${PUBLIC_URL}/#/admin?s=support&id=${t.id}`;
  const m = Mail.renderSupport({ kind, store: db.settings.storeName, logo: brandLogo(), name: t.name, number: t.number, topic: t.topic, orderNumber: t.orderNumber, text: last.text, url, contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
  sendMail({ to, subject: m.subject, html: m.html, text: m.text }).catch((e) => console.error('Письмо поддержки не отправлено:', e.message));
}
function supportApi(req, p, M, body, u) {
  const mine = () => db.tickets.filter((t) => t.userId === u.id);
  if (!p[1] && M === 'GET') return { tickets: mine().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(ticketForUser), topics: SUPPORT_TOPICS };
  if (!p[1] && M === 'POST') {
    throttle(req, 'support', 30);
    const text = ticketText(body.text); if (!text) fail(400, 'Напишите, чем мы можем помочь');
    if (mine().filter((t) => t.status !== 'closed').length >= 20) fail(429, 'Открыто слишком много обращений. Продолжите одно из них');
    const o = body.orderId ? db.orders.find((x) => x.id === body.orderId && x.userId === u.id) : null;
    const now = new Date().toISOString();
    db.ticketSeq = (db.ticketSeq || 1000) + 1;
    const t = { id: uid('t'), number: String(db.ticketSeq), userId: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' '), email: u.email, phone: u.phone,
      topic: SUPPORT_TOPICS.includes(body.topic) ? body.topic : (o ? 'Заказ' : 'Другое'), orderId: o ? o.id : '', orderNumber: o ? o.number : '',
      status: 'open', createdAt: now, updatedAt: now, unreadUser: false, unreadShop: true, messages: [{ id: uid('m'), from: 'user', text, at: now }] };
    db.tickets.push(t); save(); supportMail(t, 'shop');
    return { ticket: ticketForUser(t) };
  }
  const t = p[1] && mine().find((x) => x.id === p[1]);
  if (!t) fail(404, 'Обращение не найдено');
  if (!p[2] && M === 'GET') { if (t.unreadUser) { t.unreadUser = false; save(); } return { ticket: ticketForUser(t) }; }
  if (!p[2] && M === 'POST') {
    throttle(req, 'support', 30);
    const text = ticketText(body.text); if (!text) fail(400, 'Сообщение пустое');
    const now = new Date().toISOString();
    t.messages.push({ id: uid('m'), from: 'user', text, at: now }); t.status = 'open'; t.unreadShop = true; t.unreadUser = false; t.updatedAt = now;
    save(); supportMail(t, 'shop');
    return { ticket: ticketForUser(t) };
  }
  fail(404, 'Неизвестный запрос');
}
function supportAdminApi(p, M, body) {
  if (!p[2] && M === 'GET') return { tickets: db.tickets.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
  const t = db.tickets.find((x) => x.id === p[2]); if (!t) fail(404, 'Обращение не найдено');
  if (M === 'POST') {
    const text = ticketText(body.text); if (!text) fail(400, 'Напишите ответ');
    const now = new Date().toISOString();
    t.messages.push({ id: uid('m'), from: 'shop', text, at: now }); t.status = 'answered'; t.unreadUser = true; t.unreadShop = false; t.updatedAt = now;
    save(); supportMail(t, 'customer');
    return { ticket: t, mailed: mailReady() };
  }
  if (M === 'PATCH') {
    if (body.read) t.unreadShop = false;
    if (body.status === 'closed' || body.status === 'open') t.status = body.status;
    save(); return { ticket: t };
  }
  fail(404, 'Неизвестный запрос');
}

/* ---------------- Уведомления о поступлении ---------------- */
function mailCfg() {
  const m = db.secrets.mail || {};
  return { host: process.env.SMTP_HOST || m.host || '', port: Number(process.env.SMTP_PORT || m.port || 465), security: process.env.SMTP_SECURITY || m.security || 'ssl', user: process.env.SMTP_USER || m.user || '', pass: process.env.SMTP_PASS || m.pass || '', fromEmail: process.env.SMTP_FROM || m.fromEmail || m.user || '', fromName: m.fromName || db.settings.storeName,
    // ответы покупателей — на почту для связи (адрес отправителя может быть no-reply@)
    replyTo: process.env.SMTP_REPLY_TO || m.replyTo || (db.settings.contacts || {}).email || '' };
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

  if (p[0] === 'support') { const u = user(); if (!u) fail(401, 'Войдите в личный кабинет'); return supportApi(req, p, M, body, u); }

  if (p[0] === 'quote' && M === 'POST') return { quote: await quoteFull(req, body) };
  // Уведомление СДЭК о движении посылки. Статус перепроверяем через API
  if (p[0] === 'cdek' && p[1] === 'webhook' && M === 'POST') {
    const uuid = body && (body.uuid || (body.attributes && body.attributes.uuid));
    const o = uuid && db.orders.find((x) => x.cdek && x.cdek.uuid === uuid);
    if (o) { try { await syncCdek(o); } catch (e) { console.error('СДЭК:', e.message); } }
    const ro = uuid && db.orders.find((x) => (x.returns || []).some((r) => r.uuid === uuid));
    if (ro) { try { await syncReturns(ro); } catch (e) { console.error('СДЭК возврат:', e.message); } }
    return {};
  }
  // Подсказки населённых пунктов и пункты выдачи СДЭК
  if (p[0] === 'cdek' && M === 'GET' && (p[1] === 'cities' || p[1] === 'points')) {
    if (!cdek.ready()) fail(503, 'Подбор пунктов СДЭК не подключён');
    throttle(req, 'cdek', 600);
    try {
      if (p[1] === 'cities') return { cities: await cdek.cities(url.searchParams.get('q')) };
      return { points: await cdek.points(url.searchParams.get('city')) };
    } catch (e) { console.error('СДЭК:', e.message); fail(502, 'СДЭК сейчас не отвечает. Попробуйте ещё раз через минуту.'); }
  }

  if (p[0] === 'notify' && !p[1] && M === 'POST') return subscribe(req, body);

  if (p[0] === 'payments' && p[1] === 'yookassa' && M === 'POST') {
    // Уведомление ЮKassa. Статус не берём из тела запроса, а перепроверяем через API.
    const id = body && body.object && body.object.id;
    // Возврат, оформленный прямо в кабинете ЮKassa, тоже отмечаем в заказе
    if (/^refund\./.test(String(body && body.event || '')) && id) {
      try { recordRefund(await ykRequest('GET', '/refunds/' + id)); } catch (e) { console.error(e.message); }
      return {};
    }
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
      // Тестовые заказы (оплата в тестовом режиме) в панели не показываются и не считаются
      d.orders = db.orders.filter((o) => !o.test).map(orderView); d.testOrders = db.orders.filter((o) => o.test).length; d.users = db.users.map((u) => Object.assign(publicUser(u), { bonusLog: (u.bonusLog || []).slice(0, 100) }));
      d.waitlist = db.waitlist.map((w) => { const c = Object.assign({}, w); delete c.token; return c; });
      d.supportNew = db.tickets.filter((t) => t.unreadShop).length;
      // Состояние ночных резервных копий (файл пишет tools/backup.js)
      try { d.backup = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'backup-status.json'), 'utf8')); } catch (e) { d.backup = null; }
      // Автообновление из GitHub (файл пишет deploy/autoupdate.sh)
      try { d.update = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'update-status.json'), 'utf8')); } catch (e) { d.update = null; }
      return { data: d };
    }
    if (p[1] === 'health' && M === 'GET') return { health: health() };
    if (p[1] === 'support') return supportAdminApi(p, M, body);
    // Следующий номер заказа (Настройки → Нумерация заказов)
    if (p[1] === 'order-seq' && M === 'GET') return { next: (Number(db.orderSeq) || 0) + 1 };
    if (p[1] === 'order-seq' && M === 'POST') {
      const n = Number(body.next);
      if (!Number.isInteger(n) || n < 1 || n > 999999999) fail(400, 'Укажите целое число от 1');
      if (db.orders.some((o) => o.number === String(n))) fail(400, 'Заказ № ' + n + ' уже есть — укажите другой номер');
      db.orderSeq = n - 1; save(); return { next: n };
    }
    if (p[1] === 'password' && M === 'POST') {
      if (String(body.password || '').length < 8) fail(400, 'Пароль должен быть не короче 8 символов');
      if (!pwOk(body.password)) fail(400, 'Слишком длинный пароль');
      db.secrets.adminHash = hashPassword(body.password);
      const keep = getSession(req, 'admin').token;
      for (const k in db.sessions) if (db.sessions[k].kind === 'admin' && k !== keep) delete db.sessions[k];
      save(); return {};
    }
    // Ключи СДЭК: Account хранится в настройках, Secure password — только на сервере
    if (p[1] === 'cdek' && M === 'POST') {
      db.settings.cdek = Object.assign({}, db.settings.cdek);
      if (typeof body.clientId === 'string') db.settings.cdek.clientId = body.clientId.trim().slice(0, 100);
      if (typeof body.secret === 'string' && body.secret.trim()) db.secrets.cdekSecret = body.secret.trim().slice(0, 200);
      if (body.secret === null) delete db.secrets.cdekSecret;
      if (typeof body.test === 'boolean') db.settings.cdek.test = body.test;
      if (body.shipmentPoint && typeof body.shipmentPoint === 'object') {
        const sp = body.shipmentPoint; db.settings.cdek.shipmentPoint = sp.code ? { code: String(sp.code).slice(0, 40), address: String(sp.address || '').slice(0, 200), city: String(sp.city || '').slice(0, 100), cityCode: Number(sp.cityCode) || 0 } : null;
      }
      if (body.pkg) db.settings.cdek.pkg = cdekPkg(body.pkg);
      if (body.tariff) db.settings.cdek.tariff = Number(body.tariff) || 136;
      if (body.tariffDoor) db.settings.cdek.tariffDoor = Number(body.tariffDoor) || 137;
      if (Array.isArray(body.packs)) {
        const n = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
        db.settings.cdek.packs = body.packs.slice(0, 12).map((x, i) => ({ id: String(x.id || 'pk' + i).replace(/[^\w-]/g, '').slice(0, 20) || 'pk' + i, name: String(x.name || 'Упаковка').slice(0, 40), length: n(x.length, 1, 150), width: n(x.width, 1, 150), height: n(x.height, 1, 150), weight: n(x.weight, 0, 5000) }));
      }
      if (body.returnTo && typeof body.returnTo === 'object') db.settings.cdek.returnTo = { name: String(body.returnTo.name || '').trim().slice(0, 120), phone: normPhone(body.returnTo.phone || '') };
      if (typeof body.defaultPack === 'string') db.settings.cdek.defaultPack = body.defaultPack.slice(0, 20);
      if (body.services) db.settings.cdek.services = { partDeliv: !!body.services.partDeliv, tryOn: !!body.services.tryOn };
      save();
      const s = process.env.CDEK_CLIENT_SECRET || db.secrets.cdekSecret || '';
      let checked = false, error = '';
      if (cdek.ready() && body.check !== false) {
        try { checked = await cdek.check(); } catch (e) { error = e.message; }
        // уведомления о движении посылок — только для сайта на https
        if (checked && /^https:/.test(PUBLIC_URL)) { try { await cdek.webhook(PUBLIC_URL + '/api/cdek/webhook'); db.settings.cdek.webhook = true; save(); } catch (e) { console.error('СДЭК webhook:', e.message); } }
      }
      return { settings: db.settings, hasSecret: !!s, mask: s ? s.slice(0, 3) + '…' + s.slice(-3) : '', checked, error, env: !!process.env.CDEK_CLIENT_SECRET };
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
    // Удаление заказа: товар возвращается на склад, промокод и бонусы — как при отмене
    if (p[1] === 'orders' && p[2] && M === 'DELETE') {
      const drop = p[2] === 'test' ? db.orders.filter((o) => o.test) : db.orders.filter((o) => o.id === p[2]);
      if (!drop.length) fail(404, p[2] === 'test' ? 'Тестовых заказов нет' : 'Заказ не найден');
      for (const o of drop) {
        if (o.status !== 'canceled') {
          restock(o);
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
        const pkg = cdekPkg(body.pkg);
        let uuid;
        try { uuid = await cdek.createOrder(cdekOrderBody(o, pkg)); }
        catch (e) { if (e instanceof HttpError) throw e; o.cdekTry = (o.cdekTry || 0) + 1; save(); fail(502, 'СДЭК: ' + e.message); }
        o.cdekTry = (o.cdekTry || 0) + 1;
        o.cdek = { uuid, number: '', status: 'ACCEPTED', statusName: 'Заявка принята', createdAt: new Date().toISOString(), pkg };
        if (o.status === 'new') o.status = 'processing';
        save();
        // номер СДЭК присваивает через пару секунд
        for (let i = 0; i < 4 && !o.cdek.number; i++) { await new Promise((r) => setTimeout(r, 1500)); try { await syncCdek(o); } catch (e) { /* дождёмся уведомления */ } }
        if (o.cdek.error) { const err = o.cdek.error; delete o.cdek; save(); fail(400, 'СДЭК отклонил заявку: ' + err); }
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
        delete o.cdek; if (o.status === 'processing') o.status = 'new'; save();
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
        if (body.status === 'canceled' && o.status !== 'canceled') { restock(o); if (pc) pc.used = Math.max(0, (pc.used || 0) - 1); }
        if (body.status !== 'canceled' && o.status === 'canceled' && pc) pc.used = (pc.used || 0) + 1;
        if (o.status === 'canceled' && body.status !== 'canceled') o.items.forEach((i) => { const s = sizeEntry(i.productId, i.colorId, i.size); if (s) s.stock = Math.max(0, s.stock - i.qty); });
        o.status = body.status;
      }
      if (body.paymentStatus && pays.includes(body.paymentStatus)) o.payment.status = body.paymentStatus;
      // Трек-номер СДЭК: сохраняем, ставим «Передан в доставку» и пишем покупателю
      let tracked = false;
      if (typeof body.track === 'string') {
        const t = body.track.replace(/\s+/g, '').slice(0, 40);
        if (t && !/^[A-Za-z0-9-]{4,40}$/.test(t)) fail(400, 'Трек-номер: только цифры и латинские буквы');
        const prev = o.tracking && o.tracking.number;
        if (!t) delete o.tracking;
        else if (t !== prev) {
          o.tracking = { carrier: 'СДЭК', number: t, url: CDEK_TRACK + encodeURIComponent(t), at: new Date().toISOString() };
          if (o.status === 'new' || o.status === 'processing') o.status = 'shipped';
          tracked = true;
        }
      }
      if (typeof body.note === 'string') o.adminNote = body.note.slice(0, 2000);
      syncBonus(o);
      save();
      let mailed = false;
      if (tracked && body.notify !== false && mailReady()) { try { await sendTrackingMail(o); o.tracking.mailedAt = new Date().toISOString(); save(); mailed = true; } catch (e) { console.error('Письмо с трек-номером не отправлено:', e.message); } }
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
      save(); return { user: Object.assign(publicUser(u), { bonusLog: (u.bonusLog || []).slice(0, 100) }) };
    }
    if (p[1] === 'waitlist') {
      if (p[2] === 'send' && M === 'POST') return { notify: await processWaitlist() };
      if (p[2] && M === 'DELETE') { db.waitlist = db.waitlist.filter((w) => w.id !== p[2]); save(); return {}; }
    }
    if (p[1] === 'mail') {
      if (!p[2] && M === 'GET') { const c = mailCfg(); return { mail: { host: c.host, port: c.port, security: c.security, user: c.user, fromEmail: c.fromEmail, fromName: (db.secrets.mail || {}).fromName || '', replyTo: (db.secrets.mail || {}).replyTo || '', contactEmail: (db.settings.contacts || {}).email || '', hasPass: !!c.pass, ready: mailReady() } }; }
      if (!p[2] && M === 'POST') {
        const m = body.mail || {}, prev = db.secrets.mail || {};
        if (m.fromEmail && !validEmail(m.fromEmail)) fail(400, 'Проверьте адрес отправителя');
        if (m.replyTo && !validEmail(m.replyTo)) fail(400, 'Проверьте адрес для ответов');
        db.secrets.mail = { host: String(m.host || '').trim(), port: Number(m.port) || 465, security: ['ssl', 'starttls', 'none'].includes(m.security) ? m.security : 'ssl', user: String(m.user || '').trim(), pass: m.pass ? String(m.pass) : prev.pass || '', fromEmail: String(m.fromEmail || '').trim(), fromName: String(m.fromName || '').trim(), replyTo: String(m.replyTo || '').trim().toLowerCase() };
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
      if (out && out.__file) {
        res.writeHead(200, { 'Content-Type': out.__file.type, 'Content-Disposition': 'inline; filename="' + out.__file.name + '"', 'Cache-Control': 'no-store' });
        return res.end(out.__file.buf);
      }
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
