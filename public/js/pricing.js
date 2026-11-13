/* Общий модуль расчёта цен: используется и в браузере, и на сервере.
   Все суммы — целые рубли. */
(function (root) {
  'use strict';

  /* Цвета товара. У каждого цвета свои фото и остатки по размерам.
     Старые товары без списка цветов переводятся в формат с одним цветом. */
  function migrateProduct(p) {
    if (!p || (Array.isArray(p.colors) && p.colors.length)) return p;
    p.colors = [{ id: 'col1', name: p.color || 'Основной', hex: '', images: p.images || [], sizes: p.sizes || [], art: p.art || null }];
    delete p.color; delete p.images; delete p.sizes;
    return p;
  }
  /* Перенос старых данных на новую версию: цвета товаров, логотип */
  // Стандартные картинки прошлых версий (логотип и слайды прежних палитр), которые превью
  // сохранило в браузере. Узнаём по длине и концу кода картинки и меняем на актуальные — свои загрузки не трогаем.
  var OLD_DEFAULTS = {
    '5782:iutNn/qYy/Z/l4uMU6OzJj4AAAAASUVORK5CYII=': 'mark',
    '9422:ZbzF9mXG/w9eIhZ83GDGqwAAAABJRU5ErkJggg==': 'word',
    '52631:ndPAm5ojB09szyGNFlcvMcYvI9w8cYUu/wD/2Q==': 'sl1',
    '46395:WLzungTk2Rg6fGZ5DGy0yXmNYvI+Q8awtl//2Q==': 'sl2',
    '38259:vF53TwJo4Rg6fWZ5DHC2ovMbxeR6DxvDFP8A/9k=': 'sl3',
    // светлая версия «кашемир и камень»
    '11026:J8bPiQrxA/8PojgYTmflpuAAAAAASUVORK5CYII=': 'mark',
    '19790:WEQWt5tQ3vr/AUQ468vPO02BAAAAAElFTkSuQmCC': 'word',
    '60591:pSlKXFxS4uKUpSlLmlKUpc0pS6F0qUpcUpS6FP/Z': 'sl1',
    '50771:hcKXC4UpSlKXGlKUpcaUpdi7VKUuFKUuxT//2Q==': 'sl2',
    '43299:SlKUuLilxcUpSlKXNKUpS5pSl0XVSlLilKXRT//Z': 'sl3'
  };
  // Новая картинка берётся из стартовых данных, поэтому второй копии в коде нет
  function freshImg(src, seed) {
    if (!seed || typeof src !== 'string' || src.indexOf('data:') !== 0) return src;
    var k = OLD_DEFAULTS[src.length + ':' + src.slice(-40)], b = seed.settings.brand || {};
    if (k === 'mark' || k === 'word') return (b[k] || {}).src || src;
    var sl = k && ((seed.settings.slider || {}).slides || []).find(function (x) { return x.id === k; });
    return sl ? sl.image : src;
  }
  /* Плашки на карточке: Новинка и Хит — по меткам товара, Скидка — если есть старая цена или акция.
     Свой текст плашки можно задать в товаре, общий текст и цвет — в настройках. «{n}» — размер скидки в процентах. */
  var BADGE_KEYS = ['new', 'sale', 'hit'];
  function inkFor(hex) {
    var n = parseInt(String(hex || '#000000').slice(1), 16); if (isNaN(n)) return '#ffffff';
    var l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return l > 0.62 ? '#141414' : '#ffffff';
  }
  // Сколько ещё можно заказать по предзаказу (Infinity — без ограничения)
  function preorderLeft(p) { if (!p || !p.preorder) return 0; var lim = Math.max(0, Math.floor(Number(p.preorderLimit) || 0)); return lim ? Math.max(0, lim - (Number(p.preorderSold) || 0)) : Infinity; }
  function badgesOf(p, price, settings) {
    var conf = (settings && settings.badges) || {}, own = p.badgeText || {}, off = p.badgeOff || [], tags = p.tags || [], out = [];
    BADGE_KEYS.forEach(function (k) {
      var show = k === 'sale' ? !!(price && price.oldPrice) && off.indexOf('sale') === -1 : tags.indexOf(k) !== -1;
      if (!show) return;
      var c = conf[k] || {}, text = String(own[k] || c.text || '');
      if (k === 'sale') text = text.replace(/\{n\}/g, Math.round((1 - price.price / price.oldPrice) * 100));
      if (text) out.push({ key: k, text: text, color: c.color || '#141414', ink: inkFor(c.color) });
    });
    return out;
  }
  function migrateData(d, seed) {
    (d.products || []).forEach(function (p) {
      migrateProduct(p);
      // «Для кого»: у старых товаров определяем по размерной сетке, иначе — унисекс
      if (!p.gender) p.gender = p.sizeChartId === 'sc1' ? 'women' : p.sizeChartId === 'sc2' ? 'men' : 'unisex';
    });
    (d.promocodes || []).forEach(function (c) { if (c.firstOrderOnly === undefined) c.firstOrderOnly = c.code === 'WELCOME10'; if (c.code === 'WELCOME10') { c.onlyRegistered = true; c.onePerCustomer = true; } });
    var st = d.settings || {};
    if (!st.genders && seed && seed.settings.genders) st.genders = JSON.parse(JSON.stringify(seed.settings.genders));
    // Раздел «Детям» (13.63): у старых данных его нет — добавляем закрытым, со страницей «скоро»
    if (st.genders && !st.genders.kids && seed && seed.settings.genders.kids) st.genders.kids = JSON.parse(JSON.stringify(seed.settings.genders.kids));
    // Экрана выбора раздела больше нет (13.63): его фото — фон страницы «скоро» — переезжают в настройки раздела
    if (st.gateway) { Object.keys(st.genders || {}).forEach(function (g) { var w = st.gateway[g]; if (w && w.image && !st.genders[g].image) st.genders[g].image = w.image; }); delete st.gateway; }
    // Строки над шапкой больше нет (13.63)
    delete st.announcement; delete st.annFree;
    // «О бренде» (13.63.2): вместо фото основателя — знак бренда (страница сама показывает его, когда фото нет)
    (d.pages || []).forEach(function (pg) { if (pg.slug === 'about' && pg.body) pg.body = pg.body.replace(/^[ \t]*!\[[^\]]*\]\(img\/founder\.webp\)[ \t]*\n?/m, '').replace(/\n{3,}/g, '\n\n'); });
    // Слайдер на главной: первый слайд берёт тексты и фото прежнего первого экрана, если их меняли
    if (!st.slider && seed && seed.settings.slider) {
      st.slider = JSON.parse(JSON.stringify(seed.settings.slider));
      var h = st.home || {}, s1 = st.slider.slides[0];
      if (h.heroTitle) { s1.eyebrow = h.heroEyebrow || ''; s1.title = h.heroTitle; s1.text = h.heroText || ''; }
      if (h.heroImage) s1.image = h.heroImage;
    }
    if (!st.brand && seed && seed.settings.brand) {
      st.brand = JSON.parse(JSON.stringify(seed.settings.brand));
      if (st.storeName === 'VANTA') st.storeName = seed.settings.storeName;
      if (st.contacts && st.contacts.email === 'hello@vanta.store') st.contacts.email = seed.settings.contacts.email;
      (d.pages || []).forEach(function (pg) { if (pg.body) pg.body = pg.body.replace(/^VANTA —/, seed.settings.storeName + ' —'); });
    }
    if (!st.badges && seed && seed.settings.badges) st.badges = JSON.parse(JSON.stringify(seed.settings.badges));
    if (!st.bonus && seed && seed.settings.bonus) st.bonus = JSON.parse(JSON.stringify(seed.settings.bonus));
    // Бонус за онлайн-оплату и обмен размера (появились в 13.34): по умолчанию включены
    if (st.bonus && st.bonus.onlineExtra === undefined) st.bonus.onlineExtra = 5;
    if (!st.exchange) st.exchange = { enabled: true, days: 14, free: true };
    // Блок о бонусах на главной (появился в ALBAKOV9)
    if (st.home && st.home.showBonus === undefined && seed && seed.settings.home) ['showBonus', 'bonusEyebrow', 'bonusTitle', 'bonusText'].forEach(function (k) { st.home[k] = seed.settings.home[k]; });
    // Кнопка связи на всех страницах (13.11): включена по умолчанию
    if (st.contacts && st.contacts.fab === undefined) st.contacts.fab = true;
    // Заголовок блока преимуществ (13.8): появляется у магазинов, где его ещё не было; пустой — скрыт
    if (st.home && st.home.benefitsTitle === undefined && seed && seed.settings.home) { st.home.benefitsEyebrow = seed.settings.home.benefitsEyebrow; st.home.benefitsTitle = seed.settings.home.benefitsTitle; }
    // Преимущества (13.9): стандартные «Примерка» и «Возврат 14 дней» меняем на «Качество» и «Премиум ткани»; свои тексты владельца не трогаем
    if (st.home && Array.isArray(st.home.benefits) && seed && seed.settings.home) {
      var sb = seed.settings.home.benefits;
      st.home.benefits.forEach(function (b, i) {
        if (b.title === 'Примерка' && b.text === 'Оплачиваете только то, что подошло') st.home.benefits[i] = Object.assign({}, sb[1], { id: b.id });
        if (b.title === 'Возврат 14 дней' && b.text === 'Без объяснения причин, если сохранён вид') st.home.benefits[i] = Object.assign({}, sb[2], { id: b.id });
      });
    }
    // Хиты продаж на главной (появились в 13.4): блок включён, самые продаваемые добавляются сами
    if (st.home && st.home.showHits === undefined) { st.home.showHits = true; st.home.hitsAuto = true; }
    // Короткий блок бонусов (13.4): стандартные длинные тексты меняем на новые, свои тексты владельца не трогаем
    if (st.home && seed && seed.settings.home) {
      if (st.home.bonusTitle === 'Возвращаем *{n}%*\nбонусами') st.home.bonusTitle = seed.settings.home.bonusTitle;
      if (st.home.bonusText === 'С каждой покупки начисляем бонусы на ваш счёт в личном кабинете. 1 бонус = 1 ₽ — ими можно оплатить следующий заказ хоть целиком.') st.home.bonusText = seed.settings.home.bonusText;
    }
    // Документы по 152-ФЗ (13.6): стандартные короткие заглушки политики и оферты меняем на полные тексты,
    // добавляем отдельное «Согласие на обработку персональных данных». Тексты, которые владелец уже менял, не трогаем
    if (d.pages && seed && seed.pages) {
      var sp = function (slug) { return seed.pages.find(function (x) { return x.slug === slug; }); };
      d.pages.forEach(function (pg) {
        var body = String(pg.body || '');
        if (pg.slug === 'privacy' && body.indexOf('Мы обрабатываем персональные данные (имя, фамилию, телефон, электронную почту, адрес доставки) только для исполнения заказов') === 0 && body.length < 600) { pg.body = sp('privacy').body; pg.title = sp('privacy').title; }
        if (pg.slug === 'offer' && body.indexOf('Замените этот текст договором публичной оферты') === 0) pg.body = sp('offer').body;
      });
      if (!d.pages.some(function (pg) { return pg.slug === 'consent'; })) d.pages.push(JSON.parse(JSON.stringify(sp('consent'))));
    }
    // Светлая тема: старые стандартные логотип и слайды меняем на новые
    if (st.brand) { if (st.brand.mark) st.brand.mark.src = freshImg(st.brand.mark.src, seed); if (st.brand.word) st.brand.word.src = freshImg(st.brand.word.src, seed); }
    if (st.slider && st.slider.slides) st.slider.slides.forEach(function (x) { x.image = freshImg(x.image, seed); });
    if (st.home) st.home.heroImage = freshImg(st.home.heroImage, seed);
    // Знак убран из шапки и стоит водяным знаком в подвале (если владелец ещё не менял настройку шапки)
    if (st.brand && st.brand.footerMark === undefined) {
      if (st.brand.desktop === 'both' && st.brand.mobile === 'both') { st.brand.desktop = 'word'; st.brand.mobile = 'word'; }
      st.brand.footerMark = st.brand.placements ? st.brand.placements.footer !== false : true;
      delete st.brand.placements;
    }
    return d;
  }
  /* Подходит ли товар выбранному разделу: женщинам, мужчинам или всё */
  // «Унисекс» — для взрослых разделов: в детском только детские товары
  function forGender(p, g) { return !g || p.gender === g || (g !== 'kids' && (!p.gender || p.gender === 'unisex')); }
  function colorsOf(p) { migrateProduct(p); return p.colors; }
  function colorOf(p, colorId) { var cs = colorsOf(p); return cs.find(function (c) { return c.id === colorId; }) || cs[0]; }
  function stockOf(c) { return (c && c.sizes || []).reduce(function (s, x) { return s + (Number(x.stock) || 0); }, 0); }

  function inWindow(x, now) {
    if (!x.active) return false;
    if (x.startsAt && now < new Date(x.startsAt + 'T00:00:00').getTime()) return false;
    if (x.endsAt && now > new Date(x.endsAt + 'T23:59:59').getTime()) return false;
    return true;
  }

  function promoApplies(promo, product) {
    if (promo.scope === 'all') return true;
    if (promo.scope === 'categories') return (promo.categoryIds || []).indexOf(product.categoryId) !== -1;
    if (promo.scope === 'products') return (promo.productIds || []).indexOf(product.id) !== -1;
    return false;
  }

  /* Итоговая цена товара с учётом действующих акций */
  function productPrice(product, promotions, now) {
    now = now || Date.now();
    var base = Math.round(Number(product.price) || 0);
    var best = null, bestPrice = base;
    (promotions || []).forEach(function (p) {
      if (!inWindow(p, now) || !promoApplies(p, product)) return;
      var v = Number(p.value) || 0;
      var price = p.type === 'fixed' ? base - v : Math.round(base * (100 - v) / 100);
      price = Math.max(0, price);
      if (price < bestPrice) { bestPrice = price; best = p; }
    });
    var compare = Math.round(Number(product.compareAt) || 0);
    var oldPrice = best ? Math.max(base, compare) : (compare > base ? compare : 0);
    return {
      price: bestPrice,
      oldPrice: oldPrice > bestPrice ? oldPrice : 0,
      promotion: best,
      onSale: !!best || compare > base
    };
  }

  /* Проверка промокода. ctx: { subtotal, eligibleSubtotal, usedByCustomer, now } */
  function checkCode(code, ctx) {
    if (!code) return { ok: false, message: 'Промокод не найден' };
    var now = ctx.now || Date.now();
    if (!code.active) return { ok: false, message: 'Промокод не действует' };
    if (code.startsAt && now < new Date(code.startsAt + 'T00:00:00').getTime()) return { ok: false, message: 'Промокод ещё не начал действовать' };
    if (code.endsAt && now > new Date(code.endsAt + 'T23:59:59').getTime()) return { ok: false, message: 'Срок действия промокода истёк' };
    if (code.limit && (code.used || 0) >= code.limit) return { ok: false, message: 'Лимит использования промокода исчерпан' };
    // Сначала — ограничения по покупателю (у них есть понятная причина для плашки при оформлении)
    if ((code.onlyRegistered || code.firstOrderOnly) && !ctx.registered) return { ok: false, reason: 'login', message: 'Скидка действует только для зарегистрированных покупателей. Войдите или зарегистрируйтесь — это займёт минуту.' };
    if (code.onePerCustomer && ctx.usedByCustomer) return { ok: false, reason: 'used', message: 'Вы уже воспользовались этой скидкой. Промокод действует один раз.' };
    if (code.firstOrderOnly && ctx.hasOrders) return { ok: false, reason: 'first', message: 'Скидка действует только на первый заказ, а у вас уже есть заказы в магазине.' };
    if (code.minTotal && ctx.subtotal < code.minTotal) return { ok: false, message: 'Минимальная сумма заказа для промокода — ' + format(code.minTotal) };
    var base = code.excludeSale ? ctx.eligibleSubtotal : ctx.subtotal;
    if (code.type !== 'shipping' && base <= 0) return { ok: false, message: 'Промокод не распространяется на товары со скидкой' };
    var amount = 0;
    if (code.type === 'percent') amount = Math.round(base * Math.min(100, Number(code.value) || 0) / 100);
    else if (code.type === 'fixed') amount = Math.min(base, Math.round(Number(code.value) || 0));
    return { ok: true, amount: amount, freeShipping: code.type === 'shipping', message: 'Промокод применён' };
  }

  /* Полный расчёт корзины.
     lines: [{productId, size, qty}]
     data: { products, promotions, promocodes, settings }
     opts: { code, deliveryId, usedByCustomer, registered } */
  function calcCart(lines, data, opts) {
    opts = opts || {};
    var now = Date.now();
    var out = { lines: [], subtotal: 0, baseTotal: 0, eligibleSubtotal: 0, count: 0, errors: [] };
    // Одинаковые позиции (товар + цвет + размер) складываем: иначе можно было бы
    // обойти проверку остатка, прислав одну и ту же вещь несколькими строками
    var merged = [], seen = {};
    (lines || []).forEach(function (l) {
      if (!l || typeof l !== 'object') return;
      var key = [l.productId, l.colorId || '', l.size].join('\u0001');
      var q = Math.max(1, Math.floor(Number(l.qty) || 1));
      if (seen[key]) { seen[key].qty = Math.min(999, seen[key].qty + q); return; }
      seen[key] = { productId: l.productId, colorId: l.colorId, size: l.size, qty: Math.min(999, q) };
      merged.push(seen[key]);
    });
    merged.forEach(function (l) {
      var p = (data.products || []).find(function (x) { return x.id === l.productId; });
      if (!p || p.active === false) { out.errors.push('Товар больше недоступен'); return; }
      var col = colorOf(p, l.colorId);
      var s = (col.sizes || []).find(function (x) { return x.size === l.size; });
      var qty = Math.max(1, Math.floor(Number(l.qty) || 1));
      var stock = s ? Math.max(0, Number(s.stock) || 0) : 0;
      var pr = productPrice(p, data.promotions, now);
      var line = {
        productId: p.id, slug: p.slug, name: p.name, colorId: col.id, color: col.name, colors: p.colors.length, size: l.size, qty: qty,
        price: pr.price, oldPrice: pr.oldPrice, onSale: pr.onSale, basePrice: Math.round(p.price),
        stock: stock, image: (col.images && col.images[0]) || '', art: col.art || null,
        total: pr.price * qty
      };
      // Предзаказ: размера нет, но товар можно заказать заранее, пока есть места в партии
      if (stock === 0 && s && p.preorder) {
        var left = preorderLeft(p);
        if (left === Infinity || left >= qty) { line.preorder = true; line.shipDate = p.preorderShip || ''; }
        else line.problem = left > 0 ? 'По предзаказу осталось ' + left + ' шт.' : 'Места в партии закончились';
      } else if (stock < qty) line.problem = stock === 0 ? 'Нет в наличии' : 'В наличии только ' + stock + ' шт.';
      if (l.colorId && col.id !== l.colorId) line.problem = 'Этот цвет больше недоступен';
      out.lines.push(line);
      out.subtotal += line.total;
      out.baseTotal += Math.max(line.oldPrice || 0, line.price) * qty;
      if (!pr.onSale) out.eligibleSubtotal += line.total;
      out.count += qty;
    });
    out.saleDiscount = out.baseTotal - out.subtotal;

    // Промокод
    out.promo = null; out.promoDiscount = 0;
    var freeShipping = false;
    if (opts.code) {
      var code = (data.promocodes || []).find(function (c) { return c.code.toUpperCase() === String(opts.code).trim().toUpperCase(); });
      var res = checkCode(code, { subtotal: out.subtotal, eligibleSubtotal: out.eligibleSubtotal, usedByCustomer: opts.usedByCustomer, registered: opts.registered, hasOrders: opts.hasOrders, now: now });
      out.promo = { code: code ? code.code : String(opts.code).trim().toUpperCase(), ok: res.ok, reason: res.reason || '', message: res.message, type: code && code.type, value: code && code.value };
      if (res.ok) { out.promoDiscount = res.amount; freeShipping = res.freeShipping; }
    }

    // Доставка
    var methods = (data.settings && data.settings.delivery && data.settings.delivery.methods) || [];
    var m = methods.find(function (x) { return x.id === opts.deliveryId; }) || null;
    out.delivery = null; out.deliveryPrice = 0;
    if (m) {
      var after = out.subtotal - out.promoDiscount;
      var free = freeShipping || (m.freeFrom && after >= m.freeFrom);
      // Цена по тарифу СДЭК приходит снаружи (opts.deliveryPrice); пока пункт не выбран — «рассчитаем после выбора»
      var auto = m.priceAuto && cdekMode(m) && opts.cdekAuto, known = typeof opts.deliveryPrice === 'number';
      var base = auto ? (known ? opts.deliveryPrice : 0) : m.price;
      out.delivery = { id: m.id, name: m.name, price: free ? 0 : Math.round(base || 0), free: !!free };
      if (auto && !known && !free) out.delivery.pending = true;
      if (auto && opts.deliveryDays) out.delivery.days = opts.deliveryDays;
      out.deliveryPrice = out.delivery.price;
    }
    out.total = Math.max(0, out.subtotal - out.promoDiscount) + out.deliveryPrice;

    // Бонусы: 1 бонус = 1 рубль. Списать можно все бонусы, но не больше суммы к оплате.
    // Начисляются на сумму товаров, оплаченную деньгами (без доставки и без части, оплаченной бонусами).
    var bc = bonusConf(data.settings), bal = Math.max(0, Math.floor(Number(opts.bonusBalance) || 0));
    var goods = Math.max(0, out.subtotal - out.promoDiscount);
    out.bonusUsed = bc.enabled && opts.useBonus ? Math.min(bal, out.total) : 0;
    out.total -= out.bonusUsed;
    var paidGoods = goods - Math.min(out.bonusUsed, goods);
    out.bonusEarn = bonusFor(paidGoods, data.settings);
    // За онлайн-оплату — дополнительный процент бонусами (покупатель забирает заказ почти всегда)
    out.bonusOnline = bc.enabled && bc.onlineExtra > 0 && opts.payment === 'online' ? Math.floor(paidGoods * bc.onlineExtra / 100) : 0;
    out.bonusEarn += out.bonusOnline;
    out.bonus = { enabled: bc.enabled, percent: bc.earn ? bc.percent : 0, onlineExtra: bc.enabled ? bc.onlineExtra : 0, balance: bal };
    return out;
  }

  /* ---------- Бонусная программа ---------- */
  function bonusConf(settings) {
    var b = (settings && settings.bonus) || {}, pct = Math.max(0, Math.min(100, Number(b.percent) || 0));
    var extra = Math.max(0, Math.min(50, Number(b.onlineExtra) || 0));
    return { enabled: !!b.enabled, earn: !!b.enabled && pct > 0, percent: pct, onlineExtra: extra, creditOn: b.creditOn === 'done' ? 'done' : 'paid' };
  }
  // Сколько бонусов дадут за покупку на эту сумму
  function bonusFor(amount, settings) {
    var c = bonusConf(settings);
    return c.earn ? Math.floor(Math.max(0, amount) * c.percent / 100) : 0;
  }
  // Операция по счёту покупателя. Уведомление (seen: false) — только о том, что бонусы пришли.
  function bonusMove(user, amount, type, order, mkId, note) {
    amount = Math.round(amount);
    if (!user || !amount) return null;
    user.bonus = Math.max(0, (user.bonus || 0) + amount);
    user.bonusLog = user.bonusLog || [];
    var e = { id: mkId('b'), at: new Date().toISOString(), amount: amount, type: type, seen: !(amount > 0 && (type === 'earn' || type === 'manual')) };
    if (order) { e.orderId = order.id; e.orderNumber = order.number; }
    if (note) e.note = String(note).slice(0, 200);
    user.bonusLog.unshift(e);
    if (user.bonusLog.length > 300) user.bonusLog.length = 300;
    return e;
  }
  /* Бонусы заказа после любой смены статуса:
     - отменили заказ или вернули деньги — возвращаем списанные бонусы и забираем начисленные;
     - заказ оплачен (или выполнен — смотря по настройке) — начисляем обещанные бонусы.
     Повторный вызов ничего не меняет. Возвращает true, если счёт изменился. */
  function syncOrderBonus(order, user, settings, mkId) {
    if (!order || !user) return false;
    var pay = order.payment || {}, changed = false;
    var off = order.status === 'canceled' || pay.status === 'refunded' || pay.status === 'canceled';
    if (order.bonusUsed > 0) {
      if (off && !order.bonusReturned) { bonusMove(user, order.bonusUsed, 'return', order, mkId); order.bonusReturned = true; changed = true; }
      else if (!off && order.bonusReturned) { bonusMove(user, -Math.min(user.bonus || 0, order.bonusUsed), 'spend', order, mkId); order.bonusReturned = false; changed = true; }
    }
    if (order.bonusEarn > 0) {
      var due = !off && (order.status === 'done' || (bonusConf(settings).creditOn === 'paid' && pay.status === 'paid'));
      if (due && !order.bonusCredited) { bonusMove(user, order.bonusEarn, 'earn', order, mkId); order.bonusCredited = true; changed = true; }
      else if (off && order.bonusCredited) { bonusMove(user, -Math.min(user.bonus || 0, order.bonusEarn), 'revoke', order, mkId); order.bonusCredited = false; changed = true; }
    }
    return changed;
  }

  function format(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }

  // Способ доставки «до пункта выдачи СДЭК»: пункт выбирают из списка СДЭК. Флаг pickupPoint задаётся в панели;
  // если его ещё не трогали — узнаём по названию («СДЭК, пункт выдачи»)
  function isPvzMethod(m) {
    if (!m || m.needsAddress === false || m.cdekDoor === true) return false;
    if (typeof m.pickupPoint === 'boolean') return m.pickupPoint;
    return /сдэк|cdek/i.test(m.name || '') && /пункт|пвз|постамат|выдач/i.test((m.name || '') + ' ' + (m.desc || ''));
  }

  // Курьер СДЭК до двери: город из подсказок СДЭК + улица, дом, квартира
  function isDoorMethod(m) { return !!(m && m.needsAddress !== false && m.cdekDoor === true); }
  function cdekMode(m) { return isDoorMethod(m) ? 'door' : isPvzMethod(m) ? 'pvz' : null; }

  /* Посылка для СДЭК. В карточке товара — вес и размер посылки (box: длина × ширина × высота, см).
     Вещи со своим размером кладутся стопкой: длина и ширина — по самой крупной, высоты складываются.
     Вещи без размера — в упаковку из настроек СДЭК (по самой крупной; если вещей много — на размер больше). */
  var DEFAULT_PACKS = [
    { id: 'bag', name: 'Пакет', length: 30, width: 25, height: 5, weight: 20 },
    { id: 'm', name: 'Коробка M', length: 40, width: 30, height: 10, weight: 150 },
    { id: 'l', name: 'Коробка L', length: 50, width: 40, height: 20, weight: 300 }
  ];
  function cdekPacks(c) {
    var list = c && Array.isArray(c.packs) && c.packs.length ? c.packs : DEFAULT_PACKS;
    return list.slice().sort(function (a, b) { return a.length * a.width * a.height - b.length * b.width * b.height; });
  }
  // Размер посылки товара; старые товары с выбранной упаковкой — её размер
  function boxOf(p, c) {
    var b = p && p.box, n = function (v) { return Math.max(0, Math.round(Number(v) || 0)); };
    if (b && n(b.length) && n(b.width) && n(b.height)) return { length: n(b.length), width: n(b.width), height: n(b.height) };
    if (p && p.pack) { var pk = cdekPacks(c).find(function (x) { return x.id === p.pack; }); if (pk) return { length: n(pk.length), width: n(pk.width), height: n(pk.height), pack: true }; }
    return null;
  }
  function parcelFor(items, products, c) {
    var packs = cdekPacks(c), def = Math.max(50, Number(c && c.pkg && c.pkg.weight) || 1000), n = 0, w = 0, other = 0;
    var defIdx = Math.max(0, packs.findIndex(function (x) { return c && x.id === c.defaultPack; }));
    var stack = null;
    (items || []).forEach(function (it) {
      var q = Math.max(0, Math.floor(Number(it.qty) || 0)); if (!q) return;
      var p = (products || []).find(function (x) { return x.id === it.productId; }) || {};
      n += q; w += (Number(p.weight) > 0 ? Number(p.weight) : def) * q;
      var b = boxOf(p, c);
      if (!b) { other += q; return; }
      var d = [b.length, b.width, b.height].sort(function (x, y) { return y - x; });
      stack = stack ? { length: Math.max(stack.length, d[0]), width: Math.max(stack.width, d[1]), height: stack.height + d[2] * q } : { length: d[0], width: d[1], height: d[2] * q };
    });
    var lim = function (v) { return Math.min(150, Math.max(1, Math.round(v))); };
    var out = { weight: w, length: 0, width: 0, height: 0, pack: '', count: n };
    if (other || !stack) {
      var idx = defIdx; if (other >= 3) idx++; if (other >= 6) idx++;
      var pk = packs[Math.min(idx, packs.length - 1)];
      out.weight += Number(pk.weight) || 0; out.pack = pk.name;
      if (stack) { out.length = Math.max(stack.length, pk.length); out.width = Math.max(stack.width, pk.width); out.height = stack.height + pk.height; out.pack = 'По размерам товаров + ' + pk.name; }
      else { out.length = pk.length; out.width = pk.width; out.height = pk.height; }
    } else { out.length = stack.length; out.width = stack.width; out.height = stack.height; out.pack = 'По размерам товаров'; }
    out.length = lim(out.length); out.width = lim(out.width); out.height = lim(out.height);
    out.weight = Math.min(30000, Math.max(50, Math.round(out.weight)));
    return out;
  }

  var api = { isPvzMethod: isPvzMethod, isDoorMethod: isDoorMethod, cdekMode: cdekMode, cdekPacks: cdekPacks, boxOf: boxOf, parcelFor: parcelFor, bonusConf: bonusConf, bonusFor: bonusFor, bonusMove: bonusMove, syncOrderBonus: syncOrderBonus, badgesOf: badgesOf, preorderLeft: preorderLeft, inkFor: inkFor, BADGE_KEYS: BADGE_KEYS, forGender: forGender, migrateData: migrateData, migrateProduct: migrateProduct, colorsOf: colorsOf, colorOf: colorOf, stockOf: stockOf, productPrice: productPrice, calcCart: calcCart, inWindow: inWindow, format: format };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pricing = api;
})(this);
