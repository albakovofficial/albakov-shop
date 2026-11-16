'use strict';
/* Модуль сервера ALBAKOV — маршруты API витрины: заказы, счётчик посещений, сертификаты, трек, СДЭК, оплата.
   Вынесен из функции api() в server.js 16.11.2026: код маршрутов без изменений, порядок проверки прежний.
   Если ни один маршрут не подошёл, возвращается NEXT — запрос идёт к следующему разделу. */
module.exports = function install(S) {
  const {
    GIFT_MSG, NEXT, PAY_WINDOW_MIN, Pricing, apnsCfg, applyPayment, cdek, cdekCfg, cdekShipPrice, cleanIdem,
    clientIp, createPayment, createRequest, crypto, currentUser, customerView, cut, db, fail, findGift, giftCfg,
    giftCode, giftState, giftView, inflightOrders, isAdmin, normPhone, orderView, payReady, placeOrder,
    pushSubscribe, pushTo, quoteFull, recentOrders, recordRefund, repeatedOrder, safeEqual, save, streetSuggest,
    subscribe, supportApi, syncCdek, syncPayment, syncReturns, throttle, txt, uid, validEmail, ykRequest
  } = S;

  let statDirty = false;
  // Кто уже засчитан сегодня (только в памяти: номера браузеров не сохраняются и обнуляются каждый день)
  const statSeen = { day: '', keys: new Set() };
  const STAT_SALT = crypto.randomBytes(16).toString('hex');
  setInterval(() => { if (statDirty) { statDirty = false; save(); } }, 60e3).unref();

  async function shopRoutes(req, res, url, body, p, M, user) {
    if (p[0] === 'orders') {
      if (!p[1] && M === 'GET') { const u = user(); if (!u) fail(401, 'Войдите в личный кабинет'); return { orders: db.orders.filter((o) => o.userId === u.id).reverse().map(customerView), now: new Date().toISOString() }; }
      if (!p[1] && M === 'POST') { throttle(req, 'order', 40); return await placeOrder(req, body); }
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
        return { order: isAdmin(req) ? orderView(o) : customerView(o), now: new Date().toISOString() };
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
      // Повтор того же запроса (двойное нажатие, обрыв связи) — тот же сертификат, а не второй (15.11.2026)
      const gIdem = cleanIdem(body.idem);
      if (gIdem) {
        if (inflightOrders.has('g' + gIdem)) await inflightOrders.get('g' + gIdem).catch(() => {});
        const prev = repeatedOrder('g' + gIdem);
        if (prev) return { order: customerView(prev), token: prev.token, payUrl: prev.payment.status === 'pending' ? prev.payUrl || null : null, repeated: true };
      }
      const job = (async () => {
      const cfg = giftCfg(); if (!cfg.enabled) fail(400, 'Подарочные сертификаты сейчас недоступны');
      if (!payReady()) fail(400, 'Покупка сертификатов появится после подключения онлайн-оплаты');
      const amount = Math.round(Number(body.amount) || 0);
      if (!(amount >= cfg.min && amount <= cfg.max)) fail(400, 'Сумма сертификата — от ' + Pricing.format(cfg.min) + ' до ' + Pricing.format(cfg.max));
      const t = (v, n) => cut(txt(v).replace(/\s+/g, ' ').trim(), n);
      const c = body.customer || {}, user = currentUser(req);
      const customer = { firstName: t(c.firstName, 60), lastName: t(c.lastName, 60), phone: normPhone(txt(c.phone)), email: t(c.email, 120).toLowerCase() };
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
      g.orderId = order.id; order.payBy = new Date(Date.now() + PAY_WINDOW_MIN * 60e3).toISOString();
      db.giftcards.push(g); db.orders.push(order);
      let payUrl = null;
      try { payUrl = await createPayment(order); }
      catch (e) { db.giftcards = db.giftcards.filter((x) => x.id !== g.id); db.orders = db.orders.filter((x) => x.id !== order.id); save(); throw e; }
      if (gIdem) { order.idem = 'g' + gIdem; recentOrders.set('g' + gIdem, { id: order.id, t: Date.now() }); }
      save();
      return { order: customerView(order), token: order.token, payUrl };
      })();
      if (gIdem) inflightOrders.set('g' + gIdem, job);
      try { return await job; } finally { if (gIdem && inflightOrders.get('g' + gIdem) === job) inflightOrders.delete('g' + gIdem); }
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

    // Расчёт корзины может спрашивать цену у СДЭК — ограничиваем частоту с одного адреса (аудит N-4, 16.11);
    // запас большой: за одним адресом мобильного оператора бывает много покупателей
    if (p[0] === 'quote' && M === 'POST') { throttle(req, 'quote', 1200); return { quote: await quoteFull(req, body) }; }
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
    return NEXT;
  }

  return { shopRoutes };
};
