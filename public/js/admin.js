/* Панель управления магазином: #/admin */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var A = function () { return window.App; };
  var esc = function (s) { return A().esc(s); };
  var fmt = function (n) { return A().fmt(n); };
  var DATA = null;

  var SECTIONS = [
    ['overview', 'Обзор'], ['orders', 'Заказы'], ['products', 'Товары'], ['categories', 'Категории'], ['sizeCharts', 'Размерные сетки'],
    ['promotions', 'Акции'], ['promocodes', 'Промокоды'], ['bonus', 'Бонусы'], ['customers', 'Покупатели'], ['notify', 'Сообщить о поступлении'], ['sections', 'Разделы: женщинам / мужчинам'], ['brand', 'Логотип и название'], ['slider', 'Слайдер на главной'], ['home', 'Главная страница'], ['pages', 'Страницы'],
    ['menu', 'Меню, контакты, соцсети'], ['payment', 'Оплата, касса, доставка'], ['settings', 'Настройки']
  ];
  var TAX = [[1, 'ОСН — общая система'], [2, 'УСН «Доходы»'], [3, 'УСН «Доходы минус расходы»'], [5, 'ЕСХН'], [6, 'Патентная система']];
  var VAT = [[1, 'Без НДС'], [2, 'НДС 0%'], [7, 'НДС 5%'], [8, 'НДС 7%'], [3, 'НДС 10%'], [4, 'НДС 20% (до 2026)'], [11, 'НДС 22%']];

  function uid(p) { return Store.uid(p); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function translit(s) {
    var m = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
    return String(s || '').toLowerCase().split('').map(function (c) { return m[c] !== undefined ? m[c] : c; }).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || uid('item-');
  }
  function toast(m, bad) { A().toast(m, bad); }
  function plural(n, a, b, c) { return A().plural(n, a, b, c); }

  /* ================= Поля форм ================= */
  // def: {k, label, type, options, hint, wide, placeholder}
  function fieldHtml(d, obj) {
    var v = obj[d.k], id = 'f-' + d.k, cls = d.wide ? ' style="grid-column:1/-1"' : '';
    var hint = d.hint ? '<small class="muted" style="font-size:13px">' + esc(d.hint) + '</small>' : '';
    switch (d.type) {
      case 'textarea': return '<label class="field"' + ' style="grid-column:1/-1"><span>' + esc(d.label) + '</span><textarea class="textarea" id="' + id + '" data-k="' + d.k + '" rows="' + (d.rows || 4) + '">' + esc(v || '') + '</textarea>' + hint + '</label>';
      case 'number': return '<label class="field"' + cls + '><span>' + esc(d.label) + '</span><input class="input num" type="number" min="0" step="' + (d.step || 1) + '" id="' + id + '" data-k="' + d.k + '" value="' + esc(v == null ? '' : v) + '">' + hint + '</label>';
      case 'date': return '<label class="field"' + cls + '><span>' + esc(d.label) + '</span><input class="input" type="date" id="' + id + '" data-k="' + d.k + '" value="' + esc(v || '') + '">' + hint + '</label>';
      case 'select': return '<label class="field"' + cls + '><span>' + esc(d.label) + '</span><select class="select" id="' + id + '" data-k="' + d.k + '">' + d.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>' + hint + '</label>';
      case 'checkbox': return '<label class="check" style="grid-column:1/-1"><input type="checkbox" id="' + id + '" data-k="' + d.k + '"' + (v ? ' checked' : '') + '> <span>' + esc(d.label) + (d.hint ? '<br><small style="font-size:13px">' + esc(d.hint) + '</small>' : '') + '</span></label>';
      case 'multi': return '<div class="field" style="grid-column:1/-1" data-multi="' + d.k + '"><span>' + esc(d.label) + '</span><div class="adm-multi">' + (d.options.length ? d.options.map(function (o) { return '<label class="check"><input type="checkbox" value="' + esc(o[0]) + '"' + ((v || []).indexOf(o[0]) !== -1 ? ' checked' : '') + '> ' + esc(o[1]) + '</label>'; }).join('') : '<span class="muted">Нет вариантов</span>') + '</div>' + hint + '</div>';
      case 'color': return '<label class="field"' + cls + '><span>' + esc(d.label) + '</span><input class="input adm-color-input" type="color" id="' + id + '" data-k="' + d.k + '" value="' + esc(v || '#141414') + '">' + hint + '</label>';
      case 'badges': return badgesField(obj);
      case 'images': case 'image': return '<div class="field" style="grid-column:1/-1"><span>' + esc(d.label) + '</span><div class="adm-imgs" data-imgs="' + d.k + '" data-single="' + (d.type === 'image' ? 1 : 0) + '"></div>' + hint + '</div>';
      default: return '<label class="field"' + cls + '><span>' + esc(d.label) + '</span><input class="input" id="' + id + '" data-k="' + d.k + '" value="' + esc(v == null ? '' : v) + '"' + (d.placeholder ? ' placeholder="' + esc(d.placeholder) + '"' : '') + '>' + hint + '</label>';
    }
  }
  function formHtml(defs, obj) { return '<div class="adm-form">' + defs.map(function (d) { return d.section ? '<h4 class="adm-sub">' + esc(d.section) + '</h4>' : fieldHtml(d, obj); }).join('') + '</div>'; }
  function readForm(box, defs, obj) {
    defs.forEach(function (d) {
      if (d.section) return;
      if (d.type === 'badges') { readBadges(box, obj); return; }
      if (d.type === 'multi') { obj[d.k] = $$('[data-multi="' + d.k + '"] input:checked', box).map(function (i) { return i.value; }); return; }
      if (d.type === 'images' || d.type === 'image') { var st = imgState[d.k] || []; obj[d.k] = d.type === 'image' ? (st[0] || '') : st.slice(); return; }
      var el = $('[data-k="' + d.k + '"]', box); if (!el) return;
      if (d.type === 'checkbox') obj[d.k] = el.checked;
      else if (d.type === 'number') obj[d.k] = el.value === '' ? 0 : Number(el.value);
      else if (d.type === 'select' && typeof (d.options[0] || [])[0] === 'number') obj[d.k] = Number(el.value);
      else obj[d.k] = el.value.trim();
    });
    return obj;
  }

  /* --- Плашки товара: Новинка, Скидка, Хит --- */
  var BADGE_ROWS = [['new', 'Новинка', 'Товар также появится в разделе «Новинки».'], ['sale', 'Скидка', 'Видна, только если у товара есть скидка — старая цена или акция. {n} заменится на размер скидки в процентах.'], ['hit', 'Хит продаж', 'Товар попадёт в блок «Хиты продаж» на главной. Самые продаваемые товары попадают туда сами (настройка в «Главной странице»).']];
  function badgeSample(k, text, p) {
    if (k !== 'sale') return text;
    var pr = Pricing.productPrice(p, DATA.promotions), n = pr.oldPrice ? Math.round((1 - pr.price / pr.oldPrice) * 100) : 15;
    return text.replace(/\{n\}/g, n);
  }
  function badgesField(p) {
    var conf = DATA.settings.badges || {}, tags = p.tags || [], off = p.badgeOff || [], own = p.badgeText || {};
    return '<div class="field" style="grid-column:1/-1" data-badges><span>Плашки на карточке</span><div class="adm-badges">' + BADGE_ROWS.map(function (r) {
      var k = r[0], c = conf[k] || {}, on = k === 'sale' ? off.indexOf('sale') === -1 : tags.indexOf(k) !== -1, def = c.text || r[1];
      return '<div class="adm-badge-row"><label class="adm-switch" title="Показывать плашку"><input type="checkbox" data-bon="' + k + '"' + (on ? ' checked' : '') + ' aria-label="Показывать плашку «' + esc(r[1]) + '»"><span></span></label>' +
        '<span class="badge' + (on ? '' : ' is-off') + '" data-bpv="' + k + '" data-def="' + esc(def) + '" style="--b:' + esc(c.color || '#141414') + ';--bi:' + Pricing.inkFor(c.color) + '">' + esc(badgeSample(k, own[k] || def, p)) + '</span>' +
        '<input class="input" data-btext="' + k + '" value="' + esc(own[k] || '') + '" placeholder="' + esc(def) + '" aria-label="Текст плашки «' + esc(r[1]) + '»">' +
        (r[2] ? '<small class="muted">' + esc(r[2]) + '</small>' : '') + '</div>';
    }).join('') + '</div><small class="muted" style="font-size:13px">Пустое поле — общий текст из раздела «Настройки». Там же меняются цвета плашек.</small></div>';
  }
  function readBadges(box, p) {
    var tags = (p.tags || []).filter(function (t) { return t !== 'new' && t !== 'hit'; });
    ['new', 'hit'].forEach(function (k) { if ($('[data-bon="' + k + '"]', box).checked) tags.push(k); });
    p.tags = tags;
    p.badgeOff = $('[data-bon="sale"]', box).checked ? [] : ['sale'];
    p.badgeText = {};
    BADGE_ROWS.forEach(function (r) { var v = $('[data-btext="' + r[0] + '"]', box).value.trim(); if (v) p.badgeText[r[0]] = v; });
  }
  // Предпросмотр плашки обновляется сразу при вводе текста и переключении
  function badgePreview(e) {
    var row = e.target.closest('.adm-badge-row'); if (!row) return;
    var pv = $('[data-bpv]', row), k = pv.getAttribute('data-bpv'), t = $('[data-btext]', row).value.trim() || pv.getAttribute('data-def');
    var form = row.closest('#edForm'), p = { price: Number(($('#f-price', form) || {}).value) || 0, compareAt: Number(($('#f-compareAt', form) || {}).value) || 0, categoryId: ($('#f-categoryId', form) || {}).value, id: '' };
    pv.textContent = badgeSample(k, t, p); pv.classList.toggle('is-off', !$('[data-bon]', row).checked);
  }
  document.addEventListener('input', badgePreview);
  document.addEventListener('change', badgePreview);

  /* --- Загрузка изображений --- */
  var imgState = {};
  function mountImages(box, obj) {
    $$('[data-imgs]', box).forEach(function (el) {
      var k = el.getAttribute('data-imgs'), single = el.getAttribute('data-single') === '1';
      var v = obj[k]; imgState[k] = single ? (v ? [v] : []) : (v || []).slice();
      var draw = function () {
        el.innerHTML = imgState[k].map(function (src, i) {
          return '<div class="adm-img"><img src="' + esc(src) + '" alt=""><div class="adm-img-tools">' + (!single && i > 0 ? '<button type="button" data-left="' + i + '" title="Сделать раньше">←</button>' : '') + '<button type="button" data-del="' + i + '" title="Удалить">✕</button></div>' + (!single && i === 0 ? '<span class="adm-img-main">Главное</span>' : '') + '</div>';
        }).join('') + ((single && imgState[k].length) ? '' : '<label class="adm-img add"><input type="file" accept="image/*"' + (single ? '' : ' multiple') + ' hidden><span>+ Загрузить фото</span></label>');
      };
      draw();
      el.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-del')) imgState[k].splice(+b.getAttribute('data-del'), 1);
        if (b.hasAttribute('data-left')) { var i = +b.getAttribute('data-left'), t = imgState[k][i]; imgState[k][i] = imgState[k][i - 1]; imgState[k][i - 1] = t; }
        draw();
      });
      el.addEventListener('change', async function (e) {
        if (!e.target.files) return;
        var files = Array.prototype.slice.call(e.target.files);
        el.classList.add('busy');
        for (var i = 0; i < files.length; i++) {
          try { imgState[k].push(await A().API.uploadImage(files[i])); } catch (ex) { toast(A().errMsg(ex), true); }
        }
        el.classList.remove('busy'); draw();
      });
    });
  }

  /* --- Список строк (меню, соцсети, преимущества, способы доставки) --- */
  function rowsEditor(key, cols, rows) {
    return '<div class="adm-rows" data-rows="' + key + '"><div class="adm-rows-body">' + rows.map(function (r) { return rowHtml(cols, r); }).join('') + '</div><button type="button" class="btn ghost sm" data-addrow>+ Добавить</button></div>';
  }
  function rowHtml(cols, r) {
    return '<div class="adm-row" data-id="' + esc(r.id || uid('r')) + '">' + cols.map(function (c) {
      if (c.type === 'checkbox') return '<label class="check" title="' + esc(c.label) + '"><input type="checkbox" data-c="' + c.k + '"' + (r[c.k] ? ' checked' : '') + '> ' + esc(c.label) + '</label>';
      return '<input class="input' + (c.type === 'number' ? ' num' : '') + '" ' + (c.type === 'number' ? 'type="number" min="0" ' : '') + 'data-c="' + c.k + '" placeholder="' + esc(c.label) + '" aria-label="' + esc(c.label) + '" value="' + esc(r[c.k] == null ? '' : r[c.k]) + '" style="flex:' + (c.flex || 1) + '">';
    }).join('') + '<span class="adm-row-tools"><button type="button" data-up title="Выше">↑</button><button type="button" data-down title="Ниже">↓</button><button type="button" data-rm title="Удалить">✕</button></span></div>';
  }
  function bindRows(box, defs) {
    $$('[data-rows]', box).forEach(function (el) {
      var cols = defs[el.getAttribute('data-rows')];
      el.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var row = b.closest('.adm-row'), body = $('.adm-rows-body', el);
        if (b.hasAttribute('data-addrow')) { body.insertAdjacentHTML('beforeend', rowHtml(cols, {})); $('input', body.lastElementChild).focus(); }
        if (b.hasAttribute('data-rm')) row.remove();
        if (b.hasAttribute('data-up') && row.previousElementSibling) body.insertBefore(row, row.previousElementSibling);
        if (b.hasAttribute('data-down') && row.nextElementSibling) body.insertBefore(row.nextElementSibling, row);
      });
    });
  }
  function readRows(box, key, cols) {
    return $$('[data-rows="' + key + '"] .adm-row', box).map(function (row) {
      var o = { id: row.getAttribute('data-id') };
      cols.forEach(function (c) { var i = $('[data-c="' + c.k + '"]', row); o[c.k] = c.type === 'checkbox' ? i.checked : c.type === 'number' ? Number(i.value || 0) : i.value.trim(); });
      return o;
    }).filter(function (o) { return cols.some(function (c) { return c.type !== 'checkbox' && c.type !== 'number' && o[c.k]; }); });
  }

  /* --- Кнопка удаления с подтверждением на месте --- */
  function bindConfirm(btn, fn) {
    var armed = false, label = btn.textContent;
    btn.addEventListener('click', function () {
      if (!armed) { armed = true; btn.textContent = 'Нажмите ещё раз для удаления'; btn.classList.add('danger'); setTimeout(function () { armed = false; btn.textContent = label; btn.classList.remove('danger'); }, 3500); return; }
      fn();
    });
  }

  async function reload() { DATA = await A().API.adminData(); }
  async function afterSave(msg, hash) {
    await reload();
    if (hash) location.hash = hash;
    await A().refresh();
    toast(msg || 'Сохранено'); // после перерисовки, иначе уведомление исчезает вместе со старой страницей
  }

  /* ================= Каркас админки ================= */
  var renderTicket = 0;
  async function render(v, parts, q) {
    var API = A().API;
    if (!API.isAdmin) return loginView(v);
    var ticket = ++renderTicket;
    if (!DATA) v.innerHTML = '<div class="loader">…</div>';
    try { await reload(); }
    catch (e) {
      // 401 — сессия действительно закончилась: показываем вход. Любой другой сбой (связь, перезагрузка страницы)
      // не повод выходить из панели: показываем ошибку и кнопку «Повторить», сессия остаётся
      if (e.status === 401) { API.isAdmin = false; return loginView(v); }
      if (ticket !== renderTicket || !document.body.contains(v)) return;
      v.innerHTML = '<div class="wrap"><div class="empty" style="padding:120px 0"><h3>Не удалось загрузить панель</h3><p>' + esc(A().errMsg(e)) + '</p><button class="btn" id="admRetry">Повторить</button></div></div>';
      $('#admRetry').addEventListener('click', function () { render(v, parts, q); });
      return;
    }
    if (ticket !== renderTicket || !document.body.contains(v)) return; // пока грузились данные, открылась другая страница
    var s = q.s || 'overview';
    v.innerHTML = '<div class="adm"><aside class="adm-side"><div class="adm-brand"><span class="eyebrow">Управление</span><b class="serif">' + esc(A().D.settings.storeName) + '</b></div><nav>' +
      SECTIONS.map(function (x) { return '<a href="#/admin?s=' + x[0] + '"' + (x[0] === s ? ' class="on"' : '') + '>' + x[1] + (x[0] === 'orders' ? newOrdersBadge() : '') + (x[0] === 'notify' ? waitBadge() : '') + '</a>'; }).join('') +
      '</nav><div class="adm-side-foot"><a href="#/" class="muted">← В магазин</a><button class="muted" id="admOut">Выйти</button></div></aside><section class="adm-main" id="admMain"></section></div>';
    $('#admOut').addEventListener('click', async function () { await API.adminLogout(); DATA = null; location.hash = '#/'; await A().refresh(); });
    var main = $('#admMain');
    var fn = { overview: overview, orders: orders, products: products, categories: categories, sizeCharts: sizeCharts, promotions: promotions, promocodes: promocodes, bonus: bonusSection, customers: customers, notify: notifySection, sections: sectionsSettings, brand: brandSection, slider: sliderSection, home: homeSettings, pages: pages, menu: menuSettings, payment: paymentSettings, settings: generalSettings }[s] || overview;
    fn(main, q);
  }
  function waitBadge() { var n = (DATA.waitlist || []).filter(function (w) { return w.status === 'waiting' || w.status === 'failed'; }).length; return n ? ' <span class="adm-badge muted-badge">' + n + '</span>' : ''; }
  function newOrdersBadge() { var n = DATA.orders.filter(function (o) { return o.status === 'new'; }).length; return n ? ' <span class="adm-badge">' + n + '</span>' : ''; }
  function head(title, actions, sub) { return '<div class="adm-head"><div><h1 class="serif">' + esc(title) + '</h1>' + (sub ? '<p class="muted" style="margin-top:6px;font-size:14px;max-width:70ch">' + sub + '</p>' : '') + '</div><div class="adm-actions">' + (actions || '') + '</div></div>'; }

  function loginView(v) {
    v.innerHTML = '<div class="wrap"><div class="auth" style="padding-top:72px"><div style="text-align:center;display:grid;gap:12px"><span class="eyebrow">Панель управления</span><h1 class="serif" style="font-size:52px">Вход</h1></div>' +
      '<form class="form" id="admLogin" novalidate><label class="field"><span>Пароль администратора</span><input class="input" type="password" id="adm-pass" autocomplete="current-password"></label><p class="form-error" id="admErr"></p><button class="btn block">Войти</button></form>' + '</div></div>';
    $('#admLogin').addEventListener('submit', async function (e) {
      e.preventDefault();
      try { await A().API.adminLogin($('#adm-pass').value); DATA = null; location.hash = '#/admin?s=overview'; await A().refresh(); }
      catch (ex) { $('#admErr').textContent = A().errMsg(ex); }
    });
  }

  /* ================= Обзор ================= */
  function overview(m) {
    var o = DATA.orders, today = new Date().toDateString();
    var active = o.filter(function (x) { return x.status !== 'canceled'; });
    var revenue = active.reduce(function (s, x) { return s + x.total; }, 0);
    var todayN = o.filter(function (x) { return new Date(x.createdAt).toDateString() === today; }).length;
    var newN = o.filter(function (x) { return x.status === 'new'; }).length;
    var low = [];
    DATA.products.forEach(function (p) { Pricing.colorsOf(p).forEach(function (c) { (c.sizes || []).forEach(function (s) { if (s.stock <= 1) low.push({ p: p, c: c, s: s }); }); }); });
    var promosActive = DATA.promotions.filter(function (p) { return Pricing.inWindow(p, Date.now()); }).length;
    var codesActive = DATA.promocodes.filter(function (c) { return c.active; }).length;
    // Реквизиты продавца подставляются в оферту, политику и согласие — без настоящих реквизитов документы недействительны
    var legal = String(DATA.settings.legal || '');
    var legalBad = !legal.trim() || /0{10}|Иванов И\. И\./.test(legal);
    m.innerHTML = head('Обзор') +
      (legalBad ? '<div class="adm-alert"><b>Укажите реквизиты продавца.</b> Они подставляются в публичную оферту, политику обработки персональных данных и согласие. Сейчас там: «' + esc(legal || 'пусто') + '». <a class="link" href="#/admin?s=settings">Открыть настройки</a></div>' : '') +
      '<div class="adm-stats">' +
        stat('Новые заказы', newN, '#/admin?s=orders&f=new') + stat('Заказов сегодня', todayN, '#/admin?s=orders') + stat('Выручка, всего', fmt(revenue), '#/admin?s=orders') + stat('Покупателей', DATA.users.length, '#/admin?s=customers') +
        stat('Товаров в продаже', DATA.products.filter(function (p) { return p.active !== false; }).length, '#/admin?s=products') + stat('Активных акций', promosActive, '#/admin?s=promotions') + stat('Активных промокодов', codesActive, '#/admin?s=promocodes') +
      '</div>' +
      '<div class="adm-two"><div class="adm-card"><h3 class="adm-h3">Последние заказы</h3>' + (o.length ? ordersTable(o.slice().reverse().slice(0, 6)) : '<p class="muted">Заказов пока нет.</p>') + '</div>' +
      '<div class="adm-card"><h3 class="adm-h3">Заканчиваются</h3>' + (low.length ? '<div class="adm-list">' + low.slice(0, 10).map(function (x) { return '<a href="#/admin?s=products&id=' + esc(x.p.id) + '" class="adm-li"><span>' + esc(x.p.name) + ' <span class="muted">· ' + esc(x.c.name) + ' · ' + esc(x.s.size) + '</span></span><span class="num ' + (x.s.stock ? 'warn' : 'bad') + '">' + x.s.stock + ' шт.</span></a>'; }).join('') + '</div>' : '<p class="muted">Все размеры в наличии.</p>') + '</div></div>';
  }
  function stat(label, val, href) { return '<a class="adm-stat" href="' + href + '"><span class="eyebrow">' + esc(label) + '</span><b class="num">' + esc(val) + '</b></a>'; }

  /* ================= Заказы ================= */
  function ordersTable(list) {
    return '<div class="table-wrap adm-table"><table class="sizes"><thead><tr><th>№</th><th>Дата</th><th>Покупатель</th><th>Сумма</th><th>Оплата</th><th>Статус</th></tr></thead><tbody>' +
      list.map(function (o) {
        return '<tr data-href="#/admin?s=orders&id=' + esc(o.id) + '"><td>' + esc(o.number) + '</td><td>' + esc(new Date(o.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '</td><td>' + esc(o.customer.firstName + ' ' + o.customer.lastName) + '</td><td class="num">' + fmt(o.total) + '</td>' +
          '<td><span class="status ' + esc(o.payment.status) + '">' + esc(o.payment.method === 'bonus' ? 'Бонусами' : o.payment.method === 'cod' && o.payment.status === 'pending' ? 'При получении' : A().PAY[o.payment.status]) + '</span></td><td><span class="status ' + esc(o.status) + '">' + esc(A().STATUS[o.status]) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function orders(m, q) {
    if (q.id) return orderDetail(m, q.id);
    var f = q.f || 'all', search = (q.q || '').toLowerCase();
    var list = DATA.orders.slice().reverse().filter(function (o) {
      if (f !== 'all' && o.status !== f) return false;
      if (search) { var t = [o.number, o.customer.firstName, o.customer.lastName, o.customer.email, o.customer.phone].join(' ').toLowerCase(); if (t.indexOf(search) === -1) return false; }
      return true;
    });
    m.innerHTML = head('Заказы', '<input class="input" id="oSearch" placeholder="Номер, имя, телефон" value="' + esc(q.q || '') + '" style="min-height:40px;width:220px">') +
      '<div class="adm-filter">' + [['all', 'Все']].concat(Object.keys(A().STATUS).map(function (k) { return [k, A().STATUS[k]]; })).map(function (x) { var n = x[0] === 'all' ? DATA.orders.length : DATA.orders.filter(function (o) { return o.status === x[0]; }).length; return '<a class="chip' + (f === x[0] ? ' on' : '') + '" href="#/admin?s=orders&f=' + x[0] + '">' + x[1] + ' <span class="muted" style="margin-left:6px">' + n + '</span></a>'; }).join('') + '</div>' +
      (list.length ? ordersTable(list) : '<div class="empty"><h3>Заказов нет</h3><p>Они появятся здесь сразу после оформления на сайте.</p></div>');
    var si = $('#oSearch'); si.addEventListener('change', function () { location.hash = '#/admin?s=orders&f=' + f + '&q=' + encodeURIComponent(si.value); });
  }
  function orderDetail(m, id) {
    var o = DATA.orders.find(function (x) { return x.id === id; });
    if (!o) { m.innerHTML = head('Заказ не найден') + '<a class="link" href="#/admin?s=orders">← К заказам</a>'; return; }
    var c = o.customer, d = o.delivery || {};
    m.innerHTML = '<a class="link muted" href="#/admin?s=orders" style="font-size:14px">← Все заказы</a>' + head('Заказ № ' + o.number, '', esc(new Date(o.createdAt).toLocaleString('ru-RU'))) +
      '<div class="adm-two"><div class="adm-card" style="display:grid;gap:14px"><h3 class="adm-h3">Состав</h3>' +
        o.items.map(function (i) { return '<div class="mini-line"><img src="' + esc(i.image || Art.make(i.art)) + '" alt=""><div>' + esc(i.name) + '<div class="sub">' + (i.color ? 'Цвет ' + esc(i.color) + ' · ' : '') + 'Размер ' + esc(i.size) + ' · ' + i.qty + ' шт. × ' + fmt(i.price) + '</div></div><span class="num">' + fmt(i.price * i.qty) + '</span></div>'; }).join('') +
        '<div class="sum-row"><span>Товары</span><span>' + fmt(o.subtotal) + '</span></div>' +
        (o.promoDiscount ? '<div class="sum-row disc"><span>Промокод ' + esc(o.promoCode) + '</span><span>−' + fmt(o.promoDiscount) + '</span></div>' : '') +
        '<div class="sum-row"><span>' + esc(d.name || 'Доставка') + '</span><span>' + fmt(d.price || 0) + '</span></div>' +
        (o.bonusUsed ? '<div class="sum-row disc"><span>Оплачено бонусами' + (o.bonusReturned ? ' (возвращены покупателю)' : '') + '</span><span>−' + fmt(o.bonusUsed) + '</span></div>' : '') +
        '<div class="sum-row total"><span>Итого деньгами</span><span>' + fmt(o.total) + '</span></div>' +
        (o.bonusEarn ? '<div class="sum-row"><span class="muted">Бонусы за заказ: ' + (o.bonusCredited ? 'начислены' : o.status === 'canceled' ? 'не начисляются — заказ отменён' : 'начислятся ' + (Pricing.bonusConf(DATA.settings).creditOn === 'done' ? 'когда заказ будет выполнен' : 'после оплаты')) + '</span><span class="num">+' + o.bonusEarn + '</span></div>' : '') + '</div>' +
      '<div style="display:grid;gap:16px;align-content:start"><div class="adm-card" style="display:grid;gap:8px"><h3 class="adm-h3">Покупатель</h3><b>' + esc(c.firstName + ' ' + c.lastName) + '</b><span class="copyable">' + esc(A().fmtPhone(c.phone)) + '</span><span class="copyable">' + esc(c.email) + '</span>' + (o.userId ? '<span class="muted" style="font-size:14px">Зарегистрированный покупатель</span>' : '<span class="muted" style="font-size:14px">Без регистрации</span>') + '</div>' +
        '<div class="adm-card" style="display:grid;gap:8px"><h3 class="adm-h3">Доставка</h3><span>' + esc(d.name || '—') + '</span>' + (d.city || d.address ? '<span class="copyable">' + esc([d.city, d.address].filter(Boolean).join(', ')) + '</span>' : '') + (o.comment ? '<span class="muted">Комментарий: ' + esc(o.comment) + '</span>' : '') + '</div>' +
        '<div class="adm-card adm-form" style="grid-template-columns:1fr"><h3 class="adm-h3">Статус</h3>' +
          fieldHtml({ k: 'status', label: 'Статус заказа', type: 'select', options: Object.keys(A().STATUS).map(function (k) { return [k, A().STATUS[k]]; }) }, o) +
          fieldHtml({ k: 'paymentStatus', label: 'Оплата (' + (o.payment.method === 'online' ? 'онлайн' : o.payment.method === 'bonus' ? 'бонусами' : 'при получении') + ')', type: 'select', options: Object.keys(A().PAY).map(function (k) { return [k, A().PAY[k]]; }) }, { paymentStatus: o.payment.status }) +
          fieldHtml({ k: 'note', label: 'Заметка для себя', type: 'textarea', rows: 2 }, { note: o.adminNote || '' }) +
          '<button class="btn" id="oSave">Сохранить</button></div></div></div>';
    $('#oSave').addEventListener('click', async function () {
      try { var r = await A().API.adminOrder(o.id, { status: $('#f-status').value, paymentStatus: $('#f-paymentStatus').value, note: $('#f-note').value }); await afterSave(notifyMsg('Заказ обновлён', r.notify), '#/admin?s=orders&id=' + o.id); }
      catch (e) { toast(A().errMsg(e), true); }
    });
  }

  /* ================= Универсальный редактор коллекций ================= */
  function collection(m, q, cfg) {
    var items = DATA[cfg.key];
    if (q.id) {
      var isNew = q.id === 'new';
      var item = isNew ? cfg.blank() : clone(items.find(function (x) { return x.id === q.id; }) || {});
      if (!isNew && !item.id) { m.innerHTML = head('Не найдено') + '<a class="link" href="#/admin?s=' + cfg.key + '">← Назад</a>'; return; }
      m.innerHTML = '<a class="link muted" href="#/admin?s=' + cfg.key + '" style="font-size:14px">← ' + esc(cfg.title) + '</a>' +
        head(isNew ? cfg.newTitle : (cfg.itemTitle(item) || 'Без названия'), (cfg.view && !isNew ? cfg.view(item) : '')) +
        '<div class="adm-card" id="edForm">' + formHtml(cfg.fields(), item) + (cfg.extra ? cfg.extra(item) : '') + '</div>' +
        '<div class="adm-bar"><button class="btn" id="edSave">Сохранить</button>' + (!isNew && cfg.duplicate ? '<button class="btn ghost" id="edDup">Копировать</button>' : '') + (!isNew ? '<button class="btn ghost" id="edDel">Удалить</button>' : '') + '<span class="form-error" id="edErr"></span></div>';
      var box = $('#edForm'); mountImages(box, item); if (cfg.mount) cfg.mount(box, item);
      $('#edSave').addEventListener('click', async function () {
        var next = readForm(box, cfg.fields(), clone(item));
        if (cfg.read) cfg.read(box, next);
        var problem = cfg.validate ? cfg.validate(next, items) : '';
        if (problem) { $('#edErr').textContent = problem; return; }
        if (!next.id) next.id = uid(cfg.prefix);
        try { var r = await A().API.adminUpsert(cfg.key, next); await afterSave(notifyMsg('Сохранено', r && r.notify), '#/admin?s=' + cfg.key + '&id=' + next.id); }
        catch (e) { $('#edErr').textContent = A().errMsg(e); }
      });
      if ($('#edDup')) $('#edDup').addEventListener('click', async function () {
        var copy = cfg.duplicate(clone(item));
        try { await A().API.adminUpsert(cfg.key, copy); await afterSave('Создана копия', '#/admin?s=' + cfg.key + '&id=' + copy.id); } catch (e) { toast(A().errMsg(e), true); }
      });
      if ($('#edDel')) bindConfirm($('#edDel'), async function () {
        try { await A().API.adminDelete(cfg.key, item.id); await afterSave('Удалено', '#/admin?s=' + cfg.key); } catch (e) { toast(A().errMsg(e), true); }
      });
      return;
    }
    var list = cfg.sort ? items.slice().sort(cfg.sort) : items;
    var term = (q.q || '').toLowerCase();
    if (term) list = list.filter(function (x) { return JSON.stringify(cfg.row(x)).toLowerCase().indexOf(term) !== -1; });
    m.innerHTML = head(cfg.title, (cfg.searchable ? '<input class="input" id="cSearch" placeholder="Поиск" value="' + esc(q.q || '') + '" style="min-height:40px;width:200px">' : '') + '<a class="btn sm" href="#/admin?s=' + cfg.key + '&id=new">+ ' + esc(cfg.addLabel) + '</a>', cfg.sub) +
      (list.length ? '<div class="table-wrap adm-table"><table class="sizes' + (cfg.bulk ? ' adm-bulk-table' : '') + '"><thead><tr>' +
        (cfg.bulk ? '<th class="adm-pick-cell"><label class="check adm-pick" title="Выбрать все"><input type="checkbox" id="pickAll" aria-label="Выбрать все"></label></th>' : '') +
        cfg.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        list.map(function (x) { return '<tr data-href="#/admin?s=' + cfg.key + '&id=' + esc(x.id) + '">' + (cfg.bulk ? '<td class="adm-pick-cell"><label class="check adm-pick"><input type="checkbox" data-pick="' + esc(x.id) + '" aria-label="Выбрать"></label></td>' : '') + cfg.row(x).map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
        (cfg.bulk ? '<div class="adm-bar adm-bulk-bar" id="bulkBar" hidden><span class="adm-bulk-n" id="bulkN"></span><button class="btn ghost sm" id="bulkAll"></button><button class="btn ghost sm" id="bulkNone">Снять выбор</button><button class="btn sm" id="bulkDel"></button></div>' : '')
        : '<div class="empty"><h3>Пока пусто</h3><a class="btn ghost" href="#/admin?s=' + cfg.key + '&id=new">' + esc(cfg.addLabel) + '</a></div>');
    var cs = $('#cSearch'); if (cs) cs.addEventListener('change', function () { location.hash = '#/admin?s=' + cfg.key + '&q=' + encodeURIComponent(cs.value); });
    if (cfg.bulk && list.length) bindBulk(m, cfg, list, q);
  }
  /* Выбор нескольких строк галочками и удаление выбранных (сейчас — в «Товарах») */
  function bindBulk(m, cfg, list, q) {
    var picks = $$('[data-pick]', m), all = $('#pickAll', m), bar = $('#bulkBar', m), del = $('#bulkDel', m), armed = false, timer = null;
    var w = cfg.bulk;  // слова: { one, few, many } — «товар», «товара», «товаров»
    var word = function (n) { return A().plural(n, w.one, w.few, w.many); };
    function chosen() { return picks.filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-pick'); }); }
    function disarm() { armed = false; clearTimeout(timer); del.classList.remove('danger'); }
    function sync() {
      var n = chosen().length;
      picks.forEach(function (c) { c.closest('tr').classList.toggle('picked', c.checked); });
      all.checked = n === picks.length; all.indeterminate = n > 0 && n < picks.length;
      bar.hidden = !n; disarm();
      $('#bulkN', m).textContent = 'Выбрано: ' + n + ' из ' + picks.length;
      var ba = $('#bulkAll', m); ba.hidden = n === picks.length; ba.textContent = 'Выбрать все ' + picks.length;
      del.textContent = 'Удалить ' + n + ' ' + word(n);
    }
    // слушаем саму таблицу: она новая при каждой отрисовке, поэтому старые обработчики не копятся
    $('.adm-bulk-table', m).addEventListener('change', function (e) {
      if (e.target === all) { picks.forEach(function (c) { c.checked = all.checked; }); sync(); return; }
      if (e.target.hasAttribute && e.target.hasAttribute('data-pick')) sync();
    });
    $('#bulkAll', m).addEventListener('click', function () { picks.forEach(function (c) { c.checked = true; }); sync(); });
    $('#bulkNone', m).addEventListener('click', function () { picks.forEach(function (c) { c.checked = false; }); sync(); });
    del.addEventListener('click', async function () {
      var ids = chosen(); if (!ids.length) return;
      if (!armed) {
        armed = true; del.classList.add('danger');
        del.textContent = 'Нажмите ещё раз — удалить ' + ids.length + ' ' + word(ids.length) + ' навсегда';
        timer = setTimeout(sync, 4000);
        return;
      }
      disarm(); del.disabled = true; del.textContent = 'Удаляю…';
      try {
        var n = await A().API.adminDeleteMany(cfg.key, ids);
        await afterSave('Удалено: ' + n + ' ' + word(n), '#/admin?s=' + cfg.key + (q.q ? '&q=' + encodeURIComponent(q.q) : ''));
      } catch (e) { del.disabled = false; sync(); toast(A().errMsg(e), true); }
    });
    sync();
  }
  function onOff(b) { return b ? '<span class="status done">Да</span>' : '<span class="status canceled">Нет</span>'; }
  function catOpts() { return DATA.categories.map(function (c) { return [c.id, c.name]; }); }

  /* ================= Товары ================= */
  function productStock(p) { return Pricing.colorsOf(p).reduce(function (s, c) { return s + Pricing.stockOf(c); }, 0); }
  function products(m, q) {
    var colorsState = [];
    collection(m, q, {
      key: 'products', prefix: 'p', title: 'Товары', newTitle: 'Новый товар', addLabel: 'Добавить товар', searchable: true,
      bulk: { one: 'товар', few: 'товара', many: 'товаров' },
      sub: 'Нажмите на строку, чтобы изменить товар: цены, цвета, фото, размеры и остатки. Галочками можно выбрать несколько товаров или все сразу и удалить их.',
      itemTitle: function (x) { return x.name; },
      view: function (x) { return '<a class="btn ghost sm" href="#/product/' + esc(x.slug) + '">Открыть на сайте</a>'; },
      blank: function () { return { name: '', slug: '', gender: 'women', categoryId: (DATA.categories[0] || {}).id || '', price: 0, compareAt: 0, tags: ['new'], description: '', composition: '', care: '', colors: [newColor(1, '#3a3734')], sizeChartId: (DATA.sizeCharts[0] || {}).id || '', active: true, createdAt: new Date().toISOString().slice(0, 10) }; },
      cols: ['', 'Название', 'Для кого', 'Категория', 'Цвета', 'Цена', 'Остаток', 'В продаже'],
      row: function (p) {
        var c = DATA.categories.find(function (x) { return x.id === p.categoryId; }), st = productStock(p), pr = Pricing.productPrice(p, DATA.promotions);
        var cs = Pricing.colorsOf(p);
        return ['<img class="adm-thumb" src="' + esc(A().imgOf(p)) + '" alt="">', esc(p.name), esc({ women: 'Женщинам', men: 'Мужчинам' }[p.gender] || 'Унисекс'), esc(c ? c.name : '—'),
          '<span class="card-swatches" title="' + esc(cs.map(function (x) { return x.name; }).join(', ')) + '">' + cs.map(function (x) { return '<i style="background:' + esc(x.hex || 'var(--surface-2)') + '"></i>'; }).join('') + '</span>',
          '<span class="num">' + fmt(pr.price) + (pr.oldPrice ? ' <s class="muted">' + fmt(pr.oldPrice) + '</s>' : '') + '</span>', '<span class="num' + (st === 0 ? ' bad' : st < 4 ? ' warn' : '') + '">' + st + '</span>', onOff(p.active !== false)];
      },
      fields: function () {
        return [
          { section: 'Основное' },
          { k: 'name', label: 'Название', wide: true },
          { k: 'categoryId', label: 'Категория', type: 'select', options: catOpts() },
          { k: 'gender', label: 'Для кого', type: 'select', options: [['women', 'Женщинам'], ['men', 'Мужчинам'], ['unisex', 'Унисекс — в обоих разделах']] },
          { k: 'sizeChartId', label: 'Размерная сетка', type: 'select', options: [['', 'Без таблицы размеров']].concat(DATA.sizeCharts.map(function (c) { return [c.id, c.name]; })) },
          { k: 'price', label: 'Цена, ₽', type: 'number', hint: 'Одна для всех цветов' },
          { k: 'compareAt', label: 'Старая цена, ₽', type: 'number', hint: 'Если больше цены — показывается зачёркнутой. Оставьте 0, если скидки нет.' },
          { k: 'badges', type: 'badges' },
          { k: 'active', label: 'Показывать в магазине', type: 'checkbox' },
          { section: 'Описание' },
          { k: 'description', label: 'Описание', type: 'textarea' },
          { k: 'composition', label: 'Состав', type: 'textarea', rows: 2 },
          { k: 'care', label: 'Уход', type: 'textarea', rows: 2 },
          { section: 'Служебное' },
          { k: 'slug', label: 'Адрес страницы', hint: 'Латиницей. Заполнится сам из названия, если оставить пустым.' },
          { k: 'createdAt', label: 'Дата поступления', type: 'date', hint: 'Для сортировки «Сначала новые»' }
        ];
      },
      extra: function (p) {
        colorsState = clone(Pricing.colorsOf(p));
        return waitingForProduct(p) + '<div class="adm-colors"><h4 class="adm-sub">Цвета, фото и остатки</h4><p class="muted" style="font-size:14px;margin-bottom:14px;max-width:70ch">Все цвета — в одной карточке товара. У каждого цвета свои фото и остатки по размерам. Покупатель сначала выбирает цвет, потом размер. Первый цвет показывается в каталоге первым.</p><div id="colorBlocks"></div><button type="button" class="btn ghost sm" id="colorAdd">+ Добавить цвет</button></div>';
      },
      mount: function (box) {
        var wrap = $('.adm-colors', box), blocks = $('#colorBlocks', box);
        $('.adm-form', box).insertBefore(wrap, $$('.adm-sub', box)[1]); // перед «Описанием»
        function sync() {
          $$('.adm-color', blocks).forEach(function (el, i) {
            var c = colorsState[i]; if (!c) return;
            c.name = $('[data-cname]', el).value.trim();
            c.hex = $('[data-chex]', el).value;
            c.art = Object.assign({ kind: 'tee' }, c.art || {}, { tone: c.hex });
            c.sizes = $$('.adm-size-row', el).map(function (r) { return { size: $('[data-sz]', r).value.trim(), stock: Math.max(0, parseInt($('[data-st]', r).value, 10) || 0) }; }).filter(function (x) { return x.size; });
          });
        }
        function draw() {
          blocks.innerHTML = colorsState.map(function (c, i) {
            var imgs = c.images || [];
            return '<div class="adm-color" data-ci="' + i + '"><div class="adm-color-head">' +
              '<label class="adm-hex" title="Оттенок для кружка выбора цвета"><input type="color" data-chex value="' + esc(c.hex || '#777777') + '" aria-label="Оттенок"></label>' +
              '<input class="input" data-cname placeholder="Название цвета, например «Графит»" value="' + esc(c.name || '') + '" aria-label="Название цвета">' +
              '<span class="adm-row-tools">' + (i > 0 ? '<button type="button" data-cup title="Выше">↑</button>' : '') + (i < colorsState.length - 1 ? '<button type="button" data-cdown title="Ниже">↓</button>' : '') + (colorsState.length > 1 ? '<button type="button" data-cdel title="Удалить цвет">✕</button>' : '') + '</span></div>' +
              '<div class="adm-imgs">' + imgs.map(function (src, k) { return '<div class="adm-img"><img src="' + esc(src) + '" alt=""><div class="adm-img-tools">' + (k > 0 ? '<button type="button" data-ileft="' + k + '" title="Сделать раньше">←</button>' : '') + '<button type="button" data-idel="' + k + '" title="Удалить">✕</button></div>' + (k === 0 ? '<span class="adm-img-main">Главное</span>' : '') + '</div>'; }).join('') +
                '<label class="adm-img add"><input type="file" accept="image/*" multiple hidden data-iup><span>+ Фото этого цвета</span></label></div>' +
              '<div class="adm-size-rows">' + (c.sizes || []).map(sizeRow).join('') + '</div>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ghost sm" data-szadd>+ Размер</button><button type="button" class="btn ghost sm" data-szchart>Размеры из сетки</button>' + (i > 0 ? '<button type="button" class="btn ghost sm" data-szcopy>Размеры как у «' + esc(colorsState[0].name || 'первого цвета') + '»</button>' : '') + '</div></div>';
          }).join('');
        }
        draw();
        blocks.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          var el = b.closest('.adm-color'), i = +el.getAttribute('data-ci');
          sync();
          var c = colorsState[i];
          if (b.hasAttribute('data-szrm')) { b.closest('.adm-size-row').remove(); sync(); return; }
          if (b.hasAttribute('data-szadd')) { $('.adm-size-rows', el).insertAdjacentHTML('beforeend', sizeRow({ size: '', stock: 0 })); $('.adm-size-rows .adm-size-row:last-child [data-sz]', el).focus(); return; }
          if (b.hasAttribute('data-szchart')) {
            var ch = DATA.sizeCharts.find(function (x) { return x.id === $('#f-sizeChartId', box).value; });
            if (!ch) { toast('Сначала выберите размерную сетку', true); return; }
            ch.rows.forEach(function (r) { if (r[0] && !c.sizes.some(function (x) { return x.size === r[0]; })) c.sizes.push({ size: r[0], stock: 0 }); });
          }
          if (b.hasAttribute('data-szcopy')) colorsState[0].sizes.forEach(function (x) { if (!c.sizes.some(function (y) { return y.size === x.size; })) c.sizes.push({ size: x.size, stock: 0 }); });
          if (b.hasAttribute('data-cdel')) colorsState.splice(i, 1);
          if (b.hasAttribute('data-cup')) colorsState.splice(i - 1, 0, colorsState.splice(i, 1)[0]);
          if (b.hasAttribute('data-cdown')) colorsState.splice(i + 1, 0, colorsState.splice(i, 1)[0]);
          if (b.hasAttribute('data-idel')) c.images.splice(+b.getAttribute('data-idel'), 1);
          if (b.hasAttribute('data-ileft')) { var k = +b.getAttribute('data-ileft'), t = c.images[k]; c.images[k] = c.images[k - 1]; c.images[k - 1] = t; }
          draw();
        });
        blocks.addEventListener('change', async function (e) {
          if (!e.target.hasAttribute('data-iup')) return;
          sync();
          var el = e.target.closest('.adm-color'), c = colorsState[+el.getAttribute('data-ci')];
          var files = Array.prototype.slice.call(e.target.files || []);
          el.classList.add('busy');
          c.images = c.images || [];
          for (var f = 0; f < files.length; f++) { try { c.images.push(await A().API.uploadImage(files[f])); } catch (ex) { toast(A().errMsg(ex), true); } }
          draw();
        });
        $('#colorAdd', box).addEventListener('click', function () {
          sync();
          var first = colorsState[0];
          var c = newColor(colorsState.length + 1, '#777777', first && first.art && first.art.kind);
          if (first) c.sizes = first.sizes.map(function (x) { return { size: x.size, stock: 0 }; });
          colorsState.push(c); draw();
          $('.adm-color:last-child [data-cname]', blocks).focus();
        });
        box._syncColors = function () { sync(); return colorsState; };
      },
      read: function (box, p) {
        p.colors = clone(box._syncColors());
        delete p.color; delete p.images; delete p.sizes; delete p.art;
        if (!p.slug) p.slug = translit(p.name);
        p.slug = translit(p.slug);
      },
      validate: function (p, all) {
        if (!p.name) return 'Укажите название';
        if (!p.price) return 'Укажите цену';
        if (!p.colors.length) return 'Добавьте хотя бы один цвет';
        var names = {};
        for (var i = 0; i < p.colors.length; i++) {
          var c = p.colors[i];
          if (!c.name) return 'Укажите название для каждого цвета';
          if (names[c.name.toLowerCase()]) return 'Цвет «' + c.name + '» указан дважды';
          names[c.name.toLowerCase()] = 1;
          if (!c.sizes.length) return 'Добавьте размеры для цвета «' + c.name + '» (для аксессуаров — «Единый»)';
        }
        if (all.some(function (x) { return x.id !== p.id && x.slug === p.slug; })) return 'Такой адрес страницы уже занят другим товаром';
        return '';
      },
      duplicate: function (p) { p.id = uid('p'); p.name += ' (копия)'; p.slug = translit(p.name) + '-' + Math.random().toString(36).slice(2, 5); p.active = false; return p; }
    });
  }
  function newColor(n, hex, kind) { return { id: uid('col'), name: '', hex: hex, images: [], sizes: [], art: { kind: kind || 'tee', tone: hex } }; }
  function sizeRow(s) { return '<div class="adm-size-row"><input class="input" data-sz placeholder="Размер" value="' + esc(s.size) + '" aria-label="Размер"><input class="input num" data-st type="number" min="0" placeholder="Остаток" value="' + esc(s.stock) + '" aria-label="Остаток, шт."><span class="muted" style="font-size:14px">шт.</span><button type="button" class="adm-x" data-szrm title="Удалить">✕</button></div>'; }

  /* ================= Категории ================= */
  function categories(m, q) {
    collection(m, q, {
      key: 'categories', prefix: 'c', title: 'Категории', newTitle: 'Новая категория', addLabel: 'Добавить категорию',
      sub: 'Категории показываются на главной, в меню и фильтрах каталога в порядке номера.',
      itemTitle: function (x) { return x.name; },
      blank: function () { return { name: '', slug: '', image: '', art: { kind: 'tee', tone: '#3b3b3f' }, order: DATA.categories.length + 1 }; },
      sort: function (a, b) { return (a.order || 0) - (b.order || 0); },
      cols: ['', 'Название', 'Порядок', 'Товаров'],
      row: function (c) { return ['<img class="adm-thumb" src="' + esc(c.image || Art.make(c.art)) + '" alt="">', esc(c.name), '<span class="num">' + (c.order || 0) + '</span>', '<span class="num">' + DATA.products.filter(function (p) { return p.categoryId === c.id; }).length + '</span>']; },
      fields: function () { return [{ k: 'name', label: 'Название' }, { k: 'order', label: 'Порядок', type: 'number' }, { k: 'image', label: 'Обложка', type: 'image', hint: 'Вертикальное фото 3:4' }, { k: 'slug', label: 'Адрес', hint: 'Латиницей, заполнится сам' }]; },
      read: function (box, c) { c.slug = translit(c.slug || c.name); },
      validate: function (c, all) { if (!c.name) return 'Укажите название'; if (all.some(function (x) { return x.id !== c.id && x.slug === c.slug; })) return 'Такой адрес уже занят'; return ''; }
    });
    if (q.id && q.id !== 'new') {
      var n = DATA.products.filter(function (p) { return p.categoryId === q.id; }).length;
      if (n) { var del = $('#edDel'); if (del) { del.disabled = true; del.title = 'Сначала перенесите товары в другую категорию'; $('#edErr').textContent = 'В категории ' + n + ' тов. — удалить можно пустую категорию.'; $('#edErr').style.color = 'var(--muted)'; } }
    }
  }

  /* ================= Размерные сетки ================= */
  function sizeCharts(m, q) {
    collection(m, q, {
      key: 'sizeCharts', prefix: 'sc', title: 'Размерные сетки', newTitle: 'Новая размерная сетка', addLabel: 'Добавить сетку',
      sub: 'Таблицы размеров показываются в карточке товара и на странице «Таблица размеров». Столбцы и строки можно добавлять и удалять.',
      itemTitle: function (x) { return x.name; },
      blank: function () { return { name: '', columns: ['Размер', 'RU', 'Обхват груди, см'], rows: [['S', '44', '88'], ['M', '46', '92']], note: '' }; },
      cols: ['Название', 'Размеры', 'Товаров'],
      row: function (c) { return [esc(c.name), esc((c.rows || []).map(function (r) { return r[0]; }).join(', ')), '<span class="num">' + DATA.products.filter(function (p) { return p.sizeChartId === c.id; }).length + '</span>']; },
      fields: function () { return [{ k: 'name', label: 'Название', wide: true }, { k: 'note', label: 'Подсказка под таблицей', type: 'textarea', rows: 2 }]; },
      extra: function (c) { return '<h4 class="adm-sub">Таблица</h4><div class="table-wrap"><table class="adm-grid" id="scGrid"></table></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="btn ghost sm" id="scAddRow">+ Строка</button><button type="button" class="btn ghost sm" id="scAddCol">+ Столбец</button></div><p class="muted" style="font-size:13px;margin-top:8px">Первый столбец — название размера, его же покупатель выбирает в карточке товара.</p>'; },
      mount: function (box, c) {
        var cols = (c.columns || []).slice(), rows = (c.rows || []).map(function (r) { return r.slice(); });
        var grid = $('#scGrid', box);
        function sync() {
          cols = $$('thead input', grid).map(function (i) { return i.value; });
          rows = $$('tbody tr', grid).map(function (tr) { return $$('input', tr).map(function (i) { return i.value; }); });
        }
        function draw() {
          grid.innerHTML = '<thead><tr>' + cols.map(function (h, i) { return '<th><div class="adm-cell"><input class="input" value="' + esc(h) + '" aria-label="Заголовок столбца">' + (cols.length > 1 ? '<button type="button" class="adm-x" data-dc="' + i + '" title="Удалить столбец">✕</button>' : '') + '</div></th>'; }).join('') + '<th></th></tr></thead><tbody>' +
            rows.map(function (r, ri) { return '<tr>' + cols.map(function (x, ci) { return '<td><input class="input" value="' + esc(r[ci] || '') + '" aria-label="Ячейка"></td>'; }).join('') + '<td><button type="button" class="adm-x" data-dr="' + ri + '" title="Удалить строку">✕</button></td></tr>'; }).join('') + '</tbody>';
        }
        draw();
        grid.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return; sync();
          if (b.hasAttribute('data-dc')) { var i = +b.getAttribute('data-dc'); cols.splice(i, 1); rows.forEach(function (r) { r.splice(i, 1); }); }
          if (b.hasAttribute('data-dr')) rows.splice(+b.getAttribute('data-dr'), 1);
          draw();
        });
        $('#scAddRow', box).addEventListener('click', function () { sync(); rows.push(cols.map(function () { return ''; })); draw(); });
        $('#scAddCol', box).addEventListener('click', function () { sync(); cols.push('Новый столбец'); rows.forEach(function (r) { r.push(''); }); draw(); });
        box._readGrid = function () { sync(); return { columns: cols, rows: rows.filter(function (r) { return r.some(function (x) { return x; }); }) }; };
      },
      read: function (box, c) { var g = box._readGrid(); c.columns = g.columns; c.rows = g.rows; },
      validate: function (c) { return !c.name ? 'Укажите название' : !c.columns.length ? 'Нужен хотя бы один столбец' : ''; }
    });
  }

  /* ================= Акции ================= */
  function promotions(m, q) {
    collection(m, q, {
      key: 'promotions', prefix: 'a', title: 'Акции', newTitle: 'Новая акция', addLabel: 'Создать акцию',
      sub: 'Акция автоматически снижает цену на выбранные товары в указанные даты. Если на товар действует несколько акций, применяется самая выгодная.',
      itemTitle: function (x) { return x.title; },
      blank: function () { return { title: '', description: '', type: 'percent', value: 10, scope: 'all', categoryIds: [], productIds: [], startsAt: new Date().toISOString().slice(0, 10), endsAt: '', active: true }; },
      cols: ['Название', 'Скидка', 'На что', 'Период', 'Сейчас'],
      row: function (a) {
        var scope = a.scope === 'all' ? 'Весь каталог' : a.scope === 'categories' ? (a.categoryIds || []).length + ' кат.' : (a.productIds || []).length + ' тов.';
        var live = Pricing.inWindow(a, Date.now());
        return [esc(a.title), a.type === 'percent' ? a.value + '%' : fmt(a.value), esc(scope), esc((a.startsAt || '…') + ' — ' + (a.endsAt || '…')), live ? '<span class="status done">Действует</span>' : '<span class="status">Не действует</span>'];
      },
      fields: function () {
        return [
          { k: 'title', label: 'Название', wide: true },
          { k: 'description', label: 'Описание для покупателей', type: 'textarea', rows: 2 },
          { k: 'type', label: 'Тип скидки', type: 'select', options: [['percent', 'Процент от цены'], ['fixed', 'Фиксированная сумма, ₽']] },
          { k: 'value', label: 'Размер скидки', type: 'number' },
          { k: 'scope', label: 'Применяется к', type: 'select', options: [['all', 'Всему каталогу'], ['categories', 'Выбранным категориям'], ['products', 'Выбранным товарам']] },
          { k: 'categoryIds', label: 'Категории', type: 'multi', options: catOpts() },
          { k: 'productIds', label: 'Товары', type: 'multi', options: DATA.products.map(function (p) { return [p.id, p.name]; }) },
          { k: 'startsAt', label: 'Начало', type: 'date' },
          { k: 'endsAt', label: 'Окончание', type: 'date', hint: 'Пусто — без срока' },
          { k: 'active', label: 'Акция включена', type: 'checkbox' }
        ];
      },
      mount: function (box) {
        var sel = $('#f-scope', box), cat = $('[data-multi="categoryIds"]', box), pr = $('[data-multi="productIds"]', box);
        function upd() { cat.hidden = sel.value !== 'categories'; pr.hidden = sel.value !== 'products'; }
        sel.addEventListener('change', upd); upd();
      },
      validate: function (a) { if (!a.title) return 'Укажите название'; if (!a.value) return 'Укажите размер скидки'; if (a.type === 'percent' && a.value >= 100) return 'Процент должен быть меньше 100'; return ''; }
    });
  }

  /* ================= Промокоды ================= */
  function promocodes(m, q) {
    collection(m, q, {
      key: 'promocodes', prefix: 'pc', title: 'Промокоды', newTitle: 'Новый промокод', addLabel: 'Создать промокод',
      sub: 'Покупатель вводит промокод при оформлении заказа. Скидка по промокоду считается от суммы после акций.',
      itemTitle: function (x) { return x.code; },
      blank: function () { return { code: '', type: 'percent', value: 10, minTotal: 0, startsAt: '', endsAt: '', limit: 0, used: 0, onePerCustomer: false, onlyRegistered: false, firstOrderOnly: false, excludeSale: false, active: true, note: '' }; },
      cols: ['Код', 'Скидка', 'Мин. сумма', 'Использован', 'Действует до', 'Активен'],
      row: function (c) { return ['<b class="num">' + esc(c.code) + '</b>', c.type === 'percent' ? c.value + '%' : c.type === 'fixed' ? fmt(c.value) : 'Бесплатная доставка', c.minTotal ? fmt(c.minTotal) : '—', '<span class="num">' + (c.used || 0) + (c.limit ? ' / ' + c.limit : '') + '</span>', esc(c.endsAt || 'Без срока'), onOff(c.active)]; },
      fields: function () {
        return [
          { k: 'code', label: 'Код', hint: 'Латиница и цифры, регистр не важен' },
          { k: 'note', label: 'Заметка (видно только вам)' },
          { k: 'type', label: 'Что даёт', type: 'select', options: [['percent', 'Скидку в процентах'], ['fixed', 'Скидку в рублях'], ['shipping', 'Бесплатную доставку']] },
          { k: 'value', label: 'Размер скидки', type: 'number' },
          { k: 'minTotal', label: 'Минимальная сумма заказа, ₽', type: 'number' },
          { k: 'limit', label: 'Лимит использований', type: 'number', hint: '0 — без ограничений' },
          { k: 'startsAt', label: 'Начало', type: 'date' },
          { k: 'endsAt', label: 'Окончание', type: 'date' },
          { k: 'used', label: 'Уже использован, раз', type: 'number' },
          { k: 'onePerCustomer', label: 'Один раз на покупателя', type: 'checkbox' },
          { k: 'onlyRegistered', label: 'Только для зарегистрированных покупателей', type: 'checkbox' },
          { k: 'firstOrderOnly', label: 'Только на первый заказ покупателя', type: 'checkbox', hint: 'Нужен вход в личный кабинет. Если у покупателя уже есть заказы, при оформлении он увидит плашку с объяснением.' },
          { k: 'excludeSale', label: 'Не распространяется на товары со скидкой', type: 'checkbox' },
          { k: 'active', label: 'Промокод активен', type: 'checkbox' }
        ];
      },
      mount: function (box) { var t = $('#f-type', box), v = $('#f-value', box).closest('.field'); function upd() { v.hidden = t.value === 'shipping'; } t.addEventListener('change', upd); upd(); },
      read: function (box, c) { c.code = c.code.toUpperCase().replace(/\s+/g, ''); },
      validate: function (c, all) {
        if (!/^[A-Z0-9А-ЯЁ_-]{3,30}$/i.test(c.code)) return 'Код — от 3 до 30 символов: буквы, цифры, дефис';
        if (all.some(function (x) { return x.id !== c.id && x.code.toUpperCase() === c.code; })) return 'Такой промокод уже есть';
        if (c.type !== 'shipping' && !c.value) return 'Укажите размер скидки';
        if (c.type === 'percent' && c.value > 100) return 'Процент не может быть больше 100';
        return '';
      },
      duplicate: function (c) { c.id = uid('pc'); c.code = c.code + Math.floor(Math.random() * 90 + 10); c.used = 0; return c; }
    });
  }

  /* ================= Покупатели ================= */
  function customers(m, q) {
    var term = (q.q || '').toLowerCase();
    var list = DATA.users.slice().reverse().map(function (u) {
      var os = DATA.orders.filter(function (o) { return o.userId === u.id && o.status !== 'canceled'; });
      return { u: u, n: os.length, sum: os.reduce(function (s, o) { return s + o.total; }, 0) };
    }).filter(function (x) { return !term || [x.u.firstName, x.u.lastName, x.u.email, x.u.phone].join(' ').toLowerCase().indexOf(term) !== -1; });
    if (q.id) {
      var u = DATA.users.find(function (x) { return x.id === q.id; });
      var os = DATA.orders.filter(function (o) { return o.userId === q.id; }).reverse();
      m.innerHTML = '<a class="link muted" href="#/admin?s=customers" style="font-size:14px">← Покупатели</a>' + head(u ? u.firstName + ' ' + u.lastName : 'Покупатель') +
        (u ? '<div class="adm-two" style="margin-bottom:20px"><div class="adm-card" style="display:grid;gap:6px;align-content:start"><span class="copyable">' + esc(A().fmtPhone(u.phone)) + '</span><span class="copyable">' + esc(u.email) + '</span><span class="muted" style="font-size:14px">С нами с ' + esc(A().fmtDate(u.createdAt)) + '</span></div>' +
          '<div class="adm-card adm-bonus"><h3 class="adm-h3">Бонусный счёт</h3><div class="adm-bonus-sum"><b class="num">' + (u.bonus || 0) + '</b> ' + plural(u.bonus || 0, 'бонус', 'бонуса', 'бонусов') + '</div>' +
            '<div class="adm-bonus-form"><input class="input num" type="number" step="1" id="bnAmount" placeholder="Количество" aria-label="Количество бонусов"><input class="input" id="bnNote" placeholder="Причина" aria-label="Причина, её увидит покупатель"><button class="btn sm" id="bnAdd">Начислить</button><button class="btn ghost sm" id="bnSub">Списать</button></div>' +
            '<p class="muted" style="font-size:13px;margin:0">Покупатель увидит начисление и причину в личном кабинете.</p>' +
            (u.bonusLog && u.bonusLog.length ? '<div class="adm-list">' + u.bonusLog.slice(0, 12).map(function (e) { return '<div class="adm-li"><span>' + esc(BONUS_OPS[e.type] || e.type) + (e.orderNumber ? ' № ' + esc(e.orderNumber) : '') + ' <span class="muted">· ' + esc(new Date(e.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + (e.note ? ' · ' + esc(e.note) : '') + '</span></span><span class="num">' + (e.amount > 0 ? '+' : '−') + Math.abs(e.amount) + '</span></div>'; }).join('') + '</div>' : '') + '</div></div>' : '') +
        (os.length ? ordersTable(os) : '<p class="muted">Заказов нет.</p>');
      if (u) [['bnAdd', 1], ['bnSub', -1]].forEach(function (x) {
        $('#' + x[0]).addEventListener('click', async function () {
          var n = Math.abs(Math.round(Number($('#bnAmount').value) || 0));
          if (!n) { toast('Укажите количество бонусов', true); return; }
          try { await A().API.adminBonus(u.id, n * x[1], $('#bnNote').value); await afterSave(x[1] > 0 ? 'Начислено ' + n + ' ' + plural(n, 'бонус', 'бонуса', 'бонусов') : 'Бонусы списаны', '#/admin?s=customers&id=' + u.id); }
          catch (e) { toast(A().errMsg(e), true); }
        });
      });
      return;
    }
    m.innerHTML = head('Покупатели', '<input class="input" id="uSearch" placeholder="Имя, почта, телефон" value="' + esc(q.q || '') + '" style="min-height:40px;width:220px">', 'Все, кто зарегистрировался в личном кабинете.') +
      (list.length ? '<div class="table-wrap adm-table"><table class="sizes"><thead><tr><th>Имя</th><th>Телефон</th><th>Почта</th><th>Заказов</th><th>Сумма</th><th>Бонусы</th></tr></thead><tbody>' +
        list.map(function (x) { return '<tr data-href="#/admin?s=customers&id=' + esc(x.u.id) + '"><td>' + esc(x.u.firstName + ' ' + x.u.lastName) + '</td><td>' + esc(A().fmtPhone(x.u.phone)) + '</td><td>' + esc(x.u.email) + '</td><td class="num">' + x.n + '</td><td class="num">' + fmt(x.sum) + '</td><td class="num">' + (x.u.bonus || 0) + '</td></tr>'; }).join('') + '</tbody></table></div>'
        : '<div class="empty"><h3>Покупателей пока нет</h3><p>Они появятся после регистрации на сайте.</p></div>');
    $('#uSearch').addEventListener('change', function (e) { location.hash = '#/admin?s=customers&q=' + encodeURIComponent(e.target.value); });
  }

  /* Ночные резервные копии: когда была последняя, размер, ушла ли копия в Selectel S3 */
  function backupStatusHtml(b) {
    var when = function (iso) { return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); };
    var size = function (n) { return (n / 1048576).toFixed(n < 10485760 ? 2 : 1).replace('.', ',') + ' МБ'; };
    var old = b && b.at && Date.now() - Date.parse(b.at) > 36 * 36e5;
    var rows = !b ? '<p class="muted" style="font-size:14px">Копий ещё не было. Первая появится этой ночью в 03:30 (или запустите на сервере: <span class="copyable">sudo node /var/www/albakov/tools/backup.js</span>).</p>'
      : '<div class="adm-list">' +
        '<div class="adm-li"><span>Последняя копия</span><span class="' + (b.ok && !old ? '' : 'bad') + '">' + (b.ok ? when(b.at) + ' · ' + size(b.size) : 'ошибка ' + when(b.at) + ': ' + esc(b.error || '')) + '</span></div>' +
        '<div class="adm-li"><span>На сервере</span><span>' + (b.ok ? 'хранится 14 дней' : '—') + '</span></div>' +
        '<div class="adm-li"><span>Selectel S3</span><span class="' + (b.s3 && b.s3.enabled && !b.s3.ok ? 'bad' : '') + '">' + (!b.s3 || !b.s3.enabled ? 'не подключено' : b.s3.ok ? 'отправлена в «' + esc(b.s3.bucket || '') + '»' : 'ошибка: ' + esc(b.s3.error || '')) + '</span></div></div>' +
        (old ? '<p class="form-error" style="margin-top:8px">Копия старше суток — проверьте на сервере журнал /var/log/albakov-backup.log</p>' : '') +
        (!b.s3 || !b.s3.enabled ? '<p class="muted" style="font-size:13px;margin-top:8px">Чтобы копии хранились и вне сервера, подключите хранилище: <span class="copyable">sudo bash /var/www/albakov/deploy/backup-s3.sh</span></p>' : '');
    return '<h4 class="adm-sub">Автоматические копии</h4>' + rows;
  }

  /* Версия сайта и автообновление из GitHub */
  function updateStatusHtml(u) {
    var when = function (iso) { return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); };
    if (!u || !u.enabled) return '<h4 class="adm-sub">Версия сайта</h4><p class="muted" style="font-size:14px">Автообновление не включено. Новые версии ставятся вручную: <span class="copyable">sudo bash deploy/update.sh</span> из папки новой версии.</p>';
    var stale = u.checkedAt && Date.now() - Date.parse(u.checkedAt) > 30 * 6e4;
    return '<h4 class="adm-sub">Версия сайта</h4><div class="adm-list">' +
      '<div class="adm-li"><span>Работает</span><span>' + (u.commit ? esc((u.version ? 'v' + u.version + ' · ' : '') + u.commit) + (u.subject ? ' — ' + esc(u.subject) : '') : 'ещё не обновлялась') + '</span></div>' +
      (u.updatedAt ? '<div class="adm-li"><span>Установлена</span><span>' + when(u.updatedAt) + '</span></div>' : '') +
      '<div class="adm-li"><span>Автообновление</span><span class="' + (u.checkError || stale ? 'bad' : '') + '">' + (u.checkError ? esc(u.checkError) : 'включено, проверка каждые 5 минут' + (u.checkedAt ? ' (последняя ' + when(u.checkedAt) + ')' : '')) + '</span></div></div>' +
      (u.lastError ? '<p class="form-error" style="margin-top:8px">' + esc(u.lastError) + (u.failedAt ? ' · ' + when(u.failedAt) : '') + '. Сайт работает на прежней версии.</p>' : '');
  }

  /* ================= Бонусная программа ================= */
  var BONUS_OPS = { earn: 'Начислено за заказ', spend: 'Оплата заказа', 'return': 'Возврат за отмену', revoke: 'Забрано: заказ отменён', manual: 'Вручную' };
  function bonusSection(m) {
    settingsForm(m, 'Бонусы', '1 бонус = 1 ₽. Бонусы получают зарегистрированные покупатели. Под каждым товаром на сайте видно, сколько бонусов придёт за покупку, а при оформлении бонусами можно оплатить весь заказ.', [
      { k: 'enabled', label: 'Бонусная программа включена', type: 'checkbox', hint: 'Если выключить, бонусы перестанут начисляться и списываться, но останутся на счетах покупателей' },
      { k: 'percent', label: 'Сколько процентов от покупки начислять', type: 'number', step: 0.5, hint: 'Например, 5 — за товар за 1 500 ₽ придёт 75 бонусов' },
      { k: 'creditOn', label: 'Когда начислять', type: 'select', options: [['paid', 'После оплаты заказа'], ['done', 'Когда заказ выполнен (получен покупателем)']], hint: 'При отмене заказа или возврате денег начисленные бонусы забираются, а потраченные возвращаются' }
    ], {}, function (s) { s.bonus = s.bonus || { enabled: true, percent: 5, creditOn: 'paid' }; return s.bonus; }, function (s, o) {
      if (!(o.percent >= 0 && o.percent <= 100)) return 'Процент должен быть от 0 до 100';
      s.bonus = o;
    });
    var users = DATA.users, held = users.reduce(function (x, u) { return x + (u.bonus || 0); }, 0);
    var spent = 0, earned = 0;
    users.forEach(function (u) { (u.bonusLog || []).forEach(function (e) { if (e.type === 'earn' || e.type === 'revoke' || e.type === 'manual') earned += e.amount; if (e.type === 'spend' || e.type === 'return') spent -= e.amount; }); });
    var calc = '<div class="adm-card adm-bonus-calc"><h3 class="adm-h3">Пример</h3><p class="muted" id="bnExample"></p></div>';
    m.insertAdjacentHTML('beforeend', '<div class="adm-stats" style="margin-top:28px">' + stat('На счетах покупателей', held, '#/admin?s=customers') + stat('Начислено всего', earned, '#/admin?s=customers') + stat('Потрачено на заказы', spent, '#/admin?s=orders') + '</div>' + calc);
    var pi = $('#f-percent'), ex = function () {
      var pct = Math.max(0, Math.min(100, Number(pi.value) || 0)), n = Math.floor(1500 * pct / 100);
      $('#bnExample').innerHTML = 'Покупатель берёт вещь за 1 500 ₽ и получает <b>+' + n + ' ' + plural(n, 'бонус', 'бонуса', 'бонусов') + '</b>. В следующий раз у него, например, 300 бонусов: вещь за 1 500 ₽ обойдётся в 1 200 ₽, а бонусы начислятся на эти 1 200 ₽ — <b>+' + Math.floor(1200 * pct / 100) + '</b>.';
    };
    pi.addEventListener('input', ex); ex();
  }

  /* ================= Настройки (разделы на основе settings) ================= */
  function settingsForm(m, title, sub, defs, rowDefs, getObj, apply) {
    var s = clone(DATA.settings), obj = getObj(s);
    m.innerHTML = head(title, '', sub) + '<div class="adm-card" id="stForm">' + formHtml(defs, obj) +
      Object.keys(rowDefs).map(function (k) { return '<h4 class="adm-sub">' + esc(rowDefs[k].title) + '</h4>' + (rowDefs[k].hint ? '<p class="muted" style="font-size:13px;margin:-6px 0 10px">' + esc(rowDefs[k].hint) + '</p>' : '') + rowsEditor(k, rowDefs[k].cols, rowDefs[k].get(s) || []); }).join('') +
      '</div><div class="adm-bar"><button class="btn" id="stSave">Сохранить</button><span class="form-error" id="stErr"></span></div>';
    var box = $('#stForm'); mountImages(box, obj);
    var colsMap = {}; Object.keys(rowDefs).forEach(function (k) { colsMap[k] = rowDefs[k].cols; }); bindRows(box, colsMap);
    $('#stSave').addEventListener('click', async function () {
      readForm(box, defs, obj);
      Object.keys(rowDefs).forEach(function (k) { rowDefs[k].set(s, readRows(box, k, rowDefs[k].cols)); });
      var e = apply ? apply(s, obj) : ''; if (e) { $('#stErr').textContent = e; return; }
      try { await A().API.adminSave('settings', s); await afterSave('Сохранено'); } catch (ex) { $('#stErr').textContent = A().errMsg(ex); }
    });
  }

  function homeSettings(m) {
    settingsForm(m, 'Главная страница', 'Тексты, картинки и блоки главной страницы. Выделить слово в заголовке курсивом и цветом: *слово*. Перенос строки — Enter.', [
      { section: 'Верхняя строка' },
      { k: 'announcement', label: 'Объявление над шапкой', wide: true, hint: 'Пусто — строка скрыта' },
      { section: 'Первый экран — когда слайдер выключен' },
      { k: 'heroEyebrow', label: 'Надзаголовок' },
      { k: 'heroCta', label: 'Текст кнопки' },
      { k: 'heroTitle', label: 'Заголовок', type: 'textarea', rows: 2 },
      { k: 'heroText', label: 'Подзаголовок', type: 'textarea', rows: 2 },
      { k: 'heroLink', label: 'Ссылка кнопки', hint: 'Например, #/catalog или #/catalog?cat=outerwear' },
      { k: 'heroImage', label: 'Фото первого экрана', type: 'image' },
      { section: 'Блоки' },
      { k: 'showCategories', label: 'Показывать категории', type: 'checkbox' },
      { k: 'showNew', label: 'Показывать новинки', type: 'checkbox' },
      { k: 'showHits', label: 'Показывать хиты продаж', type: 'checkbox', hint: 'Товары с плашкой «Хит продаж» и самые продаваемые. Блок скрыт, пока хитов нет' },
      { k: 'showSale', label: 'Показывать текущую акцию', type: 'checkbox' },
      { k: 'showEditorial', label: 'Показывать блок о бренде', type: 'checkbox' },
      { k: 'showBenefits', label: 'Показывать преимущества', type: 'checkbox' },
      { k: 'showBonus', label: 'Показывать блок «Бонусная программа»', type: 'checkbox', hint: 'Блок скрывается сам, если бонусная программа выключена в разделе «Бонусы»' },
      { section: 'Хиты продаж' },
      { k: 'hitsAuto', label: 'Добавлять самые продаваемые автоматически', type: 'checkbox', wide: true, hint: 'По заказам за последние 90 дней — без отменённых и неоплаченных онлайн. Такие товары получают плашку «Хит продаж» сами. Вручную хит отмечается в карточке товара' },
      { section: 'Блок «Бонусная программа»' },
      { k: 'bonusEyebrow', label: 'Надзаголовок' },
      { k: 'bonusTitle', label: 'Заголовок', type: 'textarea', rows: 2, hint: '{n} — процент из раздела «Бонусы», *слово* — курсивом' },
      { k: 'bonusText', label: 'Текст', type: 'textarea', rows: 3 },
      { section: 'Блок о бренде' },
      { k: 'editorialEyebrow', label: 'Надзаголовок' },
      { k: 'editorialTitle', label: 'Заголовок' },
      { k: 'editorialText', label: 'Текст', type: 'textarea' },
      { k: 'editorialImage', label: 'Фото', type: 'image' }
    ], {
      benefits: { title: 'Преимущества', cols: [{ k: 'title', label: 'Заголовок' }, { k: 'text', label: 'Описание', flex: 2 }], get: function (s) { return s.home.benefits; }, set: function (s, v) { s.home.benefits = v; } }
    }, function (s) { var o = s.home; o.announcement = s.announcement; return o; }, function (s, o) { s.announcement = o.announcement; delete o.announcement; s.home = Object.assign(s.home, o); });
  }

  /* Разделы «Женщинам» и «Мужчинам»: открыт/закрыт, страница «скоро», экран выбора */
  function sectionsSettings(m) {
    var cnt = function (g) { return DATA.products.filter(function (p) { return p.active !== false && p.gender === g; }).length; };
    var G = [['women', 'Женщинам', 'Woman'], ['men', 'Мужчинам', 'Man']], defs = [];
    G.forEach(function (x) {
      var k = x[2];
      defs.push({ section: 'Раздел «' + x[1] + '» · товаров: ' + cnt(x[0]) });
      defs.push({ k: 'open' + k, label: 'Раздел открыт', type: 'checkbox', hint: 'Если выключить, его товары пропадут из каталога, а покупатель, выбравший этот раздел, увидит страницу «скоро появится». Товары унисекс останутся в другом разделе.' });
      defs.push({ k: 'soonTitle' + k, label: 'Заголовок страницы «скоро»', type: 'textarea', rows: 2, hint: 'Enter — перенос строки, *слово* — курсивом' });
      defs.push({ k: 'soonText' + k, label: 'Текст страницы «скоро»', type: 'textarea', rows: 2 });
    });
    defs = defs.concat([
      { section: 'Экран выбора при первом заходе' },
      { k: 'gwEnabled', label: 'Показывать экран «Женщинам / Мужчинам» при первом заходе на сайт', type: 'checkbox', hint: 'Покупатель видит его один раз. Закрытый раздел отмечается на нём словом «Скоро».' },
      { k: 'gwEyebrow', label: 'Надпись над выбором', wide: true },
      { k: 'gwWomanTitle', label: 'Женщинам — заголовок' }, { k: 'gwManTitle', label: 'Мужчинам — заголовок' },
      { k: 'gwWomanText', label: 'Женщинам — подпись' }, { k: 'gwManText', label: 'Мужчинам — подпись' },
      { k: 'gwWomanImage', label: 'Женщинам — фото', type: 'image', hint: 'Вертикальное фото. Оно же — фон страницы «скоро»' },
      { k: 'gwManImage', label: 'Мужчинам — фото', type: 'image', hint: 'Вертикальное фото. Оно же — фон страницы «скоро»' }
    ]);
    settingsForm(m, 'Разделы: женщинам / мужчинам', 'Здесь можно закрыть раздел, пока в нём нет одежды, и настроить экран выбора раздела. У каждого товара раздел задаётся полем «Для кого» в карточке товара.', defs, {},
      function (s) {
        var o = {}, gs = s.genders || {}, gw = s.gateway || {};
        G.forEach(function (x) { var c = gs[x[0]] || {}, w = gw[x[0]] || {}, k = x[2]; o['open' + k] = c.open !== false; o['soonTitle' + k] = c.title || ''; o['soonText' + k] = c.text || ''; o['gw' + k + 'Title'] = w.title || ''; o['gw' + k + 'Text'] = w.text || ''; o['gw' + k + 'Image'] = w.image || ''; });
        o.gwEnabled = gw.enabled !== false; o.gwEyebrow = gw.eyebrow || '';
        return o;
      },
      function (s, o) {
        if (!o.openWoman && !o.openMan) return 'Оставьте открытым хотя бы один раздел';
        s.genders = {}; s.gateway = { enabled: o.gwEnabled, eyebrow: o.gwEyebrow };
        G.forEach(function (x) { var k = x[2]; s.genders[x[0]] = { open: o['open' + k], title: o['soonTitle' + k], text: o['soonText' + k] }; s.gateway[x[0]] = { title: o['gw' + k + 'Title'] || x[1], text: o['gw' + k + 'Text'], image: o['gw' + k + 'Image'] }; });
        return '';
      });
  }

  function menuSettings(m) {
    settingsForm(m, 'Меню, контакты, соцсети', 'Пункты верхнего меню, контакты в подвале и ссылки на социальные сети. Порядок меняется стрелками.', [
      { section: 'Контакты' },
      { k: 'phone', label: 'Телефон' }, { k: 'email', label: 'Электронная почта' },
      { k: 'address', label: 'Адрес' }, { k: 'hours', label: 'Часы работы' }
    ], {
      nav: { title: 'Верхнее меню', hint: 'Ссылки: #/catalog, #/catalog?cat=адрес-категории, #/sale, #/sizes, #/page/адрес-страницы или полный адрес сайта', cols: [{ k: 'label', label: 'Название' }, { k: 'link', label: 'Ссылка', flex: 2 }], get: function (s) { return s.nav; }, set: function (s, v) { s.nav = v; } },
      socials: { title: 'Социальные сети', hint: 'Например: Telegram — https://t.me/ваш_канал', cols: [{ k: 'name', label: 'Название' }, { k: 'url', label: 'Ссылка', flex: 2 }], get: function (s) { return s.socials; }, set: function (s, v) { s.socials = v; } }
    }, function (s) { return s.contacts; }, function (s, o) {
      s.contacts = o;
      var bad = (s.socials || []).find(function (x) { return !/^https?:\/\//.test(x.url); });
      if (bad) return 'Ссылка на «' + bad.name + '» должна начинаться с https://';
      return '';
    });
  }

  function paymentSettings(m) {
    settingsForm(m, 'Оплата, касса, доставка',
      'Онлайн-оплата и фискальные чеки работают через ЮKassa: она передаёт данные чека в подключённую онлайн-кассу (свою или «Чеки от ЮKassa») по 54-ФЗ.' + (A().D.payReady ? ' <b>ЮKassa подключена</b> — покупатели видят онлайн-оплату.' : ' <b>Онлайн-оплата скрыта на сайте</b>, пока не выбран провайдер ЮKassa и не указаны shopId и секретный ключ — до этого покупатели видят только оплату при получении.'), [
      { section: 'Способы оплаты' },
      { k: 'online', label: 'Онлайн-оплата картой и СБП', type: 'checkbox' },
      { k: 'onlineLabel', label: 'Название онлайн-оплаты' },
      { k: 'cod', label: 'Оплата при получении', type: 'checkbox' },
      { k: 'codLabel', label: 'Название оплаты при получении' },
      { section: 'Платёжный сервис' },
      { k: 'provider', label: 'Провайдер', type: 'select', options: [['demo', 'Тестовый режим (без списания денег)'], ['yookassa', 'ЮKassa']] },
      { k: 'shopId', label: 'shopId магазина в ЮKassa', hint: 'Личный кабинет ЮKassa → Интеграция → Ключи API' },
      { section: 'Онлайн-касса (54-ФЗ)' },
      { k: 'sendReceipt', label: 'Передавать данные для чека', type: 'checkbox', hint: 'Включите, если в ЮKassa подключена онлайн-касса или «Чеки от ЮKassa»' },
      { k: 'taxSystem', label: 'Система налогообложения', type: 'select', options: TAX },
      { k: 'vatCode', label: 'Ставка НДС в чеке', type: 'select', options: VAT }
    ], {
      delivery: { title: 'Способы доставки', hint: 'Цена в рублях; «бесплатно от» — сумма заказа, с которой доставка бесплатная (0 — никогда). Галочка «адрес» — спрашивать город и адрес.', cols: [{ k: 'name', label: 'Название' }, { k: 'desc', label: 'Описание', flex: 2 }, { k: 'price', label: 'Цена', type: 'number' }, { k: 'freeFrom', label: 'Бесплатно от', type: 'number' }, { k: 'needsAddress', label: 'адрес', type: 'checkbox' }], get: function (s) { return s.delivery.methods; }, set: function (s, v) { s.delivery.methods = v; } }
    }, function (s) { var p = s.payment; return Object.assign({}, p, { shopId: p.yookassa.shopId, sendReceipt: p.yookassa.sendReceipt, taxSystem: p.yookassa.taxSystem, vatCode: p.yookassa.vatCode }); },
    function (s, o) {
      if (!o.online && !o.cod) return 'Оставьте хотя бы один способ оплаты';
      if (!s.delivery.methods.length) return 'Добавьте хотя бы один способ доставки';
      s.payment = { provider: o.provider, online: o.online, cod: o.cod, onlineLabel: o.onlineLabel, codLabel: o.codLabel, yookassa: { shopId: o.shopId, sendReceipt: o.sendReceipt, taxSystem: Number(o.taxSystem), vatCode: Number(o.vatCode) } };
      return '';
    });
    // Секретный ключ хранится только на сервере
    var card = document.createElement('div'); card.className = 'adm-card'; card.style.marginTop = '20px';
    card.innerHTML = '<h4 class="adm-sub" style="margin-top:0;padding-top:0;border-top:0">Секретный ключ ЮKassa</h4>' +
      '<p class="muted" style="font-size:14px;margin-bottom:12px" id="secState">Проверяем…</p><div class="promo-form"><input class="input" id="secKey" type="password" placeholder="live_… или test_…" autocomplete="off" aria-label="Секретный ключ"><button type="button" class="btn ghost" id="secSave">Сохранить ключ</button></div><p class="muted" style="font-size:13px;margin-top:10px">Адрес для уведомлений ЮKassa (HTTP-уведомления, событие payment.succeeded и payment.canceled): <span class="copyable">' + esc(location.origin + '/api/payments/yookassa') + '</span></p>';
    m.insertBefore(card, $('.adm-bar', m));
    var showState = function (r) { $('#secState').textContent = r.hasSecret ? 'Ключ сохранён на сервере (' + r.mask + ').' : 'Ключ ещё не задан — онлайн-оплата через ЮKassa не будет работать.'; };
    A().API.adminSecret().then(showState).catch(function () {});
    $('#secSave').addEventListener('click', async function () { try { showState(await A().API.adminSecret($('#secKey').value.trim())); $('#secKey').value = ''; toast('Ключ сохранён'); } catch (e) { toast(A().errMsg(e), true); } });
  }

  function pages(m, q) {
    collection(m, q, {
      key: 'pages', prefix: 'pg', title: 'Страницы', newTitle: 'Новая страница', addLabel: 'Создать страницу',
      sub: 'Информационные страницы: доставка, возврат, о бренде, оферта. Ссылки на них появляются в подвале сайта.',
      itemTitle: function (x) { return x.title; },
      view: function (x) { return '<a class="btn ghost sm" href="#/page/' + esc(x.slug) + '">Открыть на сайте</a>'; },
      blank: function () { return { title: '', slug: '', body: '', inFooter: true, group: 'help' }; },
      cols: ['Название', 'Адрес', 'Раздел подвала'],
      row: function (p) { return [esc(p.title), '<span class="muted">#/page/' + esc(p.slug) + '</span>', p.inFooter ? esc({ help: 'Покупателям', brand: 'Покупателям', legal: 'Нижняя строка' }[p.group] || '—') : '<span class="muted">Скрыта</span>']; },
      fields: function () {
        return [
          { k: 'title', label: 'Заголовок' }, { k: 'slug', label: 'Адрес', hint: 'Латиницей, заполнится сам' },
          { k: 'group', label: 'Где показать ссылку', type: 'select', options: [['help', 'Подвал: «Покупателям»'], ['brand', 'Подвал: «Покупателям», в конце'], ['legal', 'Нижняя строка подвала (юридическое)']] },
          { k: 'inFooter', label: 'Показывать ссылку в подвале', type: 'checkbox' },
          { k: 'body', label: 'Текст', type: 'textarea', rows: 14, hint: 'Пустая строка — новый абзац. ## Заголовок. - пункт списка. **жирный**. [текст ссылки](https://адрес). Подставляются сами: {продавец} — реквизиты из «Настроек», {адрес}, {почта}, {телефон} — из контактов, {магазин}, {сайт}' }
        ];
      },
      read: function (box, p) { p.slug = translit(p.slug || p.title); },
      validate: function (p, all) { if (!p.title) return 'Укажите заголовок'; if (all.some(function (x) { return x.id !== p.id && x.slug === p.slug; })) return 'Такой адрес уже занят'; return ''; }
    });
  }

  function generalSettings(m) {
    settingsForm(m, 'Настройки', '', [
      { k: 'storeName', label: 'Название магазина', hint: 'Логотип меняется в разделе «Логотип и название»' },
      { k: 'tagline', label: 'Слоган' },
      { k: 'legal', label: 'Реквизиты продавца', wide: true, hint: 'Например: ИП Фамилия Имя Отчество, ИНН 000000000000, ОГРНИП 000000000000000. Показываются в подвале и подставляются в оферту, политику обработки персональных данных и согласие' },
      { k: 'footerNote', label: 'Примечание о ценах', wide: true },
      { section: 'Плашки на карточках товаров' },
      { k: 'bt_new', label: '«Новинка» — текст' }, { k: 'bc_new', label: '«Новинка» — цвет', type: 'color' },
      { k: 'bt_sale', label: '«Скидка» — текст', hint: '{n} заменится на размер скидки: «Скидка {n}%» → «Скидка 15%»' }, { k: 'bc_sale', label: '«Скидка» — цвет', type: 'color' },
      { k: 'bt_hit', label: '«Хит продаж» — текст', hint: 'Например, «Хит»' }, { k: 'bc_hit', label: '«Хит продаж» — цвет', type: 'color' }
    ], {}, function (s) {
      var b = s.badges || {};
      Pricing.BADGE_KEYS.forEach(function (k) { s['bt_' + k] = (b[k] || {}).text || ''; s['bc_' + k] = (b[k] || {}).color || '#141414'; });
      return s;
    }, function (s) {
      if (!s.storeName) return 'Укажите название магазина';
      var b = {};
      Pricing.BADGE_KEYS.forEach(function (k) { b[k] = { text: s['bt_' + k] || ({ new: 'Новинка', sale: 'Скидка {n}%', hit: 'Хит продаж' })[k], color: s['bc_' + k] }; delete s['bt_' + k]; delete s['bc_' + k]; });
      s.badges = b;
      return '';
    });
    var card = document.createElement('div'); card.className = 'adm-card'; card.style.cssText = 'margin-top:20px;display:grid;gap:14px';
    var hasPath = !!DATA.settings.adminPathHash;
    card.innerHTML = '<h4 class="adm-sub" style="margin-top:0;padding-top:0;border-top:0">Адрес входа в панель</h4>' +
      '<p class="muted" style="font-size:14px">Покупатели не видят ссылку «Управление»: она появляется в подвале только после вашего входа. ' + (hasPath ? 'Сейчас задан секретный адрес входа, адрес #/admin для посторонних не открывается.' : 'Сейчас вход работает по адресу <b>#/admin</b>. Задайте свой адрес, чтобы его нельзя было угадать.') + '</p>' +
      '<div class="promo-form"><input class="input" id="admPath" placeholder="Например, vhod-k7m2q" autocomplete="off" aria-label="Секретный адрес входа"><button type="button" class="btn ghost" id="admPathGen">Придумать</button><button type="button" class="btn ghost" id="admPathSave">Сохранить</button></div><div id="admPathOut"></div>' +
      '<h4 class="adm-sub">Пароль администратора</h4><div class="promo-form"><input class="input" type="password" id="newPass" placeholder="Новый пароль, от 8 символов" autocomplete="new-password" aria-label="Новый пароль"><button type="button" class="btn ghost" id="passSave">Сменить</button></div>' +
      backupStatusHtml(DATA.backup) +
      updateStatusHtml(DATA.update) +
      '<h4 class="adm-sub">Состояние магазина</h4><div id="healthBox"><p class="muted" style="font-size:14px">Проверяю…</p></div>' +
      '<h4 class="adm-sub">Резервная копия</h4><p class="muted" style="font-size:14px">Скопируйте данные магазина, чтобы сохранить их или перенести на сервер.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ghost sm" id="bkShow">Показать данные</button>' + '</div><div id="bkBox"></div>';
    m.insertBefore(card, $('.adm-bar', m));
    A().API.adminHealth().then(function (h) {
      var box = $('#healthBox'); if (!box) return;
      var dbOk = h.db && h.db.integrity === 'ok', lowDisk = h.disk && h.disk.freeGB < 2, c = (h.db && h.db.counts) || {};
      var num = function (n) { return String(n).replace('.', ','); };
      var li = function (k, v, bad) { return '<div class="adm-li"><span>' + k + '</span><span class="' + (bad ? 'bad' : '') + '">' + v + '</span></div>'; };
      box.innerHTML = '<div class="adm-list">' +
        li('База данных', dbOk ? 'в порядке · ' + num(h.db.sizeMB) + ' МБ' : 'ошибка: ' + esc((h.db && h.db.integrity) || ''), !dbOk) +
        li('Записей', 'заказов ' + (c.orders || 0) + ' · покупателей ' + (c.users || 0) + ' · товаров ' + (c.products || 0)) +
        (h.uploads ? li('Фото', h.uploads.files + ' шт. · ' + num(h.uploads.sizeMB) + ' МБ') : '') +
        (h.disk ? li('Свободно на диске', num(h.disk.freeGB) + ' из ' + num(h.disk.totalGB) + ' ГБ', lowDisk) : '') +
        li('HTTPS', h.https ? 'включён' : 'ещё не включён', !h.https) +
        li('Почта для писем', h.mail ? 'подключена' : 'не настроена', !h.mail) +
        li('Онлайн-оплата', h.pay ? 'подключена' : 'не подключена') +
        li('Работает без перезапуска', num(h.uptimeH) + ' ч') + '</div>';
    }).catch(function (e) { var box = $('#healthBox'); if (box) box.innerHTML = '<p class="form-error">' + esc(A().errMsg(e)) + '</p>'; });
    $('#admPathGen').addEventListener('click', function () { var a = 'abcdefghijkmnpqrstuvwxyz23456789', r = 'vhod-'; for (var i = 0; i < 10; i++) r += a[Math.floor(Math.random() * a.length)]; $('#admPath').value = r; });
    $('#admPathSave').addEventListener('click', async function () {
      var slug = $('#admPath').value.trim().toLowerCase();
      var reserved = ['', 'admin', 'catalog', 'product', 'sale', 'sizes', 'cart', 'checkout', 'account', 'order', 'page'];
      if (!/^[a-z0-9-]{6,40}$/.test(slug) || reserved.indexOf(slug) !== -1) { toast('Адрес: от 6 до 40 символов, латинские буквы, цифры и дефис', true); return; }
      var s = clone(DATA.settings); s.adminPathHash = A().hashPath(slug);
      try {
        await A().API.adminSave('settings', s);
        var link = location.href.split('#')[0] + '#/' + slug;
        await afterSave('Адрес входа сохранён', '#/admin?s=settings');
        var out = $('#admPathOut'); if (out) out.innerHTML = '<p style="margin-top:12px;font-size:14px">Ваш адрес входа: <b class="copyable">' + esc(link) + '</b><br><span class="muted" style="font-size:14px">Сохраните его в закладки — он нигде больше не показывается. Восстановить его по данным сайта нельзя, только задать новый.</span></p>';
      } catch (e) { toast(A().errMsg(e), true); }
    });
    $('#passSave').addEventListener('click', async function () { var p = $('#newPass').value; if (p.length < 8) { toast('Пароль должен быть не короче 8 символов', true); return; } try { await A().API.adminPassword(p); $('#newPass').value = ''; toast('Пароль изменён'); } catch (e) { toast(A().errMsg(e), true); } });
    $('#bkShow').addEventListener('click', async function () {
      var d = await A().API.adminData();
      $('#bkBox').innerHTML = '<textarea class="textarea" id="bkText" rows="8" readonly style="font-size:13px;font-family:monospace"></textarea><button type="button" class="btn ghost sm" id="bkCopy" style="margin-top:8px">Скопировать</button>';
      $('#bkText').value = JSON.stringify(d);
      $('#bkCopy').addEventListener('click', function () { var t = $('#bkText'); navigator.clipboard.writeText(t.value).then(function () { toast('Скопировано'); }).catch(function () { t.select(); toast('Выделено — нажмите Ctrl+C'); }); });
    });
  }




  /* ================= Слайдер на главной ================= */
  // Картинки шаблонов берём из стартовых слайдов: новинки, акция, первый заказ
  function seedImg(i) { return ['img/slide-new.jpg', 'img/slide-sale.jpg', 'img/slide-welcome.jpg'][i] || ''; }
  var SLIDE_TPL = {
    sale: { name: 'Акция', hint: 'Связан с акцией: сам покажет скидку и срок и скроется, когда акция закончится', slide: { layout: 'full', eyebrow: 'Акция', title: 'Название\n*акции*', text: 'Коротко о том, на что скидка.', image: seedImg(1), btn1: { label: 'Смотреть товары', link: '#/sale' }, btn2: { label: 'Все акции', link: '#/sale' } } },
    welcome: { name: 'Скидка на первый заказ', hint: 'С промокодом, который покупатель копирует одним нажатием', slide: { layout: 'split', eyebrow: 'Для новых покупателей', title: '−10%\nна *первый заказ*', text: 'Зарегистрируйтесь и введите промокод при оформлении.', image: seedImg(2), code: 'WELCOME10', btn1: { label: 'Зарегистрироваться', link: '#/account?tab=register' }, btn2: { label: '', link: '' } } },
    news: { name: 'Новинки', hint: 'Новая коллекция или поступление', slide: { layout: 'split', eyebrow: 'Новое поступление', title: 'Новая\n*коллекция*', text: 'Пара строк о коллекции.', image: seedImg(0), btn1: { label: 'Смотреть новинки', link: '#/catalog?tag=new' }, btn2: { label: 'Весь каталог', link: '#/catalog' } } },
    blank: { name: 'Пустой слайд', hint: 'Свой текст, фото и кнопки', slide: { layout: 'split', eyebrow: '', title: 'Заголовок', text: '', image: '', btn1: { label: 'Подробнее', link: '#/catalog' }, btn2: { label: '', link: '' } } }
  };
  function blankSlide(tpl) {
    var base = { id: uid('sl'), active: true, layout: 'split', eyebrow: '', title: '', text: '', image: '', badge: '', code: '', promotionId: '', btn1: { label: '', link: '' }, btn2: { label: '', link: '' }, gender: '', startsAt: '', endsAt: '' };
    var t = SLIDE_TPL[tpl] || SLIDE_TPL.blank, sl = Object.assign(base, clone(t.slide));
    if (tpl === 'sale') { var pr = DATA.promotions.find(function (p) { return Pricing.inWindow(p, Date.now()); }) || DATA.promotions[0]; if (pr) { sl.promotionId = pr.id; sl.title = pr.title; sl.text = pr.description || sl.text; } }
    if (tpl === 'welcome') { var c = DATA.promocodes.find(function (x) { return x.active; }); sl.code = c ? c.code : ''; }
    return sl;
  }
  function slideStatus(sl) {
    var now = Date.now(), pr = sl.promotionId && DATA.promotions.find(function (p) { return p.id === sl.promotionId; });
    if (!sl.active) return ['Скрыт', ''];
    if (sl.startsAt && now < new Date(sl.startsAt + 'T00:00:00').getTime()) return ['Покажется с ' + new Date(sl.startsAt).toLocaleDateString('ru-RU'), 'processing'];
    if (sl.endsAt && now > new Date(sl.endsAt + 'T23:59:59').getTime()) return ['Период показа закончился', 'canceled'];
    if (sl.promotionId && (!pr || !Pricing.inWindow(pr, now))) return ['Акция не действует — слайд скрыт', 'canceled'];
    return ['Показывается', 'done'];
  }
  function cleanTitle(t) { return String(t || '').replace(/\*/g, '').replace(/\n/g, ' '); }
  async function saveSlider(cfg, msg, hash) {
    var s2 = clone(DATA.settings); s2.slider = cfg;
    await A().API.adminSave('settings', s2); await afterSave(msg, hash);
  }
  function sliderSection(m, q) {
    var cfg = Object.assign({ enabled: true, autoplay: true, interval: 7, slides: [] }, clone(DATA.settings.slider || {}));
    if (q.id) return slideEditor(m, q, cfg);
    var sl = cfg.slides;
    m.innerHTML = head('Слайдер на главной', '<button class="btn sm" id="slAdd">+ Добавить слайд</button>', 'Первый экран главной страницы. Слайды сменяют друг друга по порядку из списка. Скрыть или показать слайд — переключатель справа, порядок — стрелки. Изменения сохраняются сразу.') +
      '<div id="slTpl" hidden class="adm-card adm-tpl"><h4 class="adm-sub" style="margin-top:0;padding-top:0;border-top:0">Какой слайд добавить?</h4><div class="adm-tpl-grid">' +
        Object.keys(SLIDE_TPL).map(function (k) { return '<a class="adm-tpl-item" href="#/admin?s=slider&id=new&tpl=' + k + '"><b>' + esc(SLIDE_TPL[k].name) + '</b><span class="muted">' + esc(SLIDE_TPL[k].hint) + '</span></a>'; }).join('') + '</div></div>' +
      '<div class="adm-card adm-sl-opts"><label class="check"><input type="checkbox" id="slEnabled"' + (cfg.enabled !== false ? ' checked' : '') + '> <span>Показывать слайдер на главной<br><small>Если выключить, на первом экране будет обычный блок из «Главной страницы»</small></span></label>' +
        '<label class="check"><input type="checkbox" id="slAuto"' + (cfg.autoplay !== false ? ' checked' : '') + '> <span>Листать автоматически<br><small>Пауза, когда покупатель наводит курсор</small></span></label>' +
        '<label class="field adm-sl-int"><span>Смена слайда, секунд</span><input class="input num" type="number" min="3" max="20" id="slInt" value="' + (cfg.interval || 7) + '"></label></div>' +
      (sl.length ? '<div class="adm-sl-list">' + sl.map(function (x, i) {
        var st = slideStatus(x), pr = x.promotionId && DATA.promotions.find(function (p) { return p.id === x.promotionId; });
        var pills = [x.layout === 'full' ? 'Фото на весь экран' : 'Фото справа'];
        if (x.gender) pills.push(x.gender === 'women' ? 'Только «Женщинам»' : 'Только «Мужчинам»');
        if (pr) pills.push('Акция: ' + pr.title);
        if (x.code) pills.push('Промокод ' + x.code);
        return '<div class="adm-sl-row' + (x.active ? '' : ' off') + '"><span class="adm-sl-num num">' + (i + 1) + '</span>' +
          '<a class="adm-sl-thumb" href="#/admin?s=slider&id=' + esc(x.id) + '"><img src="' + esc(x.image || Art.make({ kind: 'coat', tone: '#3d3d40' })) + '" alt=""></a>' +
          '<div class="adm-sl-info"><a href="#/admin?s=slider&id=' + esc(x.id) + '"><b>' + esc(cleanTitle(x.title) || 'Без заголовка') + '</b></a>' + (x.eyebrow ? '<span class="muted">' + esc(x.eyebrow) + '</span>' : '') +
            '<span class="adm-sl-pills"><span class="status ' + st[1] + '">' + esc(st[0]) + '</span>' + pills.map(function (p) { return '<em>' + esc(p) + '</em>'; }).join('') + '</span></div>' +
          '<label class="adm-switch" title="Показывать на сайте"><input type="checkbox" data-sl-on="' + i + '"' + (x.active ? ' checked' : '') + '><span></span></label>' +
          '<span class="adm-row-tools">' + (i > 0 ? '<button type="button" data-sl-up="' + i + '" title="Выше">↑</button>' : '') + (i < sl.length - 1 ? '<button type="button" data-sl-down="' + i + '" title="Ниже">↓</button>' : '') + '</span>' +
          '<span class="adm-sl-acts"><a class="btn ghost sm" href="#/admin?s=slider&id=' + esc(x.id) + '">Изменить</a><button class="btn ghost sm" data-sl-dup="' + i + '">Копия</button><button class="btn ghost sm" data-sl-del="' + i + '">Удалить</button></span></div>';
      }).join('') + '</div>' : '<div class="empty"><h3>Слайдов нет</h3><p>Добавьте первый слайд — например, о текущей акции.</p></div>');
    $('#slAdd', m).addEventListener('click', function () { var t = $('#slTpl', m); t.hidden = !t.hidden; });
    var save = async function (msg) { try { await saveSlider(cfg, msg, '#/admin?s=slider'); } catch (e) { toast(A().errMsg(e), true); } };
    $('#slEnabled', m).addEventListener('change', function (e) { cfg.enabled = e.target.checked; save(cfg.enabled ? 'Слайдер включён' : 'Слайдер выключен'); });
    $('#slAuto', m).addEventListener('change', function (e) { cfg.autoplay = e.target.checked; save(cfg.autoplay ? 'Автопрокрутка включена' : 'Автопрокрутка выключена'); });
    $('#slInt', m).addEventListener('change', function (e) { cfg.interval = Math.min(20, Math.max(3, Number(e.target.value) || 7)); save('Слайды меняются каждые ' + cfg.interval + ' с'); });
    m.addEventListener('change', function (e) { var i = e.target.getAttribute('data-sl-on'); if (i === null) return; sl[+i].active = e.target.checked; save(e.target.checked ? 'Слайд показан' : 'Слайд скрыт'); });
    m.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var up = b.getAttribute('data-sl-up'), down = b.getAttribute('data-sl-down'), dup = b.getAttribute('data-sl-dup');
      if (up !== null) { sl.splice(+up - 1, 0, sl.splice(+up, 1)[0]); save('Порядок изменён'); }
      if (down !== null) { sl.splice(+down + 1, 0, sl.splice(+down, 1)[0]); save('Порядок изменён'); }
      if (dup !== null) { var c = clone(sl[+dup]); c.id = uid('sl'); c.active = false; sl.splice(+dup + 1, 0, c); save('Копия создана — она скрыта, пока вы её не включите'); }
    });
    $$('[data-sl-del]', m).forEach(function (b) { bindConfirm(b, function () { sl.splice(+b.getAttribute('data-sl-del'), 1); save('Слайд удалён'); }); });
  }

  function slideEditor(m, q, cfg) {
    var isNew = q.id === 'new';
    var sl = isNew ? blankSlide(q.tpl) : clone(cfg.slides.find(function (x) { return x.id === q.id; }) || {});
    if (!isNew && !sl.id) { m.innerHTML = head('Слайд не найден') + '<a class="link" href="#/admin?s=slider">← К слайдам</a>'; return; }
    var flat = Object.assign({}, sl, { b1l: sl.btn1 && sl.btn1.label, b1h: sl.btn1 && sl.btn1.link, b2l: sl.btn2 && sl.btn2.label, b2h: sl.btn2 && sl.btn2.link });
    var promoOpts = [['', 'Не связан с акцией']].concat(DATA.promotions.map(function (p) { return [p.id, p.title + (Pricing.inWindow(p, Date.now()) ? ' — действует' : ' — не действует')]; }));
    var codeOpts = [['', 'Без промокода']].concat(DATA.promocodes.map(function (c) { return [c.code, c.code + (c.active ? '' : ' (выключен)') + (c.note ? ' — ' + c.note : '')]; }));
    var defs = [
      { section: 'Основное' },
      { k: 'active', label: 'Показывать слайд на сайте', type: 'checkbox' },
      { k: 'layout', label: 'Макет', type: 'select', options: [['split', 'Фото справа, текст слева'], ['full', 'Фото на весь экран, текст поверх']] },
      { k: 'gender', label: 'Для какого раздела', type: 'select', options: [['', 'Всем покупателям'], ['women', 'Только «Женщинам»'], ['men', 'Только «Мужчинам»']] },
      { section: 'Текст' },
      { k: 'eyebrow', label: 'Надзаголовок', wide: true, hint: 'Маленькая строка над заголовком' },
      { k: 'title', label: 'Заголовок', type: 'textarea', rows: 2, hint: 'Enter — перенос строки. *Слово в звёздочках* — курсивом.' },
      { k: 'text', label: 'Текст', type: 'textarea', rows: 3 },
      { k: 'badge', label: 'Крупная надпись над заголовком', hint: 'Например, −15%. Если слайд связан с акцией, а поле пустое — подставится размер скидки.' },
      { k: 'image', label: 'Фото', type: 'image', hint: 'Горизонтальное фото от 1600×1000 пикселей. В макете «на весь экран» главное держите в правой части кадра.' },
      { section: 'Предложение' },
      { k: 'promotionId', label: 'Связать с акцией', type: 'select', options: promoOpts, hint: 'Слайд покажет срок и размер скидки и сам скроется, когда акция закончится.' },
      { k: 'code', label: 'Промокод на слайде', type: 'select', options: codeOpts, hint: 'Покупатель копирует его одним нажатием.' },
      { section: 'Кнопки' },
      { k: 'b1l', label: 'Главная кнопка — текст', hint: 'Пусто — кнопки нет' },
      { k: 'b1h', label: 'Главная кнопка — ссылка', placeholder: '#/catalog' },
      { k: 'b2l', label: 'Вторая кнопка — текст', hint: 'Пусто — кнопки нет' },
      { k: 'b2h', label: 'Вторая кнопка — ссылка', placeholder: '#/sale' },
      { section: 'Когда показывать' },
      { k: 'startsAt', label: 'Показывать с', type: 'date', hint: 'Пусто — сразу' },
      { k: 'endsAt', label: 'Показывать по', type: 'date', hint: 'Пусто — без срока' }
    ];
    var links = [['#/catalog', 'Каталог'], ['#/catalog?tag=new', 'Новинки'], ['#/sale', 'Акции'], ['#/account?tab=register', 'Регистрация'], ['#/sizes', 'Таблица размеров']]
      .concat(DATA.categories.map(function (c) { return ['#/catalog?cat=' + c.slug, 'Категория: ' + c.name]; }))
      .concat(DATA.pages.map(function (p) { return ['#/page/' + p.slug, 'Страница: ' + p.title]; }));
    m.innerHTML = '<a class="link muted" href="#/admin?s=slider" style="font-size:14px">← Все слайды</a>' + head(isNew ? 'Новый слайд' : (cleanTitle(sl.title) || 'Слайд')) +
      '<datalist id="slLinks">' + links.map(function (l) { return '<option value="' + esc(l[0]) + '">' + esc(l[1]) + '</option>'; }).join('') + '</datalist>' +
      '<div class="adm-sl-edit"><div class="adm-card" id="slForm">' + formHtml(defs, flat) + '</div>' +
      '<div class="adm-sl-preview"><div class="adm-sl-pvhead"><span class="eyebrow">Предпросмотр</span><div class="tabs"><button class="on" data-pv="desk">Компьютер</button><button data-pv="mob">Телефон</button></div></div><div class="slpv" id="slpv"><div class="slpv-stage" id="slpvStage"></div></div>' +
      '<p class="muted" style="font-size:13px;margin-top:8px">Предпросмотр обновляется сразу. На сайте изменения появятся после «Сохранить».</p></div></div>' +
      '<div class="adm-bar"><button class="btn" id="slSave">Сохранить</button>' + (!isNew ? '<button class="btn ghost" id="slDel">Удалить</button>' : '') + '<a class="btn ghost" href="#/admin?s=slider">Отмена</a><span class="form-error" id="slErr"></span></div>';
    var box = $('#slForm', m); mountImages(box, flat);
    ['b1h', 'b2h'].forEach(function (k) { $('#f-' + k, box).setAttribute('list', 'slLinks'); });
    var mode = 'desk';
    function current() {
      var f = readForm(box, defs, Object.assign({}, flat));
      return Object.assign({}, sl, { active: f.active, layout: f.layout, gender: f.gender, eyebrow: f.eyebrow, title: f.title, text: f.text, badge: f.badge, image: f.image, promotionId: f.promotionId, code: f.code, startsAt: f.startsAt, endsAt: f.endsAt, btn1: { label: f.b1l, link: f.b1h }, btn2: { label: f.b2l, link: f.b2h } });
    }
    function preview() {
      var stage = $('#slpvStage', m), wrap = $('#slpv', m), w = mode === 'desk' ? 1280 : 390;
      stage.style.width = w + 'px';
      stage.className = 'slpv-stage ' + mode;
      stage.innerHTML = '<section class="slider" style="--dur:7s"><div class="sl-track">' + A().slideHtml(current(), 0, 1, true) + '</div></section>';
      var k = Math.min(1, wrap.clientWidth / w);
      stage.style.transform = 'scale(' + k + ')';
      stage.style.left = Math.max(0, (wrap.clientWidth - w * k) / 2) + 'px';
      wrap.style.height = Math.ceil(stage.offsetHeight * k) + 'px';
      $$('a,button', stage).forEach(function (a) { a.tabIndex = -1; });
    }
    preview();
    var t = null; box.addEventListener('input', function () { clearTimeout(t); t = setTimeout(preview, 120); });
    box.addEventListener('change', preview);
    new MutationObserver(function () { preview(); }).observe($('[data-imgs="image"]', box), { childList: true });
    $('#slpv', m).addEventListener('click', function (e) { if (e.target.closest('a,button')) e.preventDefault(); }, true);
    $$('[data-pv]', m).forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-pv'); $$('[data-pv]', m).forEach(function (x) { x.classList.toggle('on', x === b); }); preview(); }); });
    window.addEventListener('resize', function onR() { if (!document.body.contains(m) || !$('#slpv', m)) { window.removeEventListener('resize', onR); return; } preview(); });
    $('#slSave', m).addEventListener('click', async function () {
      var x = current();
      if (!x.title.trim()) { $('#slErr').textContent = 'Напишите заголовок'; return; }
      if (x.btn1.label && !x.btn1.link) { $('#slErr').textContent = 'Укажите ссылку для главной кнопки'; return; }
      if (x.btn2.label && !x.btn2.link) { $('#slErr').textContent = 'Укажите ссылку для второй кнопки'; return; }
      var i = cfg.slides.findIndex(function (y) { return y.id === x.id; });
      if (i === -1) cfg.slides.push(x); else cfg.slides[i] = x;
      try { await saveSlider(cfg, isNew ? 'Слайд добавлен' : 'Слайд сохранён', '#/admin?s=slider'); } catch (e) { $('#slErr').textContent = A().errMsg(e); }
    });
    if ($('#slDel', m)) bindConfirm($('#slDel', m), async function () { cfg.slides = cfg.slides.filter(function (y) { return y.id !== sl.id; }); try { await saveSlider(cfg, 'Слайд удалён', '#/admin?s=slider'); } catch (e) { toast(A().errMsg(e), true); } });
  }

  /* ================= Логотип и название ================= */
  var MODES = [['both', 'Знак и надпись'], ['word', 'Только надпись'], ['mark', 'Только знак'], ['text', 'Название текстом']];
  // Обработка загруженного логотипа: убрать однотонный фон, перекрасить в светлый цвет сайта, обрезать пустые поля
  function processLogo(file, opt) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Не удалось прочитать файл')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Файл не похож на изображение. Подойдут PNG, JPG, WebP или SVG.')); };
        img.onload = function () {
          var k = Math.min(1, 2400 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
          var W = Math.max(1, Math.round((img.naturalWidth || img.width || 600) * k)), H = Math.max(1, Math.round((img.naturalHeight || img.height || 200) * k));
          var c = document.createElement('canvas'); c.width = W; c.height = H;
          var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
          var d = ctx.getImageData(0, 0, W, H), px = d.data, note = '';
          var corner = function (x, y) { var i = (y * W + x) * 4; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
          var cs = [corner(0, 0), corner(W - 1, 0), corner(0, H - 1), corner(W - 1, H - 1)];
          var bg = [0, 1, 2, 3].map(function (j) { return cs.reduce(function (a, x) { return a + x[j]; }, 0) / 4; });
          var uniform = cs.every(function (x) { return Math.abs(x[0] - bg[0]) + Math.abs(x[1] - bg[1]) + Math.abs(x[2] - bg[2]) < 40 && x[3] > 200; });
          if (opt.removeBg && uniform) {
            for (var i = 0; i < px.length; i += 4) {
              var dist = Math.max(Math.abs(px[i] - bg[0]), Math.abs(px[i + 1] - bg[1]), Math.abs(px[i + 2] - bg[2]));
              var a = Math.min(1, Math.max(0, (dist - 10) / 60));
              if (a > 0 && a < 1) for (var ch = 0; ch < 3; ch++) px[i + ch] = Math.max(0, Math.min(255, bg[ch] + (px[i + ch] - bg[ch]) / a));
              px[i + 3] = Math.round(a * px[i + 3]);
            }
            note = 'Фон убран';
          } else if (opt.removeBg && cs.some(function (x) { return x[3] > 200; })) note = 'Фон неоднородный — убрать его автоматически не получилось. Лучше загрузить PNG с прозрачным фоном.';
          if (opt.recolor) for (var j = 0; j < px.length; j += 4) { px[j] = 0xec; px[j + 1] = 0xe6; px[j + 2] = 0xdc; }
          // обрезка пустых полей
          var x0 = W, y0 = H, x1 = -1, y1 = -1;
          for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          if (x1 < 0) { reject(new Error('После удаления фона ничего не осталось. Попробуйте без галочки «Убрать фон».')); return; }
          ctx.putImageData(d, 0, 0);
          var cw = x1 - x0 + 1, chh = y1 - y0 + 1, s2 = Math.min(1, 1000 / cw, 300 / chh);
          var o = document.createElement('canvas'); o.width = Math.max(1, Math.round(cw * s2)); o.height = Math.max(1, Math.round(chh * s2));
          var octx = o.getContext('2d'); octx.imageSmoothingQuality = 'high'; octx.drawImage(c, x0, y0, cw, chh, 0, 0, o.width, o.height);
          resolve({ dataUrl: o.toDataURL('image/png'), w: o.width, h: o.height, note: note });
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function brandSection(m) {
    var s = clone(DATA.settings);
    s.brand = Object.assign({ desktop: 'word', mobile: 'word', scale: 100 }, s.brand || {});

    var b = s.brand;
    m.innerHTML = head('Логотип и название', '', 'Надпись стоит в шапке, в меню на телефоне, в подвале и в письмах покупателям. Знак — водяным знаком в подвале. Что показывать в шапке на компьютере и на телефоне, выбирается ниже.') +
      '<div class="adm-brand-grid"><div class="adm-card" style="display:grid;gap:22px">' +
        '<div class="adm-logo-slots">' + slot('mark', 'Знак', 'Иконка или монограмма, примерно квадратная') + slot('word', 'Надпись', 'Название бренда в фирменном начертании, вытянутое по горизонтали') + '</div>' +
        '<div class="adm-logo-opts"><span class="eyebrow">При загрузке</span><label class="check"><input type="checkbox" id="lgBg" checked> <span>Убрать однотонный фон (белый, чёрный и т. п.)</span></label><label class="check"><input type="checkbox" id="lgColor" checked> <span>Перекрасить в светлый цвет сайта — чтобы логотип был виден на тёмном фоне</span></label></div>' +
        '<div class="adm-form">' +
          fieldHtml({ k: 'storeName', label: 'Название магазина', hint: 'Используется в заголовке вкладки, в письмах и там, где выбрано «Название текстом»' }, s) +
          '<label class="field"><span>Размер логотипа: <b id="lgScaleVal">' + b.scale + '%</b></span><input type="range" id="lgScale" min="70" max="150" step="5" value="' + b.scale + '" aria-label="Размер логотипа"></label>' +
          fieldHtml({ k: 'desktop', label: 'На компьютере показывать', type: 'select', options: MODES }, b) +
          fieldHtml({ k: 'mobile', label: 'На телефоне показывать', type: 'select', options: MODES }, b) +
        '</div>' +
        '<label class="check"><input type="checkbox" id="lgFooterMark"' + (b.footerMark !== false ? ' checked' : '') + '> <span>Водяной знак в подвале сайта — крупно и едва заметно, справа. Работает, если загружен знак.</span></label>' +
        '</div>' +
        '<div class="adm-logo-preview"><span class="eyebrow">Так выглядит шапка</span>' +
          '<div class="pv-desk"><div class="pv-bar"><span class="pv-nav">Новинки · Каталог · Акции</span><span id="pvDesk"></span><span class="pv-icons">○ ○ ○</span></div><small class="muted">Компьютер</small></div>' +
          '<div class="pv-mob"><div class="pv-bar"><span class="pv-icons">≡</span><span id="pvMob"></span><span class="pv-icons">○ ○</span></div><small class="muted">Телефон</small></div>' +
        '</div></div>' +
      '<div class="adm-bar"><button class="btn" id="lgSave">Сохранить</button><span class="form-error" id="lgErr"></span></div>';
    function slot(k, title, hint) {
      return '<div class="adm-logo-slot" data-slot="' + k + '"><div class="adm-logo-tile"></div><div style="display:grid;gap:4px"><b>' + title + '</b><span class="muted" style="font-size:13px">' + hint + '</span></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap"><label class="btn ghost sm"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden data-up="' + k + '">Загрузить</label><button type="button" class="btn ghost sm" data-del="' + k + '">Убрать</button></div></div>';
    }
    function readState() {
      s.storeName = $('#f-storeName', m).value.trim() || s.storeName;
      b.desktop = $('#f-desktop', m).value; b.mobile = $('#f-mobile', m).value; b.scale = Number($('#lgScale', m).value);
      b.footerMark = $('#lgFooterMark', m).checked;
    }
    function draw() {
      readState();
      ['mark', 'word'].forEach(function (k) {
        var el = $('[data-slot="' + k + '"]', m), has = b[k] && b[k].src;
        $('.adm-logo-tile', el).innerHTML = has ? '<img src="' + esc(b[k].src) + '" alt="">' : '<span class="muted">Не загружен</span>';
        $('[data-del]', el).hidden = !has;
      });
      $('#lgScaleVal', m).textContent = b.scale + '%';
      $('#pvDesk', m).innerHTML = A().brandHtml(s, 'desktop', 'brand-pv-desk');
      $('#pvMob', m).innerHTML = A().brandHtml(s, 'mobile', 'brand-pv-mob');
      var warn = [];
      ['desktop', 'mobile'].forEach(function (w) { var want = b[w], got = A().brandMode(s, w); if (want !== got) warn.push((w === 'desktop' ? 'На компьютере' : 'На телефоне') + ' выбрано «' + MODES.find(function (x) { return x[0] === want; })[1] + '», но нужного изображения нет — показано «' + MODES.find(function (x) { return x[0] === got; })[1] + '»'); });
      $('#lgErr', m).textContent = warn.join('. ');
      $('#lgErr', m).style.color = warn.length ? 'var(--warn)' : '';
    }
    draw();
    m.addEventListener('input', function (e) { if (e.target.id === 'lgScale' || e.target.id === 'f-storeName') draw(); });
    m.addEventListener('change', async function (e) {
      if (e.target.matches('#f-desktop,#f-mobile')) { draw(); return; }
      var k = e.target.getAttribute('data-up'); if (!k || !e.target.files[0]) return;
      var slotEl = $('[data-slot="' + k + '"]', m); slotEl.classList.add('busy');
      try {
        var r = await processLogo(e.target.files[0], { removeBg: $('#lgBg', m).checked, recolor: $('#lgColor', m).checked });
        var src = await A().API.uploadDataUrl(r.dataUrl);
        b[k] = { src: src, w: r.w, h: r.h };
        if (r.note) toast(r.note, /неоднородный/.test(r.note));
      } catch (ex) { toast(A().errMsg(ex), true); }
      slotEl.classList.remove('busy'); e.target.value = ''; draw();
    });
    m.addEventListener('click', function (e) { var d = e.target.closest('[data-del]'); if (d) { b[d.getAttribute('data-del')] = null; draw(); } });
    $('#lgSave', m).addEventListener('click', async function () {
      readState();
      if (!s.storeName) { $('#lgErr', m).textContent = 'Укажите название магазина'; return; }
      try { await A().API.adminSave('settings', s); await afterSave('Логотип сохранён', '#/admin?s=brand'); } catch (ex) { $('#lgErr', m).textContent = A().errMsg(ex); }
    });
  }

  /* ================= Сообщить о поступлении ================= */
  var W_STATUS = { waiting: ['Ждёт поступления', 'new'], failed: ['Ошибка отправки — повторим', 'canceled'], sent: ['Письмо отправлено', 'done'], canceled: ['Покупатель отменил', ''] };
  function notifyMsg(base, n) {
    if (!n) return base;
    if (n.sent) return base + '. Отправлено писем о поступлении: ' + n.sent;
    if (n.ready && n.disabled) return base + '. Уведомления выключены, письма не отправлены';
    if (n.ready && n.noMail) return base + '. ' + n.ready + ' чел. ждут этот товар, но почта для отправки не настроена';
    if (n.failed) return base + '. Не удалось отправить писем: ' + n.failed;
    return base;
  }
  function wInfo(w) {
    var p = DATA.products.find(function (x) { return x.id === w.productId; });
    var c = p && Pricing.colorsOf(p).find(function (x) { return x.id === w.colorId; });
    var sz = c && (c.sizes || []).filter(function (x) { return !w.size || x.size === w.size; }).reduce(function (a, x) { return a + (+x.stock || 0); }, 0);
    return { p: p, c: c, name: p ? p.name : 'Товар удалён', color: c ? c.name : '—', hex: c && c.hex, size: w.size || 'любой', stock: sz || 0 };
  }
  function waitingForProduct(p) {
    var list = (DATA.waitlist || []).filter(function (w) { return w.productId === p.id && (w.status === 'waiting' || w.status === 'failed'); });
    if (!list.length) return '';
    var groups = {};
    list.forEach(function (w) { var i = wInfo(w), k = i.color + ' · ' + i.size; groups[k] = (groups[k] || 0) + 1; });
    return '<div class="adm-wait-note"><b>Этот товар ' + (list.length % 10 === 1 && list.length % 100 !== 11 ? 'ждёт ' : 'ждут ') + list.length + ' ' + plural(list.length, 'покупатель', 'покупателя', 'покупателей') + ':</b> ' +
      Object.keys(groups).map(function (k) { return esc(k) + ' — ' + groups[k]; }).join(', ') +
      '. Пополните остаток нужного цвета и размера и нажмите «Сохранить» — письма уйдут автоматически.</div>';
  }

  async function notifySection(m, q) {
    var API = A().API, tab = q.tab || 'requests', tpl = Mail.tplOf(DATA.settings);
    var mail = { ready: false };
    try { mail = (await API.adminMail()).mail; } catch (e) {}
    var wl = DATA.waitlist || [];
    var waiting = wl.filter(function (w) { return w.status === 'waiting' || w.status === 'failed'; });
    var ready = Mail.readyRequests(wl, DATA.products);
    var mailState = mail.ready ? ['Настроена', 'done', esc(mail.fromEmail)] : ['Не настроена', 'canceled', 'Письма не отправляются'];
    m.innerHTML = head('Сообщить о поступлении', '', 'Если нужного размера или цвета нет, покупатель нажимает на сайте «Сообщить о поступлении» и оставляет почту. Когда вы пополните остаток в карточке товара и сохраните её, письмо уйдёт автоматически — один раз на каждую заявку.') +
      '<ol class="adm-steps"><li><b>Покупатель оставляет заявку</b><span>на странице товара, если размера или цвета нет</span></li><li><b>Вы пополняете остаток</b><span>в разделе «Товары», в нужном цвете и размере</span></li><li><b>Письмо уходит само</b><span>сразу после сохранения товара</span></li></ol>' +
      '<div class="adm-stats" style="margin-top:20px">' +
        '<div class="adm-stat"><span class="eyebrow">Кнопка на сайте</span><b class="adm-stat-sm"><span class="status ' + (tpl.enabled ? 'done' : 'canceled') + '">' + (tpl.enabled ? 'Включена' : 'Выключена') + '</span></b><button class="link muted" id="nToggle" style="justify-self:start;font-size:14px">' + (tpl.enabled ? 'Выключить' : 'Включить') + '</button></div>' +
        '<a class="adm-stat" href="#/admin?s=notify&tab=mail"><span class="eyebrow">Почта для отправки</span><b class="adm-stat-sm"><span class="status ' + mailState[1] + '">' + mailState[0] + '</span></b><span class="muted" style="font-size:14px">' + mailState[2] + '</span></a>' +
        '<a class="adm-stat" href="#/admin?s=notify"><span class="eyebrow">Ждут поступления</span><b class="num">' + waiting.length + '</b></a>' +
      '</div>' +
      (ready.length && !mail.ready ? '<div class="adm-alert">' + ready.length + ' ' + plural(ready.length, 'заявка', 'заявки', 'заявок') + ': товар уже в наличии, но письма не ушли, потому что почта для отправки не настроена. <a class="link" href="#/admin?s=notify&tab=mail">Настроить почту</a></div>' : '') +
      '<div class="tabs adm-tabs">' + [['requests', 'Заявки'], ['letter', 'Текст письма'], ['mail', 'Почта для отправки']].map(function (t) { return '<a href="#/admin?s=notify&tab=' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</a>'; }).join('') + '</div><div id="nBody"></div>';
    $('#nToggle').addEventListener('click', async function () {
      var s2 = clone(DATA.settings); s2.notify = Object.assign({}, tpl, { enabled: !tpl.enabled });
      try { await API.adminSave('settings', s2); await afterSave(s2.notify.enabled ? 'Кнопка «Сообщить о поступлении» включена' : 'Кнопка выключена: покупатели её не увидят', '#/admin?s=notify&tab=' + tab); } catch (e) { toast(A().errMsg(e), true); }
    });
    var body = $('#nBody');
    if (tab === 'letter') return letterTab(body, tpl, mail);
    if (tab === 'mail') return mailTab(body, mail);
    requestsTab(body, q, wl, ready, mail);
  }

  function requestsTab(body, q, wl, ready, mail) {
    var f = q.f || 'waiting';
    var match = { waiting: ['waiting', 'failed'], done: ['sent'], canceled: ['canceled'], all: null }[f];
    var list = wl.filter(function (w) { return !match || match.indexOf(w.status) !== -1; }).slice().reverse();
    var groups = {};
    wl.filter(function (w) { return w.status === 'waiting' || w.status === 'failed'; }).forEach(function (w) {
      var k = w.productId + '|' + w.colorId + '|' + w.size;
      if (!groups[k]) groups[k] = { w: w, n: 0 }; groups[k].n++;
    });
    var top = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return b.n - a.n; });
    body.innerHTML =
      (top.length ? '<div class="adm-card" style="margin-bottom:20px"><h3 class="adm-h3" style="margin-bottom:12px">Чего ждут покупатели</h3><div class="table-wrap adm-table"><table class="sizes"><thead><tr><th>Товар</th><th>Цвет</th><th>Размер</th><th>Ждут</th><th>Остаток сейчас</th><th></th></tr></thead><tbody>' +
        top.map(function (g) { var i = wInfo(g.w); return '<tr><td>' + esc(i.name) + '</td><td>' + swatchInline(i.hex) + esc(i.color) + '</td><td>' + esc(i.size) + '</td><td class="num"><b>' + g.n + '</b></td><td class="num' + (i.stock ? '' : ' muted') + '">' + i.stock + '</td><td>' + (i.p ? '<a class="link" href="#/admin?s=products&id=' + esc(i.p.id) + '">Пополнить</a>' : '') + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>' : '') +
      '<div class="adm-head" style="margin:0 0 14px"><div class="adm-filter" style="margin:0">' + [['waiting', 'Ждут'], ['done', 'Отправлены'], ['canceled', 'Отменены'], ['all', 'Все']].map(function (x) { return '<a class="chip' + (f === x[0] ? ' on' : '') + '" href="#/admin?s=notify&f=' + x[0] + '">' + x[1] + '</a>'; }).join('') + '</div>' +
        (ready.length ? '<button class="btn sm" id="nSend">Отправить письма сейчас (' + ready.length + ')</button>' : '') + '</div>' +
      (list.length ? '<div class="table-wrap adm-table"><table class="sizes"><thead><tr><th>Дата</th><th>Почта</th><th>Товар</th><th>Цвет</th><th>Размер</th><th>Статус</th><th></th></tr></thead><tbody>' +
        list.map(function (w) { var i = wInfo(w), st = W_STATUS[w.status] || [w.status, '']; return '<tr><td class="num">' + esc(new Date(w.createdAt).toLocaleDateString('ru-RU')) + '</td><td class="copyable">' + esc(w.email) + '</td><td>' + esc(i.name) + '</td><td>' + swatchInline(i.hex) + esc(i.color) + '</td><td>' + esc(i.size) + '</td><td><span class="status ' + st[1] + '"' + (w.error ? ' title="' + esc(w.error) + '"' : '') + '>' + esc(st[0]) + '</span>' + (w.sentAt && w.status === 'sent' ? '<div class="muted" style="font-size:13px">' + esc(new Date(w.sentAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '</div>' : '') + '</td><td><button class="adm-x" data-wdel="' + esc(w.id) + '" title="Удалить заявку">✕</button></td></tr>'; }).join('') +
        '</tbody></table></div>' :
        '<div class="empty"><h3>' + (f === 'waiting' ? 'Заявок нет' : 'Пусто') + '</h3><p>' + (f === 'waiting' ? 'Когда покупатель попросит сообщить о поступлении, заявка появится здесь.' : 'В этом списке пока ничего нет.') + '</p></div>');
    var sb = $('#nSend'); if (sb) sb.addEventListener('click', async function () {
      sb.disabled = true;
      try { var r = await A().API.adminWaitlistSend(); await afterSave(notifyMsg('Готово', r.notify), '#/admin?s=notify'); } catch (e) { toast(A().errMsg(e), true); sb.disabled = false; }
    });
    $$('[data-wdel]', body).forEach(function (b) { bindConfirm(b, async function () { try { await A().API.adminWaitlistDelete(b.getAttribute('data-wdel')); await afterSave('Заявка удалена', '#/admin?s=notify&f=' + f); } catch (e) { toast(A().errMsg(e), true); } }); });
  }
  function swatchInline(hex) { return hex ? '<i class="adm-dot" style="background:' + esc(hex) + '"></i>' : ''; }

  function letterTab(body, tpl, mail) {
    var defs = [
      { k: 'subject', label: 'Тема письма', wide: true },
      { k: 'heading', label: 'Заголовок', wide: true },
      { k: 'text', label: 'Текст', type: 'textarea', rows: 6, hint: 'Пустая строка — новый абзац' },
      { k: 'button', label: 'Текст кнопки', wide: true },
      { k: 'footer', label: 'Подпись внизу письма', type: 'textarea', rows: 3 }
    ];
    var sample = DATA.products.find(function (p) { return p.active !== false && Pricing.colorsOf(p).some(function (c) { return c.images && c.images.length; }); }) || DATA.products.find(function (p) { return p.active !== false; });
    body.innerHTML = '<div class="adm-letter"><div class="adm-card"><p class="muted" style="font-size:14px;margin-bottom:14px">Вставьте подстановку, и в каждом письме на её месте окажутся данные из заявки. Нажмите на подстановку — она добавится туда, где стоит курсор.</p>' +
      '<div class="adm-ph">' + Mail.PLACEHOLDERS.map(function (x) { return '<button type="button" class="chip" data-ph="' + esc(x[0]) + '" title="' + esc(x[1]) + '">' + esc(x[0]) + '<small>' + esc(x[1]) + '</small></button>'; }).join('') + '</div>' +
      '<div id="ltForm">' + formHtml(defs, tpl) + '</div>' +
      '<div class="adm-bar" style="position:static;background:none;padding-bottom:0"><button class="btn" id="ltSave">Сохранить текст</button><button class="btn ghost" id="ltReset" type="button">Вернуть стандартный</button><span class="form-error" id="ltErr"></span></div>' +
      '<div class="adm-test"><h4 class="adm-sub">Проверить письмо</h4>' + ('<div class="promo-form"><input class="input" id="ltTo" type="email" placeholder="Ваша почта" aria-label="Почта для примера"><button type="button" class="btn ghost" id="ltTest">Отправить пример</button></div>' + (mail.ready ? '' : '<p class="muted" style="font-size:13px;margin-top:8px">Сначала настройте почту для отправки.</p>')) + '</div></div>' +
      '<div class="adm-preview"><div class="adm-preview-head"><span class="eyebrow">Так покупатель увидит письмо</span><div class="adm-preview-subj"><span class="muted">Тема:</span> <b id="pvSubj"></b></div></div><div id="pvBox" class="adm-preview-box"></div></div></div>';
    var box = $('#ltForm', body), host = $('#pvBox', body), shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host, lastField = null;
    function current() { return readForm(box, defs, Object.assign({}, tpl)); }
    function preview() {
      var t = current(), c = sample ? Pricing.colorsOf(sample)[0] : null;
      var pr = sample ? Pricing.productPrice(sample, DATA.promotions) : { price: 0 };
      var r = Mail.render({ tpl: t, store: DATA.settings.storeName, product: sample ? sample.name : 'Пальто из шерсти', color: c ? c.name : 'Графит', colorHex: c && c.hex, size: c && c.sizes[0] ? c.sizes[0].size : 'M', price: fmt(pr.price), oldPrice: pr.oldPrice ? fmt(pr.oldPrice) : '', url: '#', image: c && c.images && c.images[0] && !/^data:image\/svg/.test(c.images[0]) ? c.images[0] : '', unsubscribe: '#', contacts: [DATA.settings.contacts.phone, DATA.settings.contacts.email].filter(Boolean).join(' · ') });
      $('#pvSubj', body).textContent = r.subject;
      shadow.innerHTML = r.html.replace(/^[\s\S]*?<body[^>]*>/, '<div style="background:#F4F1EB">').replace(/<\/body>[\s\S]*$/, '</div>');
    }
    preview();
    shadow.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) e.preventDefault(); });
    box.addEventListener('input', preview);
    box.addEventListener('focusin', function (e) { if (e.target.matches('input,textarea')) lastField = e.target; });
    $$('[data-ph]', body).forEach(function (b) { b.addEventListener('mousedown', function (e) { e.preventDefault(); }); b.addEventListener('click', function () {
      var el = lastField || $('#f-text', box), ph = b.getAttribute('data-ph'), a = el.selectionStart || el.value.length, z = el.selectionEnd || a;
      el.value = el.value.slice(0, a) + ph + el.value.slice(z); el.focus(); el.selectionStart = el.selectionEnd = a + ph.length; preview();
    }); });
    $('#ltReset', body).addEventListener('click', function () { defs.forEach(function (d) { $('[data-k="' + d.k + '"]', box).value = Mail.DEFAULT_NOTIFY[d.k]; }); preview(); toast('Стандартный текст подставлен. Нажмите «Сохранить текст», чтобы применить.'); });
    $('#ltSave', body).addEventListener('click', async function () {
      var t = current();
      if (!t.subject.trim() || !t.heading.trim() || !t.button.trim()) { $('#ltErr').textContent = 'Тема, заголовок и текст кнопки не могут быть пустыми'; return; }
      var bad = (t.subject + t.heading + t.text + t.button + t.footer).match(/\{[^}]*\}/g); bad = (bad || []).filter(function (x) { return !Mail.PLACEHOLDERS.some(function (p) { return p[0] === x; }); });
      if (bad.length) { $('#ltErr').textContent = 'Неизвестная подстановка ' + bad[0] + '. Используйте подстановки из списка выше.'; return; }
      var s2 = clone(DATA.settings); s2.notify = Object.assign({}, t, { enabled: tpl.enabled });
      try { await A().API.adminSave('settings', s2); await afterSave('Текст письма сохранён', '#/admin?s=notify&tab=letter'); } catch (e) { $('#ltErr').textContent = A().errMsg(e); }
    });
    var tb = $('#ltTest', body); if (tb) tb.addEventListener('click', async function () {
      tb.disabled = true; tb.textContent = 'Отправляем…';
      try { await A().API.adminMailTest($('#ltTo').value.trim()); toast('Пример отправлен на ' + $('#ltTo').value.trim() + '. Учтите: сохранённый текст, а не черновик.'); } catch (e) { toast(A().errMsg(e), true); }
      tb.disabled = false; tb.textContent = 'Отправить пример';
    });
  }

  function mailTab(body, mail) {
    var PRESETS = { yandex: { host: 'smtp.yandex.ru', port: 465, security: 'ssl' }, mailru: { host: 'smtp.mail.ru', port: 465, security: 'ssl' } };
    var defs = [
      { k: 'host', label: 'Сервер исходящей почты (SMTP)', placeholder: 'smtp.yandex.ru' },
      { k: 'port', label: 'Порт', type: 'number' },
      { k: 'security', label: 'Шифрование', type: 'select', options: [['ssl', 'SSL (обычно порт 465)'], ['starttls', 'STARTTLS (обычно порт 587)'], ['none', 'Без шифрования (только для своего сервера)']] },
      { k: 'user', label: 'Логин — адрес ящика', placeholder: 'shop@вашдомен.ru' },
      { k: 'pass', label: 'Пароль приложения', hint: mail.hasPass ? 'Пароль сохранён. Оставьте поле пустым, чтобы не менять.' : 'Создаётся в настройках безопасности почты. Обычный пароль от ящика не подойдёт.' },
      { k: 'fromEmail', label: 'Адрес отправителя', placeholder: 'Обычно совпадает с логином' },
      { k: 'fromName', label: 'Имя отправителя', placeholder: DATA.settings.storeName }
    ];
    body.innerHTML = '<div class="adm-card"><p class="muted" style="font-size:14px;max-width:70ch;margin-bottom:16px">Письма уходят с вашего почтового ящика. Лучше всего — ящик на домене магазина в <b>Яндекс 360</b> или <b>Mail.ru для бизнеса</b>, например <span class="copyable">shop@albakov.ru</span>: такие письма реже попадают в спам.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px"><span class="muted" style="font-size:14px;align-self:center">Заполнить для:</span><button type="button" class="btn ghost sm" data-preset="yandex">Яндекс 360</button><button type="button" class="btn ghost sm" data-preset="mailru">Mail.ru</button></div>' +
      '<div id="mlForm">' + formHtml(defs, Object.assign({}, mail, { pass: '' })) + '</div>' +
      '<div class="adm-bar" style="position:static;background:none;padding-bottom:0"><button class="btn" id="mlSave">Сохранить</button><span class="form-error" id="mlErr"></span></div></div>';
    var box = $('#mlForm', body);
    $('#f-pass', box).type = 'password'; $('#f-pass', box).autocomplete = 'new-password';
    $$('[data-preset]', body).forEach(function (b) { b.addEventListener('click', function () { var pr = PRESETS[b.getAttribute('data-preset')]; $('#f-host', box).value = pr.host; $('#f-port', box).value = pr.port; $('#f-security', box).value = pr.security; $('#f-user', box).focus(); }); });
    $('#f-user', box).addEventListener('change', function () { var fe = $('#f-fromEmail', box); if (!fe.value) fe.value = this.value; });
    $('#mlSave', body).addEventListener('click', async function () {
      var m = readForm(box, defs, {});
      if (!m.host || !m.user) { $('#mlErr').textContent = 'Укажите сервер и логин'; return; }
      if (!m.fromEmail) m.fromEmail = m.user;
      try { await A().API.adminMailSave(m); toast('Настройки почты сохранены. Проверьте их: «Текст письма» → «Отправить пример».'); location.hash = '#/admin?s=notify&tab=mail&t=' + Date.now(); } catch (e) { $('#mlErr').textContent = A().errMsg(e); }
    });
  }

  /* Клик по строке таблицы */
  document.addEventListener('click', function (e) { if (e.target.closest('.adm-pick')) return; var tr = e.target.closest('tr[data-href]'); if (tr) location.hash = tr.getAttribute('data-href'); });

  window.Admin = { render: render };
})();
