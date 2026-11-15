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
setImmediate(() => save()); // записать то, что поправил переход данных (например, новый девиз), когда сервер загрузится
db.secrets = db.secrets || {};
db.waitlist = db.waitlist || [];
db.tickets = db.tickets || [];
db.giftcards = db.giftcards || [];
// Финансы (13.46): расходы — отдельные записи; себестоимость и ставки — не в settings, чтобы не уходить на витрину
db.expenses = db.expenses || [];
db.receipts = db.receipts || [];
db.intakes = db.intakes || [];
db.pushsubs = db.pushsubs || []; // в новой базе списка ещё нет
// Общей таблицы размеров больше нет (13.64.3): пункт меню «Размеры» убираем, у каждого товара своя таблица в карточке
if (db.settings && Array.isArray(db.settings.nav)) db.settings.nav = db.settings.nav.filter((n) => !/^[#/]*sizes\b/.test(String(n.link || '')));
// Юридические документы (13.64.3): новая редакция — приложение, push-уведомления, поддержка с фото, удаление аккаунта.
// Меняем текст, только если на сайте стоит прежняя редакция без правок владельца (сверяем отпечаток текста)
{
  const LEGAL_OLD = { privacy: '4fb32ae6188caa50aea66a024be6442ba2ad0ded', consent: 'cc7a98dd7dd8f7d3433e8b5186fc528fdfe3ad5b', offer: '1f490ab8c27ba2d37118f23890b11b746c611fb9' };
  let changed = false;
  for (const slug of Object.keys(LEGAL_OLD)) {
    const pg = db.pages.find((x) => x.slug === slug), fresh = SEED.pages.find((x) => x.slug === slug);
    if (pg && fresh && crypto.createHash('sha1').update(String(pg.body || '')).digest('hex') === LEGAL_OLD[slug]) { pg.body = fresh.body; changed = true; }
  }
  if (changed) setImmediate(save); // save() объявлен ниже — записываем, когда сервер загрузится
}
db.audit = db.audit || [];
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
// Обрезка по символам: эмодзи и другие «двойные» символы не разрезаются пополам (15.11.2026)
const cut = (v, n) => Array.from(String(v == null ? '' : v)).slice(0, n).join('');
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
// Счётчик по произвольному ключу (например, по логину), без учёта адреса
function throttleKey(k, limit) {
  const now = Date.now(), a = attempts.get(k) || { n: 0, t: now };
  if (now - a.t > 15 * 60e3) { a.n = 0; a.t = now; }
  a.n++; attempts.set(k, a);
  if (a.n > limit) fail(429, 'Слишком много попыток. Попробуйте через 15 минут.');
  return k;
}
const GIFT_MSG = { none: 'Сертификат не найден — проверьте код', canceled: 'Этот сертификат отменён', pending: 'Сертификат ещё не оплачен', expired: 'Срок действия сертификата закончился', used: 'Сертификат уже полностью использован' };
const money = (n) => Pricing.format(n);
const itemsLine = (o) => o.items.map((i) => i.name + (i.size ? ' ' + i.size : '') + (i.qty > 1 ? ' ×' + i.qty : '')).join(', ');
const firstImg = (o) => (o.items.find((i) => i.image) || {}).image || '';
const mailReady = () => { const c = mailCfg(); return !!(c.host && c.fromEmail); };
const absUrl = (u) => !u ? '' : /^https?:/.test(u) ? u : /^data:/.test(u) ? '' : PUBLIC_URL + '/' + String(u).replace(/^\//, '');

/* ---------------- Маршруты API ---------------- */
async function api(req, res, url, body) {
  const p = url.pathname.replace(/^\/api\//, '').split('/').map(safeDecode);
  if (p.includes(null)) fail(400, 'Неверный адрес');
  const M = req.method;
  const user = () => currentUser(req);

  if (p[0] === 'state' && M === 'GET') return { data: publicState(), user: publicUser(user()), isAdmin: isAdmin(req) };
  // Разделы проверяются по порядку, как раньше шли блоки в этой функции (lib/app/api-*.js)
  for (const routes of [authRoutes, accountRoutes, shopRoutes]) {
    const r = await routes(req, res, url, body, p, M, user); if (r !== NEXT) return r;
  }
  if (p[0] === 'admin') {
    // adminRoutes сначала проверяет вход и права, затем — заказы и каталог (коллекции — последними)
    for (const routes of [adminRoutes, adminOrderRoutes, adminCatalogRoutes]) {
      const r = await routes(req, res, url, body, p, M, user); if (r !== NEXT) return r;
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

/* ---------------- Модули (16.11.2026) ----------------
   Разделы сервера живут в lib/app/*.js. Каждый модуль получает S — общие данные и функции ядра —
   и возвращает свои функции; они добавляются в S для следующих модулей и для ядра.
   Порядок подключения — прежний порядок разделов в файле. */
const ROOT = __dirname;
const NEXT = Symbol('следующий раздел API');
const S = {
  ROOT, NEXT,
  Apns, CDEK_WAIT, COLLECTIONS, DATA_DIR, Finance, GIFT_MSG, HttpError, Mail, OWNER_PHONE, PUBLIC_DIR,
  PUBLIC_URL, Pricing, ROLES, SETTINGS_PERMS, Seo, Specs, UPLOAD_DIR, absUrl, adminRole, applyCdek, can, cdek,
  cdekCfg, cdekOrderBody, cdekPkg, checkPassword, cleanFavorites, clientIp, createSession, crypto, currentUser,
  cut, db, fail, firstImg, fixSkus, fs, getSession, hashPassword, health, isAdmin, itemsLine, mailReady, money,
  normPhone, parseCookies, path, perms, publicUser, pwOk, requireAdmin, requirePerm, safeEqual, save, seoChanged,
  seoPing, seoPingFlush, seoPingOn, setCookie, smtp, staffApi, staffList, staffRole, syncBonus, throttle,
  throttleKey, throttleOk, uid, userOf, validEmail
};
for (const m of ['cdek-returns', 'payments', 'orders', 'order-mail', 'gifts', 'cart-reminders', 'push', 'journal', 'owner-mail', 'delivery-info', 'support', 'stock-finance', 'cdek-batch', 'monitor', 'exchange', 'waitlist', 'signup', 'api-auth', 'api-account', 'api-shop', 'api-admin', 'api-admin-orders', 'api-admin-catalog']) Object.assign(S, require('./lib/app/' + m + '.js')(S));
const {
  CDEK_TRACK, IOS_BUNDLE, accountRoutes, adminCatalogRoutes, adminOrderRoutes, adminRoutes, auditAdd, authRoutes,
  cartOffSig, htmlPage, mailCfg, netLines, payReady, publicState, pushOrderEvent, receiptItems, sendTrackingMail,
  shopRoutes
} = S;


/* ---------------- HTTP ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8' };
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    let big = false;
    req.on('data', (c) => { if (big) return; size += c.length; if (size > limit) { big = true; chunks.length = 0; reject(new HttpError(413, 'Слишком большой запрос: файл больше допустимого размера')); } else chunks.push(c); });
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
  const min = (ext === '.js' || ext === '.css') ? minCopy(file, st) : null;
  res.writeHead(200, Object.assign({ 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache', 'Last-Modified': lm }, min ? { 'Content-Length': min.length } : {}));
  if (min) return res.end(min);
  fs.createReadStream(file).on('error', () => res.end()).pipe(res);
}
/* Уменьшенные копии скриптов и стилей (16.11.2026): tools/minify.js кладёт их в public/.min/ с отпечатком
   исходника в первой строке. Копия отдаётся, только если отпечаток совпадает с текущим файлом — забыли
   пересобрать, и сайт отдаёт обычный файл. MINIFY=0 в .env отключает копии совсем. */
const minCache = new Map();
function minCopy(file, st) {
  if (process.env.MINIFY === '0') return null;
  const c = minCache.get(file); if (c && c.mtime === st.mtimeMs && c.size === st.size) return c.buf;
  let buf = null;
  try {
    const copy = path.join(PUBLIC_DIR, '.min', path.relative(PUBLIC_DIR, file));
    const text = fs.readFileSync(copy), nl = text.indexOf(10);
    const want = '/* src-sha1:' + crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex') + ' */';
    if (nl > 0 && text.slice(0, nl).toString() === want) buf = text.slice(nl + 1);
  } catch (e) { buf = null; }
  minCache.set(file, { mtime: st.mtimeMs, size: st.size, buf });
  return buf;
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
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req, /^\/api\/(admin\/upload|support\/upload|admin\/support\/upload)$/.test(url.pathname) ? 12 * 1024 * 1024 : 2 * 1024 * 1024) : {};
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
      // слишком большой запрос: ответить и закрыть соединение, не дочитывая остаток (15.11.2026)
      if (e.status === 413) { res.setHeader('Connection', 'close'); res.on('finish', () => req.destroy()); }
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
