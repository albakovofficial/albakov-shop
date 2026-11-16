'use strict';
/* Модуль сервера ALBAKOV — заказы: расчёт, оформление, двойной заказ, лимиты.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    GIFT_MSG, Mail, OPEN_ORDERS_MAX, PAY_WINDOW_MIN, PUBLIC_DIR, PUBLIC_URL, Pricing, cdek, cdekCfg, createPayment,
    crypto, currentUser, cut, db, fail, fs, hist, normPhone, orderSurge, path, payReady, publicUser, restock, save,
    sizeEntry, smtp, syncBonus, txt, uid, validEmail
  } = S;
  // функции модулей, которые подключаются позже
  const customerView = (...a) => S.customerView(...a);
  const findGift = (...a) => S.findGift(...a);
  const giftReturn = (...a) => S.giftReturn(...a);
  const giftState = (...a) => S.giftState(...a);
  const mailCfg = (...a) => S.mailCfg(...a);
  const pushStaffOrder = (...a) => S.pushStaffOrder(...a);
  const sendOrderMails = (...a) => S.sendOrderMails(...a);
  const stockMail = (...a) => S.stockMail(...a);

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
    const extra = await quoteExtra(req, b, strict);
    const q = quote(req, b, extra);
    if (q.delivery && extra.deliveryTariff) q.delivery.tariff = extra.deliveryTariff;
    return q;
  }
  // Часть расчёта, которая ждёт сеть: цена доставки СДЭК. Остальное (quote) считается сразу, без ожиданий
  async function quoteExtra(req, b, strict) {
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
    return extra;
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
    const email = txt(c.email).trim().toLowerCase(), phone = normPhone(txt(c.phone));
    return Pricing.calcCart(Array.isArray(b.lines) ? b.lines.slice(0, 100) : [], db, {
      code: b.code ? String(b.code).slice(0, 40) : '', deliveryId: b.deliveryId, registered: !!user,
      hasOrders: !!user && db.orders.some((o) => o.userId === user.id && o.status !== 'canceled'),
      usedByCustomer: b.code ? usedByCustomer(b.code, user, email, phone) : false,
      bonusBalance: user ? user.bonus || 0 : 0, useBonus: !!(user && b.useBonus), payment: b.payment === 'online' ? 'online' : 'cod',
      cdekAuto: !!(extra && extra.cdekAuto), deliveryPrice: extra ? extra.deliveryPrice : undefined, deliveryDays: extra ? extra.deliveryDays : undefined
    });
  }
  // Защита от двойного заказа (15.11.2026): ключ повтора idem занимается в самом начале оформления.
  // Второй такой же запрос — двойное нажатие, повтор после обрыва связи — ждёт первый и получает тот же заказ, а не создаёт новый.
  // Ключ хранится и в заказе: защита работает и после перезапуска сервера (в пределах 30 минут).
  const recentOrders = new Map();   // idem → { id, t } — готовый заказ
  const inflightOrders = new Map();   // idem → обещание: заказ ещё оформляется
  setInterval(() => { const old = Date.now() - 30 * 60e3; for (const [k, v] of recentOrders) if (v.t < old) recentOrders.delete(k); }, 10 * 60e3).unref();
  const cleanIdem = (v) => /^[a-z0-9]{16,64}$/i.test(String(v || '')) ? String(v) : '';
  function repeatedOrder(idem) {
    const r = recentOrders.get(idem);
    if (r) return db.orders.find((o) => o.id === r.id) || null;
    const since = Date.now() - 30 * 60e3;
    return db.orders.find((o) => o.idem === idem && Date.parse(o.createdAt) > since) || null;
  }
  function repeatAnswer(req, prev) {
    return { order: customerView(prev), token: prev.token, payUrl: prev.payment.status === 'pending' ? prev.payUrl || null : null, user: publicUser(currentUser(req)), repeated: true };
  }
  async function placeOrder(req, b) {
    const idem = cleanIdem(b.idem);
    if (!idem) return await placeOrderNow(req, b, '');
    const prev = repeatedOrder(idem);
    if (prev) return repeatAnswer(req, prev);
    if (inflightOrders.has(idem)) {
      // тот же заказ уже оформляется: дожидаемся и отвечаем им же (если первый не удался — второй сообщит ту же ошибку)
      await inflightOrders.get(idem).catch(() => {});
      const done = repeatedOrder(idem);
      if (done) return repeatAnswer(req, done);
    }
    const job = placeOrderNow(req, b, idem);
    inflightOrders.set(idem, job);
    try { return await job; } finally { if (inflightOrders.get(idem) === job) inflightOrders.delete(idem); }
  }
  async function placeOrderNow(req, b, idem) {
    const user = currentUser(req), c = b.customer || {};
    const customer = { firstName: cut(txt(c.firstName).trim(), 60), lastName: cut(txt(c.lastName).trim(), 60), phone: normPhone(txt(c.phone)), email: txt(c.email).trim().toLowerCase().slice(0, 120) };
    if (!customer.firstName || !customer.lastName) fail(400, 'Укажите имя и фамилию');
    if (customer.phone.length !== 11) fail(400, 'Проверьте номер телефона');
    if (!validEmail(customer.email)) fail(400, 'Проверьте электронную почту');
    if (!b.consent) fail(400, 'Нужно согласие на обработку персональных данных');
    // Количество — целое, не меньше 1: «0» или «−1» не превращаем молча в 1 штуку (аудит L-1)
    if (Array.isArray(b.lines) && b.lines.some((l) => !(Number.isInteger(Number(l && l.qty)) && Number(l.qty) >= 1))) fail(400, 'Укажите количество — не меньше 1 шт.');
    // Не больше 3 неподтверждённых заказов на один телефон или почту — иначе можно занять весь остаток (аудит M-2)
    // онлайн-заказы не считаем — неоплаченные сами отменяются через 10 минут (аудит M-5); старше 2 суток — тоже (L-10)
    const openOrders = db.orders.filter((o) => !o.test && o.kind !== 'gift' && o.payment.method !== 'online' && o.status === 'new' && o.payment.status === 'pending' &&
      Date.now() - Date.parse(o.createdAt) < 2 * 864e5 &&
      ((o.customer || {}).phone === customer.phone || (o.customer || {}).email === customer.email)).length;
    if (openOrders >= OPEN_ORDERS_MAX) fail(429, 'У вас уже есть 3 заказа, которые ждут подтверждения. Дождитесь звонка менеджера или напишите в поддержку — поможем');
    const pay = db.settings.payment || {};
    const method = b.payment === 'online' ? 'online' : 'cod';
    if ((method === 'online' && !pay.online) || (method === 'cod' && !pay.cod)) fail(400, 'Этот способ оплаты недоступен');
    // Без подключённой ЮKassa заказ «с онлайн-оплатой» повис бы неоплаченным — не принимаем такой
    if (method === 'online' && !payReady()) fail(400, 'Онлайн-оплата пока не подключена. Выберите оплату при получении.');
    const qArgs = { gift: b.gift, lines: b.lines, code: b.code, deliveryId: b.deliveryId, contact: customer, useBonus: b.useBonus, cityCode: b.cityCode, pvzType: b.pvzType, payment: method };
    // Сначала всё, что ждёт сеть (цена СДЭК, пункты выдачи, город), — остатки и скидки проверяем уже после (15.11.2026)
    const extra = await quoteExtra(req, qArgs, true);
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

    // Дальше до создания заказа — ни одного ожидания: проверка остатка, промокода, сертификата и бонусов
    // и их списание идут одним шагом, второй покупатель не успеет купить ту же последнюю вещь (15.11.2026)
    const q = quote(req, qArgs, extra);
    if (q.delivery && extra.deliveryTariff) q.delivery.tariff = extra.deliveryTariff;
    if (!q.lines.length) fail(400, 'Корзина пуста');
    if (!q.delivery) fail(400, 'Выберите способ доставки');
    const bad = q.lines.find((l) => l.problem); if (bad) fail(409, `${bad.name}: ${bad.problem.toLowerCase()}`);
    if (b.code && !(q.promo && q.promo.ok)) fail(400, q.promo ? q.promo.message : 'Промокод не применён');
    if (b.gift && !(q.gift && q.gift.ok)) fail(400, q.gift ? q.gift.message : 'Сертификат не применён');
    if (q.bonusUsed && user && (user.bonus || 0) < q.bonusUsed) fail(409, 'Бонусов на счёте стало меньше — обновите страницу оформления');

    q.lines.forEach((l) => {
      if (l.preorder) { const pp = db.products.find((x) => x.id === l.productId); pp.preorderSold = (pp.preorderSold || 0) + l.qty; return; }
      sizeEntry(l.productId, l.colorId, l.size).stock -= l.qty;
    });
    if (q.promo && q.promo.ok) { const pc = db.promocodes.find((x) => x.code === q.promo.code); if (pc) pc.used = (pc.used || 0) + 1; }
    db.orderSeq = Number(db.orderSeq) || 0;
    do { db.orderSeq++; } while (db.orders.some((o) => o.number === String(db.orderSeq)));
    const order = {
      id: uid('o'), number: String(db.orderSeq), token: crypto.randomBytes(16).toString('hex'), createdAt: new Date().toISOString(), userId: user ? user.id : null, customer, consentAt: new Date().toISOString(), idem: idem || undefined,
      items: q.lines.map((l) => ({ productId: l.productId, slug: l.slug, sku: (db.products.find((p) => p.id === l.productId) || {}).sku || undefined, name: l.name, colorId: l.colorId, color: l.color, size: l.size, qty: l.qty, price: l.price, oldPrice: l.oldPrice, image: l.image, art: l.art, preorder: l.preorder || undefined, shipDate: l.preorder ? l.shipDate : undefined })),
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
    if (order.payment.method === 'online' && order.payment.status === 'pending') order.payBy = new Date(Date.now() + PAY_WINDOW_MIN * 60e3).toISOString();
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
    else { pushStaffOrder(order, 'new'); save(); }                  // а сотрудникам — сразу: «Новый заказ · ждёт оплаты»
    orderSurge();
    if (order.payment.method !== 'online') stockMail(q.lines);   // онлайн — «Заканчивается размер» после оплаты: неоплаченный заказ может отмениться
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

  return {
    cdekCalcAny, cdekShipPrice, cleanIdem, inflightOrders, placeOrder, quoteFull, recentOrders, repeatedOrder,
    sendMail
  };
};
