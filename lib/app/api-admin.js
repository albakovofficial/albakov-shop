'use strict';
/* Модуль сервера ALBAKOV — маршруты API панели: доступ по ролям и системные разделы.
   Вынесен из функции api() в server.js 16.11.2026: код маршрутов без изменений, порядок проверки прежний.
   Если ни один маршрут не подошёл, возвращается NEXT — запрос идёт к следующему разделу. */
module.exports = function install(S) {
  const {
    Apns, CDEK_TRACK, COLLECTIONS, DATA_DIR, Finance, IOS_BUNDLE, Mail, NEXT, PUBLIC_URL, PUSH_STAFF, Pricing,
    ROLES, SETTINGS_PERMS, Seo, UPLOAD_DIR, VERIFY_MIN, absUrl, adminRole, apnsCfg, brandLogo, can, cdek,
    cdekBatchApi, cdekPkg, crypto, currentUser, db, fail, financeApi, fs, giftState, health, mailCfg, mailReady,
    normPhone, notifyContext, orderView, ownerTo, path, perms, publicUser, pushPrefsOf, pushTo, requireAdmin,
    requirePerm, save, sendMail, seoPing, seoPingFlush, seoPingOn, siteAlertMail, siteProblems, staffApi,
    staffList, staffPushPrefs, stockMail, supportAdminApi, throttle, uid, validEmail, welcomePromo
  } = S;

  async function adminRoutes(req, res, url, body, p, M, user) {
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
        return { prefs: staffPushPrefs(u), devices: db.pushsubs.filter((x) => x.scope === 'staff' && x.userId === u.id).length, apnsReady: !!apnsCfg(),
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
      const d = { settings: db.settings, role, roleName: ROLES[role].name, perms: perms(req), me: publicUser(currentUser(req)), now: new Date().toISOString() };
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
    if (p[1] === 'support') return supportAdminApi(req, p, M, body);
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
      // Владелец тоже меняет только присланные разделы: неполные настройки (панель не догрузилась, сбой) не стирают остальное (аудит T-4, 16.11)
      if (can(req, 'settings')) next = Object.assign({}, db.settings, body.value);
      const methods = next.delivery && Array.isArray(next.delivery.methods) ? next.delivery.methods : null;
      if (!methods || !methods.length || !next.payment || typeof next.payment !== 'object' || !String(next.storeName || '').trim()) fail(400, 'Настройки неполные: нет способов доставки, оплаты или названия магазина. Обновите панель и сохраните ещё раз');
      for (const k of ['ok', 'error']) delete next[k];
      db.settings = next; if (db.settings.payment) delete db.settings.payment.parts; save(); return {};
    }
    return NEXT;
  }

  return { adminRoutes };
};
