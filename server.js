/* Сервер интернет-магазина. Без внешних зависимостей: нужен только Node.js 18+.
   Запуск: node server.js   (переменные окружения — см. .env.example) */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Pricing = require('./public/js/pricing.js');
const SEED = require('./public/js/seed.js');
const Specs = require('./public/js/specs.js'); // характеристики одежды — общий список для панели, витрины и поиска
const Mail = require('./public/js/mail.js');
const Finance = require('./public/js/finance.js'); // раздел «Финансы»: настройки, себестоимость, расходы
const smtp = require('./lib/smtp.js');
const Store = require('./lib/db.js');
const CdekLib = require('./lib/cdek.js');
const WebPush = require('./lib/webpush.js');
const Audit = require('./lib/audit.js');
const Apns = require('./lib/apns.js'); // уведомления в браузер и приложение на телефоне

loadEnv(path.join(__dirname, '.env'));
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const COOKIE_SECURE = PUBLIC_URL.startsWith('https://');
const PUBLIC_HOST = (() => { try { const h = new URL(PUBLIC_URL).hostname; return /^www\./.test(h) || h === 'localhost' ? '' : h; } catch (e) { return ''; } })();
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
// Статистика посещений (13.50.2): один раз обнуляем — до 13.50.1 в неё могли попадать заходы владельца
if (db.statsReset !== 2) { db.stats = {}; db.statsReset = 2; }
/* Артикулы (13.51): у каждого товара свой — ALB-0001, ALB-0002…; можно задать свой в панели */
function cleanSku(v) { return String(v || '').trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-ZА-ЯЁ0-9._\/-]/g, '').slice(0, 32); }
function nextSku(list) {
  const n = list.reduce((m, x) => { const r = /^ALB-(\d+)$/.exec(x.sku || ''); return r ? Math.max(m, Number(r[1])) : m; }, 0) + 1;
  return 'ALB-' + String(n).padStart(4, '0');
}
// Проверяет и дополняет артикулы: пустой — следующий номер, занятый другим товаром — ошибка
function fixSkus(items, all, strict) {
  items.forEach((it) => {
    it.sku = cleanSku(it.sku);
    if (!it.sku) return;
    const twin = all.find((x) => x !== it && x.id !== it.id && cleanSku(x.sku) === it.sku);
    if (twin) { if (strict) fail(400, 'Артикул ' + it.sku + ' уже у товара «' + twin.name + '»'); it.sku = ''; }
  });
  items.forEach((it) => { if (!it.sku) it.sku = nextSku(all.concat(items)); });
}
fixSkus(db.products.slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))), db.products, false);
Pricing.migrateData(db, SEED); // цвета товаров, логотип — для данных, созданных до обновления
db.secrets = db.secrets || {};
db.waitlist = db.waitlist || [];
db.tickets = db.tickets || [];
db.giftcards = db.giftcards || [];
// Финансы (13.46): расходы — отдельные записи; себестоимость и ставки — не в settings, чтобы не уходить на витрину
db.expenses = db.expenses || [];
db.receipts = db.receipts || [];
db.intakes = db.intakes || [];
db.finance = Finance.cleanSettings(db.finance, db.finance);
if (db.settings && db.settings.payment && db.settings.payment.parts) delete db.settings.payment.parts; // оплата частями убрана в 13.43
if (db.settings && db.settings.telegram) delete db.settings.telegram; // уведомления в Telegram заменены письмами (13.43)
if (db.secrets && db.secrets.telegram) delete db.secrets.telegram;
/* Панель управления (13.57): отдельного входа по паролю больше нет. Владелец — аккаунт покупателя с номером OWNER_PHONE,
   сотрудники — аккаунты, которым владелец выдал роль. Владелец привязывается к уже существующему аккаунту один раз:
   если аккаунта ещё нет, никто не получает доступ, пока его не назначат командой deploy/set-owner.sh */
const OWNER_PHONE = String(process.env.OWNER_PHONE || '79111930794').replace(/\D/g, '');
db.secrets.staff = Array.isArray(db.secrets.staff) ? db.secrets.staff : [];
if (!db.secrets.ownerId) {
  const o = db.users.find((u) => String(u.phone || '') === OWNER_PHONE);
  if (o) { db.secrets.ownerId = o.id; console.log('Владелец панели: аккаунт ' + (o.firstName || '') + ' ' + (o.lastName || '') + ' (+' + o.phone + ')'); }
  else console.log('\n  Владелец панели не назначен: нет аккаунта с номером +' + OWNER_PHONE + '.\n  Зарегистрируйтесь на сайте и выполните: sudo bash /var/www/albakov/deploy/set-owner.sh +' + OWNER_PHONE + '\n');
}
// прежний вход по паролю администратора убран: пароль и его сеансы больше не нужны
delete db.secrets.adminHash;
for (const k in db.sessions) if (db.sessions[k].kind === 'admin') delete db.sessions[k];
delete (db.settings || {}).adminPathHash;
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
  bonusNews: (u.bonusLog || []).filter((e) => !e.seen).slice(0, 5).map((e) => ({ id: e.id, amount: e.amount, type: e.type, orderNumber: e.orderNumber || '', note: e.note || '' })),
  favorites: u.favorites || [], cartRemind: u.cartRemind === true ? true : u.cartRemind === false ? false : null, cart: (u.cart && u.cart.lines) || [],
  // для слайда со скидкой новым покупателям: есть ли заказы и какие промокоды уже использованы
  hasOrders: db.orders.some((o) => o.userId === u.id && o.status !== 'canceled'),
  usedPromos: [...new Set(db.orders.filter((o) => o.promoCode && o.status !== 'canceled' && (o.userId === u.id || (u.email && o.customer.email === u.email) || (u.phone && o.customer.phone === u.phone))).map((o) => o.promoCode.toUpperCase()))] };
/* Избранное покупателя: проверяем и обрезаем всё, что пришло из браузера */
function cleanFavorites(list) {
  const ids = new Set(db.products.map((x) => x.id)), out = [];
  (Array.isArray(list) ? list : []).forEach((x) => { const id = String(x && x.id || x || ''); if (ids.has(id) && !out.some((y) => y.id === id)) out.push({ id, at: String(x && x.at || new Date().toISOString()).slice(0, 30) }); });
  return out.slice(0, 200);
}
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
// Страницы для поисковиков: заголовок, описание, разметка и текст каждой страницы (lib/seo.js)
const Seo = require('./lib/seo.js').create({
  getDb: () => db, Pricing, siteUrl: () => PUBLIC_URL,
  features: () => ({ tryOn: !!((cdekCfg().services || {}).tryOn), cod: !!((db.settings.payment || {}).cod) })
});
let indexHtml = { mtime: 0, text: '' };

/* IndexNow: сразу сообщаем Яндексу (и Bing) о новых и изменённых страницах — не ждём, пока робот сам зайдёт.
   Ключ — случайный, лежит в файле /<ключ>.txt (так Яндекс проверяет, что сайт наш). Работает только на https. */
if (!/^[a-f0-9]{32}$/.test(db.secrets.indexnow || '')) db.secrets.indexnow = crypto.randomBytes(16).toString('hex');
const seoPingQ = new Set();
let seoPingTimer = null;
const seoPingOn = () => /^https:\/\//.test(PUBLIC_URL) && !/localhost|127\.0\.0\.1/.test(PUBLIC_URL) && ((db.settings.seo || {}).indexnow !== false);
function seoPing(paths) {
  if (!seoPingOn()) return;
  (paths || []).forEach((u) => { if (u) seoPingQ.add(/^https?:/.test(u) ? u : PUBLIC_URL + (u[0] === '/' ? '' : '/') + u); });
  clearTimeout(seoPingTimer); seoPingTimer = setTimeout(() => seoPingFlush().catch(() => {}), 30e3); // правки копятся полминуты — один запрос
}
async function seoPingFlush() {
  clearTimeout(seoPingTimer); seoPingTimer = null;
  const list = [...seoPingQ].slice(0, 10000); seoPingQ.clear();
  if (!list.length || !seoPingOn()) return null;
  const host = new URL(PUBLIC_URL).host, out = { at: new Date().toISOString(), count: list.length, ok: false, error: '' };
  try {
    const r = await fetch('https://yandex.com/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ host, key: db.secrets.indexnow, keyLocation: PUBLIC_URL + '/' + db.secrets.indexnow + '.txt', urlList: list }), signal: AbortSignal.timeout(15000) });
    out.ok = r.status === 200 || r.status === 202; out.status = r.status;
    if (!out.ok) out.error = r.status === 403 ? 'Яндекс не смог проверить ключ на сайте' : r.status === 422 ? 'Адреса не с этого сайта' : r.status === 429 ? 'Слишком часто — повторим позже' : 'Ответ ' + r.status;
  } catch (e) { out.error = 'Не удалось связаться с Яндексом: ' + e.message; }
  db.seoPing = out; save();
  if (!out.ok) console.error('IndexNow:', out.error);
  return out;
}
// Что поменялось в панели — то и отправляем
function seoChanged(coll, item) {
  if (coll === 'products') seoPing(item ? ['/product/' + item.slug, '/catalog', '/'].concat((db.categories.find((c) => c.id === item.categoryId) || {}).slug ? ['/catalog?cat=' + encodeURIComponent(db.categories.find((c) => c.id === item.categoryId).slug)] : []) : Seo.urls());
  else if (coll === 'pages') seoPing(item ? ['/page/' + item.slug] : Seo.urls());
  else if (coll === 'categories') seoPing(Seo.urls().filter((u) => /\/catalog/.test(u)));
}
function sendIndex(req, res, url) {
  const file = path.join(PUBLIC_DIR, 'index.html'), mt = fs.statSync(file).mtimeMs;
  if (mt !== indexHtml.mtime) indexHtml = { mtime: mt, text: fs.readFileSync(file, 'utf8') };
  let r;
  try { r = Seo.render(url.pathname, Object.fromEntries(url.searchParams)); } catch (e) { console.error('SEO:', e.message); r = null; }
  const html = r ? Seo.inject(indexHtml.text, r) : indexHtml.text;
  res.writeHead(r ? r.status : 200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(req.method === 'HEAD' ? undefined : html);
}
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
      items: items.map((x) => ({ name: `${x.i.name}${x.i.color ? ', ' + x.i.color : ''}, ${x.i.size}`.slice(0, 255), ware_key: `${x.i.productId}-${x.i.size}${x.suffix}`.slice(0, 50), payment: { value: x.payK / 100 }, cost: x.i.exchangePrice || x.i.price, weight: unitWOf(x), amount: x.qty })) }],
    delivery_recipient_cost: !paid && net.delivK > 0 && !o.deliveryRefunded ? { value: net.delivK / 100 } : undefined,
    services: services.length ? services : undefined,
    comment: o.comment ? o.comment.slice(0, 255) : undefined
  };
}
// Посылку сдали в СДЭК: дальше статусы, кроме «создан», значат «в пути»
const CDEK_WAIT = ['', 'ACCEPTED', 'CREATED', 'INVALID', 'REMOVED'];
async function applyCdek(o, info) {
  if (!o.cdek || !info) return;
  const was = o.cdek.status || '', wasDone = o.status === 'done';
  Object.assign(o.cdek, { number: info.number || o.cdek.number || '', status: info.status || o.cdek.status, statusName: info.statusName || o.cdek.statusName, statusAt: info.statusAt || o.cdek.statusAt, error: info.error || '' });
  if (info.cost > 0) o.fin = Object.assign({}, o.fin, { cdekCost: info.cost }); // сколько СДЭК берёт с магазина — для «Финансов»
  let mail = false;
  if (o.cdek.number && !CDEK_WAIT.includes(o.cdek.status) && (!o.tracking || o.tracking.number !== o.cdek.number)) {
    o.tracking = { carrier: 'СДЭК', number: o.cdek.number, url: CDEK_TRACK + encodeURIComponent(o.cdek.number), at: new Date().toISOString() };
    if (['new', 'processing'].includes(o.status)) o.status = 'shipped';
    mail = true;
  }
  if (o.cdek.status === 'DELIVERED' && o.status !== 'done' && o.status !== 'returned') { o.status = 'done'; o.doneAt = o.doneAt || info.statusAt || new Date().toISOString(); }
  // при получении покупатель заплатил СДЭК — отмечаем оплату (деньги придут от СДЭК по договору)
  if (o.cdek.status === 'DELIVERED' && o.payment.method === 'cod' && o.payment.status === 'pending') { o.payment.status = 'paid'; o.payment.collectedBy = 'cdek'; o.payment.paidAt = info.statusAt || new Date().toISOString(); }
  syncBonus(o);
  // Push покупателю: каждое событие — один раз
  const st = o.cdek.status, PICK = ['ACCEPTED_AT_PICK_UP_POINT', 'POSTOMAT_POSTED'];
  o.pushed = o.pushed || {};
  const once = (ev) => { if (o.pushed[ev]) return; o.pushed[ev] = new Date().toISOString(); pushOrderEvent(o, ev); };
  if (!o.test) {
    if (st === 'DELIVERED') { if (!wasDone) once('done'); }
    else if (PICK.includes(st) && !PICK.includes(was)) { o.pickupAt = o.pickupAt || info.statusAt || new Date().toISOString(); once('pickup'); }
    else if (st === 'TAKEN_BY_COURIER' && was !== st) once('courier');
    else if (mail) once('shipped');
  }
  save();
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
    const was = r.status;
    Object.assign(r, { number: info.number || r.number, status: info.status || r.status, statusName: info.statusName || r.statusName, statusAt: info.statusAt || r.statusAt, error: info.error || '' }, info.cost > 0 ? { cost: info.cost } : {});
    if (r.status === 'DELIVERED' && was !== 'DELIVERED') pushStaff('returnIn', { title: 'Возврат пришёл на склад', body: 'Заказ № ' + o.number + ': ' + r.items.map((x) => x.name + ' ' + x.size + (x.qty > 1 ? ' ×' + x.qty : '')).join(', ') + '. Проверьте вещи и завершите возврат.', url: '/admin', tag: 'ret-' + o.id, icon: firstImg(o) });
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
    if (o.test || o.status === 'canceled' || o.status === 'returned' || (o.payment && o.payment.method === 'exchange') || Date.parse(o.createdAt) < since) continue;
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
    giftCfg: (({ enabled, nominals, min, max, months }) => ({ enabled, nominals, min, max, months }))(giftCfg()),
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
  const days = 60;
  db.sessions[token] = { kind, userId: userId || null, exp: Date.now() + days * 864e5 };
  setCookie(res, 'sid', token, days * 86400);
  save();
}
function getSession(req, kind) {
  const token = parseCookies(req).sid;
  const s = token && db.sessions[token];
  if (!s || s.kind !== kind || s.exp < Date.now()) return null;
  return Object.assign({ token }, s);
}
function currentUser(req) { const s = getSession(req, 'user'); return s ? db.users.find((u) => u.id === s.userId) || null : null; }
/* ---------- Доступ к панели (13.57): роли ----------
   Права: orders — заказы, поддержка, обмены, покупатели, сертификаты; content — товары, категории, страницы, витрина;
   finance — финансы и аналитика; marketing — бонусы, Метрика, поиск, уведомления; mail — раздел «Почта»;
   payment — оплата, доставка, ключи СДЭК, ЮKassa и почты; settings — общие настройки; staff — сотрудники */
const ROLES = {
  owner: { name: 'Владелец', perms: ['orders', 'content', 'finance', 'marketing', 'mail', 'payment', 'settings', 'staff'] },
  manager: { name: 'Управляющий', perms: ['orders', 'content', 'finance', 'marketing', 'mail'] },
  orders: { name: 'Менеджер заказов', perms: ['orders', 'mail'] },
  content: { name: 'Контент-менеджер', perms: ['content'] },
  finance: { name: 'Финансы', perms: ['finance'] }
};
function staffRole(u) {
  if (!u) return null;
  if (u.id === db.secrets.ownerId) return 'owner';
  const x = db.secrets.staff.find((y) => y.userId === u.id);
  return x && ROLES[x.role] ? x.role : null;
}
function adminRole(req) { return staffRole(currentUser(req)); }
function perms(req) { const r = adminRole(req); return r ? ROLES[r].perms : []; }
function can(req, perm) { return perms(req).includes(perm); }
function isAdmin(req) { return !!adminRole(req); }
function requireAdmin(req) { if (!isAdmin(req)) fail(401, 'Войдите в личный кабинет аккаунтом с доступом к панели'); }
function requirePerm(req, ...need) { if (!need.some((p) => can(req, p))) fail(403, 'У вашей роли нет доступа к этому разделу'); }
// Какие поля настроек может менять роль (по разделам панели). Поля, которых здесь нет, — только с правом settings
const SETTINGS_PERMS = {
  brand: ['content'], tagline: ['content'], socials: ['content'], nav: ['content'], contacts: ['content'],
  slider: ['content'], genders: ['content'], home: ['content'], badges: ['content'], footerNote: ['content'], sizeHint: ['content'],
  exchange: ['orders'], notify: ['orders', 'mail'], ownerNotify: ['mail'],
  bonus: ['marketing'], gifts: ['marketing'], metrika: ['marketing'], seo: ['marketing'],
  payment: ['payment'], delivery: ['payment'], cdek: ['payment']
};
/* Сотрудники: владелец выдаёт роль существующему аккаунту по номеру телефона */
function staffView(u, role) { return { userId: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' '), phone: u.phone, email: u.email, role, roleName: ROLES[role].name }; }
function staffList() {
  const out = [];
  const owner = db.users.find((u) => u.id === db.secrets.ownerId);
  if (owner) out.push(Object.assign(staffView(owner, 'owner'), { owner: true }));
  db.secrets.staff.forEach((x) => { const u = db.users.find((y) => y.id === x.userId); if (u && ROLES[x.role]) out.push(Object.assign(staffView(u, x.role), { at: x.at })); });
  return out;
}
function staffApi(p, M, body) {
  const roles = Object.keys(ROLES).filter((r) => r !== 'owner');
  if (!p[2] && M === 'GET') return { staff: staffList(), roles: roles.map((r) => ({ id: r, name: ROLES[r].name, perms: ROLES[r].perms })) };
  if (!p[2] && M === 'POST') {
    const ph = normPhone(body.phone);
    if (ph.length !== 11) fail(400, 'Укажите номер телефона полностью');
    if (!roles.includes(body.role)) fail(400, 'Выберите роль');
    const u = db.users.find((x) => x.phone === ph);
    if (!u) fail(404, 'Аккаунта с номером +' + ph + ' нет — пусть человек сначала зарегистрируется на сайте');
    if (u.id === db.secrets.ownerId) fail(400, 'Это аккаунт владельца');
    const was = db.secrets.staff.find((x) => x.userId === u.id);
    if (was) was.role = body.role; else db.secrets.staff.push({ userId: u.id, role: body.role, at: new Date().toISOString() });
    save(); return { staff: staffList() };
  }
  const x = p[2] && db.secrets.staff.find((y) => y.userId === p[2]);
  if (!x) fail(404, 'Сотрудник не найден');
  if (M === 'PUT') { if (!roles.includes(body.role)) fail(400, 'Выберите роль'); x.role = body.role; save(); return { staff: staffList() }; }
  if (M === 'DELETE') { db.secrets.staff = db.secrets.staff.filter((y) => y !== x); save(); return { staff: staffList() }; }
  fail(404, 'Не найдено');
}
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
  const lines = order.items.map((i, idx) => ({ idx, gift: !!i.gift, name: (i.gift ? i.name : `${i.name}${i.color ? ', ' + i.color : ''}, размер ${i.size}`).slice(0, 128), qty: i.qty, totalK: i.price * i.qty * 100 }));
  const subK = lines.reduce((s, l) => s + l.totalK, 0);
  // бонусы и оплата сертификатом уменьшают сумму позиций в чеке (сначала товары, остаток — доставка)
  const bonusK = ((order.bonusUsed || 0) + (order.giftUsed || 0)) * 100, goodsBonusK = Math.min(bonusK, Math.max(0, subK - order.promoDiscount * 100));
  let discK = order.promoDiscount * 100 + goodsBonusK, left = discK;
  lines.forEach((l, idx) => {
    const share = idx === lines.length - 1 ? left : Math.min(left, Math.round(discK * l.totalK / (subK || 1)));
    left -= share; l.totalK -= share;
  });
  const delivK = order.delivery ? Math.max(0, order.delivery.price * 100 - (bonusK - goodsBonusK)) : 0;
  return { lines, delivK, deliveryName: order.delivery ? order.delivery.name : '' };
}
// Позиция чека: если сумма не делится на количество без остатка — одна штука уходит отдельной строкой
function pushReceipt(out, name, qty, totalK, subject, vatCode, mode) {
  const push = (q, unitK) => out.push({ description: name, quantity: q.toFixed(2), amount: { value: rub(unitK), currency: 'RUB' }, vat_code: vatCode, payment_mode: mode || 'full_payment', payment_subject: subject });
  const unit = Math.floor(totalK / qty), rest = totalK - unit * qty;
  if (rest === 0) push(qty, unit);
  else { if (qty > 1) push(qty - 1, unit); push(1, unit + rest); }
}
/* Позиции чека: сумма позиций = сумма платежа */
function receiptItems(order, vatCode) {
  const n = netLines(order), out = [];
  // продажа подарочного сертификата — аванс (признак расчёта «аванс», предмет «платёж»)
  n.lines.forEach((l) => { if (l.totalK > 0) pushReceipt(out, l.name, l.qty, l.totalK, l.gift ? 'payment' : 'commodity', vatCode, l.gift ? 'advance' : 'full_payment'); });
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
  // уже записан (оформлен из панели): только обновляем статус, второй раз сумму не добавляем
  const known = o.refunds.find((x) => x.id === r.id); if (known) { if (known.status !== r.status) { known.status = r.status; save(); } return; }
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
  o.refunds = o.refunds || []; o.refunds.push(refund); hist(o, 'Возврат денег: ' + Pricing.format(refund.amount) + (refund.reason ? ' — ' + refund.reason : ''), 'admin');
  plan.sel.forEach((x) => {
    const it = o.items[x.idx]; it.refundedQty = (it.refundedQty || 0) + x.qty;
    if (b.restock) { const st = sizeEntry(it.productId, it.colorId, it.size); if (st) st.stock += x.qty; }
  });
  if (plan.delivery) o.deliveryRefunded = true;
  // заявка покупателя на возврат денег закрывается вместе с возвратом
  (o.requests || []).forEach((q) => { if (q.kind === 'refund' && (q.status === 'new' || q.status === 'received')) { q.status = 'done'; q.refundId = r.id; } });
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
  if (!o.test) pushOrderEvent(o, 'refund', { amount: refund.amount });
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
    confirmation: { type: 'redirect', return_url: `${PUBLIC_URL}/order/${order.id}` },
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
// История заказа: что и когда менялось (статус, оплата, трек-номер, возвраты) — видна в карточке заказа в панели
const ST_RU = { new: 'Новый', processing: 'Собирается', shipped: 'Передан в доставку', done: 'Выполнен', canceled: 'Отменён', returned: 'Возврат' };
const PAY_RU = { pending: 'ожидает оплаты', paid: 'оплачен', canceled: 'оплата отменена', refunded: 'деньги возвращены' };
function hist(o, text, by) { (o.history = o.history || []).push({ at: new Date().toISOString(), text: String(text).slice(0, 300), by: by || 'system' }); if (o.history.length > 200) o.history = o.history.slice(-200); }
function applyPayment(order, p) {
  if (!order || !p) return;
  if (p.test) order.test = true;
  if (p.status === 'succeeded' && p.paid) {
    // способ оплаты нужен для комиссии в «Финансах»: у СБП она ниже
    if (p.payment_method && p.payment_method.type) order.payment.type = String(p.payment_method.type).slice(0, 30);
    if (order.payment.status !== 'paid') { order.payment.status = 'paid'; order.payment.paidAt = p.captured_at || new Date().toISOString(); hist(order, 'Оплата получена онлайн'); sendOrderMails(order); giftActivate(order); }
  }
  else if (p.status === 'canceled') {
    // оплата не прошла: возвращаем товар и промокод, если заказ ещё не был отменён вручную
    if (order.status !== 'canceled') {
      hist(order, 'Онлайн-оплата не прошла — заказ отменён, товар вернулся на склад');
      restock(order); giftReturn(order);
      if (order.kind === 'gift') { const g = db.giftcards.find((x) => x.id === order.giftId); if (g && g.status === 'pending') g.status = 'canceled'; }
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
    if (i.preorder) { const p = db.products.find((x) => x.id === i.productId); if (p) p.preorderSold = Math.max(0, (p.preorderSold || 0) - i.qty); return; }
    const s = sizeEntry(i.productId, i.colorId, i.size);
    if (s) s.stock += i.qty;
  });
}
// Обратно к restock: заказ снова в работе — списываем остаток или место в партии
function unrestock(order) {
  order.items.forEach((i) => {
    if (i.preorder) { const p = db.products.find((x) => x.id === i.productId); if (p) p.preorderSold = (p.preorderSold || 0) + i.qty; return; }
    const s = sizeEntry(i.productId, i.colorId, i.size); if (s) s.stock = Math.max(0, s.stock - i.qty);
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
  const q = quoteBase(req, b, extra);
  if (b.gift) {
    const g = findGift(b.gift), st = giftState(g);
    if (st !== 'active') q.gift = { code: String(b.gift).slice(0, 30), ok: false, message: GIFT_MSG[st] };
    else {
      const used = Math.min(g.balance, q.total);
      q.giftUsed = used; q.total -= used;
      q.gift = { code: g.code, ok: true, balance: g.balance, left: g.balance - used, expiresAt: g.expiresAt, message: used < g.balance ? 'Останется ' + Pricing.format(g.balance - used) + ' на следующие покупки' : 'Сертификат будет использован полностью' };
    }
  }
  return q;
}
function quoteBase(req, b, extra) {
  const user = currentUser(req), c = b.contact || {};
  const email = String(c.email || '').trim().toLowerCase(), phone = normPhone(c.phone);
  return Pricing.calcCart(Array.isArray(b.lines) ? b.lines.slice(0, 100) : [], db, {
    code: b.code ? String(b.code).slice(0, 40) : '', deliveryId: b.deliveryId, registered: !!user,
    hasOrders: !!user && db.orders.some((o) => o.userId === user.id && o.status !== 'canceled'),
    usedByCustomer: b.code ? usedByCustomer(b.code, user, email, phone) : false,
    bonusBalance: user ? user.bonus || 0 : 0, useBonus: !!(user && b.useBonus), payment: b.payment === 'online' ? 'online' : 'cod',
    cdekAuto: !!(extra && extra.cdekAuto), deliveryPrice: extra ? extra.deliveryPrice : undefined, deliveryDays: extra ? extra.deliveryDays : undefined
  });
}
// Защита от двойного заказа: если ответ потерялся и покупатель отправил форму ещё раз, возвращаем уже созданный заказ
const recentOrders = new Map();
setInterval(() => { const old = Date.now() - 30 * 60e3; for (const [k, v] of recentOrders) if (v.t < old) recentOrders.delete(k); }, 10 * 60e3).unref();
async function placeOrder(req, b) {
  const idem = /^[a-z0-9]{16,64}$/i.test(String(b.idem || '')) ? String(b.idem) : '';
  if (idem && recentOrders.has(idem)) {
    const prev = db.orders.find((o) => o.id === recentOrders.get(idem).id);
    if (prev) return { order: customerView(prev), token: prev.token, payUrl: prev.payment.status === 'paid' ? null : prev.payUrl || null, user: publicUser(currentUser(req)), repeated: true };
  }
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
  const q = await quoteFull(req, { gift: b.gift, lines: b.lines, code: b.code, deliveryId: b.deliveryId, contact: customer, useBonus: b.useBonus, cityCode: b.cityCode, pvzType: b.pvzType, payment: method }, true);
  if (!q.lines.length) fail(400, 'Корзина пуста');
  if (!q.delivery) fail(400, 'Выберите способ доставки');
  const bad = q.lines.find((l) => l.problem); if (bad) fail(409, `${bad.name}: ${bad.problem.toLowerCase()}`);
  if (b.code && !(q.promo && q.promo.ok)) fail(400, q.promo ? q.promo.message : 'Промокод не применён');
  if (b.gift && !(q.gift && q.gift.ok)) fail(400, q.gift ? q.gift.message : 'Сертификат не применён');
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

  q.lines.forEach((l) => {
    if (l.preorder) { const pp = db.products.find((x) => x.id === l.productId); pp.preorderSold = (pp.preorderSold || 0) + l.qty; return; }
    sizeEntry(l.productId, l.colorId, l.size).stock -= l.qty;
  });
  if (q.promo && q.promo.ok) { const pc = db.promocodes.find((x) => x.code === q.promo.code); if (pc) pc.used = (pc.used || 0) + 1; }
  db.orderSeq = Number(db.orderSeq) || 0;
  do { db.orderSeq++; } while (db.orders.some((o) => o.number === String(db.orderSeq)));
  const order = {
    id: uid('o'), number: String(db.orderSeq), token: crypto.randomBytes(16).toString('hex'), createdAt: new Date().toISOString(), userId: user ? user.id : null, customer, consentAt: new Date().toISOString(),
    items: q.lines.map((l) => ({ productId: l.productId, slug: l.slug, name: l.name, colorId: l.colorId, color: l.color, size: l.size, qty: l.qty, price: l.price, oldPrice: l.oldPrice, image: l.image, art: l.art, preorder: l.preorder || undefined, shipDate: l.preorder ? l.shipDate : undefined })),
    subtotal: q.subtotal, saleDiscount: q.saleDiscount, promoCode: q.promo && q.promo.ok ? q.promo.code : '', promoDiscount: q.promoDiscount,
    delivery: Object.assign({}, q.delivery, pvz
      ? { city: pvz.city + (pvz.region ? ' (' + pvz.region + ')' : ''), address: (pvz.type === 'postamat' ? 'Постамат СДЭК ' : 'ПВЗ СДЭК ') + pvz.code + ': ' + pvz.address, pvz: { code: pvz.code, type: pvz.type, cityCode: pvz.cityCode, city: pvz.city, region: pvz.region, address: pvz.address, full: pvz.full, hours: pvz.hours, cod: !!pvz.cod } }
      : door ? { city: door.city + (door.region ? ' (' + door.region + ')' : ''), address: door.address, door: { cityCode: door.code, city: door.city, region: door.region, address: door.address } }
      : { city: String(b.city || '').slice(0, 100), address: String(b.address || '').slice(0, 300) }), comment: String(b.comment || '').slice(0, 1000),
    total: q.total, payment: { method, status: 'pending', provider: method === 'online' ? pay.provider : null }, status: 'new',
    test: method === 'online' && pay.provider !== 'yookassa' ? true : undefined,
    bonusUsed: q.bonusUsed, bonusEarn: user ? q.bonusEarn : 0,
    giftCode: q.giftUsed ? q.gift.code : undefined, giftUsed: q.giftUsed || undefined
  };
  // Себестоимость на момент заказа: если потом поменять цену пошива, прошлые месяцы в «Финансах» не изменятся
  order.fin = { costs: order.items.map((it) => Number(db.finance.costs[it.productId]) || 0) };
  if (q.giftUsed) { const g = findGift(q.gift.code); g.balance -= q.giftUsed; (g.log = g.log || []).push({ at: order.createdAt, orderId: order.id, number: order.number, amount: -q.giftUsed, type: 'spend' }); }
  // Весь заказ оплачен бонусами — платить деньгами нечего
  if (order.total === 0) order.payment = { method: order.giftUsed ? 'gift' : 'bonus', status: 'paid', provider: null };
  hist(order, 'Заказ оформлен на сайте', 'customer');
  db.orders.push(order);
  const spent = q.bonusUsed ? Pricing.bonusMove(user, -q.bonusUsed, 'spend', order, uid) : null;
  let payUrl = null;
  if (order.payment.method === 'online' && pay.provider === 'yookassa') {
    try { payUrl = await createPayment(order); }
    catch (e) {
      restock(order); giftReturn(order); db.orders = db.orders.filter((o) => o.id !== order.id);
      if (order.promoCode) { const pc = db.promocodes.find((x) => x.code === order.promoCode); if (pc) pc.used--; }
      if (spent) { user.bonus += q.bonusUsed; user.bonusLog = user.bonusLog.filter((x) => x !== spent); }
      save(); throw e;
    }
  }
  syncBonus(order);
  if (idem) recentOrders.set(idem, { id: order.id, t: Date.now() });
  save();
  if (order.payment.method !== 'online') sendOrderMails(order); // при онлайн-оплате письмо уйдёт после оплаты
  stockMail(q.lines);
  console.log(`Новый заказ № ${order.number} на ${order.total} ₽`);
  return { order: customerView(order), token: order.token, payUrl, user: publicUser(user) };
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
// В письмах покупателю: «отвечать не нужно, пишите на …» — адрес для связи из «Меню, контакты»
Object.defineProperty(Mail.DEFAULTS, 'supportEmail', { get: () => (db.settings.contacts || {}).email || mailCfg().replyTo || '' });
Object.defineProperty(Mail.DEFAULTS, 'siteUrl', { get: () => PUBLIC_URL });
function sendMail(msg) { const e = embedImages(msg.html); return smtp.send(mailCfg(), Object.assign({}, msg, e)); }

/* ---------------- Письма о заказе: покупателю и магазину ---------------- */
function sendOrderMails(order) {
  if (!order.test && order.payment.method !== 'exchange' && !(order.pushed && order.pushed.staff)) {
    order.pushed = Object.assign({}, order.pushed, { staff: new Date().toISOString() });
    const paid = order.payment.status === 'paid', c = order.customer || {}, pv = order.delivery && order.delivery.pvz;
    pushStaff(paid ? 'paid' : 'order', { title: (paid ? 'Оплачен заказ № ' : 'Новый заказ № ') + order.number + ' · ' + money(order.total),
      body: [c.firstName, c.lastName].filter(Boolean).join(' ') + (pv && pv.city ? ', ' + pv.city : '') + '\n' + itemsLine(order) + (paid ? '' : '\nОплата при получении'),
      url: '/admin?s=orders&id=' + order.id, tag: 'order-' + order.id, icon: firstImg(order), urgent: true, actions: [{ action: 'open', title: 'Открыть заказ' }] });
  }
  if (!mailReady()) return;
  const pay = db.settings.payment || {}, cs = db.settings.contacts || {};
  const m = order.payment.method;
  const base = {
    store: db.settings.storeName, logo: brandLogo(), order: Object.assign({}, order, { items: order.items.map((i) => Object.assign({}, i, { image: absUrl(i.image) })) }),
    money: Pricing.format, payLabel: m === 'exchange' ? 'обмен — бесплатно' : m === 'bonus' ? 'оплачено бонусами' : m === 'online' ? (order.payment.status === 'paid' ? 'оплачено онлайн' : 'онлайн') : (pay.codLabel || 'при получении'),
    contacts: [cs.phone, cs.email].filter(Boolean).join(' · ')
  };
  const jobs = [];
  const mc = Mail.renderOrder(Object.assign({ kind: 'customer', url: `${PUBLIC_URL}/order/${order.id}` }, base));
  jobs.push(sendMail({ to: order.customer.email, subject: mc.subject, html: mc.html, text: mc.text }).then(() => { order.mailedAt = new Date().toISOString(); save(); }));
  const shopTo = order.test ? '' : ownerTo('order');
  if (shopTo) {
    const ms = Mail.renderOrder(Object.assign({ kind: 'shop', url: `${PUBLIC_URL}/admin?s=orders&id=${order.id}` }, base));
    jobs.push(sendMail({ to: shopTo, subject: ms.subject, html: ms.html, text: ms.text }));
  }
  Promise.allSettled(jobs).then((r) => r.forEach((x) => { if (x.status === 'rejected') console.error('Письмо о заказе не отправлено:', x.reason && x.reason.message); }));
}

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
const GIFT_MSG = { none: 'Сертификат не найден — проверьте код', canceled: 'Этот сертификат отменён', pending: 'Сертификат ещё не оплачен', expired: 'Срок действия сертификата закончился', used: 'Сертификат уже полностью использован' };
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
const REMIND_AFTER = Number(process.env.CART_REMIND_AFTER_MIN || 180) * 60e3; // через сколько после последнего изменения корзины
setInterval(() => { cartReminders().catch((e) => console.error(e)); }, Number(process.env.CART_REMIND_EVERY_SEC || 900) * 1000).unref();

let statDirty = false;
// Кто уже засчитан сегодня (только в памяти: номера браузеров не сохраняются и обнуляются каждый день)
const statSeen = { day: '', keys: new Set() };
const STAT_SALT = crypto.randomBytes(16).toString('hex');
setInterval(() => { if (statDirty) { statDirty = false; save(); } }, 60e3).unref();

/* ---------------- Push-уведомления (13.60) ----------------
   Покупателю — о его заказе, ответах поддержки, обмене и возврате, поступлении, бонусах и (по желанию) акциях.
   Владельцу и сотрудникам — по их роли: новые заказы, оплаты, вопросы, заявки, возвраты, остатки, входы в панель, итоги дня.
   Подписка — это устройство: телефон или браузер. Ключи VAPID создаются один раз и хранятся в базе. */
if (!db.secrets.vapid || !db.secrets.vapid.publicKey) { db.secrets.vapid = WebPush.generateKeys(); save(); }
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
  if (!subs.length) return 0;
  const data = pushPayload(m), keys = db.secrets.vapid, subject = 'mailto:' + ((db.settings.contacts || {}).email || 'info@albakovofficial.ru');
  let ok = 0, dirty = false;
  const ac = apnsCfg();
  await Promise.all(subs.map(async (x) => {
    // Приложение ALBAKOV на iPhone — через Apple (адрес «apns:<токен>»), браузеры — через web-push
    const ios = x.endpoint.startsWith('apns:');
    if (ios && !ac) return;
    const r = ios ? await Apns.send(x.endpoint.slice(5), data, ac, { env: x.env, ttl: m.ttl })
      : await WebPush.send(x, data, keys, { subject, urgency: m.urgent ? 'high' : 'normal', ttl: m.ttl || 86400 * 2 });
    if (ios && Apns.gone(r)) r.status = 410;
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
const money = (n) => Pricing.format(n);
const itemsLine = (o) => o.items.map((i) => i.name + (i.size ? ' ' + i.size : '') + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ');
const firstImg = (o) => (o.items.find((i) => i.image) || {}).image || '';
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
let digestDay = '';
setInterval(() => {
  const msk = new Date(Date.now() + 3 * 3600e3), day = msk.toISOString().slice(0, 10);
  if (msk.getUTCHours() !== 21 || digestDay === day) return;
  digestDay = day;
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

/* ---------------- Журнал действий (13.60) ----------------
   Все изменения в панели: кто, когда, что. Хранится 5000 последних записей; смотрит владелец (право «сотрудники»). */
function auditAdd(req, e, who) {
  if (!e || !e.text) return;
  const u = who || currentUser(req), role = u ? staffRole(u) : null;
  db.audit.push({ id: uid('a'), at: new Date().toISOString(), by: u ? u.id : '', name: u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || '+' + u.phone : '', role: role ? ROLES[role].name : '',
    area: e.area || 'other', text: e.text, ref: e.ref || null, ip: clientIp(req) });
  if (db.audit.length > 5000) db.audit.splice(0, db.audit.length - 5000);
  save();
}

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

/* ---------------- Подсказки адреса ---------------- */
const geoCache = new Map();
const geoNorm = (v) => String(v || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
async function streetSuggest(q, city, region) {
  q = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 80); city = String(city || '').trim().slice(0, 80); region = String(region || '').trim().slice(0, 80);
  if (q.length < 3 || !city) return [];
  const key = geoNorm(city + '|' + q);
  const hit = geoCache.get(key); if (hit && hit.until > Date.now()) return hit.items;
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 4000);
  let j;
  try {
    const qs = new URLSearchParams({ q: q + ', ' + city + (region ? ', ' + region : ''), limit: '15' }).toString() + '&layer=house&layer=street';
    const r = await fetch('https://photon.komoot.io/api/?' + qs, { headers: { 'User-Agent': 'ALBAKOV shop (' + PUBLIC_URL + ')' }, signal: ctrl.signal });
    j = await r.json();
  } catch (e) { return []; } finally { clearTimeout(timer); }
  const want = geoNorm(city), seen = new Set(), items = [];
  for (const f of (j && j.features) || []) {
    const pr = f.properties || {};
    if (pr.countrycode && pr.countrycode !== 'RU') continue;
    // только этот населённый пункт: улица с таким же названием в соседнем городе не подойдёт
    if (![pr.city, pr.town, pr.village, pr.district, pr.locality, pr.county, pr.state].some((v) => geoNorm(v) === want)) continue;
    const street = String(pr.street || (pr.type === 'street' ? pr.name : '') || '').trim(); if (!street) continue;
    const house = String(pr.housenumber || '').trim();
    const label = street + (house ? ', ' + house : '');
    if (seen.has(label)) continue; seen.add(label);
    items.push({ street, house, label, postcode: String(pr.postcode || '') });
    if (items.length >= 7) break;
  }
  if (geoCache.size > 2000) geoCache.clear();
  geoCache.set(key, { items, until: Date.now() + 864e5 });
  return items;
}

/* ---------------- Трек-номер ---------------- */
const CDEK_TRACK = 'https://www.cdek.ru/ru/tracking/?order_id=';
function sendReturnShipMail(o, r) {
  const cs = db.settings.contacts || {}, sp = cdekCfg().shipmentPoint || {};
  const m = Mail.renderReturnShip({ store: db.settings.storeName, logo: brandLogo(), name: o.customer.firstName, number: o.number, track: r.number, items: r.items,
    to: [sp.address, sp.city].filter(Boolean).join(', '), cost: r.cost, url: `${PUBLIC_URL}/order/${o.id}`, contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
  return sendMail({ to: o.customer.email, subject: m.subject, html: m.html, text: m.text });
}
function sendRefundMail(o, r) {
  const cs = db.settings.contacts || {};
  const m = Mail.renderRefund({ store: db.settings.storeName, logo: brandLogo(), name: o.customer.firstName, number: o.number, amount: r.amount, items: r.items, delivery: r.delivery,
    full: o.payment.status === 'refunded', url: `${PUBLIC_URL}/order/${o.id}`, contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
  return sendMail({ to: o.customer.email, subject: m.subject, html: m.html, text: m.text });
}
function sendTrackingMail(o) {
  const cs = db.settings.contacts || {};
  const m = Mail.renderTracking({ store: db.settings.storeName, logo: brandLogo(), name: o.customer.firstName, number: o.number, carrier: o.tracking.carrier, track: o.tracking.number,
    trackUrl: o.tracking.url, url: `${PUBLIC_URL}/order/${o.id}`, contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
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
  const cs = db.settings.contacts || {}, last = t.messages[t.messages.length - 1];
  const short = String(last.text || '').replace(/\s+/g, ' ').slice(0, 140);
  if (kind === 'customer') pushUser(db.users.find((x) => x.id === t.userId), 'support', { title: 'Ответ поддержки ALBAKOV', body: short, url: '/account?tab=support&id=' + t.id, tag: 'ticket-' + t.id, actions: [{ action: 'open', title: 'Ответить' }] });
  else if (!(t.request && t.messages.length === 1)) pushStaff('support', { title: 'Вопрос от ' + (t.name || 'покупателя') + (t.orderNumber ? ' · заказ № ' + t.orderNumber : ''), body: t.topic + ': ' + short, url: '/admin?s=support&id=' + t.id, tag: 'ticket-' + t.id, urgent: true, actions: [{ action: 'open', title: 'Ответить' }] });
  if (!mailReady()) return;
  const to = kind === 'customer' ? t.email : ownerTo('support');
  if (!to) return;
  const url = kind === 'customer' ? `${PUBLIC_URL}/account?tab=support&id=${t.id}` : `${PUBLIC_URL}/admin?s=support&id=${t.id}`;
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
/* ---------- Финансы: настройки, себестоимость, операции вручную (отчёт считает панель — public/js/finance.js) ---------- */
function financeApi(p, M, body) {
  // Ставки налога и комиссий, категории расходов
  if (p[2] === 'settings' && M === 'PUT') {
    const prev = db.finance, next = Finance.cleanSettings(body.value, prev);
    // категорию с операциями удалить нельзя — иначе расходы потеряются из отчёта
    const used = new Set(db.expenses.map((e) => e.categoryId));
    const gone = prev.categories.filter((c) => used.has(c.id) && !next.categories.some((x) => x.id === c.id));
    if (gone.length) fail(400, 'В категории «' + gone[0].name + '» есть операции — сначала перенесите или удалите их');
    db.finance = next; save(); return { finance: db.finance };
  }
  // Себестоимость: { id товара: ₽ }, пустое значение — убрать
  if (p[2] === 'costs' && M === 'PUT') {
    const v = body.costs; if (!v || typeof v !== 'object') fail(400, 'Нет данных');
    const ids = db.products.map((x) => x.id), costs = Object.assign({}, db.finance.costs);
    Object.keys(v).forEach((id) => { if (ids.includes(id)) delete costs[id]; });
    Object.assign(costs, Finance.cleanCosts(v, ids));
    db.finance.costs = costs; save(); return { finance: db.finance };
  }
  // Приход товара: остатки растут, закупка уходит в расходы, себестоимость пересчитывается
  if (p[2] === 'receive' && !p[3] && M === 'POST') return receiveGoods(body);
  if (p[2] === 'receive' && p[3] && M === 'DELETE') return receiveCancel(p[3]);
  if (p[2] === 'expenses') {
    if (!p[3] && M === 'POST') {
      const r = Finance.cleanExpense(body, db.finance); if (r.error) fail(400, r.error);
      const e = Object.assign({ id: uid('x'), createdAt: new Date().toISOString() }, r.value);
      db.expenses.push(e); save(); return { expense: e };
    }
    const e = p[3] && db.expenses.find((x) => x.id === p[3]); if (!e) fail(404, 'Операция не найдена');
    if (M === 'PUT') { const r = Finance.cleanExpense(body, db.finance); if (r.error) fail(400, r.error); Object.assign(e, r.value, { updatedAt: new Date().toISOString() }); save(); return { expense: e }; }
    if (M === 'DELETE') { db.expenses = db.expenses.filter((x) => x !== e); save(); return {}; }
  }
  fail(404, 'Не найдено');
}
/* ---------- Приход товара ----------
   Пришла партия: указываете товар, сколько штук каждого цвета и размера и сколько стоила одна вещь.
   Остатки сразу растут (и уходят письма «Снова в наличии»), сумма закупки записывается операцией
   в «Финансы» (категория закупки), себестоимость товара пересчитывается — средняя по складу или новая цена. */
function receiveGoods(b) {
  const pr = db.products.find((x) => x.id === b.productId); if (!pr) fail(400, 'Выберите товар');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? b.date : new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
  const lines = [];
  (Array.isArray(b.lines) ? b.lines : []).forEach((l) => {
    const qty = Math.round(Number(l && l.qty) || 0); if (qty <= 0) return;
    if (qty > 100000) fail(400, 'Слишком большое количество');
    const c = (pr.colors || []).find((x) => x.id === l.colorId); const sz = c && (c.sizes || []).find((x) => x.size === l.size);
    if (!sz) fail(400, 'Такого цвета или размера у товара нет — добавьте его в карточке товара');
    lines.push({ colorId: c.id, color: c.name || '', size: sz.size, qty });
  });
  if (!lines.length) fail(400, 'Укажите количество хотя бы для одного размера');
  const qty = lines.reduce((s, l) => s + l.qty, 0);
  const unit = Math.round(Math.max(0, Math.min(10000000, Number(b.unitCost) || 0)) * 100) / 100;
  const units0 = (pr.colors || []).reduce((s, c) => s + (c.sizes || []).reduce((t, z) => t + Math.max(0, Number(z.stock) || 0), 0), 0);
  const costBefore = Number(db.finance.costs[pr.id]) || 0;
  const mode = ['avg', 'set', 'keep'].includes(b.costMode) ? b.costMode : 'avg';
  let costAfter = costBefore;
  if (unit > 0 && mode !== 'keep') costAfter = mode === 'set' || !(costBefore > 0) || units0 <= 0 ? unit : Math.round((units0 * costBefore + qty * unit) / (units0 + qty) * 100) / 100;
  // операция в «Финансах»
  let expense = null;
  if (unit > 0) {
    const cats = db.finance.categories || [];
    const cat = cats.find((c) => c.id === b.categoryId && c.kind === 'purchase') || cats.find((c) => c.kind === 'purchase');
    if (!cat) fail(400, 'В «Финансах» нет категории закупки — добавьте её в настройках');
    const note = ('Приход: ' + pr.name + ' — ' + lines.map((l) => (l.color ? l.color + ' ' : '') + l.size + ' × ' + l.qty).join(', ') + (b.note ? '. ' + String(b.note) : '')).slice(0, 300);
    const r = Finance.cleanExpense({ date, categoryId: cat.id, amount: Math.round(unit * qty * 100) / 100, note }, db.finance); if (r.error) fail(400, r.error);
    expense = Object.assign({ id: uid('x'), createdAt: new Date().toISOString(), auto: 'receive' }, r.value);
  }
  // остатки
  lines.forEach((l) => { const sz = pr.colors.find((c) => c.id === l.colorId).sizes.find((z) => z.size === l.size); sz.stock = Math.max(0, Number(sz.stock) || 0) + l.qty; });
  if (expense) db.expenses.push(expense);
  if (costAfter !== costBefore) db.finance.costs = Object.assign({}, db.finance.costs, { [pr.id]: costAfter });
  const rec = { id: uid('r'), at: new Date().toISOString(), date, productId: pr.id, name: pr.name, lines, qty, unitCost: unit, total: Math.round(unit * qty * 100) / 100, costMode: mode, costBefore, costAfter, expenseId: expense ? expense.id : '', note: String(b.note || '').slice(0, 200) };
  db.receipts.push(rec);
  save();
  processWaitlist().catch((e) => console.error('Снова в наличии:', e.message));
  return { receipt: rec, product: pr, finance: db.finance, expense };
}
// Отмена прихода (ошиблись при вводе): остатки уменьшаются обратно, операция закупки удаляется
function receiveCancel(id) {
  const rec = db.receipts.find((x) => x.id === id); if (!rec) fail(404, 'Приход не найден');
  const pr = db.products.find((x) => x.id === rec.productId);
  if (pr) {
    for (const l of rec.lines) { const c = (pr.colors || []).find((x) => x.id === l.colorId), sz = c && c.sizes.find((z) => z.size === l.size); if (sz && (Number(sz.stock) || 0) < l.qty) fail(400, 'Часть этой партии уже продана (' + (l.color ? l.color + ' ' : '') + l.size + ') — отменить приход целиком нельзя. Поправьте остатки в карточке товара'); }
    rec.lines.forEach((l) => { const sz = pr.colors.find((x) => x.id === l.colorId).sizes.find((z) => z.size === l.size); sz.stock = Math.max(0, (Number(sz.stock) || 0) - l.qty); });
    if (Number(db.finance.costs[pr.id]) === rec.costAfter && rec.costAfter !== rec.costBefore) { const c = Object.assign({}, db.finance.costs); if (rec.costBefore > 0) c[pr.id] = rec.costBefore; else delete c[pr.id]; db.finance.costs = c; }
  }
  if (rec.expenseId) db.expenses = db.expenses.filter((x) => x.id !== rec.expenseId);
  db.receipts = db.receipts.filter((x) => x !== rec);
  save(); return { finance: db.finance, product: pr || null };
}

/* ---------- СДЭК пачкой: одна печать на несколько заказов, вызов курьера ---------- */
async function cdekBatchApi(p, M, body, url) {
  if (!cdek.ready()) fail(400, 'СДЭК не подключён — введите ключи в «Оплата и доставка»');
  // Наклейки или накладные сразу для нескольких заказов — один PDF
  if (p[1] === 'cdek-print' && M === 'GET') {
    const ids = String(url.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 100);
    const os = ids.map((id) => db.orders.find((x) => x.id === id)).filter((o) => o && o.cdek && o.cdek.uuid);
    if (!os.length) fail(400, 'У выбранных заказов нет отправлений СДЭК');
    const kind = url.searchParams.get('kind') === 'barcode' ? 'barcode' : 'waybill';
    let buf; try { buf = await cdek.print(os.map((o) => o.cdek.uuid), kind); } catch (e) { fail(502, 'СДЭК: ' + e.message); }
    return { __file: { buf, type: 'application/pdf', name: (kind === 'barcode' ? 'naklejki-' : 'nakladnye-') + os.length + '-zakaz.pdf' } };
  }
  // Вызов курьера: забрать посылки выбранных заказов по адресу магазина
  if (p[1] === 'cdek-intake' && !p[2] && M === 'POST') {
    const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 100);
    const os = ids.map((id) => db.orders.find((x) => x.id === id)).filter((o) => o && o.cdek && o.cdek.uuid && !['canceled', 'returned'].includes(o.status));
    if (!os.length) fail(400, 'Выберите заказы с созданными отправлениями');
    const date = String(body.date || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, 'Выберите день');
    const today = new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10); if (date < today) fail(400, 'День уже прошёл');
    const tm = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : '';
    const from = tm(body.from) || '10:00', to = tm(body.to) || '18:00';
    const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    if (mins(to) - mins(from) < 180) fail(400, 'СДЭК просит окно не короче 3 часов');
    const pk = { cityCode: Number(body.cityCode) || Number((cdekCfg().shipmentPoint || {}).cityCode) || 0, address: String(body.address || '').trim().slice(0, 255), name: String(body.name || '').trim().slice(0, 100), phone: normPhone(body.phone) };
    if (!pk.cityCode) fail(400, 'Укажите город');
    if (pk.address.length < 5) fail(400, 'Укажите адрес, откуда забрать посылки');
    if (!pk.name) fail(400, 'Укажите, кто передаст посылки');
    if (pk.phone.length !== 11) fail(400, 'Проверьте телефон');
    // запоминаем адрес забора для следующего раза
    db.settings.cdek = Object.assign({}, db.settings.cdek, { pickup: pk });
    const weight = os.reduce((s, o) => s + ((o.cdek.pkg && o.cdek.pkg.weight) || 500), 0);
    const req = {
      intake_date: date, intake_time_from: from, intake_time_to: to,
      name: 'Одежда, ' + os.length + ' ' + (os.length === 1 ? 'посылка' : os.length < 5 ? 'посылки' : 'посылок'),
      weight, length: 40, width: 30, height: Math.min(150, 10 * os.length),
      comment: ('Заказы: ' + os.map((o) => o.cdek.number || ('ALB-' + o.number)).join(', ') + (body.comment ? '. ' + String(body.comment) : '')).slice(0, 255),
      need_call: !!body.needCall,
      sender: { company: db.settings.storeName || 'ALBAKOV', name: pk.name, phones: [{ number: '+' + pk.phone }] },
      from_location: { code: pk.cityCode, address: pk.address }
    };
    if (os.length === 1 && os[0].cdek.number) req.cdek_number = Number(os[0].cdek.number) || undefined;
    let uuid; try { uuid = await cdek.intake(req); } catch (e) { fail(502, 'СДЭК: ' + e.message); }
    const it = { id: uid('k'), uuid, number: '', status: 'ACCEPTED', statusName: 'Заявка принята', createdAt: new Date().toISOString(), date, from, to, orders: os.map((o) => ({ id: o.id, number: o.number, cdek: o.cdek.number || '' })), address: pk.address, weight };
    db.intakes.push(it); save();
    try { await new Promise((r) => setTimeout(r, 1500)); const info = await cdek.intakeInfo(uuid); if (info.error) { db.intakes = db.intakes.filter((x) => x !== it); save(); fail(400, 'СДЭК отклонил заявку: ' + info.error); } Object.assign(it, { number: info.number, status: info.status || it.status, statusName: info.statusName || it.statusName }); save(); } catch (e) { if (e instanceof HttpError) throw e; }
    os.forEach((o) => hist(o, 'Вызван курьер СДЭК на ' + date + ', ' + from + '–' + to, 'admin'));
    save(); return { intake: it, intakes: db.intakes };
  }
  if (p[1] === 'cdek-intake' && p[2]) {
    const it = db.intakes.find((x) => x.id === p[2]); if (!it) fail(404, 'Заявка не найдена');
    if (M === 'POST' && p[3] === 'sync') { try { const info = await cdek.intakeInfo(it.uuid); Object.assign(it, { number: info.number || it.number, status: info.status || it.status, statusName: info.statusName || it.statusName }); save(); } catch (e) { fail(502, 'СДЭК: ' + e.message); } return { intake: it };
    }
    if (M === 'DELETE') { try { await cdek.intakeCancel(it.uuid); } catch (e) { fail(502, 'СДЭК: ' + e.message); } it.status = 'REMOVED'; it.statusName = 'Отменена'; save(); return { intake: it }; }
  }
  fail(404, 'Не найдено');
}

/* ---------- Присмотр за сайтом ----------
   Раз в час: резервные копии (файл состояния от tools/backup.js) и место на диске.
   Что-то не так — письмо владельцу, не чаще раза в сутки по каждой проблеме. Если сайт совсем не отвечает,
   написать он не сможет — для этого включён внешний мониторинг Яндекс Метрики. */
function siteProblems() {
  const out = [];
  try {
    const st = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'backup-status.json'), 'utf8'));
    const age = (Date.now() - new Date(st.at).getTime()) / 36e5;
    if (!st.ok) out.push({ key: 'backup-fail', title: 'Резервная копия не сделалась', text: 'Последняя попытка ' + new Date(st.at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' закончилась ошибкой' + (st.error ? ': ' + st.error : '') + '.' });
    else if (age > 30) out.push({ key: 'backup-old', title: 'Резервные копии не обновлялись ' + Math.round(age / 24 * 10) / 10 + ' дн.', text: 'Копия должна делаться каждую ночь в 03:30. Последняя — ' + new Date(st.at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + '.' });
    else if (st.s3 && st.s3.enabled && st.s3.ok === false) out.push({ key: 'backup-s3', title: 'Копия не ушла в хранилище Selectel', text: 'На сервере копия есть, а в облачное хранилище не загрузилась' + (st.s3.error ? ': ' + st.s3.error : '') + '.' });
  } catch (e) { /* копии ещё не настраивались (например, на тестовой копии) — молчим */ }
  try {
    const st = fs.statfsSync(DATA_DIR), free = st.bavail * st.bsize, total = st.blocks * st.bsize;
    if (free < 1.5e9 || free / total < 0.08) out.push({ key: 'disk', title: 'Заканчивается место на сервере', text: 'Свободно ' + (Math.round(free / 1e8) / 10) + ' ГБ из ' + (Math.round(total / 1e8) / 10) + ' ГБ. Когда место кончится, заказы перестанут сохраняться.' });
  } catch (e) {}
  return out;
}
function siteAlertMail(problems, test) {
  const to = ownerTo('system'); if (!to || !mailReady() || !problems.length) return Promise.resolve(false);
  const m = Mail.renderNotice({ store: db.settings.storeName, logo: brandLogo(), test, subject: problems.length === 1 ? problems[0].title : 'Проблемы на сайте: ' + problems.length,
    eyebrow: 'Состояние сайта', title: problems.length === 1 ? problems[0].title : 'На сайте есть проблемы', lead: 'Магазин работает, но это лучше поправить в ближайшее время — подробности в панели, раздел «Обзор» → «Состояние сайта».',
    rows: problems.map((x) => [x.title, x.text, '']), button: 'Открыть панель', url: PUBLIC_URL + '/admin?s=overview' });
  return sendMail({ to, subject: m.subject, html: m.html, text: m.text }).then(() => true, (e) => { console.error('Письмо о состоянии сайта не отправлено:', e.message); return false; });
}
function siteWatch() {
  const now = Date.now(), sent = db.alertsSent = db.alertsSent || {};
  const fresh = siteProblems().filter((x) => !(sent[x.key] && now - sent[x.key] < 23 * 36e5));
  if (!fresh.length) return;
  siteAlertMail(fresh).then((ok) => { if (ok) { fresh.forEach((x) => { sent[x.key] = now; }); save(); } });
}
setTimeout(siteWatch, 5 * 60e3).unref(); setInterval(siteWatch, 60 * 60e3).unref();

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

function orderView(o) { const c = Object.assign({}, o); delete c.token; c.requestState = requestState(o); c.doneAt = doneAtOf(o) || undefined; return c; }
// Покупателю — без служебного: заметка магазина и история изменений видны только в панели
function customerView(o) { const c = orderView(o); delete c.adminNote; delete c.history; delete c.fin; return c; }

/* ---------------- Маршруты API ---------------- */
async function api(req, res, url, body) {
  const p = url.pathname.replace(/^\/api\//, '').split('/').map(safeDecode);
  if (p.includes(null)) fail(400, 'Неверный адрес');
  const M = req.method;
  const user = () => currentUser(req);

  if (p[0] === 'state' && M === 'GET') return { data: publicState(), user: publicUser(user()), isAdmin: isAdmin(req) };

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
      throttleOk(tk);
      // Владелец и сотрудники с нового устройства входят только по коду из письма (13.60)
      if (staffRole(u) && mailReady() && u.email && !trustedDevice(req, u)) {
        sweepPending();
        for (const [k, r] of pendingLogins) if (r.userId === u.id) pendingLogins.delete(k);
        const r = { id: crypto.randomBytes(16).toString('hex'), userId: u.id, f: { email: u.email, firstName: u.firstName }, device: deviceName(req) };
        await sendCode(r, 'login'); pendingLogins.set(r.id, r);
        return { confirm: { id: r.id, email: maskEmail(u.email), minutes: VERIFY_MIN, resendIn: VERIFY_RESEND_SEC } };
      }
      createSession(res, 'user', u.id);
      if (staffRole(u)) { touchDevice(req, res, u); auditAdd(req, { area: 'security', text: 'Вход в панель · ' + deviceName(req) }, u); }
      return { user: publicUser(u), isAdmin: !!staffRole(u) };
    }
    if (p[1] === 'login-confirm' && M === 'POST') {
      throttle(req, 'verify', 40);
      sweepPending();
      const r = pendingLogins.get(String(body.id || ''));
      if (!r) fail(410, 'Код устарел. Войдите ещё раз — пришлём новый');
      const code = String(body.code || '').replace(/\D/g, '');
      if (code.length !== 6) fail(400, 'Введите все 6 цифр кода');
      if (r.tries >= VERIFY_TRIES) { pendingLogins.delete(r.id); fail(429, 'Слишком много неверных попыток. Войдите ещё раз'); }
      if (!safeEqual(codeHash(r.id, code), r.code)) { r.tries++; const left = VERIFY_TRIES - r.tries; fail(400, left > 0 ? 'Неверный код. Осталось попыток: ' + left : 'Слишком много неверных попыток. Войдите ещё раз'); }
      pendingLogins.delete(r.id);
      const u = db.users.find((x) => x.id === r.userId); if (!u) fail(400, 'Аккаунт не найден');
      createSession(res, 'user', u.id); touchDevice(req, res, u, true);
      auditAdd(req, { area: 'security', text: 'Вход в панель с нового устройства · ' + r.device }, u);
      pushStaff('security', { title: 'Вход в панель с нового устройства', body: [u.firstName, u.lastName].filter(Boolean).join(' ') + (staffRole(u) ? ' (' + ROLES[staffRole(u)].name + ')' : '') + ' · ' + r.device + '. Если это не ваш сотрудник — заберите доступ в «Сотрудниках».', url: '/admin?s=audit', tag: 'sec-' + u.id, urgent: true });
      return { user: publicUser(u), isAdmin: !!staffRole(u) };
    }
    if (p[1] === 'login-resend' && M === 'POST') {
      throttle(req, 'resend', 20);
      sweepPending();
      const r = pendingLogins.get(String(body.id || ''));
      if (!r) fail(410, 'Код устарел. Войдите ещё раз — пришлём новый');
      const wait = Math.ceil((r.sentAt + VERIFY_RESEND_SEC * 1000 - Date.now()) / 1000);
      if (wait > 0) fail(429, 'Новый код можно запросить через ' + wait + ' с');
      if (r.sends >= VERIFY_SENDS) fail(429, 'Код уже отправлялся несколько раз. Проверьте папку «Спам»');
      await sendCode(r, 'login');
      return { resendIn: VERIFY_RESEND_SEC };
    }
    // Восстановление пароля: код на почту аккаунта, потом новый пароль. Есть ли такой аккаунт — не сообщаем
    if (p[1] === 'forgot' && M === 'POST') {
      throttle(req, 'forgot', 8);
      if (!mailReady()) fail(503, 'Восстановление пароля временно недоступно. Напишите нам — поможем войти');
      sweepPending();
      const l = String(body.login || '').trim().toLowerCase(), ph = normPhone(l);
      const u = db.users.find((x) => x.email === l || (ph.length === 11 && x.phone === ph));
      const id = crypto.randomBytes(16).toString('hex');
      if (u) {
        for (const [k, r] of pendingResets) if (r.userId === u.id) pendingResets.delete(k);
        const r = { id, userId: u.id, f: { email: u.email, firstName: u.firstName } };
        await sendCode(r, 'reset'); pendingResets.set(id, r);
      }
      return { id, email: u ? maskEmail(u.email) : (validEmail(l) ? maskEmail(l) : ''), resendIn: VERIFY_RESEND_SEC };
    }
    if (p[1] === 'reset' && M === 'POST') {
      throttle(req, 'verify', 40);
      sweepPending();
      const r = pendingResets.get(String(body.id || ''));
      const code = String(body.code || '').replace(/\D/g, '');
      if (code.length !== 6) fail(400, 'Введите все 6 цифр кода');
      if (String(body.password || '').length < 6) fail(400, 'Пароль должен быть не короче 6 символов');
      if (!pwOk(body.password)) fail(400, 'Слишком длинный пароль');
      if (!r) fail(400, 'Неверный или устаревший код. Запросите новый');
      if (r.tries >= VERIFY_TRIES) fail(429, 'Слишком много неверных попыток. Запросите новый код');
      if (!safeEqual(codeHash(r.id, code), r.code)) { r.tries++; const left = VERIFY_TRIES - r.tries; fail(400, left > 0 ? 'Неверный код. Осталось попыток: ' + left : 'Слишком много неверных попыток. Запросите новый код'); }
      const u = db.users.find((x) => x.id === r.userId); pendingResets.delete(r.id);
      if (!u) fail(400, 'Аккаунт не найден');
      u.hash = hashPassword(body.password);
      // старые входы на других устройствах закрываем — пароль мог знать посторонний
      for (const k in db.sessions) if (db.sessions[k].kind === 'user' && db.sessions[k].userId === u.id) delete db.sessions[k];
      createSession(res, 'user', u.id); save();
      return { user: publicUser(u) };
    }
    if (p[1] === 'logout' && M === 'POST') { const s = getSession(req, 'user'); if (s) { delete db.sessions[s.token]; save(); } setCookie(res, 'sid', '', 0); return {}; }
  }

  if (p[0] === 'me' && p[1] === 'push') {
    const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
    if (M === 'PUT') { const v = body.prefs || {}; u.pushPrefs = {}; for (const k of Object.keys(PUSH_CUSTOMER)) u.pushPrefs[k] = !!v[k]; if (u.pushPrefs.promo && !u.pushPromoAt) u.pushPromoAt = new Date().toISOString(); save(); }
    return { prefs: pushPrefsOf(u), devices: db.pushsubs.filter((x) => x.scope !== 'staff' && x.userId === u.id).length };
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
  // Корзина вошедшего покупателя хранится и на сервере: видна на всех устройствах, по ней приходит напоминание
  if (p[0] === 'me' && p[1] === 'cart' && M === 'PUT') {
    const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
    const lines = cleanCartLines(body.lines), key = JSON.stringify(lines);
    if (!u.cart || u.cart.key !== key) u.cart = { lines, key, updatedAt: new Date().toISOString(), reminded: false };
    save(); return {};
  }
  if (p[0] === 'me' && p[1] === 'prefs' && M === 'PUT') {
    const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
    if (typeof body.cartRemind === 'boolean') { u.cartRemind = body.cartRemind; u.cartRemindAt = new Date().toISOString(); }
    save(); return { user: publicUser(u) };
  }
  if (p[0] === 'me' && p[1] === 'favorites' && M === 'PUT') {
    const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
    u.favorites = cleanFavorites(body.list); save(); return { user: publicUser(u) };
  }
  if (p[0] === 'me' && !p[1] && M === 'PUT') {
    const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
    const email = String(body.email || '').trim().toLowerCase(), phone = normPhone(body.phone);
    if (!String(body.firstName || '').trim() || !String(body.lastName || '').trim()) fail(400, 'Укажите имя и фамилию');
    if (phone.length !== 11) fail(400, 'Проверьте номер телефона');
    if (!validEmail(email)) fail(400, 'Проверьте электронную почту');
    if (db.users.some((x) => x.id !== u.id && x.email === email)) fail(409, 'Эта почта уже используется');
    if (db.users.some((x) => x.id !== u.id && x.phone === phone)) fail(409, 'Этот телефон уже используется');
    // Смена пароля или почты (почта — это логин) — только с текущим паролем: иначе чужой человек с открытым кабинетом мог бы забрать аккаунт
    if (body.newPassword || email !== u.email) {
      const tk = throttle(req, 'pwcheck', 15);
      if (!String(body.currentPassword || '')) fail(400, body.newPassword ? 'Введите текущий пароль, чтобы сменить его' : 'Введите текущий пароль, чтобы сменить почту');
      if (!pwOk(body.currentPassword) || !checkPassword(body.currentPassword, u.hash)) fail(400, 'Текущий пароль указан неверно');
      throttleOk(tk);
    }
    Object.assign(u, { firstName: body.firstName.trim().slice(0, 60), lastName: body.lastName.trim().slice(0, 60), email, phone });
    if (body.newPassword) { if (String(body.newPassword).length < 6) fail(400, 'Пароль должен быть не короче 6 символов'); if (!pwOk(body.newPassword)) fail(400, 'Слишком длинный пароль'); u.hash = hashPassword(body.newPassword); }
    save(); return { user: publicUser(u) };
  }

  // Удаление аккаунта (13.64.0, требование App Store 5.1.1(v)): по паролю. Личные данные, избранное, корзина, бонусы,
  // подписки и вход удаляются; заказы и чеки остаются у магазина (учёт по закону), но больше не привязаны к аккаунту
  if (p[0] === 'me' && p[1] === 'delete' && M === 'POST') {
    const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
    const tk = throttle(req, 'pwcheck', 15);
    if (!pwOk(body.password) || !checkPassword(body.password, u.hash)) fail(400, 'Пароль указан неверно');
    throttleOk(tk);
    if (String(u.phone || '') === OWNER_PHONE) fail(400, 'Это аккаунт владельца магазина — его нельзя удалить из кабинета');
    db.orders.forEach((o) => { if (o.userId === u.id) o.userId = null; });
    // Обращения в поддержку: без заказа — удаляем, по заказу — оставляем без имени и контактов
    db.tickets = db.tickets.filter((t) => t.userId !== u.id || t.orderId);
    db.tickets.forEach((t) => { if (t.userId === u.id) Object.assign(t, { userId: null, name: 'Удалённый покупатель', email: '', phone: '' }); });
    db.waitlist = db.waitlist.filter((w) => w.userId !== u.id && w.email !== u.email);
    db.pushsubs = (db.pushsubs || []).filter((x) => x.userId !== u.id);
    if (db.secrets.staff) db.secrets.staff = db.secrets.staff.filter((x) => x.userId !== u.id);
    for (const k in db.sessions) if (db.sessions[k].userId === u.id) delete db.sessions[k];
    for (const m of [pendingLogins, pendingResets]) for (const [k, r] of m) if (r.userId === u.id) m.delete(k);
    db.users = db.users.filter((x) => x.id !== u.id);
    save(); setCookie(res, 'sid', '', 0);
    return {};
  }

  if (p[0] === 'orders') {
    if (!p[1] && M === 'GET') { const u = user(); if (!u) fail(401, 'Войдите в личный кабинет'); return { orders: db.orders.filter((o) => o.userId === u.id).reverse().map(customerView) }; }
    if (!p[1] && M === 'POST') { throttle(req, 'order', 20); return await placeOrder(req, body); }
    if (p[1] && p[2] === 'request' && M === 'POST') {
      throttle(req, 'request', 20);
      const o = db.orders.find((x) => x.id === p[1]); const u = user();
      const allowed = o && ((u && o.userId === u.id) || safeEqual(String(body.t || ''), o.token));
      if (!allowed) fail(404, 'Заказ не найден');
      const r = await createRequest(o, body);
      return { order: customerView(o), request: r };
    }
    if (p[1] && M === 'GET') {
      const o = db.orders.find((x) => x.id === p[1]); const u = user();
      const t = url.searchParams.get('t') || '';
      const allowed = o && ((u && o.userId === u.id) || safeEqual(t, o.token) || isAdmin(req));
      if (!allowed) fail(404, 'Заказ не найден');
      await syncPayment(o);
      return { order: isAdmin(req) ? orderView(o) : customerView(o) };
    }
  }

  // Своя статистика без cookie и персональных данных: сколько зашло, открыло товар, положило в корзину, начало оформление
  if (p[0] === 't' && M === 'POST') {
    if (/bot|crawl|spider|slurp|yandex(bot|images)|googlebot|headless|lighthouse|preview/i.test(String(req.headers['user-agent'] || ''))) return {};
    const e = String(body.e || ''); if (!['v', 'p', 'c', 'k', 'pv'].includes(e)) fail(400, 'Неизвестное событие');
    throttle(req, e === 'pv' ? 'statpv' : 'stat', e === 'pv' ? 600 : 400);
    if (isAdmin(req)) return {}; // заходы владельца с открытой админкой не считаем, даже если браузер забыл пометку
    const day = new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10); // по Москве
    // Повторы за день не считаем: браузер шлёт свой случайный номер; без номера — отпечаток адреса и браузера (только в памяти, с солью)
    const sid = /^[a-z0-9]{12,40}$/.test(String(body.id || '')) ? String(body.id) : 'h' + crypto.createHash('sha256').update(STAT_SALT + clientIp(req) + '|' + String(req.headers['user-agent'] || '')).digest('hex').slice(0, 24);
    if (statSeen.day !== day) { statSeen.day = day; statSeen.keys = new Set(); }
    if (e !== 'pv') { // просмотры страниц считаем все, остальное — один раз в день на посетителя
      const sk = sid + ':' + e;
      if (statSeen.keys.has(sk) || statSeen.keys.size > 300000) return {};
      statSeen.keys.add(sk);
    }
    db.stats = db.stats || {};
    const d = db.stats[day] = db.stats[day] || { v: 0, p: 0, c: 0, k: 0, pv: 0, src: {}, dev: { m: 0, d: 0 } };
    d[e] = (d[e] || 0) + 1;
    if (e === 'v') {
      const SRC = ['instagram', 'telegram', 'vk', 'yandex', 'google', 'direct', 'other'];
      const sc = SRC.includes(body.src) ? body.src : 'other'; d.src[sc] = (d.src[sc] || 0) + 1;
      d.dev[body.m ? 'm' : 'd']++;
      const keys = Object.keys(db.stats).sort(); while (keys.length > 120) delete db.stats[keys.shift()];
    }
    statDirty = true; return {};
  }
  // Подарочный сертификат: проверить остаток по коду
  if (p[0] === 'gifts' && p[1] === 'check' && M === 'POST') {
    throttle(req, 'giftcheck', 20);
    const g = findGift(body.code), st = giftState(g);
    if (!g) fail(404, GIFT_MSG.none);
    return { gift: Object.assign(giftView(g), { message: st === 'active' ? '' : GIFT_MSG[st] }) };
  }
  // Купить сертификат: заказ с онлайн-оплатой, после оплаты код уходит получателю
  if (p[0] === 'gifts' && !p[1] && M === 'POST') {
    throttle(req, 'gift', 10);
    const cfg = giftCfg(); if (!cfg.enabled) fail(400, 'Подарочные сертификаты сейчас недоступны');
    if (!payReady()) fail(400, 'Покупка сертификатов появится после подключения онлайн-оплаты');
    const amount = Math.round(Number(body.amount) || 0);
    if (!(amount >= cfg.min && amount <= cfg.max)) fail(400, 'Сумма сертификата — от ' + Pricing.format(cfg.min) + ' до ' + Pricing.format(cfg.max));
    const t = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
    const c = body.customer || {}, user = currentUser(req);
    const customer = { firstName: t(c.firstName, 60), lastName: t(c.lastName, 60), phone: normPhone(c.phone), email: t(c.email, 120).toLowerCase() };
    if (!customer.firstName || !customer.lastName) fail(400, 'Укажите ваше имя и фамилию');
    if (customer.phone.length !== 11) fail(400, 'Проверьте номер телефона');
    if (!validEmail(customer.email)) fail(400, 'Проверьте вашу электронную почту');
    const to = { name: t(body.toName, 60), email: t(body.toEmail, 120).toLowerCase() };
    if (!validEmail(to.email)) fail(400, 'Проверьте почту получателя');
    if (!body.consent) fail(400, 'Нужно согласие на обработку персональных данных');
    const today = new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10);
    const sendAt = /^\d{4}-\d{2}-\d{2}$/.test(String(body.sendAt || '')) && body.sendAt > today ? body.sendAt : '';
    if (sendAt && sendAt > new Date(Date.now() + 366 * 864e5).toISOString().slice(0, 10)) fail(400, 'Дату отправки можно выбрать в пределах года');
    const g = { id: uid('g'), code: giftCode(), amount, balance: amount, status: 'pending', createdAt: new Date().toISOString(), to, fromName: t(body.fromName, 60), message: t(body.message, 300), sendAt, log: [] };
    db.orderSeq = Number(db.orderSeq) || 0; do { db.orderSeq++; } while (db.orders.some((o) => o.number === String(db.orderSeq)));
    const order = {
      id: uid('o'), number: String(db.orderSeq), token: crypto.randomBytes(16).toString('hex'), createdAt: g.createdAt, userId: user ? user.id : null, customer, consentAt: g.createdAt, kind: 'gift', giftId: g.id,
      items: [{ productId: '', name: 'Подарочный сертификат ' + db.settings.storeName + ' на ' + Pricing.format(amount), qty: 1, price: amount, gift: true, color: '', size: '' }],
      subtotal: amount, saleDiscount: 0, promoCode: '', promoDiscount: 0, delivery: { id: 'email', name: 'Электронный сертификат — на почту ' + to.email, price: 0, city: '', address: '' }, comment: '',
      total: amount, payment: { method: 'online', status: 'pending', provider: (db.settings.payment || {}).provider }, status: 'new', bonusUsed: 0, bonusEarn: 0
    };
    g.orderId = order.id;
    db.giftcards.push(g); db.orders.push(order);
    let payUrl = null;
    try { payUrl = await createPayment(order); }
    catch (e) { db.giftcards = db.giftcards.filter((x) => x.id !== g.id); db.orders = db.orders.filter((x) => x.id !== order.id); save(); throw e; }
    save();
    return { order: customerView(order), token: order.token, payUrl };
  }
  // «Где мой заказ» без входа: номер заказа и телефон из него → секретная ссылка на страницу заказа
  if (p[0] === 'track' && M === 'POST') {
    throttle(req, 'track', 15);
    const num = String(body.number || '').replace(/\D/g, '').slice(0, 12), ph = normPhone(body.phone);
    if (!num) fail(400, 'Укажите номер заказа');
    if (ph.length !== 11) fail(400, 'Укажите телефон полностью');
    const o = db.orders.find((x) => x.number === num && x.customer && x.customer.phone === ph && !x.test);
    if (!o) fail(404, 'Заказ не найден. Проверьте номер и телефон — тот, что указывали при оформлении');
    return { id: o.id, token: o.token };
  }
  if (p[0] === 'support') { const u = user(); if (!u) fail(401, 'Войдите в личный кабинет'); return supportApi(req, p, M, body, u); }
  // Push-уведомления: ключ, подписка устройства, настройки покупателя, проверка
  if (p[0] === 'push') {
    if (p[1] === 'key' && M === 'GET') return { key: db.secrets.vapid.publicKey };
    if (p[1] === 'subscribe' && M === 'POST') return pushSubscribe(req, body);
    if (p[1] === 'unsubscribe' && M === 'POST') { const e = String(body.endpoint || ''); const n = db.pushsubs.length; db.pushsubs = db.pushsubs.filter((x) => !(x.endpoint === e && (body.scope === 'staff') === (x.scope === 'staff'))); if (n !== db.pushsubs.length) save(); return {}; }
    if (p[1] === 'test' && M === 'POST') {
      throttle(req, 'pushtest', 20);
      const e = String(body.endpoint || ''), x = db.pushsubs.find((y) => y.endpoint === e && (body.scope === 'staff') === (y.scope === 'staff')); if (!x) fail(404, 'Устройство не подписано');
      if (x.endpoint.startsWith('apns:') && !apnsCfg()) fail(400, 'Уведомления в приложении заработают, когда владелец добавит ключ Apple в панели');
      const n = await pushTo([x], body.scope === 'staff'
        ? { title: 'Уведомления панели включены', body: 'Сюда будут приходить новые заказы, вопросы и заявки — по вашей роли.', url: '/admin', tag: 'test' }
        : { title: 'Уведомления включены', body: 'Сообщим, когда заказ будет в пути и когда приедет в пункт выдачи.', url: '/account', tag: 'test' });
      if (!n) fail(502, 'Не получилось доставить уведомление. Проверьте, что они разрешены в настройках телефона');
      return { sent: n };
    }
  }

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

  // Срок и цена доставки одной вещи в город — для страницы товара (до оформления заказа)
  if (p[0] === 'cdek' && p[1] === 'estimate' && M === 'GET') {
    throttle(req, 'cdekest', 300);
    const city = String(url.searchParams.get('city') || '').replace(/\D/g, '').slice(0, 9);
    const prod = db.products.find((x) => x.id === url.searchParams.get('pid') && x.active !== false);
    if (!city || !prod) fail(400, 'Нет города или товара');
    const from = cdekCfg().shipmentPoint && cdekCfg().shipmentPoint.cityCode;
    const ms = (db.settings.delivery.methods || []).filter((m) => Pricing.cdekMode(m));
    const out = [];
    for (const m of ms) {
      const kind = Pricing.cdekMode(m) === 'door' ? 'door' : 'pvz';
      // known — цена точно известна: фиксированная из настроек или посчитанная СДЭК. Цена «по тарифу», которую СДЭК не посчитал, не 0 ₽
      let price = Math.round(Number(m.price) || 0), days = '', known = !m.priceAuto;
      if (cdek.ready() && from) {
        try { const r = await cdekShipPrice(m, city, kind, [{ productId: prod.id, qty: 1 }]); if (r) { if (m.priceAuto && Number(r.price) > 0) { price = Math.round(r.price); known = true; } days = r.days; } }
        catch (e) { console.error('СДЭК срок:', e.message); }
      }
      if (!known) price = 0;
      out.push({ id: m.id, name: m.name, kind, price, known, days, freeFrom: Math.round(Number(m.freeFrom) || 0) });
    }
    return { methods: out };
  }

  // Подсказки улицы и дома внутри выбранного города (данные OpenStreetMap через Photon) — чтобы адрес был без опечаток
  if (p[0] === 'geo' && p[1] === 'street' && M === 'GET') {
    throttle(req, 'geo', 300);
    return { items: await streetSuggest(url.searchParams.get('q'), url.searchParams.get('city'), url.searchParams.get('region')) };
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
    requireAdmin(req);
    // Права на каждый раздел: чего нет в списке — только владельцу
    const ROUTE_PERMS = {
      data: [], health: ['settings'], upload: [], 'order-seq': ['settings'], staff: ['staff'],
      orders: ['orders'], support: ['orders'], 'cdek-print': ['orders'], 'cdek-intake': ['orders'], 'cdek-calc': ['orders'], gifts: ['orders', 'marketing'], users: ['orders', 'marketing'], waitlist: ['orders', 'content'],
      products: ['content'], categories: ['content'], sizeCharts: ['content'], pages: ['content'], promotions: ['content', 'marketing'], promocodes: ['content', 'marketing'],
      finance: ['finance'], 'seo-ping': ['marketing'], 'owner-notify': ['mail'], 'mail-catalog': ['mail'],
      mail: !p[2] && M === 'POST' ? ['payment'] : ['mail'], // пароль почты для отправки меняет только тот, кому доверены ключи
      cdek: ['payment'], 'payment-secret': ['payment'], settings: [], push: [], apns: ['staff']
    };
    const need = Object.prototype.hasOwnProperty.call(ROUTE_PERMS, p[1]) ? ROUTE_PERMS[p[1]] : ['staff'];
    if (need.length) requirePerm(req, ...need);
    if (p[1] === 'audit' && M === 'GET') {
      const area = url.searchParams.get('area') || '', by = url.searchParams.get('by') || '', q = String(url.searchParams.get('q') || '').toLowerCase().slice(0, 80), till = url.searchParams.get('before') || '';
      let list = db.audit.slice().reverse();
      if (area) list = list.filter((x) => x.area === area);
      if (by) list = list.filter((x) => x.by === by);
      if (q) list = list.filter((x) => (x.text + ' ' + x.name).toLowerCase().includes(q));
      if (till) list = list.filter((x) => x.at < till);
      const people = {}; db.audit.forEach((x) => { if (x.by) people[x.by] = x.name; });
      return { items: list.slice(0, 100), more: list.length > 100, people: Object.keys(people).map((id) => ({ id, name: people[id] })) };
    }
    // Ключ Apple для push в приложении на iPhone. Сам ключ наружу не отдаём — только Key ID и Team ID
    if (p[1] === 'apns') {
      if (M === 'PUT') {
        const v = { keyId: String(body.keyId || '').trim().toUpperCase(), teamId: String(body.teamId || '').trim().toUpperCase(), p8: String(body.p8 || '').trim() };
        if (!v.p8 && db.secrets.apns) v.p8 = db.secrets.apns.p8;   // ключ уже сохранён — меняют только ID
        const er = Apns.checkKey(v); if (er) fail(400, er);
        db.secrets.apns = Object.assign(v, { at: new Date().toISOString() }); save();
      }
      if (M === 'DELETE') { delete db.secrets.apns; save(); }
      const a = db.secrets.apns;
      return { set: !!apnsCfg(), keyId: a ? a.keyId : '', teamId: a ? a.teamId : '', bundleId: IOS_BUNDLE, devices: db.pushsubs.filter((x) => x.endpoint.startsWith('apns:')).length };
    }
    // Push сотрудника: свои настройки; рассылка акций — с правом marketing
    if (p[1] === 'push') {
      const u = currentUser(req);
      if (!p[2] && M === 'PUT') { const v = body.prefs || {}; u.staffPush = {}; for (const k of Object.keys(PUSH_STAFF)) if (k in v) u.staffPush[k] = !!v[k]; save(); }
      if (!p[2] && (M === 'GET' || M === 'PUT')) {
        const promoUsers = new Set(db.users.filter((x) => pushPrefsOf(x).promo).map((x) => x.id));
        return { prefs: staffPushPrefs(u), devices: db.pushsubs.filter((x) => x.scope === 'staff' && x.userId === u.id).length,
          audience: can(req, 'marketing') ? db.pushsubs.filter((x) => x.scope !== 'staff' && promoUsers.has(x.userId)).length : null,
          customers: can(req, 'marketing') ? db.pushsubs.filter((x) => x.scope !== 'staff').length : null,
          broadcasts: can(req, 'marketing') ? (db.pushBroadcasts || []).slice(0, 20) : [] };
      }
      if (p[2] === 'broadcast' && M === 'POST') {
        requirePerm(req, 'marketing');
        const title = String(body.title || '').trim().slice(0, 60), text = String(body.body || '').trim().slice(0, 180);
        if (!title || !text) fail(400, 'Напишите заголовок и текст');
        const link = String(body.url || '/').trim(); if (!/^\/[^\s]*$/.test(link)) fail(400, 'Ссылка — адрес на сайте, например /sale или /product/…');
        const image = String(body.image || '').trim(); if (image && !/^(uploads|img)\/[\w./-]+$/.test(image.replace(/^\//, ''))) fail(400, 'Картинка — из загруженных на сайт');
        const promoUsers = new Set(db.users.filter((x) => pushPrefsOf(x).promo).map((x) => x.id));
        const subs = db.pushsubs.filter((x) => x.scope !== 'staff' && promoUsers.has(x.userId));
        if (body.test) { const mine = db.pushsubs.filter((x) => x.userId === u.id); const n = await pushTo(mine, { title, body: text, url: link, image, icon: image, tag: 'promo-test' }); if (!n) fail(400, 'Включите уведомления на этом устройстве — пришлём пробное сюда'); return { sent: n, test: true }; }
        const n = await pushTo(subs, { title, body: text, url: link, image, icon: image, tag: 'promo' });
        db.pushBroadcasts = [{ at: new Date().toISOString(), title, body: text, url: link, image, to: subs.length, sent: n, by: [u.firstName, u.lastName].filter(Boolean).join(' ') }].concat(db.pushBroadcasts || []).slice(0, 50);
        save(); return { sent: n, to: subs.length };
      }
    }
    if (p[1] === 'data' && M === 'GET') {
      // Каждая роль получает только свои данные: личные данные покупателей — тем, кто работает с заказами, деньги — финансам
      const has = (...x) => x.some((k) => can(req, k)), role = adminRole(req);
      const d = { settings: db.settings, role, roleName: ROLES[role].name, perms: perms(req), me: publicUser(currentUser(req)) };
      for (const k of COLLECTIONS) d[k] = db[k];
      // Тестовые заказы (оплата в тестовом режиме) в панели не показываются и не считаются
      d.orders = has('orders', 'finance', 'marketing') ? db.orders.filter((o) => !o.test).map(orderView) : [];
      d.testOrders = d.orders.length ? db.orders.filter((o) => o.test).length : 0;
      d.users = has('orders', 'marketing') ? db.users.map((u) => Object.assign(publicUser(u), { bonusLog: (u.bonusLog || []).slice(0, 100) })) : [];
      d.waitlist = has('orders', 'content', 'mail') ? db.waitlist.map((w) => { const c = Object.assign({}, w); delete c.token; return c; }) : [];
      d.supportNew = has('orders') ? db.tickets.filter((t) => t.unreadShop).length : 0;
      if (has('settings')) {
        // Состояние ночных резервных копий (файл пишет tools/backup.js) и автообновления из GitHub (deploy/autoupdate.sh)
        try { d.backup = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'backup-status.json'), 'utf8')); } catch (e) { d.backup = null; }
        try { d.update = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'update-status.json'), 'utf8')); } catch (e) { d.update = null; }
      }
      d.giftcards = has('orders', 'marketing') ? db.giftcards.map((g) => Object.assign({}, g, { state: giftState(g) })) : [];
      d.stats = has('finance', 'marketing') ? db.stats || {} : {};
      d.expenses = has('finance') ? db.expenses : [];
      d.finance = has('finance') ? db.finance : Finance.defaults();
      d.receipts = has('content', 'finance') ? db.receipts : [];
      d.intakes = has('orders') ? db.intakes : [];
      d.problems = has('settings') ? siteProblems() : [];
      d.seo = has('marketing') ? { indexnow: seoPingOn(), https: /^https:/.test(PUBLIC_URL), url: PUBLIC_URL, last: db.seoPing || null, pages: Seo.urls().length } : null;
      if (has('staff')) d.staff = staffList();
      return { data: d };
    }
    if (p[1] === 'staff') return staffApi(p, M, body);
    if (p[1] === 'health' && M === 'GET') return { health: health() };
    if (p[1] === 'finance') return financeApi(p, M, body);
    if (p[1] === 'cdek-print' || p[1] === 'cdek-intake') return await cdekBatchApi(p, M, body, url);
    // Отправить все страницы сайта в Яндекс прямо сейчас
    if (p[1] === 'seo-ping' && M === 'POST') {
      if (!/^https:/.test(PUBLIC_URL)) fail(400, 'Сначала включите HTTPS — Яндекс принимает страницы только с https-адресов');
      if (!seoPingOn()) fail(400, 'Оповещение Яндекса выключено');
      throttle(req, 'seoping', 10);
      seoPing(Seo.urls()); const r = await seoPingFlush();
      if (!r || !r.ok) fail(502, (r && r.error) || 'Не удалось отправить');
      return { last: r };
    }
    if (p[1] === 'support') return supportAdminApi(p, M, body);
    // Следующий номер заказа (Настройки → Нумерация заказов)
    if (p[1] === 'order-seq' && M === 'GET') return { next: (Number(db.orderSeq) || 0) + 1 };
    if (p[1] === 'order-seq' && M === 'POST') {
      const n = Number(body.next);
      if (!Number.isInteger(n) || n < 1 || n > 999999999) fail(400, 'Укажите целое число от 1');
      if (db.orders.some((o) => o.number === String(n))) fail(400, 'Заказ № ' + n + ' уже есть — укажите другой номер');
      db.orderSeq = n - 1; save(); return { next: n };
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
    // Уведомления на почту: прислать пример, чтобы проверить адрес и посмотреть, как выглядит письмо
    if (p[1] === 'owner-notify' && p[2] === 'test' && M === 'POST') {
      if (!mailReady()) fail(400, 'Сначала настройте почту для отправки: «Письма» → «Почта для отправки»');
      const to = ownerTo(); if (!to) fail(400, 'Укажите почту для уведомлений');
      const kind = ['order', 'support', 'stock', 'system'].includes(body.kind) ? body.kind : 'order';
      let sent;
      if (kind === 'system') sent = await siteAlertMail([{ key: 'test', title: 'Резервные копии не обновлялись 2 дн.', text: 'Пример письма: так придёт предупреждение, если ночная копия базы не сделалась или на сервере кончается место.' }], true);
      else if (kind === 'stock') sent = await stockMail(null, [['Футболка Оверсайз', 'Чёрный · M', 'осталось 1 шт.'], ['Худи Базовое', 'Серый · L', 'закончился']]);
      else if (kind === 'support') {
        const m = Mail.renderSupport({ kind: 'shop', store: db.settings.storeName, logo: brandLogo(), name: 'Анна (пример)', number: '57', topic: 'Размер и посадка', text: 'Здравствуйте! Подскажите, какой размер взять при росте 170 см? — Это проверочное письмо, отвечать не нужно.', url: PUBLIC_URL + '/admin?s=support', contacts: '' });
        sent = await sendMail({ to, subject: 'Проверка · ' + m.subject, html: m.html, text: m.text }).then(() => true, (e) => fail(400, 'Письмо не отправилось: ' + e.message));
      } else {
        const o = db.orders.filter((x) => !x.test && x.kind !== 'gift' && x.total > 0).slice(-1)[0] || { id: 'example', number: '1042', total: 12900, createdAt: new Date().toISOString(), items: [{ name: 'Футболка Оверсайз', color: 'Чёрный', size: 'M', qty: 2, price: 6450 }], customer: { firstName: 'Анна', lastName: 'Иванова', phone: '79001234567', email: 'anna@example.com' }, delivery: { name: 'СДЭК, пункт выдачи', city: 'Москва', price: 0 }, payment: { method: 'cod', status: 'new' } };
        const cs = db.settings.contacts || {};
        const ms = Mail.renderOrder({ kind: 'shop', url: `${PUBLIC_URL}/admin?s=orders&id=${o.id}`, store: db.settings.storeName, logo: brandLogo(), order: Object.assign({}, o, { items: o.items.map((i) => Object.assign({}, i, { image: absUrl(i.image) })) }), money: Pricing.format, payLabel: o.payment.status === 'paid' ? 'оплачено онлайн' : 'оплата при получении', contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
        sent = await sendMail({ to, subject: 'Проверка · ' + ms.subject, html: ms.html, text: ms.text }).then(() => true, (e) => fail(400, 'Письмо не отправилось: ' + e.message));
      }
      if (!sent) fail(400, 'Письмо не отправилось — проверьте настройки почты');
      return { sent: true, to };
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
    // Все письма сайта с примером — для раздела «Письма» в панели
    if (p[1] === 'mail-catalog' && (M === 'GET' || M === 'POST')) {
      const cs = db.settings.contacts || {}, mc = mailCfg(), base = { store: db.settings.storeName, logo: brandLogo(), contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') };
      const pr = db.products.find((x) => x.active !== false) || { name: 'Пальто оверсайз из шерсти', price: 38900 };
      const item = { name: pr.name, color: 'Графит', size: 'M', qty: 1, price: pr.price, image: absUrl(((Pricing.colorsOf(pr)[0] || {}).images || [])[0] || '') };
      const order = { id: 'demo', number: '25', customer: { firstName: 'Анна', lastName: 'Смирнова', phone: '79161112233', email: 'anna@example.ru' }, items: [item], subtotal: pr.price, promoDiscount: 0, saleDiscount: 0, bonusUsed: 0,
        delivery: { name: 'СДЭК, пункт выдачи', price: 380, city: 'Мурино (Ленинградская область)', address: 'ПВЗ СДЭК SPD25: б-р Петровский, 7' }, total: pr.price + 380, payment: { method: 'online', status: 'paid' }, comment: '' };
      const ord = (kind) => Mail.renderOrder(Object.assign({ kind, url: PUBLIC_URL + '/order/demo', order, money: Pricing.format, payLabel: 'оплачено онлайн' }, base));
      const c = (db.waitlist || [])[0], np = pr, ncol = Pricing.colorsOf(np)[0] || { name: 'Графит', images: [] };
      const list = [
        { key: 'code', title: 'Код подтверждения почты', when: 'При регистрации — покупатель вводит код на сайте', to: 'Покупателю', m: Mail.renderCode(Object.assign({ code: '483920', minutes: VERIFY_MIN, name: 'Анна' }, base)) },
        { key: 'code-login', title: 'Код для входа в панель', when: 'Сотрудник или владелец входит с нового устройства — без кода вход не пускает', to: 'Сотруднику', m: Mail.renderCode(Object.assign({ code: '715304', minutes: VERIFY_MIN, name: 'Ибрагим', purpose: 'login', device: 'iPhone, Safari' }, base)) },
        { key: 'welcome', title: 'Добро пожаловать', when: 'Сразу после регистрации: бонусы и промокод на первый заказ', to: 'Покупателю', m: Mail.renderWelcome(Object.assign({ name: 'Анна', url: PUBLIC_URL + '/', bonusPercent: String(Pricing.bonusConf(db.settings).percent || 5), promo: welcomePromo() }, base)) },
        { key: 'order', title: 'Заказ принят / оплачен', when: 'Оплата онлайн — после оплаты; при получении — сразу после оформления', to: 'Покупателю', m: ord('customer') },
        { key: 'order-shop', title: 'Новый заказ', when: 'Одновременно с письмом покупателю', to: 'Магазину — ' + (cs.email || mc.fromEmail || 'почта для связи'), m: ord('shop') },
        { key: 'tracking', title: 'Заказ отправлен, трек-номер', when: 'Когда посылку приняли в СДЭК (или вы вписали трек-номер вручную)', to: 'Покупателю', m: Mail.renderTracking(Object.assign({ name: 'Анна', number: '25', carrier: 'СДЭК', track: '1234567890', trackUrl: CDEK_TRACK + '1234567890', url: PUBLIC_URL + '/order/demo' }, base)) },
        { key: 'return-ship', title: 'Возврат оформлен: номер СДЭК', when: 'Когда вы оформили возврат через СДЭК в заказе', to: 'Покупателю', m: Mail.renderReturnShip(Object.assign({ name: 'Анна', number: '25', track: '1234567891', items: [item], to: 'б-р Петровский, 7, Мурино', cost: 310, url: PUBLIC_URL + '/order/demo' }, base)) },
        { key: 'refund', title: 'Деньги возвращены', when: 'После «Вернуть деньги» в заказе', to: 'Покупателю', m: Mail.renderRefund(Object.assign({ name: 'Анна', number: '25', amount: pr.price - 310, items: [item], delivery: false, full: true, url: PUBLIC_URL + '/order/demo' }, base)) },
        { key: 'support', title: 'Ответ поддержки', when: 'Когда вы отвечаете на обращение в разделе «Поддержка»', to: 'Покупателю', m: Mail.renderSupport(Object.assign({ kind: 'customer', name: 'Анна', number: '7', topic: 'Размер и посадка', orderNumber: '25', text: 'Здравствуйте! Пальто идёт в размер, при росте 170 советуем M.', url: PUBLIC_URL + '/account?tab=support' }, base)) },
        { key: 'support-shop', title: 'Новое обращение', when: 'Когда покупатель пишет в поддержку на сайте', to: 'Магазину — ' + (cs.email || mc.fromEmail || 'почта для связи'), m: Mail.renderSupport(Object.assign({ kind: 'shop', name: 'Анна', number: '7', topic: 'Размер и посадка', orderNumber: '25', text: 'Подскажите, пальто идёт в размер?', url: PUBLIC_URL + '/admin?s=support' }, base)) },
        { key: 'notify', title: 'Снова в наличии', when: 'Когда появился размер, о котором просили сообщить. Текст меняется в «Сообщить о поступлении»', to: 'Покупателю', m: Mail.render(notifyContext({ size: 'M' }, np, ncol)) }
      ];
      // «Отправить пример» — письмо с тестовыми данными на указанный адрес
      if (M === 'POST') {
        const x = list.find((y) => y.key === body.key); if (!x) fail(404, 'Письмо не найдено');
        const to = String(body.to || cs.email || '').trim(); if (!validEmail(to)) fail(400, 'Укажите почту для примера');
        if (!mailReady()) fail(400, 'Почта для отправки не настроена');
        try { await sendMail({ to, subject: '[Пример] ' + x.m.subject, html: x.m.html, text: x.m.text }); } catch (e) { fail(502, 'Письмо не отправлено: ' + e.message); }
        return { sent: to };
      }
      return { mail: { ready: mailReady(), from: mc.fromEmail, fromName: mc.fromName, replyTo: mc.replyTo, support: cs.email || '' },
        letters: list.map((x) => ({ key: x.key, title: x.title, when: x.when, to: x.to, subject: x.m.subject, html: x.m.html, text: x.m.text })) };
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
      if (!body.value || typeof body.value !== 'object' || Array.isArray(body.value)) fail(400, 'Пустые настройки');
      // Сотрудник меняет только поля своих разделов: чужие берутся из сохранённых настроек, а не из его (возможно, устаревшей) копии
      let next = body.value;
      if (!can(req, 'settings')) {
        next = Object.assign({}, db.settings);
        let changed = 0, denied = '';
        for (const k of new Set(Object.keys(db.settings).concat(Object.keys(body.value)))) {
          if (JSON.stringify(db.settings[k]) === JSON.stringify(body.value[k])) continue;
          if (!(SETTINGS_PERMS[k] || ['settings']).some((x) => can(req, x))) { denied = denied || k; continue; }
          if (k in body.value) next[k] = body.value[k]; else delete next[k];
          changed++;
        }
        if (!changed && denied) fail(403, 'У вашей роли нет прав менять эту настройку (' + denied + ')');
      }
      db.settings = next; if (db.settings.payment) delete db.settings.payment.parts; save(); return {};
    }
    // Массовые изменения товаров (13.60): цена, ±%, скидка, видимость
    if (p[1] === 'products' && p[2] === 'bulk' && M === 'POST') {
      const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string').slice(0, 5000) : [];
      const list = db.products.filter((x) => ids.includes(x.id)); if (!list.length) fail(400, 'Выберите товары');
      const v = Number(body.value) || 0, A = body.action, r10 = (n) => Math.max(1, Math.round(n));
      if (A === 'price' && !(v > 0 && v <= 10000000)) fail(400, 'Укажите цену');
      if (A === 'percent' && !(v !== 0 && v > -95 && v <= 500)) fail(400, 'Процент — от −95 до 500, например 10 или −10');
      if (A === 'discount' && !(v > 0 && v < 95)) fail(400, 'Скидка — от 1 до 94%');
      if (!['price', 'percent', 'discount', 'nodiscount', 'show', 'hide'].includes(A)) fail(400, 'Выберите, что изменить');
      let changed = 0;
      for (const x of list) {
        const was = JSON.stringify([x.price, x.compareAt, x.active]);
        if (A === 'price') x.price = r10(v);
        if (A === 'percent') { x.price = r10(x.price * (1 + v / 100)); if (x.compareAt && x.compareAt <= x.price) x.compareAt = 0; }
        if (A === 'discount') { const base = x.compareAt > x.price ? x.compareAt : x.price; x.compareAt = base; x.price = r10(base * (1 - v / 100)); }
        if (A === 'nodiscount' && x.compareAt > x.price) { x.price = x.compareAt; x.compareAt = 0; }
        if (A === 'show') x.active = true;
        if (A === 'hide') x.active = false;
        if (was !== JSON.stringify([x.price, x.compareAt, x.active])) { changed++; seoChanged('products', x); }
      }
      save();
      return { changed, notify: A === 'show' ? await processWaitlist() : null };
    }
    // Остатки в Excel: выгрузка CSV (разделитель «;», как в русском Excel) и загрузка с предпросмотром
    if (p[1] === 'products' && p[2] === 'stock.csv' && M === 'GET') {
      const q = (v) => { const t = String(v == null ? '' : v); return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
      const rows = [['Товар', 'Цвет', 'Размер', 'Артикул', 'Остаток', 'ID товара', 'ID цвета']];
      for (const x of db.products) for (const c of Pricing.colorsOf(x)) for (const z of c.sizes || []) rows.push([x.name, c.name || '', z.size, x.sku || '', z.stock || 0, x.id, c.id]);
      return { __file: { type: 'text/csv; charset=utf-8', name: 'ostatki.csv', buf: Buffer.from('﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n') + '\r\n') } };
    }
    if (p[1] === 'products' && p[2] === 'stock' && M === 'POST') {
      const text = String(body.csv || '').replace(/^﻿/, ''); if (!text.trim()) fail(400, 'Файл пустой');
      const first = text.split(/\r?\n/)[0], sep = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
      // разбор CSV с кавычками
      const rows = []; let row = [], cur = '', inq = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inq) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inq = false; } else cur += ch; continue; }
        if (ch === '"') inq = true; else if (ch === sep) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch;
      }
      if (cur || row.length) { row.push(cur); rows.push(row); }
      if (rows.length > 20001) fail(400, 'Слишком много строк');
      const H = rows.shift().map((h) => h.trim().toLowerCase());
      const col = (names) => H.findIndex((h) => names.includes(h));
      const iP = col(['id товара', 'product id']), iC = col(['id цвета', 'color id']), iS = col(['размер', 'size']), iQ = col(['остаток', 'stock', 'количество']), iN = col(['товар', 'название']), iCol = col(['цвет']), iSku = col(['артикул', 'sku']);
      if (iS < 0 || iQ < 0) fail(400, 'Не нашли колонки «Размер» и «Остаток». Выгрузите файл заново и меняйте только числа');
      const changes = [], errors = [], seen = new Set();
      rows.forEach((r, n) => {
        if (!r.some((x) => String(x).trim())) return;
        const line = 'строка ' + (n + 2), size = String(r[iS] || '').trim(), raw = String(r[iQ] || '').trim().replace(/\s/g, '');
        if (!/^\d{1,6}$/.test(raw)) { errors.push(line + ': остаток «' + raw + '» — нужно целое число'); return; }
        let x = iP >= 0 && db.products.find((y) => y.id === String(r[iP]).trim());
        if (!x && iSku >= 0 && String(r[iSku] || '').trim()) x = db.products.find((y) => y.sku && y.sku === String(r[iSku]).trim());
        if (!x && iN >= 0) x = db.products.find((y) => y.name === String(r[iN]).trim());
        if (!x) { errors.push(line + ': товар не найден'); return; }
        const cs = Pricing.colorsOf(x);
        const c = (iC >= 0 && cs.find((y) => y.id === String(r[iC]).trim())) || (iCol >= 0 && cs.find((y) => (y.name || '') === String(r[iCol]).trim())) || (cs.length === 1 ? cs[0] : null);
        if (!c) { errors.push(line + ': цвет не найден'); return; }
        const z = (c.sizes || []).find((y) => y.size === size); if (!z) { errors.push(line + ': размера ' + size + ' нет'); return; }
        const key = x.id + '|' + c.id + '|' + size; if (seen.has(key)) { errors.push(line + ': повтор'); return; } seen.add(key);
        const to = Number(raw); if (to !== Number(z.stock || 0)) changes.push({ name: x.name, color: c.name || '', size, from: Number(z.stock || 0), to, _z: z, _x: x });
      });
      const view = changes.map((c) => ({ name: c.name, color: c.color, size: c.size, from: c.from, to: c.to }));
      if (body.dry) return { changes: view, errors };
      const touched = new Set(); changes.forEach((c) => { c._z.stock = c.to; touched.add(c._x); });
      touched.forEach((x) => seoChanged('products', x)); save();
      return { changed: changes.length, errors, notify: await processWaitlist() };
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
      if (!p[2] && M === 'PUT') { if (!Array.isArray(body.value)) fail(400, 'Нужен список'); if (p[1] === 'products') { body.value.forEach(Pricing.migrateProduct); fixSkus(body.value, body.value, true); } db[p[1]] = body.value; save(); seoChanged(p[1]); return p[1] === 'products' ? { notify: await processWaitlist() } : {}; }
      if (p[2] && M === 'PUT') {
        const item = body.value; if (!item || item.id !== p[2]) fail(400, 'Неверные данные');
        if (p[1] === 'products') fixSkus([item], arr, true);
        if (p[1] === 'products') { const was = arr.find((x) => x.id === item.id); item.preorderSold = was ? (was.preorderSold || 0) : 0; if (Array.isArray(item.look)) item.look = item.look.filter((id) => id !== item.id && db.products.some((x) => x.id === id)).slice(0, 4); Pricing.migrateProduct(item); if (item.specs) { item.specs = Specs.clean(item.specs); if (!Object.keys(item.specs).length) delete item.specs; } }
        const i = arr.findIndex((x) => x.id === item.id);
        if (i === -1) arr.push(item); else arr[i] = item;
        save(); seoChanged(p[1], item); return p[1] === 'products' ? { notify: await processWaitlist() } : {};
      }
      if (p[2] && M === 'DELETE') { const gone = arr.find((x) => x.id === p[2]); db[p[1]] = arr.filter((x) => x.id !== p[2]); save(); if (gone) seoChanged(p[1], gone); return {}; } // удалённую страницу Яндекс перепроверит и уберёт из поиска
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
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8' };
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
  if (!exists || rel === '/index.html') return sendIndex(req, res, new URL(req.url, 'http://x'));
  const ext = path.extname(file).toLowerCase();
  // Фото товаров не меняются (новое фото — новый файл) — кэшируем надолго. Остальное браузер перепроверяет
  // при каждом заходе (ответ 304 без загрузки), поэтому новая версия сайта видна сразу после обновления
  // Скрипты и стили подключаются с номером версии (app.js?v=13.44.0): новая версия — новый адрес, поэтому их тоже кэшируем надолго
  const versioned = (ext === '.js' || ext === '.css') && /[?&]v=\d+\.\d+\.\d+/.test(String(req.url || ''));
  const immutable = file.includes(path.sep + 'uploads' + path.sep) || ext === '.woff2' || versioned;
  const st = fs.statSync(file), lm = new Date(Math.floor(st.mtimeMs / 1000) * 1000).toUTCString();
  if (!immutable && req.headers['if-modified-since'] === lm) { res.writeHead(304, { 'Cache-Control': 'no-cache', 'Last-Modified': lm }); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache', 'Last-Modified': lm });
  fs.createReadStream(file).on('error', () => res.end()).pipe(res);
}
// Откуда странице можно загружать скрипты, стили, шрифты и картинки. Скрипты — только свои
const CSP = [
  "default-src 'self'", "script-src 'self' https://mc.yandex.ru https://yastatic.net", "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:", "img-src 'self' data: blob: https:", "connect-src 'self' https://mc.yandex.ru https://mc.yandex.com wss://mc.yandex.ru",
  "frame-src 'self' https://mc.yandex.ru https://mc.yandex.com", // Яндекс Метрика: счётчик, карта кликов
  "object-src 'none'", "base-uri 'self'", "form-action 'self'"
].join('; ');
// Страницы магазина может показывать у себя плеер Вебвизора и карта кликов Метрики; админку и API — только сам сайт
const FRAME_SHOP = "frame-ancestors 'self' https://metrika.yandex.ru https://metrika.yandex.by https://metrica.yandex.com https://metrika.yandex.kz https://*.webvisor.com";
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  const strictFrame = /^\/(admin|api)(\/|$)/.test(String(req.url || ''));
  if (strictFrame) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', CSP + '; ' + (strictFrame ? "frame-ancestors 'self'" : FRAME_SHOP));
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (COOKIE_SECURE) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  let url;
  try { url = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
  // www.домен → домен: у поисковика одна версия сайта, а не две одинаковые
  const host = String(req.headers.host || '').toLowerCase(), mainHost = PUBLIC_HOST;
  if (mainHost && host === 'www.' + mainHost && (req.method === 'GET' || req.method === 'HEAD')) { res.writeHead(301, { Location: PUBLIC_URL + url.pathname + url.search }); return res.end(); }
  if (url.pathname === '/api/cart-remind/off' && req.method === 'GET') {
    const u = db.users.find((x) => x.id === url.searchParams.get('u'));
    const ok = !!(u && safeEqual(url.searchParams.get('t') || '', cartOffSig(u.id)));
    if (ok) { u.cartRemind = false; u.cartRemindAt = new Date().toISOString(); save(); }
    res.writeHead(ok ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(ok ? htmlPage('Напоминания отключены', 'Больше не будем писать о товарах в корзине. Включить снова можно в личном кабинете, в разделе «Профиль».') : htmlPage('Ссылка устарела', 'Отключить напоминания можно в личном кабинете, в разделе «Профиль».'));
  }
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
      // Журнал действий: что было до запроса в панели — чтобы записать, что именно поменялось
      let auditP = null, auditPre = null;
      if (url.pathname.startsWith('/api/admin/') && req.method !== 'GET') { try { auditP = url.pathname.replace(/^\/api\//, '').split('/').map(safeDecode); auditPre = Audit.before(auditP, req.method, body || {}, db); } catch (e) { auditPre = null; } }
      const out = await api(req, res, url, body || {});
      if (auditPre) auditAdd(req, Audit.describe(auditP, req.method, body || {}, auditPre, out, db));
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
  // Universal Links: ссылки albakovofficial.ru открываются сразу в приложении на iPhone (Team ID — из ключа Apple)
  if (url.pathname === '/.well-known/apple-app-site-association' || url.pathname === '/apple-app-site-association') {
    const team = (db.secrets.apns && db.secrets.apns.teamId) || process.env.APPLE_TEAM_ID || '';
    if (!team) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    const app = team + '.' + IOS_BUNDLE;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' });
    res.end(JSON.stringify({
      applinks: { details: [{ appIDs: [app], components: [{ '/': '/api/*', exclude: true }, { '/': '/uploads/*', exclude: true }, { '/': '/img/*', exclude: true }, { '/': '/*.*', exclude: true }, { '/': '/*' }] }] },
      webcredentials: { apps: [app] }
    }));
    return;
  }
  if (url.pathname === '/robots.txt') {
    // /api/state открыт: без него витрина у робота не загружается (Google видел одну заставку — «ложная 404»)
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    return res.end('User-agent: *\nAllow: /\nAllow: /api/state\nDisallow: /api/\nDisallow: /cart\nDisallow: /checkout\nDisallow: /account\nDisallow: /favorites\nDisallow: /track\nDisallow: /gift\nDisallow: /order/\nDisallow: /*?*q=\nDisallow: /*?*sort=\n' +
      'Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&source\n\nSitemap: ' + PUBLIC_URL + '/sitemap.xml\n');
  }
  if (url.pathname === '/' + db.secrets.indexnow + '.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    return res.end(db.secrets.indexnow);
  }
  if (url.pathname === '/sitemap.xml' || url.pathname === '/yml.xml') {
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=900' });
    return res.end(url.pathname === '/sitemap.xml' ? Seo.sitemap() : Seo.yml());
  }
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
