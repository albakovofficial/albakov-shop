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
    ['overview', 'Обзор'], ['orders', 'Заказы'], ['support', 'Поддержка'], ['products', 'Товары'], ['categories', 'Категории'],
    ['promotions', 'Акции'], ['promocodes', 'Промокоды'], ['bonus', 'Бонусы'], ['exchange', 'Обмен и возвраты'], ['customers', 'Покупатели'], ['mail', 'Почта'], ['analytics', 'Аналитика'], ['finance', 'Финансы'], ['gifts', 'Подарочные сертификаты'], ['sections', 'Разделы'], ['brand', 'Логотип и название'], ['slider', 'Слайдер на главной'], ['home', 'Главная страница'], ['pages', 'Страницы'],
    ['menu', 'Меню, контакты, соцсети'], ['payment', 'Оплата и доставка'], ['push', 'Push-уведомления'], ['staff', 'Сотрудники'], ['audit', 'Журнал действий'], ['settings', 'Настройки']
  ];
  /* Разделы по группам (13.63): рабочий стол и меню панели. Значок, короткое название, цвет группы */
  var GROUPS = [
    ['Продажи', 'g-sales', ['orders', 'support', 'exchange', 'customers']],
    ['Каталог', 'g-cat', ['products', 'categories', 'sections']],
    ['Маркетинг', 'g-mkt', ['promotions', 'promocodes', 'bonus', 'gifts', 'mail', 'push']],
    ['Цифры', 'g-cat', ['overview', 'analytics', 'finance']],
    ['Витрина', 'g-mkt', ['home', 'slider', 'brand', 'menu', 'pages']],
    ['Управление', 'g-cat', ['payment', 'staff', 'audit', 'settings']]
  ];
  var SHORT = { exchange: 'Обмен и возврат', gifts: 'Сертификаты', brand: 'Логотип', slider: 'Слайдер', home: 'Главная', menu: 'Меню и контакты', push: 'Push', audit: 'Журнал' };
  var SEC_IC = {
    overview: '<path d="M5 20V12M10 20V7M15 20v-5M20 20V9"/>',
    orders: '<path d="M12 3l8 4.3v9.4L12 21l-8-4.3V7.3z"/><path d="M4 7.3l8 4.3 8-4.3M12 11.6V21"/>',
    support: '<path d="M4 5.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 15H9l-4 3.5V15H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5z"/><path d="M7 9.5h7M7 12h4.5"/>',
    exchange: '<path d="M5 8h13l-3.5-3.5M19 16H6l3.5 3.5"/>',
    customers: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19c.9-3 3.2-4.6 6-4.6s5.1 1.6 6 4.6"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.4c2.2.2 3.8 1.7 4.5 4.1"/>',
    products: '<path d="M8.5 4L4 6.5l1.7 4 2.3-1V20h8V9.5l2.3 1 1.7-4L15.5 4c-.6 1.6-1.9 2.5-3.5 2.5S9.1 5.6 8.5 4z"/>',
    categories: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
    sections: '<circle cx="6.5" cy="9" r="2.4"/><circle cx="12" cy="7.5" r="2.8"/><circle cx="17.5" cy="9.5" r="2"/><path d="M2.5 18c.6-2.4 2-3.6 4-3.6M7.2 19c.7-3.1 2.4-4.6 4.8-4.6s4.1 1.5 4.8 4.6M17.5 14.6c1.9 0 3.3 1.2 4 3.4"/>',
    promotions: '<path d="M3.5 12.5V4.8A1.3 1.3 0 0 1 4.8 3.5h7.7L21 12l-9 9z"/><circle cx="8.3" cy="8.3" r="1.6"/>',
    promocodes: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-2a2.5 2.5 0 0 0 0-5z"/><path d="M14 7v10" stroke-dasharray="1.6 2"/>',
    bonus: '<path d="M11 3.5l1.6 4.4L17 9.5l-4.4 1.6L11 15.5l-1.6-4.4L5 9.5l4.4-1.6zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z"/>',
    gifts: '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M2.5 9h19V7.5A1.5 1.5 0 0 0 20 6H4a1.5 1.5 0 0 0-1.5 1.5zM12 6v14M12 6c-1.3-3.5-5.5-4-5.2-1.6.2 1.6 5.2 1.6 5.2 1.6zM12 6c1.3-3.5 5.5-4 5.2-1.6-.2 1.6-5.2 1.6-5.2 1.6z"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
    push: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    analytics: '<path d="M4 4v16h16"/><path d="M7.5 15l3.5-4 3 2.5L19 8"/><path d="M15.5 8H19v3.5"/>',
    finance: '<circle cx="12" cy="12" r="8.5"/><path d="M10 16.5v-9h3a2.3 2.3 0 0 1 0 4.6h-4.5M8.5 14.5h5"/>',
    home: '<path d="M4 11l8-6.5 8 6.5v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    slider: '<rect x="3" y="7" width="14" height="11" rx="2"/><path d="M7 4h11.5A2.5 2.5 0 0 1 21 6.5V15"/>',
    brand: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8.5 16.5L12 7.5l3.5 9M9.7 13.5h4.6"/>',
    menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h9"/>',
    pages: '<path d="M7 3h7.5L19 7.5v12a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 7 3z"/><path d="M14.5 3v4.5H19M8.5 12h7M8.5 15.5h5"/>',
    payment: '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 9.5h19M6 15h3.5"/>',
    staff: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 19.5c.9-3.4 3.4-5.2 6.5-5.2 1 0 1.9.2 2.7.5"/><circle cx="17.5" cy="15" r="2"/><path d="M17.5 17v3.5M17.5 19h1.6"/>',
    audit: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7.5 8.5h.01M10.5 8.5h6M7.5 12h.01M10.5 12h6M7.5 15.5h.01M10.5 15.5h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'
  };
  function secIcon(k) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (SEC_IC[k] || SEC_IC.pages) + '</svg>'; }
  function secTitle(k) { var x = SECTIONS.find(function (y) { return y[0] === k; }); return x ? x[1] : k; }
  function groupOf(k) { return GROUPS.find(function (g) { return g[2].indexOf(k) !== -1; }) || GROUPS[5]; }
  /* Какие разделы видит роль (13.57): права приходят с сервера в DATA.perms, сервер проверяет их на каждом запросе */
  var SECTION_PERMS = {
    overview: [], orders: ['orders'], support: ['orders'], exchange: ['orders'], customers: ['orders', 'marketing'], gifts: ['orders', 'marketing'],
    products: ['content'], categories: ['content'], promotions: ['content', 'marketing'], promocodes: ['content', 'marketing'],
    sections: ['content'], brand: ['content'], slider: ['content'], home: ['content'], pages: ['content'], menu: ['content'],
    bonus: ['marketing'], mail: ['mail'], analytics: ['finance', 'marketing'], finance: ['finance'],
    payment: ['payment'], push: [], staff: ['staff'], audit: ['staff'], settings: ['settings']
  };
  function can(perm) { return (DATA.perms || []).indexOf(perm) !== -1; }
  function canSection(key) { var need = SECTION_PERMS[key]; return !!need && (!need.length || need.some(can)); }
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
      case 'parcel': return parcelField(obj);
      case 'look': return lookField(d, obj);
      case 'images': case 'image': return '<div class="field" style="grid-column:1/-1"><span>' + esc(d.label) + '</span><div class="adm-imgs" data-imgs="' + d.k + '" data-single="' + (d.type === 'image' ? 1 : 0) + '"></div>' + hint + '</div>';
      default: return '<label class="field"' + cls + '><span>' + esc(d.label) + '</span><input class="input" id="' + id + '" data-k="' + d.k + '" value="' + esc(v == null ? '' : v) + '"' + (d.placeholder ? ' placeholder="' + esc(d.placeholder) + '"' : '') + '>' + hint + '</label>';
    }
  }
  function formHtml(defs, obj) { return '<div class="adm-form">' + defs.map(function (d) { return d.section ? '<h4 class="adm-sub">' + esc(d.section) + '</h4>' : fieldHtml(d, obj); }).join('') + '</div>'; }
  function readForm(box, defs, obj) {
    defs.forEach(function (d) {
      if (d.section) return;
      if (d.type === 'badges') { readBadges(box, obj); return; }
      if (d.type === 'parcel') { readParcel(box, obj); return; }
      if (d.type === 'look') { obj[d.k] = $$('[data-look="' + d.k + '"] input:checked', box).map(function (i) { return i.value; }); return; }
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


  /* --- Посылка для СДЭК: вес и размер (д × ш × в). Попадает в расчёт доставки и в отправление СДЭК --- */
  function cdekConf() { return (DATA.settings && DATA.settings.cdek) || {}; }
  function parcelField(p) {
    var b = Pricing.boxOf(p, cdekConf()) || {}, v = function (x) { return x ? String(x) : ''; };
    var f = function (k, val, unit, label, step) { return '<label class="pc-f"><small>' + label + '</small><span class="pc-in"><input class="input num" type="number" min="0" step="' + step + '" data-pc="' + k + '" value="' + esc(v(val)) + '" inputmode="numeric"><i>' + unit + '</i></span></label>'; };
    return '<div class="field pc" style="grid-column:1/-1" data-parcel><span>Посылка для СДЭК</span>' +
      '<div class="pc-row">' + f('weight', p.weight, 'г', 'Вес', 10) + '<span class="pc-gap"></span>' + f('length', b.length, 'см', 'Длина', 1) + '<span class="pc-x">×</span>' + f('width', b.width, 'см', 'Ширина', 1) + '<span class="pc-x">×</span>' + f('height', b.height, 'см', 'Высота', 1) + '</div>' +
      '<p class="pc-sum" data-pc-sum>' + parcelSum(p.weight, b) + '</p>' +
      '<small class="muted" style="font-size:13px">Вес и размер одной вещи в упаковке — как вы её отправляете. Эти данные уйдут в расчёт цены доставки и в отправление СДЭК. Если в заказе несколько вещей, они сложатся стопкой: высоты сложатся, вес тоже.</small></div>';
  }
  function parcelSum(w, b) {
    var c = cdekConf(), def = Pricing.cdekPacks(c), pk = def.find(function (x) { return x.id === c.defaultPack; }) || def[0];
    var hasBox = b && Number(b.length) > 0 && Number(b.width) > 0 && Number(b.height) > 0;
    var dims = hasBox ? b.length + '×' + b.width + '×' + b.height + ' см' : 'упаковка по умолчанию «' + pk.name + '» ' + pk.length + '×' + pk.width + '×' + pk.height + ' см';
    var wt = Number(w) > 0 ? Number(w) + ' г' : 'вес по умолчанию ' + (Number(c.pkg && c.pkg.weight) || 1000) + ' г';
    return '<b>В СДЭК уйдёт:</b> ' + dims + ', ' + wt;
  }
  function readParcel(box, p) {
    var g = function (k) { var el = $('[data-pc="' + k + '"]', box); return el ? Math.max(0, Math.round(Number(el.value) || 0)) : 0; };
    p.weight = g('weight');
    var b = { length: g('length'), width: g('width'), height: g('height') };
    if (b.length && b.width && b.height) p.box = b; else delete p.box;
    delete p.pack;
  }
  document.addEventListener('input', function (e) {
    var w = e.target.closest && e.target.closest('[data-parcel]'); if (!w) return;
    var g = function (k) { return Number($('[data-pc="' + k + '"]', w).value) || 0; };
    $('[data-pc-sum]', w).innerHTML = parcelSum(g('weight'), { length: g('length'), width: g('width'), height: g('height') });
  });

  /* --- «С этим носят»: крупные фото, поиск, до 4 вещей --- */
  function pImg(p) { var c = Pricing.colorsOf(p)[0]; return (c && c.images && c.images[0]) || Art.make(c && c.art); }
  function lookField(d, obj) {
    var sel = (obj[d.k] || []).slice(), max = d.max || 4;
    var list = DATA.products.filter(function (x) { return x.id !== obj.id; });
    list.sort(function (a, b) { var x = sel.indexOf(a.id), y = sel.indexOf(b.id); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
    var card = function (x) {
      var on = sel.indexOf(x.id) !== -1;
      return '<label class="lk-card' + (on ? ' on' : '') + (x.active === false ? ' off' : '') + '" data-q="' + esc((x.name + ' ' + (x.sku || '')).toLowerCase()) + '">' +
        '<input type="checkbox" value="' + esc(x.id) + '"' + (on ? ' checked' : '') + '>' +
        '<span class="lk-ph"><img src="' + esc(pImg(x)) + '" alt="" loading="lazy"><span class="lk-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' + (x.active === false ? '<span class="lk-hid">Скрыт</span>' : '') + '</span>' +
        '<span class="lk-name">' + esc(x.name) + '</span><span class="lk-meta">' + (x.sku ? esc(x.sku) + ' · ' : '') + fmt(x.price || 0) + '</span></label>';
    };
    return '<div class="field lk" style="grid-column:1/-1" data-look="' + d.k + '" data-max="' + max + '">' +
      '<div class="lk-head"><span>' + esc(d.label) + '</span><b class="lk-count">' + lookCount(sel.length, max) + '</b></div>' +
      (d.hint ? '<small class="muted" style="font-size:13px">' + esc(d.hint) + '</small>' : '') +
      '<input class="input lk-search" type="search" placeholder="Найти по названию или артикулу" aria-label="Поиск вещей">' +
      '<div class="lk-grid">' + (list.length ? list.map(card).join('') : '<span class="muted">Других товаров пока нет</span>') + '</div>' +
      '<p class="muted lk-none" hidden>Ничего не нашлось</p></div>';
  }
  function lookCount(n, max) { return n ? 'Выбрано ' + n + ' из ' + max : 'Ничего не выбрано'; }
  document.addEventListener('change', function (e) {
    var w = e.target.closest && e.target.closest('[data-look]'); if (!w || e.target.type !== 'checkbox') return;
    var max = Number(w.dataset.max) || 4, on = $$('input:checked', w);
    if (on.length > max) { e.target.checked = false; toast('Можно отметить до ' + max + ' вещей — снимите отметку с одной из выбранных', true); on = $$('input:checked', w); }
    e.target.closest('.lk-card').classList.toggle('on', e.target.checked);
    $('.lk-count', w).textContent = lookCount(on.length, max);
  });
  document.addEventListener('input', function (e) {
    if (!e.target.classList || !e.target.classList.contains('lk-search')) return;
    var w = e.target.closest('[data-look]'), q = e.target.value.trim().toLowerCase(), shown = 0;
    $$('.lk-card', w).forEach(function (c) { var ok = !q || c.dataset.q.indexOf(q) !== -1; c.hidden = !ok; if (ok) shown++; });
    $('.lk-none', w).hidden = shown > 0;
  });

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
      if (c.type === 'select') return '<select class="select" data-c="' + c.k + '" aria-label="' + esc(c.label) + '" title="' + esc(c.label) + '" style="flex:' + (c.flex || 1) + '">' + c.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + ((r[c.k] || c.options[0][0]) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
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
    }).filter(function (o) { return cols.some(function (c) { return c.type !== 'checkbox' && c.type !== 'number' && c.type !== 'select' && o[c.k]; }); });
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
    if (hash) window.ALB_NAV.go(hash);
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
    // «Письма», «Уведомления на почту» и «Сообщить о поступлении» теперь вкладки раздела «Почта» (13.48): старые ссылки ведут туда же
    if (q.s === 'notify') { q.s = 'mail'; q.sub = q.tab === 'letter' ? 'letter' : q.sub; q.tab = q.tab === 'mail' ? 'smtp' : 'notify'; }
    else if (q.s === 'alerts') { q.s = 'mail'; q.tab = 'alerts'; }
    // Без раздела в адресе — рабочий стол (13.63)
    var s = q.s && canSection(q.s) ? q.s : 'desk';
    q.s = s;
    var me = DATA.me || {};
    var link = function (k, label, extra) { return '<a href="#/admin?s=' + k + '"' + (k === s ? ' class="on"' : '') + '>' + secIcon(k) + '<span>' + label + '</span>' + (extra || '') + '</a>'; };
    v.innerHTML = '<div class="adm' + (s === 'desk' ? ' adm-on-desk' : '') + '"><aside class="adm-side"><div class="adm-brand"><span class="eyebrow">Управление</span><b class="serif">' + esc(A().D.settings.storeName) + '</b></div><nav>' +
      '<a href="#/admin"' + (s === 'desk' ? ' class="on"' : '') + '>' + secIcon('home') + '<span>Рабочий стол</span></a>' +
      GROUPS.map(function (g) {
        var list = g[2].filter(canSection); if (!list.length) return '';
        return '<span class="adm-nav-h">' + g[0] + '</span>' + list.map(function (k) { return link(k, secTitle(k), k === 'orders' ? newOrdersBadge() : k === 'support' && DATA.supportNew ? ' <span class="adm-badge">' + DATA.supportNew + '</span>' : k === 'mail' ? waitBadge() : k === 'exchange' ? reqBadge() : ''); }).join('');
      }).join('') +
      '</nav><div class="adm-me"><b>' + esc([me.firstName, me.lastName].filter(Boolean).join(' ')) + '</b><span>' + esc(DATA.roleName || '') + '</span></div>' +
      '<div class="adm-side-foot"><a href="#/" class="muted">← В магазин</a><button class="muted" id="admOut">Выйти из аккаунта</button></div></aside><section class="adm-main">' +
      (s !== 'desk' ? '<a class="adm-back" href="#/admin">' + secIcon('home') + 'Рабочий стол</a>' : '') + '<div id="admMain"></div></section></div>';
    $('#admOut').addEventListener('click', async function () { await API.logout(); DATA = null; window.ALB_NAV.go('#/'); await A().refresh(); });
    var main = $('#admMain');
    var fn = { desk: desk, overview: overview, orders: orders, support: supportSection, products: products, categories: categories, promotions: promotions, promocodes: promocodes, bonus: bonusSection, exchange: exchangeSection, customers: customers,  mail: mailHub, push: pushSection, staff: staffSection, audit: auditSection,  analytics: analyticsSection, finance: financeSection, gifts: giftsSection, sections: sectionsSettings, brand: brandSection, slider: sliderSection, home: homeSettings, pages: pages, menu: menuSettings, payment: paymentSettings, settings: generalSettings }[s] || overview;
    fn(main, q);
  }
  /* ================= Рабочий стол (13.63): сводка дня, ежедневное — карточками, остальное — значками ================= */
  function desk(m) {
    var o = DATA.orders, today = new Date().toDateString();
    var todayList = o.filter(function (x) { return new Date(x.createdAt).toDateString() === today && x.status !== 'canceled'; });
    var newN = o.filter(function (x) { return x.status === 'new'; }).length, shipN = o.filter(function (x) { return x.status === 'shipped'; }).length;
    var reqN = allRequests().filter(function (x) { return x.r.status === 'new' || x.r.status === 'received'; }).length;
    var waitN = (DATA.waitlist || []).filter(function (w) { return w.status === 'waiting'; }).length;
    var supN = DATA.supportNew || 0;
    var me = DATA.me || {};
    var work = [
      ['orders', 'Заказы', newN ? newN + ' ' + plural(newN, 'новый', 'новых', 'новых') : 'новых нет', newN],
      ['support', 'Поддержка', supN ? supN + ' ' + plural(supN, 'вопрос', 'вопроса', 'вопросов') : 'вопросов нет', supN],
      ['products', 'Товары', waitN ? waitN + ' ждут поступления' : DATA.products.filter(function (p) { return p.active !== false; }).length + ' в продаже', waitN],
      ['exchange', 'Обмен и возврат', reqN ? reqN + ' ' + plural(reqN, 'заявка', 'заявки', 'заявок') : 'заявок нет', reqN]
    ].filter(function (x) { return canSection(x[0]); });
    var rest = [];
    GROUPS.forEach(function (g) { g[2].forEach(function (k) { if (canSection(k) && !work.some(function (w) { return w[0] === k; })) rest.push([k, g[1]]); }); });
    m.innerHTML = '<div class="desk">' +
      '<div class="desk-top"><div><span class="eyebrow">' + esc(DATA.roleName || 'Управление') + '</span><h1>Панель управления</h1></div>' +
        '<label class="desk-find">' + secIcon('search') + '<input type="search" id="deskFind" placeholder="Найти раздел" autocomplete="off"></label></div>' +
      (can('orders') ? '<a class="desk-sum" href="#/admin?s=orders"><span class="desk-sum-h"><b>Сегодня</b><small>' + esc([me.firstName, me.lastName].filter(Boolean).join(' ')) + '</small></span>' +
        '<span class="desk-kpi"><span><b class="num">' + todayList.length + '</b><small>' + plural(todayList.length, 'заказ', 'заказа', 'заказов') + ' · ' + fmt(todayList.reduce(function (sm, x) { return sm + x.total; }, 0)) + '</small></span>' +
        '<span><b class="num">' + newN + '</b><small>новых, ждут сборки</small></span><span><b class="num">' + shipN + '</b><small>в пути у СДЭК</small></span></span></a>' : '') +
      ((DATA.problems || []).length ? '<div class="adm-alert site-prob"><b>Состояние сайта: нужно внимание</b>' + DATA.problems.map(function (x) { return '<span>' + esc(x.title) + ' — ' + esc(x.text) + '</span>'; }).join('') + '</div>' : '') +
      (work.length ? '<div class="desk-work">' + work.map(function (w) { return '<a class="desk-card" href="#/admin?s=' + w[0] + '" data-find="' + esc(w[1].toLowerCase()) + '"><span class="desk-ic g-sales">' + secIcon(w[0]) + '</span><b>' + w[1] + '</b><small>' + w[2] + '</small>' + (w[3] ? '<i class="desk-n">' + w[3] + '</i>' : '') + '</a>'; }).join('') + '</div>' : '') +
      '<div class="desk-h">Все разделы</div><div class="desk-all">' + rest.map(function (x) { var t = SHORT[x[0]] || secTitle(x[0]); return '<a href="#/admin?s=' + x[0] + '" data-find="' + esc((t + ' ' + secTitle(x[0])).toLowerCase()) + '"><span class="desk-ic ' + x[1] + '">' + secIcon(x[0]) + '</span><span>' + esc(t) + '</span></a>'; }).join('') + '</div>' +
      '<p class="desk-none" id="deskNone" hidden>Такого раздела нет</p>' +
    '</div>';
    $('#deskFind', m).addEventListener('input', function () {
      var t = this.value.trim().toLowerCase(), any = false;
      $$('[data-find]', m).forEach(function (a) { var on = !t || a.getAttribute('data-find').indexOf(t) !== -1; a.hidden = !on; any = any || on; });
      $('#deskNone', m).hidden = any;
    });
  }
  function waitBadge() { var n = (DATA.waitlist || []).filter(function (w) { return w.status === 'waiting' || w.status === 'failed'; }).length; return n ? ' <span class="adm-badge muted-badge">' + n + '</span>' : ''; }
  function newOrdersBadge() { var n = DATA.orders.filter(function (o) { return o.status === 'new'; }).length; return n ? ' <span class="adm-badge">' + n + '</span>' : ''; }
  /* ================= Письма: все письма сайта с примером ================= */
  /* ================= Сотрудники (13.57): владелец выдаёт роли аккаунтам покупателей ================= */
  var ROLE_INFO = {
    manager: ['Управляющий', 'Всё, кроме сотрудников, оплаты, ключей и общих настроек'],
    orders: ['Менеджер заказов', 'Заказы, отправки СДЭК, обмены и возвраты, поддержка, покупатели, сертификаты, почта'],
    content: ['Контент-менеджер', 'Товары, категории, размеры, акции, промокоды, слайдер, главная, страницы, меню'],
    finance: ['Финансы', 'Финансы и аналитика']
  };
  async function staffSection(m) {
    m.innerHTML = head('Сотрудники', '', 'Сотрудник входит в панель своим аккаунтом на сайте — отдельных паролей нет. Выдайте роль по номеру телефона: человек должен быть уже зарегистрирован. Забрать доступ можно в любой момент.') + '<div class="loader">…</div>';
    var list = [];
    try { list = await A().API.adminStaff('GET'); } catch (e) { m.querySelector('.loader').outerHTML = '<p class="form-error">' + esc(A().errMsg(e)) + '</p>'; return; }
    var roleSel = function (cur, id) { return '<select class="select st-role"' + (id ? ' data-role="' + esc(id) + '"' : ' id="stRole"') + ' aria-label="Роль">' + Object.keys(ROLE_INFO).map(function (r) { return '<option value="' + r + '"' + (r === cur ? ' selected' : '') + '>' + ROLE_INFO[r][0] + '</option>'; }).join('') + '</select>'; };
    var initials = function (n) { return String(n || '?').split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase(); };
    m.lastElementChild.outerHTML =
      '<div class="adm-card st-add"><h3 class="adm-h3">Выдать доступ</h3><div class="st-form"><label class="field"><span>Телефон аккаунта</span><input class="input" id="stPhone" type="tel" inputmode="tel" placeholder="+7 (900) 000-00-00"></label>' +
        '<label class="field"><span>Роль</span>' + roleSel('orders') + '</label><button class="btn" id="stAdd" type="button">Выдать</button></div><p class="form-error" id="stErr"></p></div>' +
      '<div class="st-list">' + list.map(function (x) {
        return '<div class="st-row' + (x.owner ? ' owner' : '') + '"><span class="st-ava">' + esc(initials(x.name)) + '</span><div class="st-who"><b>' + esc(x.name || 'Без имени') + '</b><small>' + esc(A().fmtPhone(x.phone)) + (x.email ? ' · ' + esc(x.email) : '') + '</small></div>' +
          (x.owner ? '<span class="st-badge">Владелец</span>' : roleSel(x.role, x.userId) + '<button class="btn ghost sm st-del" type="button" data-del="' + esc(x.userId) + '">Забрать доступ</button>') + '</div>';
      }).join('') + '</div>' +
      '<div class="adm-card st-roles"><h3 class="adm-h3">Что может каждая роль</h3><div class="st-rl"><div><b>Владелец</b><span>Всё, включая сотрудников, оплату, ключи и общие настройки</span></div>' +
        Object.keys(ROLE_INFO).map(function (r) { return '<div><b>' + ROLE_INFO[r][0] + '</b><span>' + ROLE_INFO[r][1] + '</span></div>'; }).join('') + '</div></div>';
    $('#stAdd', m).addEventListener('click', async function (e) {
      var b = e.currentTarget, err = $('#stErr', m); err.textContent = '';
      var ph = $('#stPhone', m).value.replace(/\D/g, ''); if (ph.length < 10) { err.textContent = 'Укажите номер телефона полностью'; return; }
      b.disabled = true;
      try { await A().API.adminStaff('POST', null, { phone: ph, role: $('#stRole', m).value }); toast('Доступ выдан — человек увидит «Панель управления» в меню, когда войдёт в аккаунт'); staffSection(m); }
      catch (ex) { err.textContent = A().errMsg(ex); b.disabled = false; }
    });
    $$('[data-role]', m).forEach(function (sel) { sel.addEventListener('change', async function () {
      try { await A().API.adminStaff('PUT', sel.getAttribute('data-role'), { role: sel.value }); toast('Роль изменена: ' + ROLE_INFO[sel.value][0]); } catch (ex) { toast(A().errMsg(ex), true); }
    }); });
    $$('[data-del]', m).forEach(function (b) { bindConfirm(b, async function () {
      try { await A().API.adminStaff('DELETE', b.getAttribute('data-del')); toast('Доступ забран'); staffSection(m); } catch (ex) { toast(A().errMsg(ex), true); }
    }); });
  }

  /* ================= Почта (13.48): письма покупателям, уведомления владельцу, «Сообщить о поступлении», подключение ================= */
  var MAIL_TABS = [['letters', 'Письма покупателям'], ['alerts', 'Уведомления мне'], ['notify', 'Сообщить о поступлении'], ['smtp', 'Подключение']];
  async function mailHub(m, q) {
    var tabs = MAIL_TABS.filter(function (t) { return t[0] !== 'smtp' || can('payment'); });
    var tab = tabs.some(function (t) { return t[0] === q.tab; }) ? q.tab : 'letters';
    m.innerHTML = head('Почта', '', 'Всё, что сайт отправляет письмами: покупателям, вам и тем, кто ждёт размер.') + '<div class="loader">…</div>';
    var mail = { ready: false };
    try { mail = (await A().API.adminMail()).mail; } catch (e) {}
    var st = DATA.settings, on = Object.assign({ email: '', events: {} }, st.ownerNotify || {}), ev = Object.assign({ order: true, support: true, stock: true }, on.events);
    var evN = ['order', 'support', 'stock'].filter(function (k) { return ev[k] !== false; }).length;
    var ownerTo = on.email || (st.contacts || {}).email || '';
    var tpl = Mail.tplOf(st), wl = DATA.waitlist || [], waiting = wl.filter(function (w) { return w.status === 'waiting' || w.status === 'failed'; }).length;
    var card = function (key, label, state, cls, sub) {
      return '<a class="mh-card' + (tab === key ? ' on' : '') + '" href="#/admin?s=mail&tab=' + key + '"><span class="mh-eb">' + label + '</span><b><span class="status ' + cls + '">' + state + '</span></b><small>' + sub + '</small></a>';
    };
    m.innerHTML = head('Почта', '', 'Всё, что сайт отправляет письмами: покупателям, вам и тем, кто ждёт размер. Письма уходят с вашего почтового ящика — он подключается один раз.') +
      (mail.ready ? '' : '<div class="adm-alert mh-alert"><div><b>Почта не подключена — ни одно письмо не уходит.</b> Покупатели не получают подтверждение заказа и трек-номер, вы не узнаёте о новых заказах.</div><a class="btn sm" href="#/admin?s=mail&tab=smtp">Подключить почту</a></div>') +
      '<div class="mh-cards">' +
        card('smtp', 'Почта для отправки', mail.ready ? 'Подключена' : 'Не подключена', mail.ready ? 'done' : 'canceled', mail.ready ? esc(mail.fromEmail || '') : 'письма не отправляются') +
        card('alerts', 'Уведомления мне', evN ? 'Включены' : 'Выключены', evN ? 'done' : 'canceled', ownerTo ? evN + ' из 3 · на ' + esc(ownerTo) : 'укажите почту') +
        card('notify', 'Сообщить о поступлении', tpl.enabled ? 'Кнопка включена' : 'Кнопка выключена', tpl.enabled ? 'done' : 'canceled', waiting ? 'ждут ' + waiting + ' ' + plural(waiting, 'покупатель', 'покупателя', 'покупателей') : 'заявок нет') +
      '</div>' +
      '<div class="tabs adm-tabs mh-tabs">' + tabs.map(function (t) {
        var badge = t[0] === 'notify' && waiting ? ' <span class="adm-badge">' + waiting + '</span>' : t[0] === 'smtp' && !mail.ready ? ' <span class="mh-dot" aria-label="не подключена"></span>' : '';
        return '<a href="#/admin?s=mail&tab=' + t[0] + '"' + (tab === t[0] ? ' class="on"' : '') + '>' + t[1] + badge + '</a>';
      }).join('') + '</div><div id="mhBody" class="mh-body"></div>';
    var body = $('#mhBody', m);
    if (tab === 'alerts') return alertsPanel(body);
    if (tab === 'notify') return notifyPanel(body, q, mail);
    if (tab === 'smtp') return mailTab(body, mail);
    return mailLetters(body);
  }
  async function mailLetters(m) {
    m.innerHTML = '<p class="mh-lead">Все письма, которые сайт отправляет сам. Покупателям они приходят с адреса для отправки и с пометкой «отвечать не нужно» — написать вам можно на почту для связи. Откройте любое письмо, чтобы посмотреть, как его видит покупатель.</p>' + '<div class="loader">…</div>';
    var r; try { r = await A().API.adminMailCatalog(); } catch (e) { m.querySelector('.loader').outerHTML = '<p class="form-error">' + esc(A().errMsg(e)) + '</p>'; return; }
    var mi = r.mail;
    m.innerHTML = '<p class="mh-lead">Все письма, которые сайт отправляет сам. Покупателям они приходят с адреса для отправки и с пометкой «отвечать не нужно» — написать вам можно на почту для связи. Откройте любое письмо, чтобы посмотреть, как его видит покупатель.</p>' +
      '<div class="ml-top">' +
        '<div class="ml-a"><span>Отправитель</span><b>' + esc(mi.fromName || '') + ' &lt;' + esc(mi.from || '—') + '&gt;</b><small class="' + (mi.ready ? 'ok' : 'warn') + '">' + (mi.ready ? 'Почта настроена, письма уходят' : 'Не настроена — письма не отправляются') + '</small></div>' +
        '<div class="ml-a"><span>Пишут вам и получают ответ</span><b>' + esc(mi.support || mi.replyTo || '—') + '</b><small>Указан в письмах; меняется в «Меню, контакты, соцсети»</small></div>' +
        '<div class="ml-a"><span>Если покупатель всё же ответит</span><b>' + esc(mi.replyTo || '—') + '</b><small>Ответ уйдёт сюда (Reply-To). <a class="link" href="#/admin?s=mail&tab=smtp">Подключение почты</a></small></div>' +
      '</div>' +
      '<div class="ml-list">' + r.letters.map(function (x, i) {
        return '<div class="ml-i" data-i="' + i + '"><div class="ml-h"><span class="ml-n">' + (i + 1) + '</span><div><b>' + esc(x.title) + '</b><small>' + esc(x.when) + '</small></div><span class="ml-to">' + esc(x.to) + '</span></div>' +
          '<div class="ml-subj"><span>Тема</span>' + esc(x.subject) + '</div>' +
          '<div class="ml-acts"><button class="btn ghost sm" type="button" data-ml-view>Посмотреть письмо</button><span class="ml-send"><input class="input" type="email" value="' + esc(mi.support || '') + '" aria-label="Почта для примера"><button class="link" type="button" data-ml-send>Отправить пример</button></span><span class="ml-st"></span></div>' +
          '<div class="ml-prev" hidden></div></div>';
      }).join('') + '</div>';
    m.addEventListener('click', async function (e) {
      var it = e.target.closest('.ml-i'); if (!it) return; var x = r.letters[Number(it.dataset.i)];
      if (e.target.closest('[data-ml-view]')) {
        var pv = $('.ml-prev', it), b = e.target.closest('[data-ml-view]');
        if (pv.hidden && !pv.firstChild) { var f = document.createElement('iframe'); f.title = x.title; f.setAttribute('sandbox', 'allow-same-origin'); f.srcdoc = x.html; pv.appendChild(f); f.addEventListener('load', function () { try { f.style.height = (f.contentDocument.documentElement.scrollHeight + 10) + 'px'; } catch (er) { f.style.height = '900px'; } }); }
        pv.hidden = !pv.hidden; b.textContent = pv.hidden ? 'Посмотреть письмо' : 'Скрыть';
      }
      if (e.target.closest('[data-ml-send]')) {
        var st = $('.ml-st', it), to = $('.ml-send input', it).value.trim(); if (!to) { st.textContent = 'Укажите почту'; st.className = 'ml-st warn'; return; }
        st.textContent = 'Отправляем…'; st.className = 'ml-st';
        try { var s = await A().API.adminMailCatalog({ key: x.key, to: to }); st.textContent = 'Отправлено на ' + s.sent; st.className = 'ml-st ok'; } catch (er) { st.textContent = A().errMsg(er); st.className = 'ml-st warn'; }
      }
    });
  }
  function head(title, actions, sub) { return '<div class="adm-head"><div><h1 class="serif">' + esc(title) + '</h1>' + (sub ? '<p class="muted" style="margin-top:6px;font-size:14px;max-width:70ch">' + sub + '</p>' : '') + '</div><div class="adm-actions">' + (actions || '') + '</div></div>'; }

  // Панель открывается из личного кабинета: отдельного пароля нет. Сюда попадают, если доступ забрали или вход закончился
  function loginView(v) {
    var u = A().API.user;
    v.innerHTML = '<div class="wrap"><div class="empty" style="padding:96px 0"><span class="eyebrow">Панель управления</span><h3>' + (u ? 'Нет доступа' : 'Войдите в аккаунт') + '</h3>' +
      '<p>' + (u ? 'У аккаунта ' + esc(u.firstName || '') + ' нет доступа к панели. Доступ выдаёт владелец магазина в разделе «Сотрудники».' : 'Панель управления открывается из личного кабинета — войдите аккаунтом владельца или сотрудника.') + '</p>' +
      '<div class="empty-acts">' + (u ? '<a class="btn" href="#/">В магазин</a>' : '<a class="btn" href="#/account?back=admin">Войти</a>') + '</div></div></div>';
  }

  /* ================= Обзор ================= */
  function overview(m) {
    var o = DATA.orders, today = new Date().toDateString();
    var active = o.filter(function (x) { return x.status !== 'canceled' && x.status !== 'returned'; });
    var revenue = o.filter(function (x) { return x.status !== 'canceled'; }).reduce(function (s, x) { return s + x.total - (x.refunded || 0); }, 0); // возвраты вычитаются
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
      ((DATA.problems || []).length ? '<div class="adm-alert site-prob"><b>Состояние сайта: нужно внимание</b>' + DATA.problems.map(function (x) { return '<span>' + esc(x.title) + ' — ' + esc(x.text) + '</span>'; }).join('') + '</div>' : '') +
      (legalBad ? '<div class="adm-alert"><b>Укажите реквизиты продавца.</b> Они подставляются в публичную оферту, политику обработки персональных данных и согласие. Сейчас там: «' + esc(legal || 'пусто') + '». <a class="link" href="#/admin?s=settings">Открыть настройки</a></div>' : '') +
      '<div class="adm-stats">' +
        stat('Новые заказы', newN, '#/admin?s=orders&f=new') + stat('Заказов сегодня', todayN, '#/admin?s=orders') + stat('Выручка, всего', fmt(revenue), '#/admin?s=orders') + stat('Покупателей', DATA.users.length, '#/admin?s=customers') +
        stat('Товаров в продаже', DATA.products.filter(function (p) { return p.active !== false; }).length, '#/admin?s=products') + stat('Активных акций', promosActive, '#/admin?s=promotions') + stat('Активных промокодов', codesActive, '#/admin?s=promocodes') +
      '</div>' +
      (function () { var t = sumDays(statDays(7)); return '<a class="adm-card an-mini" href="#/admin?s=analytics"><div><span class="adm-h3">Посетители за 7 дней</span><b class="num">' + t.v.toLocaleString('ru-RU') + '</b><small class="an-pv">' + t.pv.toLocaleString('ru-RU') + ' ' + plural(t.pv, 'просмотр', 'просмотра', 'просмотров') + ' страниц</small></div><div><span class="adm-h3">Конверсия в заказ</span><b>' + pct(t.o, t.v) + '</b></div><div class="an-mini-f">' + funnelHtml(t) + '</div><span class="an-more">Подробнее →</span></a>'; })() +
      '<div class="adm-two"><div class="adm-card"><h3 class="adm-h3">Последние заказы</h3>' + (o.length ? ordersTable(o.slice().reverse().slice(0, 6)) : '<p class="muted">Заказов пока нет.</p>') + '</div>' +
      '<div class="adm-card"><h3 class="adm-h3">Заканчиваются</h3>' + (low.length ? '<div class="adm-list">' + low.slice(0, 10).map(function (x) { return '<a href="#/admin?s=products&id=' + esc(x.p.id) + '" class="adm-li"><span>' + esc(x.p.name) + ' <span class="muted">· ' + esc(x.c.name) + ' · ' + esc(x.s.size) + '</span></span><span class="num ' + (x.s.stock ? 'warn' : 'bad') + '">' + x.s.stock + ' шт.</span></a>'; }).join('') + '</div>' : '<p class="muted">Все размеры в наличии.</p>') + '</div></div>';
  }
  function stat(label, val, href) { return '<a class="adm-stat" href="' + href + '"><span class="eyebrow">' + esc(label) + '</span><b class="num">' + esc(val) + '</b></a>'; }

  /* ================= Заказы ================= */
  function ordersTable(list) {
    var pick = !!A().D.cdekReady;
    return '<div class="table-wrap adm-table"><table class="sizes' + (pick ? ' o-pickable' : '') + '"><thead><tr>' + (pick ? '<th class="adm-pick"><input type="checkbox" id="oPickAll" aria-label="Выбрать все"></th>' : '') + '<th>№</th><th>Дата</th><th>Покупатель</th><th>Сумма</th><th>Оплата</th><th>Статус</th></tr></thead><tbody>' +
      list.map(function (o) {
        var ret = o.status === 'returned';
        return '<tr data-href="#/admin?s=orders&id=' + esc(o.id) + '"' + (ret ? ' class="row-returned"' : '') + '>' + (pick ? '<td class="adm-pick"><input type="checkbox" data-opick="' + esc(o.id) + '" aria-label="Выбрать заказ ' + esc(o.number) + '"></td>' : '') + '<td>' + esc(o.number) + (o.cdek && o.cdek.number ? '<span class="o-cdek" title="Отправление СДЭК">СДЭК ' + esc(o.cdek.number) + '</span>' : '') + (o.refunds && o.refunds.length ? '<span class="rf-tag">' + (ret ? 'Возврат' : 'Частичный возврат') + '</span>' : '') + '</td><td>' + esc(new Date(o.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '</td><td>' + esc(o.customer.firstName + ' ' + o.customer.lastName) + '</td><td class="num">' + (o.refunded ? '<s class="muted">' + fmt(o.total) + '</s><br><span class="rf-back">−' + fmt(o.refunded) + '</span>' : fmt(o.total)) + '</td>' +
          '<td><span class="status ' + esc(o.refunded ? 'refunded' : o.payment.status) + '">' + esc(payText(o)) + '</span></td><td><span class="status ' + esc(o.status) + '">' + esc(A().STATUS[o.status]) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function payText(o) {
    if (o.payment.method === 'exchange') return 'Обмен';
    if (o.payment.method === 'bonus') return 'Бонусами';
    if (o.payment.method === 'gift') return 'Сертификатом';
    if (o.payment.method === 'cod' && o.payment.status === 'pending') return 'При получении';
    if (o.payment.status === 'paid' && o.refunded) return 'Частичный возврат';
    return A().PAY[o.payment.status];
  }
  function orders(m, q) {
    if (q.id) return orderDetail(m, q.id);
    var f = q.f || 'all', search = (q.q || '').toLowerCase();
    var list = DATA.orders.slice().reverse().filter(function (o) {
      if (f === 'ship' ? !readyShip(o) : f === 'refund' ? !(o.refunds && o.refunds.length) : f !== 'all' && o.status !== f) return false;
      if (search) { var t = [o.number, o.customer.firstName, o.customer.lastName, o.customer.email, o.customer.phone, A().fmtPhone(o.customer.phone), o.payment.providerId || ''].join(' ').toLowerCase(); if (t.indexOf(search) === -1) return false; }
      return true;
    });
    // Фильтр по статусу: число заказов крупно, подпись под ним, цветная точка статуса
    var F = [['all', 'Все заказы']].concat(A().D.cdekReady ? [['ship', 'Готовы к отправке']] : [], [['new', 'Новые'], ['processing', 'Собираются'], ['shipped', 'В доставке'], ['done', 'Выполнены'], ['canceled', 'Отменены'], ['refund', 'Возвраты']]);
    var cnt = function (k) { return k === 'all' ? DATA.orders.length : k === 'ship' ? DATA.orders.filter(readyShip).length : k === 'refund' ? DATA.orders.filter(function (o) { return o.refunds && o.refunds.length; }).length : DATA.orders.filter(function (o) { return o.status === k; }).length; };
    var tabs = '<nav class="ost" aria-label="Статус заказов">' + F.map(function (x) {
      var n = cnt(x[0]);
      return '<a class="ost-i s-' + x[0] + (f === x[0] ? ' on' : '') + (n ? '' : ' zero') + '" href="#/admin?s=orders&f=' + x[0] + (q.q ? '&q=' + encodeURIComponent(q.q) : '') + '"' + (f === x[0] ? ' aria-current="page"' : '') + '>' +
        '<b class="num">' + n + '</b><span>' + (x[0] === 'all' ? '' : '<i aria-hidden="true"></i>') + x[1] + '</span></a>';
    }).join('') + '</nav>';
    var test = DATA.testOrders ? '<div class="ost-test"><span>Тестовые заказы скрыты и не считаются: ' + DATA.testOrders + '</span><button class="link" type="button" id="delTest">Удалить их</button></div>' : '';
    var emptyTxt = f === 'all' && !search ? ['Заказов пока нет', 'Они появятся здесь сразу после оформления на сайте.'] : ['Ничего не нашлось', search ? 'Проверьте номер заказа, имя, телефон, почту или номер платежа ЮKassa.' : 'В этом статусе заказов нет.'];
    m.innerHTML = head('Заказы', '<input class="input" id="oSearch" type="search" placeholder="Номер, имя, телефон, почта" value="' + esc(q.q || '') + '" style="min-height:42px;width:280px" aria-label="Поиск заказа">') +
      tabs + test + intakesHtml() +
      (list.length ? ordersTable(list) : '<div class="empty"><h3>' + emptyTxt[0] + '</h3><p>' + emptyTxt[1] + '</p></div>') +
      (A().D.cdekReady ? '<div class="o-bar" id="oBar" hidden><span class="o-bar-n" id="oBarN"></span><div class="o-bar-acts"><button class="btn sm" type="button" id="obCreate">Создать отправления</button><button class="btn ghost sm" type="button" data-obprint="barcode">Наклейки PDF</button><button class="btn ghost sm" type="button" data-obprint="waybill">Накладные PDF</button><button class="btn ghost sm" type="button" id="obIntake">Вызвать курьера</button><button class="link" type="button" id="obClear">Снять выбор</button></div></div>' : '');
    if (A().D.cdekReady) bindOrderBatch(m);
    if ($('#delTest')) bindConfirm($('#delTest'), async function () {
      try { var r = await A().API.adminOrderDelete('test'); await afterSave('Удалено тестовых заказов: ' + r.deleted, '#/admin?s=orders'); } catch (e) { toast(A().errMsg(e), true); }
    });
    var si = $('#oSearch'); si.addEventListener('change', function () { window.ALB_NAV.go('#/admin?s=orders&f=' + f + '&q=' + encodeURIComponent(si.value)); });
  }
  /* ---------- СДЭК пачкой: отправления, печать одним PDF, вызов курьера ---------- */
  // Готов к отправке: доставка СДЭК, отправления ещё нет, оплачен (или оплата при получении), не отменён
  function readyShip(o) { return useCdek(o) && !o.cdek && ['new', 'processing'].indexOf(o.status) !== -1 && (o.payment.method !== 'online' || o.payment.status === 'paid'); }
  function hasShip(o) { return !!(o.cdek && o.cdek.uuid) && ['canceled', 'returned'].indexOf(o.status) === -1; }
  function intakesHtml() {
    var today = new Date().toISOString().slice(0, 10), list = (DATA.intakes || []).filter(function (x) { return x.date >= today && x.status !== 'REMOVED'; });
    if (!list.length) return '';
    return '<div class="o-intakes">' + list.map(function (x) { return '<div class="o-intake"><span class="o-intake-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17.5" cy="17.5" r="1.6"/></svg></span><div><b>Курьер СДЭК ' + esc(x.date.split('-').reverse().slice(0, 2).join('.')) + ', ' + esc(x.from) + '–' + esc(x.to) + '</b><small>' + (x.number ? 'Заявка № ' + esc(x.number) + ' · ' : '') + esc(x.statusName || '') + ' · ' + x.orders.length + ' ' + plural(x.orders.length, 'посылка', 'посылки', 'посылок') + ' · ' + esc(x.address) + '</small></div><button type="button" class="link" data-iksync="' + esc(x.id) + '">Обновить</button><button type="button" class="link" data-ikdel="' + esc(x.id) + '">Отменить</button></div>'; }).join('') + '</div>';
  }
  function pickedIds(m) { return $$('[data-opick]:checked', m).map(function (i) { return i.getAttribute('data-opick'); }); }
  function bindOrderBatch(m) {
    var bar = $('#oBar'), all = $('#oPickAll');
    function upd() {
      var ids = pickedIds(m), os = ids.map(function (id) { return DATA.orders.find(function (o) { return o.id === id; }); }).filter(Boolean);
      var ready = os.filter(readyShip).length, shipped = os.filter(hasShip).length;
      bar.hidden = !ids.length;
      $('#oBarN').innerHTML = 'Выбрано <b>' + ids.length + '</b>' + (ready ? ' · к отправке ' + ready : '') + (shipped ? ' · с отправлением ' + shipped : '');
      $('#obCreate').disabled = !ready; $('#obCreate').textContent = ready ? 'Создать отправления · ' + ready : 'Создать отправления';
      $$('[data-obprint]').forEach(function (b) { b.disabled = !shipped; }); $('#obIntake').disabled = !shipped;
      if (all) { var boxes = $$('[data-opick]', m); all.checked = boxes.length && boxes.every(function (b) { return b.checked; }); all.indeterminate = !all.checked && ids.length > 0; }
    }
    $$('[data-opick]', m).forEach(function (b) { b.addEventListener('change', upd); });
    if (all) all.addEventListener('change', function () { $$('[data-opick]', m).forEach(function (b) { b.checked = all.checked; }); upd(); });
    $('#obClear').addEventListener('click', function () { $$('[data-opick]', m).forEach(function (b) { b.checked = false; }); upd(); });
    $('#obCreate').addEventListener('click', function () { batchCreate(pickedIds(m)); });
    $('#obIntake').addEventListener('click', function () { intakeModal(pickedIds(m)); });
    $$('[data-obprint]').forEach(function (b) { b.addEventListener('click', function () { batchPrint(pickedIds(m).filter(function (id) { return hasShip(DATA.orders.find(function (o) { return o.id === id; }) || {}); }), b.getAttribute('data-obprint'), b); }); });
    $$('[data-iksync]', m).forEach(function (b) { b.addEventListener('click', async function () { try { await A().API.adminPost('cdek-intake/' + b.getAttribute('data-iksync') + '/sync'); await afterSave('Статус заявки обновлён'); } catch (e) { toast(A().errMsg(e), true); } }); });
    $$('[data-ikdel]', m).forEach(function (b) { bindConfirm(b, async function () { try { await call('DELETE', 'cdek-intake/' + b.getAttribute('data-ikdel')); await afterSave('Заявка на курьера отменена'); } catch (e) { toast(A().errMsg(e), true); } }); });
    upd();
  }
  // Создание отправлений по очереди: прогресс по каждому заказу, ошибка одного не мешает остальным
  function batchCreate(ids) {
    var os = ids.map(function (id) { return DATA.orders.find(function (o) { return o.id === id; }); }).filter(function (o) { return o && readyShip(o); });
    if (!os.length) return;
    var sp = (DATA.settings.cdek || {}).shipmentPoint;
    var pk = function (o) { return Pricing.parcelFor(o.items.map(function (i) { return { productId: i.productId, qty: i.qty - (i.refundedQty || 0) }; }), DATA.products, DATA.settings.cdek || {}); };
    A().openModal('<div class="ob"><span class="eyebrow">СДЭК</span><h3 class="serif" style="font-size:32px;margin:12px 0 6px">Отправления: ' + os.length + '</h3><p class="muted" style="font-size:14px;margin-bottom:16px">Посылки сдаёте в ' + esc(sp ? sp.address : 'пункт отгрузки (укажите его в «Оплата и доставка»)') + '. Упаковка и вес — по карточкам товаров, как при создании по одному.</p>' +
      '<div class="ob-list">' + os.map(function (o) { var p = pk(o); return '<div class="ob-row" data-obrow="' + esc(o.id) + '"><span class="ob-st" aria-hidden="true"></span><div><b>№ ' + esc(o.number) + ' · ' + esc(o.customer.firstName + ' ' + o.customer.lastName) + '</b><small>' + esc(p.pack) + ', ' + p.weight + ' г · ' + esc((o.delivery.pvz && o.delivery.pvz.address) || (o.delivery.door && o.delivery.door.address) || o.delivery.address || '') + '</small><em class="ob-msg"></em></div></div>'; }).join('') + '</div>' +
      '<p class="form-error" id="obErr"></p><div class="ob-acts"><button class="btn block" type="button" id="obGo"' + (sp ? '' : ' disabled') + '>Создать ' + os.length + ' ' + plural(os.length, 'отправление', 'отправления', 'отправлений') + '</button></div></div>');
    $('#obGo').addEventListener('click', async function () {
      var b = this; b.disabled = true; var ok = [], bad = 0;
      for (var i = 0; i < os.length; i++) {
        var o = os[i], row = $('[data-obrow="' + o.id + '"]'), p = pk(o);
        row.classList.add('run'); $('.ob-msg', row).textContent = 'Создаём…'; b.textContent = 'Создаём ' + (i + 1) + ' из ' + os.length + '…';
        try { var n = await A().API.adminCdekOrder(o.id, 'POST', 'cdek', { pkg: { weight: p.weight, length: p.length, width: p.width, height: p.height } }); ok.push(o.id); row.className = 'ob-row ok'; $('.ob-msg', row).textContent = 'Создано' + (n && n.cdek && n.cdek.number ? ' · СДЭК ' + n.cdek.number : ' · номер присваивается'); }
        catch (e) { bad++; row.className = 'ob-row bad'; $('.ob-msg', row).textContent = A().errMsg(e); }
      }
      await reload();
      $('.ob-acts').innerHTML = (ok.length ? '<button class="btn" type="button" id="obLabels">Наклейки на ' + ok.length + ' ' + plural(ok.length, 'посылку', 'посылки', 'посылок') + ' · PDF</button><button class="btn ghost" type="button" id="obWay">Накладные · PDF</button><button class="btn ghost" type="button" id="obCall">Вызвать курьера</button>' : '') + '<button class="link" type="button" id="obDone">Закрыть</button>';
      $('#obErr').textContent = bad ? 'Не создано: ' + bad + '. Причина — у заказа; исправьте и создайте его отдельно.' : '';
      if ($('#obLabels')) { $('#obLabels').addEventListener('click', function () { batchPrint(ok, 'barcode', this); }); $('#obWay').addEventListener('click', function () { batchPrint(ok, 'waybill', this); }); $('#obCall').addEventListener('click', function () { intakeModal(ok); }); }
      $('#obDone').addEventListener('click', function () { A().closePanels(); afterSave(ok.length ? 'Создано отправлений: ' + ok.length : 'Готово', '#/admin?s=orders' + (location.search.indexOf('f=ship') !== -1 ? '&f=ship' : '')); });
    });
  }
  // Один PDF на все выбранные заказы (СДЭК готовит его несколько секунд)
  async function batchPrint(ids, kind, btn) {
    if (!ids.length) { toast('У выбранных заказов нет отправлений', true); return; }
    var w = window.open('', '_blank'), label = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; btn.textContent = 'Готовим PDF…'; }
    try {
      var r = await fetch('api/admin/cdek-print?kind=' + kind + '&ids=' + ids.map(encodeURIComponent).join(','), { credentials: 'same-origin' });
      if (!r.ok || !/pdf/.test(r.headers.get('content-type') || '')) { var j = await r.json().catch(function () { return {}; }); throw new Error(j.error || 'Не удалось получить документ'); }
      var url = URL.createObjectURL(await r.blob()); if (w) w.location = url; else location.href = url;
    } catch (e) { if (w) w.close(); toast(e.message, true); }
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
  // Вызов курьера СДЭК: заберёт посылки выбранных заказов по адресу в выбранный день
  function intakeModal(ids) {
    var os = ids.map(function (id) { return DATA.orders.find(function (o) { return o.id === id; }); }).filter(function (o) { return o && hasShip(o); });
    if (!os.length) { toast('Сначала создайте отправления', true); return; }
    var c = DATA.settings.cdek || {}, pk = c.pickup || {}, cs = DATA.settings.contacts || {}, sp = c.shipmentPoint || {};
    var d = new Date(); d.setDate(d.getDate() + 1); if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    var iso = function (x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    var times = []; for (var h = 9; h <= 21; h++) times.push((h < 10 ? '0' : '') + h + ':00');
    var sel = function (id, v) { return '<select class="input" id="' + id + '">' + times.map(function (t) { return '<option' + (t === v ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>'; };
    A().openModal('<div class="ik"><span class="eyebrow">СДЭК</span><h3 class="serif" style="font-size:32px;margin:12px 0 6px">Вызвать курьера</h3><p class="muted" style="font-size:14px;margin-bottom:16px">Курьер СДЭК заберёт ' + os.length + ' ' + plural(os.length, 'посылку', 'посылки', 'посылок') + ' — не нужно везти их в пункт. Услуга платная, по тарифу вашего договора со СДЭК.</p>' +
      '<div class="ik-orders">' + os.map(function (o) { return '<span>№ ' + esc(o.number) + (o.cdek.number ? ' · ' + esc(o.cdek.number) : '') + '</span>'; }).join('') + '</div>' +
      '<div class="ik-grid"><label class="field"><span>День</span><input class="input" type="date" id="ikD" min="' + iso(new Date()) + '" value="' + iso(d) + '"></label><label class="field"><span>С</span>' + sel('ikF', '10:00') + '</label><label class="field"><span>До</span>' + sel('ikT', '18:00') + '</label></div>' +
      '<label class="field"><span>Адрес, откуда забрать <small class="muted">— ' + esc(sp.city || 'город пункта отгрузки') + '</small></span><input class="input" id="ikA" maxlength="255" placeholder="Улица, дом, подъезд, офис" value="' + esc(pk.address || cs.address || '') + '"></label>' +
      '<div class="ik-grid two"><label class="field"><span>Кто передаст</span><input class="input" id="ikN" maxlength="100" value="' + esc(pk.name || '') + '" placeholder="Имя"></label><label class="field"><span>Телефон</span><input class="input" id="ikP" type="tel" value="' + esc(pk.phone ? A().fmtPhone(pk.phone) : (cs.phone || '')) + '"></label></div>' +
      '<label class="field"><span>Комментарий курьеру <small class="muted">— необязательно</small></span><input class="input" id="ikC" maxlength="150" placeholder="Например, домофон 12, 3 этаж"></label>' +
      '<label class="check"><input type="checkbox" id="ikCall" checked> <span>Пусть курьер позвонит заранее</span></label>' +
      '<p class="form-error" id="ikErr"></p><button class="btn block" type="button" id="ikGo">Вызвать курьера</button></div>');
    $('#ikGo').addEventListener('click', async function () {
      var b = this, err = $('#ikErr'); err.textContent = ''; b.disabled = true; b.textContent = 'Отправляем заявку…';
      try {
        var r = await A().API.adminPost('cdek-intake', { ids: os.map(function (o) { return o.id; }), date: $('#ikD').value, from: $('#ikF').value, to: $('#ikT').value, cityCode: sp.cityCode, address: $('#ikA').value, name: $('#ikN').value, phone: $('#ikP').value, comment: $('#ikC').value, needCall: $('#ikCall').checked });
        A().closePanels(); await afterSave('Курьер вызван' + (r.intake.number ? ': заявка № ' + r.intake.number : '') + ' на ' + r.intake.date.split('-').reverse().slice(0, 2).join('.') + ', ' + r.intake.from + '–' + r.intake.to);
      } catch (e) { err.textContent = A().errMsg(e); b.disabled = false; b.textContent = 'Вызвать курьера'; }
    });
  }

  /* ---------- Оплата и возврат ---------- */
  // Всё про деньги заказа в одном месте: кто и сколько заплатил, номер платежа ЮKassa, что уже вернули, и форма возврата
  function dt(s) { return new Date(s).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); }
  function refundCard(o) {
    var c = o.customer, pm = o.payment, refunds = o.refunds || [], back = o.refunded || 0, left = Math.max(0, o.total - back);
    var online = pm.method === 'online' && pm.providerId;
    var rows = '<div class="rf-sum"><div><span>Оплачено</span><b class="num">' + fmt(pm.status === 'paid' || pm.status === 'refunded' ? o.total : 0) + '</b></div>' +
      '<div><span>Возвращено</span><b class="num' + (back ? ' rf-back' : '') + '">' + (back ? '−' + fmt(back) : '0 ₽') + '</b></div>' +
      '<div><span>Осталось у магазина</span><b class="num">' + fmt(pm.status === 'paid' || pm.status === 'refunded' ? left : 0) + '</b></div></div>';
    var meta = '<dl class="rf-meta"><dt>Плательщик</dt><dd>' + esc(c.lastName + ' ' + c.firstName) + ' · ' + esc(A().fmtPhone(c.phone)) + '</dd>' +
      '<dt>Способ</dt><dd>' + (pm.method === 'online' ? 'Онлайн через ЮKassa' : pm.method === 'bonus' ? 'Бонусами' : pm.method === 'gift' ? 'Подарочным сертификатом' : 'При получении') + (o.giftUsed ? ' · сертификатом ' + fmt(o.giftUsed) + ' (' + esc(o.giftCode) + ')' : '') + '</dd>' +
      (online ? '<dt>Платёж ЮKassa</dt><dd><span class="copyable num">' + esc(pm.providerId) + '</span></dd>' : '') + '</dl>';
    var hist = refunds.length ? '<div class="rf-hist"><b>История возвратов</b>' + refunds.map(function (r) {
      var what = r.items.map(function (i) { return esc(i.name) + ', ' + esc(i.size) + ' × ' + i.qty; }); if (r.delivery) what.push('доставка');
      return '<div class="rf-row"><div><span class="num rf-back">−' + fmt(r.amount) + '</span><small>' + esc(dt(r.at)) + (r.status === 'pending' ? ' · в обработке' : '') + (r.mailedAt ? ' · письмо отправлено' : '') + '</small></div>' +
        '<p>' + (what.join('; ') || '—') + (r.reason ? '<br><span class="muted">Причина: ' + esc(r.reason) + '</span>' : '') + (r.restocked ? '<br><span class="muted">Товар вернули на склад</span>' : '') + '</p></div>';
    }).join('') + '</div>' : '';
    var action = '';
    if (online && pm.status === 'paid') {
      var lines = o.items.map(function (i, idx) {
        var can = i.qty - (i.refundedQty || 0); if (can <= 0) return '<div class="rf-line off"><span>' + esc(i.name) + ' · ' + esc(i.size) + '</span><small>возвращено</small></div>';
        return '<label class="rf-line"><input type="checkbox" data-rl="' + idx + '"><span>' + esc(i.name) + '<small>' + (i.color ? esc(i.color) + ' · ' : '') + 'размер ' + esc(i.size) + '</small></span>' +
          (can > 1 ? '<select class="select rf-qty" data-rq="' + idx + '" aria-label="Количество">' + Array.from({ length: can }, function (_, k) { return '<option value="' + (k + 1) + '"' + (k + 1 === can ? ' selected' : '') + '>' + (k + 1) + ' шт.</option>'; }).join('') + '</select>' : '<span class="muted rf-one">1 шт.</span>') + '</label>';
      }).join('');
      var dl = o.delivery && o.delivery.price > 0 && !o.deliveryRefunded ? '<label class="rf-line"><input type="checkbox" data-rd><span>Доставка<small>' + esc(o.delivery.name) + '</small></span><span class="muted rf-one">' + fmt(o.delivery.price) + '</span></label>' : '';
      action = '<button class="btn ghost" type="button" id="rfOpen">Вернуть деньги</button>' +
        '<div class="rf-form" id="rfForm" hidden><p class="rf-hint">Отметьте, за что возвращаете деньги. Сумму посчитаем сами — с учётом промокода и бонусов, которыми платил покупатель.</p>' +
        '<div class="rf-all"><button class="link" type="button" id="rfAll">Отметить всё</button></div>' + lines + dl +
        '<label class="check"><input type="checkbox" id="rfStock" checked> <span>Вернуть товар на склад (вещь вернулась к вам)</span></label>' +
        (retCost(o) ? '<label class="check"><input type="checkbox" id="rfDeduct" checked> <span>Удержать обратную доставку СДЭК — ' + fmt(retCost(o)) + ' (по оферте её оплачивает покупатель)</span></label>' : '') +
        '<label class="field"><span>Причина, для себя</span><input class="input" id="rfReason" placeholder="Например, не подошёл размер" maxlength="300"></label>' +
        '<div class="rf-total"><span>К возврату</span><b class="num" id="rfAmt">0 ₽</b></div>' +
        '<p class="rf-to">Деньги уйдут <b>' + esc(c.lastName + ' ' + c.firstName) + '</b> туда же, откуда была оплата заказа № ' + esc(o.number) + '. Покупатель получит письмо.</p>' +
        '<p class="form-error" id="rfErr"></p><button class="btn" type="button" id="rfGo" disabled>Выберите позиции</button></div>';
    } else if (pm.status === 'refunded') action = '<p class="rf-note ok">Деньги по заказу возвращены полностью.</p>';
    else if (pm.method === 'cod') action = '<p class="rf-note">Оплата при получении — деньги возвращаются вручную, переводом покупателю.</p>';
    else if (pm.method === 'online' && pm.status !== 'paid') action = '<p class="rf-note">Заказ не оплачен — возвращать нечего.</p>';
    return '<div class="adm-card rf-card"><h3 class="adm-h3">Оплата и возврат</h3>' + rows + meta + hist + action + '</div>';
  }
  function retCost(o) { return (o.returns || []).filter(function (r) { return r.cost && !r.deducted; }).reduce(function (s, r) { return s + r.cost; }, 0); }
  /* ---------- Возврат через СДЭК: обратная заявка, номер и инструкция уходят покупателю письмом ---------- */
  var RET_ST = { ACCEPTED: 'Заявка принята', CREATED: 'Ждём, когда покупатель сдаст посылку', ACCEPTED_AT_PICK_UP_POINT: 'Пришла в ваш пункт — заберите', DELIVERED: 'Получена вами' };
  function returnCard(o) {
    var list = (o.returns || []).map(function (r) {
      var what = r.items.map(function (i) { return esc(i.name) + ', ' + esc(i.size) + ' × ' + i.qty; }).join('; ');
      var waiting = ['ACCEPTED', 'CREATED', ''].indexOf(r.status || '') !== -1;
      return '<div class="ret-row' + (r.status === 'DELIVERED' ? ' done' : r.status === 'ACCEPTED_AT_PICK_UP_POINT' ? ' here' : '') + '"><div class="ret-top"><b class="num copyable">' + esc(r.number || 'номер присваивается…') + '</b><span>' + esc(RET_ST[r.status] || r.statusName || 'Обновляется') + '</span></div>' +
        '<p>' + what + '</p><small>' + (r.cost ? 'Обратная доставка ' + fmt(r.cost) + (r.deducted ? ' · удержана' : ' · удержится при возврате денег') + ' · ' : '') + (r.mailedAt ? 'инструкция отправлена покупателю' : 'письмо уйдёт, когда СДЭК присвоит номер') + '</small>' +
        (waiting ? '<button class="link" type="button" data-ret-cancel="' + esc(r.uuid) + '">Отменить возврат</button>' : '') + '</div>';
    }).join('');
    var lines = o.items.map(function (i, idx) {
      var can = i.qty - (i.refundedQty || 0) - (o.returns || []).reduce(function (s, r) { return s + ((r.items.find(function (x) { return x.idx === idx; }) || {}).qty || 0); }, 0);
      if (can <= 0) return '';
      return '<label class="rf-line"><input type="checkbox" data-retl="' + idx + '"><span>' + esc(i.name) + '<small>' + (i.color ? esc(i.color) + ' · ' : '') + 'размер ' + esc(i.size) + '</small></span>' +
        (can > 1 ? '<select class="select rf-qty" data-retq="' + idx + '">' + Array.from({ length: can }, function (_, k) { return '<option value="' + (k + 1) + '"' + (k + 1 === can ? ' selected' : '') + '>' + (k + 1) + ' шт.</option>'; }).join('') + '</select>' : '<span class="muted rf-one">1 шт.</span>') + '</label>';
    }).join('');
    return '<div class="adm-card ret-card"><h3 class="adm-h3">Возврат через СДЭК</h3>' +
      '<p class="muted" style="font-size:13px;margin:0">Покупатель хочет вернуть вещь — отметьте её. Сайт оформит обратную заявку в СДЭК на ваш пункт и пришлёт покупателю номер и инструкцию: отнести в любой пункт и назвать номер.</p>' +
      list + (lines ? '<div class="rf-form" id="retForm" hidden>' + lines + '<p class="form-error" id="retErr"></p><button class="btn" type="button" id="retGo" disabled>Выберите вещи</button></div><button class="btn ghost" type="button" id="retOpen">Оформить возврат через СДЭК</button>' : '') +
      ((o.returns || []).length ? '<button class="link" type="button" id="retSync" style="justify-self:start;font-size:13px">Обновить статус возврата</button>' : '') + '</div>';
  }
  function bindReturn(o) {
    var open = $('#retOpen'), form = $('#retForm'), go = $('#retGo');
    if (open) open.addEventListener('click', function () { form.hidden = !form.hidden; open.textContent = form.hidden ? 'Оформить возврат через СДЭК' : 'Скрыть'; });
    var sel = function () { return $$('[data-retl]', form).filter(function (x) { return x.checked; }).map(function (x) { var q = $('[data-retq="' + x.dataset.retl + '"]', form); return { idx: Number(x.dataset.retl), qty: q ? Number(q.value) : 1 }; }); };
    if (form) form.addEventListener('change', function () { var n = sel().length; go.disabled = !n; go.textContent = n ? 'Оформить возврат в СДЭК' : 'Выберите вещи'; delete go.dataset.armed; go.classList.remove('danger'); });
    if (go) go.addEventListener('click', async function () {
      if (!go.dataset.armed) { go.dataset.armed = '1'; go.textContent = 'Подтвердить: заявка и письмо покупателю'; return; }
      go.disabled = true; go.textContent = 'Оформляем в СДЭК…'; $('#retErr').textContent = '';
      try { var r = await A().API.adminReturn(o.id, 'return-ship', { lines: sel() }); await afterSave('Возврат оформлен' + (r.ret && r.ret.mailedAt ? ', покупателю отправлены номер и инструкция' : ''), '#/admin?s=orders&id=' + o.id); }
      catch (e) { $('#retErr').textContent = A().errMsg(e); go.disabled = false; delete go.dataset.armed; go.textContent = 'Оформить возврат в СДЭК'; }
    });
    if ($('#retSync')) $('#retSync').addEventListener('click', async function () { try { await A().API.adminReturn(o.id, 'return-sync'); await afterSave('Статус обновлён', '#/admin?s=orders&id=' + o.id); } catch (e) { toast(A().errMsg(e), true); } });
    $$('[data-ret-cancel]').forEach(function (b) { bindConfirm(b, async function () { try { await A().API.adminReturn(o.id, 'return-cancel', { uuid: b.dataset.retCancel }); await afterSave('Возврат отменён', '#/admin?s=orders&id=' + o.id); } catch (e) { toast(A().errMsg(e), true); } }); });
  }
  function bindRefund(o) {
    var open = $('#rfOpen'); if (!open) return;
    var form = $('#rfForm'), go = $('#rfGo'), err = $('#rfErr'), key, amount = 0, seq = 0;
    key = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); // одна попытка = один ключ: двойной клик не вернёт деньги дважды
    open.addEventListener('click', function () { form.hidden = !form.hidden; open.textContent = form.hidden ? 'Вернуть деньги' : 'Скрыть'; });
    function body(dry) {
      var lines = $$('[data-rl]', form).filter(function (x) { return x.checked; }).map(function (x) { var q = $('[data-rq="' + x.dataset.rl + '"]', form); return { idx: Number(x.dataset.rl), qty: q ? Number(q.value) : 1 }; });
      return { lines: lines, delivery: !!($('[data-rd]', form) && $('[data-rd]', form).checked), restock: $('#rfStock').checked, reason: $('#rfReason').value, dry: dry, key: key, deduct: $('#rfDeduct') && $('#rfDeduct').checked ? retCost(o) : 0 };
    }
    async function calc() {
      var b = body(true), my = ++seq; err.textContent = '';
      if (!b.lines.length && !b.delivery) { amount = 0; $('#rfAmt').textContent = '0 ₽'; go.disabled = true; go.textContent = 'Выберите позиции'; return; }
      try { var r = await A().API.adminRefund(o.id, b); if (my !== seq) return; amount = r.amount; $('#rfAmt').textContent = fmt(r.amount) + (r.deducted ? ' (удержано ' + fmt(r.deducted) + ')' : ''); go.disabled = false; go.textContent = 'Вернуть ' + fmt(r.amount); delete go.dataset.armed; }
      catch (e) { if (my !== seq) return; amount = 0; $('#rfAmt').textContent = '—'; go.disabled = true; go.textContent = 'Вернуть'; err.textContent = A().errMsg(e); }
    }
    form.addEventListener('change', function (e) { if (e.target.matches('[data-rl], [data-rq], [data-rd], #rfDeduct')) calc(); }); // сумму меняют только позиции
    $('#rfAll').addEventListener('click', function () { $$('[data-rl], [data-rd]', form).forEach(function (x) { x.checked = true; }); $$('.rf-qty', form).forEach(function (s) { s.value = s.options[s.options.length - 1].value; }); calc(); });
    // Два нажатия: первое показывает, кому и сколько, второе — возвращает
    go.addEventListener('click', async function () {
      if (!amount) return;
      if (!go.dataset.armed) { go.dataset.armed = '1'; go.textContent = 'Подтвердить возврат ' + fmt(amount); go.classList.add('danger'); return; }
      go.disabled = true; go.textContent = 'Возвращаем…';
      try {
        var r = await A().API.adminRefund(o.id, body(false));
        await afterSave('Возврат ' + fmt(r.refund.amount) + ' оформлен' + (r.refund.mailedAt ? ', покупателю отправлено письмо' : ''), '#/admin?s=orders&id=' + o.id);
      } catch (e) { err.textContent = A().errMsg(e); go.disabled = false; go.classList.remove('danger'); delete go.dataset.armed; go.textContent = 'Вернуть ' + fmt(amount); }
    });
  }
  function manualTrack(o) {
    return '<div class="adm-card adm-form trk-card" style="grid-template-columns:1fr"><h3 class="adm-h3">Отправка СДЭК</h3>' +
          (o.tracking ? '<div class="trk-now"><span>Трек-номер</span><b class="copyable">' + esc(o.tracking.number) + '</b><a class="link" href="' + esc(o.tracking.url) + '" target="_blank" rel="noopener">Отследить</a>' +
            '<small>' + (o.tracking.mailedAt ? 'Письмо покупателю отправлено ' + esc(new Date(o.tracking.mailedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) : 'Письмо покупателю не отправлялось') + '</small></div>' : '') +
          '<label class="field"><span>' + (o.tracking ? 'Изменить трек-номер' : 'Трек-номер СДЭК') + '</span><input class="input num" id="f-track" value="' + esc(o.tracking ? o.tracking.number : '') + '" placeholder="Например, 1234567890" autocomplete="off" inputmode="numeric"></label>' +
          '<p class="muted" style="font-size:13px;margin:0">После «Сохранить» покупатель получит письмо со ссылкой для отслеживания, а заказ станет «Передан в доставку». Номер также появится у покупателя на странице заказа.</p></div>';
  }
  /* ---------- Отправление СДЭК в заказе ---------- */
  function useCdek(o) { return !!(A().D.cdekReady && ((o.delivery && (o.delivery.pvz || o.delivery.door)) || o.cdek)); }
  var CDEK_STEP = { ACCEPTED: 'Заявка принята СДЭК', CREATED: 'Создано — отнесите посылку в пункт СДЭК' };
  function cdekCard(o) {
    var c = o.cdek, sp = (DATA.settings.cdek || {}).shipmentPoint, pv = o.delivery.pvz || {}, door = o.delivery.door;
    var to = '<div class="cs-route"><div><small>Отправляете из</small><b>' + esc(sp ? sp.address : 'пункт не выбран') + '</b></div><span aria-hidden="true">→</span><div><small>' + (door ? 'Курьер привезёт' : 'Получатель забирает') + '</small><b>' + esc(pv.address || o.delivery.address || '—') + '</b><small>' + esc(o.delivery.city || '') + (pv.code ? ' · ' + esc(pv.code) : '') + '</small></div></div>';
    if (!c) {
      // посылка по карточкам товаров: вес вещей и подходящая упаковка
      var pk = Pricing.parcelFor(o.items.map(function (i) { return { productId: i.productId, qty: i.qty - (i.refundedQty || 0) }; }), DATA.products, DATA.settings.cdek || {});
      var unpaid = o.payment.method === 'online' && o.payment.status !== 'paid';
      return '<div class="adm-card cs-order"><h3 class="adm-h3">Отправка СДЭК</h3>' + to +
        (o.payment.method === 'cod' ? '<p class="cs-cod">Оплата при получении: СДЭК возьмёт с покупателя <b>' + fmt(o.total - (o.refunded || 0)) + '</b></p>' : '') +
        (!sp ? '<p class="rf-note">Сначала укажите пункт отгрузки: «Оплата и доставка» → «Отправка заказов в СДЭК».</p>' : '') +
        '<div class="pm-f"><span>Посылка · ' + esc(pk.pack) + '</span><div class="cs-pkg"><label><input class="input num" id="coW" type="number" min="50" step="50" value="' + pk.weight + '"><i>г</i></label><label><input class="input num" id="coL" type="number" min="1" value="' + pk.length + '"><i>см</i></label><span>×</span><label><input class="input num" id="coWd" type="number" min="1" value="' + pk.width + '"><i>см</i></label><span>×</span><label><input class="input num" id="coH" type="number" min="1" value="' + pk.height + '"><i>см</i></label></div></div>' +
        '<p class="form-error" id="csErr"></p><button class="btn" type="button" id="csCreate"' + (unpaid || !sp || ['canceled', 'returned'].includes(o.status) ? ' disabled' : '') + '>' + (unpaid ? 'Заказ ещё не оплачен' : 'Создать отправление в СДЭК') + '</button>' +
        '<p class="muted" style="font-size:13px;margin:0">СДЭК присвоит номер. Когда сдадите посылку в пункт, покупатель автоматически получит письмо с трек-номером, а заказ станет «Передан в доставку».</p></div>';
    }
    var waiting = !c.status || c.status === 'ACCEPTED' || c.status === 'CREATED';
    var codSum = o.payment.method === 'cod' && o.payment.status === 'pending' ? '<p class="cs-cod">Покупатель платит при получении: <b>' + fmt(o.total - (o.refunded || 0)) + '</b> — СДЭК переведёт деньги вам по договору</p>' : o.payment.collectedBy === 'cdek' ? '<p class="cs-cod ok">Покупатель оплатил при получении — деньги переведёт СДЭК</p>' : '';
    return '<div class="adm-card cs-order"><h3 class="adm-h3">Отправка СДЭК</h3>' +
      '<div class="cs-num"><div><small>Номер СДЭК</small><b class="num copyable">' + esc(c.number || 'присваивается…') + '</b></div><span class="cs-st' + (c.status === 'DELIVERED' ? ' ok' : c.status === 'NOT_DELIVERED' ? ' bad' : '') + '">' + esc(CDEK_STEP[c.status] || c.statusName || 'Обновляется') + '</span></div>' + to + codSum +
      (c.statusAt ? '<small class="muted" style="font-size:12px">Обновлено ' + esc(dt(c.statusAt)) + '</small>' : '') +
      '<div class="cs-acts"><button class="btn" type="button" data-cs-print="barcode"' + (c.number ? '' : ' disabled') + '>Наклейка на посылку</button><button class="btn ghost" type="button" data-cs-print="waybill"' + (c.number ? '' : ' disabled') + '>Накладная</button></div>' +
      '<div class="cs-acts small"><button class="link" type="button" id="csSync">Обновить статус</button>' + (waiting ? '<button class="link" type="button" id="csCancel">Отменить отправление</button>' : '') + (c.number ? '<a class="link" href="' + esc((o.tracking && o.tracking.url) || ('https://www.cdek.ru/ru/tracking/?order_id=' + encodeURIComponent(c.number))) + '" target="_blank" rel="noopener">Открыть на сайте СДЭК</a>' : '') + '</div>' +
      (waiting ? '<p class="muted" style="font-size:13px;margin:0">Распечатайте наклейку, приклейте на пакет и сдайте посылку в пункт. После этого покупатель получит трек-номер.</p>' : '') +
      '<p class="form-error" id="csErr"></p></div>';
  }
  function bindCdekOrder(o) {
    var go = function (p) { return p.then(function () { return afterSave('Готово', '#/admin?s=orders&id=' + o.id); }).catch(function (e) { $('#csErr').textContent = A().errMsg(e); }); };
    var cr = $('#csCreate');
    if (cr) cr.addEventListener('click', function () {
      cr.disabled = true; cr.textContent = 'Создаём в СДЭК…'; $('#csErr').textContent = '';
      A().API.adminCdekOrder(o.id, 'POST', 'cdek', { pkg: { weight: $('#coW').value, length: $('#coL').value, width: $('#coWd').value, height: $('#coH').value } })
        .then(function () { return afterSave('Отправление создано в СДЭК', '#/admin?s=orders&id=' + o.id); })
        .catch(function (e) { $('#csErr').textContent = A().errMsg(e); cr.disabled = false; cr.textContent = 'Создать отправление в СДЭК'; });
    });
    if ($('#csSync')) $('#csSync').addEventListener('click', function () { go(A().API.adminCdekOrder(o.id, 'POST', 'cdek-sync')); });
    if ($('#csCancel')) bindConfirm($('#csCancel'), function () { return go(A().API.adminCdekOrder(o.id, 'DELETE', 'cdek')); });
    $$('[data-cs-print]').forEach(function (b) { b.addEventListener('click', async function () {
      var kind = b.dataset.csPrint, w = window.open('', '_blank'), label = b.textContent; b.disabled = true; b.textContent = 'Готовим PDF…';
      try {
        var r = await fetch('api/admin/orders/' + encodeURIComponent(o.id) + '/cdek-print?kind=' + kind, { credentials: 'same-origin' });
        if (!r.ok || !/pdf/.test(r.headers.get('content-type') || '')) { var j = await r.json().catch(function () { return {}; }); throw new Error(j.error || 'Не удалось получить документ'); }
        var url = URL.createObjectURL(await r.blob()); if (w) w.location = url; else location.href = url;
      } catch (e) { if (w) w.close(); $('#csErr').textContent = e.message; }
      b.disabled = false; b.textContent = label;
    }); });
    // пока посылка в пути — подтягиваем свежий статус при открытии заказа
    if (o.cdek && o.cdek.status !== 'DELIVERED' && !o._synced) { o._synced = true; A().API.adminCdekOrder(o.id, 'POST', 'cdek-sync').then(async function (n) { if (n && n.cdek && (n.cdek.status !== o.cdek.status || n.cdek.number !== o.cdek.number) && location.hash.indexOf(o.id) !== -1) { await reload(); DATA.orders.forEach(function (x) { if (x.id === o.id) x._synced = true; }); await A().refresh(); } }).catch(function () {}); }
  }
  /* ---------- Заявки покупателей на обмен и возврат ---------- */
  var REQ_STATE = { new: 'Ждём вещь', received: 'Вещь проверена', done: 'Закрыта', declined: 'Отклонена' };
  function allRequests() { var out = []; DATA.orders.forEach(function (o) { (o.requests || []).forEach(function (r) { out.push({ o: o, r: r }); }); }); return out.sort(function (a, b) { return b.r.createdAt.localeCompare(a.r.createdAt); }); }
  function reqBadge() { var n = allRequests().filter(function (x) { return x.r.status === 'new' || x.r.status === 'received'; }).length; return n ? ' <span class="adm-badge">' + n + '</span>' : ''; }
  function reqWhat(r) { return r.lines.map(function (l) { return esc(l.name) + (l.color ? ', ' + esc(l.color) : '') + ', ' + esc(l.size) + (r.kind === 'exchange' ? ' → <b>' + esc(l.toSize) + '</b>' : '') + (l.qty > 1 ? ' × ' + l.qty : ''); }).join('; '); }
  function requestCard(o) {
    var list = (o.requests || []); if (!list.length) return '';
    return '<div class="adm-card adm-req" style="display:grid;gap:12px"><h3 class="adm-h3">Заявка покупателя</h3>' + list.slice().reverse().map(function (r) {
      var open = r.status === 'new' || r.status === 'received';
      var ret = (o.returns || []).find(function (x) { return x.uuid === r.returnUuid; });
      return '<div class="adm-req-item"><div class="adm-req-top"><b>' + (r.kind === 'exchange' ? 'Обмен размера' : 'Возврат денег') + ' · ' + esc(r.reasonLabel) + '</b><span class="adm-req-st s-' + r.status + '">' + REQ_STATE[r.status] + '</span></div>' +
        '<span>' + reqWhat(r) + '</span>' + (r.comment ? '<span class="muted">«' + esc(r.comment) + '»</span>' : '') +
        '<span class="muted" style="font-size:13px">' + esc(dt(r.createdAt)) + (ret && ret.number ? ' · возврат СДЭК ' + esc(ret.number) + (ret.statusName ? ' — ' + esc(ret.statusName) : '') : r.returnError ? ' · возврат СДЭК не создан: ' + esc(r.returnError) + ' — оформите в карточке «Возврат через СДЭК»' : '') + '</span>' +
        (r.exchangeOrderId ? '<a class="link" href="#/admin?s=orders&id=' + esc(r.exchangeOrderId) + '">Заказ-обмен № ' + esc(r.exchangeNumber) + '</a>' : '') +
        (r.declineNote ? '<span class="muted">Причина отказа: ' + esc(r.declineNote) + '</span>' : '') +
        (open ? '<div class="adm-req-act">' + (r.kind === 'exchange' ? '<button class="btn sm" data-req="exchange" data-rid="' + esc(r.id) + '">Вещь пришла и проверена — отправить ' + esc(r.lines.map(function (l) { return l.toSize; }).join(', ')) + '</button>' :
          (r.status === 'new' ? '<button class="btn sm" data-req="received" data-rid="' + esc(r.id) + '">Вещь пришла и проверена</button>' : '<span class="muted" style="font-size:13px">Верните деньги в карточке «Оплата и возврат» — заявка закроется сама</span>')) +
          '<button class="btn ghost sm" data-req-decline="' + esc(r.id) + '">Отклонить</button></div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function bindRequest(o) {
    $$('[data-req]').forEach(function (b) { b.addEventListener('click', async function () {
      b.disabled = true;
      try { var r = await A().API.adminRequest(o.id, { id: b.getAttribute('data-rid'), action: b.getAttribute('data-req') }); await afterSave(r.exchange ? 'Создан заказ-обмен № ' + r.exchange.number + ' — отправьте его как обычно' : 'Готово', '#/admin?s=orders&id=' + (r.exchange ? r.exchange.id : o.id)); }
      catch (e) { b.disabled = false; toast(A().errMsg(e), true); }
    }); });
    $$('[data-req-decline]').forEach(function (b) { b.addEventListener('click', async function () {
      var note = window.prompt('Почему отклоняем? Покупатель увидит это в поддержке', ''); if (note === null) return;
      try { await A().API.adminRequest(o.id, { id: b.getAttribute('data-req-decline'), action: 'decline', note: note }); await afterSave('Заявка отклонена, резерв размера снят', '#/admin?s=orders&id=' + o.id); }
      catch (e) { toast(A().errMsg(e), true); }
    }); });
  }
  function exchangeSection(m) {
    settingsForm(m, 'Обмен и возвраты', 'Покупатель оформляет обмен размера или возврат сам — в карточке заказа на сайте. Если размер не подошёл, ему сначала предлагается обмен: новый размер сразу откладывается, а отправляется, когда вещь вернётся и вы её проверите. Возврат через СДЭК оформляется автоматически.', [
      { k: 'enabled', label: 'Принимать заявки на обмен и возврат на сайте', type: 'checkbox', hint: 'В карточке товара показывается «Не подошёл размер — обменяем», а в заказе — кнопка «Обменять размер или вернуть»' },
      { k: 'days', label: 'Сколько дней после получения', type: 'number', hint: 'По закону покупатель может вернуть вещь минимум 7 дней после получения' },
      { k: 'free', label: 'Обмен размера бесплатный — доставку в обе стороны оплачивает магазин', type: 'checkbox' }
    ], {}, function (s) { s.exchange = s.exchange || { enabled: true, days: 14, free: true }; return s.exchange; }, function (s, o) {
      if (!(o.days >= 7 && o.days <= 60)) return 'Срок — от 7 до 60 дней';
      s.exchange = o;
    });
    var all = allRequests(), reasons = {}, sizes = {};
    all.forEach(function (x) { reasons[x.r.reasonLabel] = (reasons[x.r.reasonLabel] || 0) + 1; x.r.lines.forEach(function (l) { if (x.r.reason === 'small' || x.r.reason === 'big') { var k = l.name + ', ' + l.size + ' — ' + x.r.reasonLabel.toLowerCase(); sizes[k] = (sizes[k] || 0) + l.qty; } }); });
    var top = function (o) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }).slice(0, 6).map(function (k) { return '<div class="adm-req-stat"><span>' + esc(k) + '</span><b class="num">' + o[k] + '</b></div>'; }).join(''); };
    m.insertAdjacentHTML('beforeend', '<div class="adm-two" style="margin-top:28px"><div class="adm-card" style="display:grid;gap:10px"><h3 class="adm-h3">Почему возвращают</h3>' + (all.length ? top(reasons) : '<p class="muted" style="margin:0">Заявок пока не было</p>') + '</div>' +
      '<div class="adm-card" style="display:grid;gap:10px"><h3 class="adm-h3">Какие размеры не садятся</h3>' + (Object.keys(sizes).length ? top(sizes) + '<p class="muted" style="font-size:13px;margin:0">Если один размер часто «велик» или «мал» — поправьте мерки и рост/вес в карточке товара</p>' : '<p class="muted" style="margin:0">Пока нет данных</p>') + '</div></div>' +
      '<div class="adm-card" style="margin-top:16px"><h3 class="adm-h3">Заявки</h3>' + (all.length ? '<div class="table-wrap adm-table"><table class="sizes"><thead><tr><th>Дата</th><th>Заказ</th><th>Покупатель</th><th>Что</th><th>Причина</th><th>Статус</th></tr></thead><tbody>' +
        all.map(function (x) { return '<tr data-href="#/admin?s=orders&id=' + esc(x.o.id) + '"><td>' + esc(dt(x.r.createdAt)) + '</td><td>№ ' + esc(x.o.number) + '</td><td>' + esc(x.o.customer.firstName + ' ' + x.o.customer.lastName) + '</td><td>' + (x.r.kind === 'exchange' ? 'Обмен: ' : 'Возврат: ') + reqWhat(x.r) + '</td><td>' + esc(x.r.reasonLabel) + '</td><td><span class="adm-req-st s-' + x.r.status + '">' + REQ_STATE[x.r.status] + '</span></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted" style="margin:0">Когда покупатель оформит обмен или возврат, заявка появится здесь и в карточке заказа, а в «Поддержке» — переписка с ним.</p>') + '</div>');
    $$('tr[data-href]', m).forEach(function (tr) { tr.addEventListener('click', function () { window.ALB_NAV.go(tr.getAttribute('data-href')); }); });
  }
  function orderDetail(m, id) {
    var o = DATA.orders.find(function (x) { return x.id === id; });
    if (!o) { m.innerHTML = head('Заказ не найден') + '<a class="link" href="#/admin?s=orders">← К заказам</a>'; return; }
    var c = o.customer, d = o.delivery || {};
    var lastRf = (o.refunds || [])[(o.refunds || []).length - 1];
    var banner = lastRf ? '<div class="rf-banner' + (o.status === 'returned' ? ' full' : '') + '"><span class="rf-banner-ic" aria-hidden="true">↩</span><div><b>' + (o.status === 'returned' ? 'Возврат — деньги возвращены полностью' : 'Частичный возврат') + '</b>' +
      '<span>Вернули ' + fmt(o.refunded) + ' из ' + fmt(o.total) + ' · ' + esc(o.customer.lastName + ' ' + o.customer.firstName) + ' · последний возврат ' + esc(dt(lastRf.at)) + '</span></div><b class="num rf-banner-sum">−' + fmt(o.refunded) + '</b></div>' : '';
    m.innerHTML = '<a class="link muted" href="#/admin?s=orders" style="font-size:14px">← Все заказы</a>' + head((o.status === 'returned' ? 'Возврат · заказ № ' : 'Заказ № ') + o.number, '', esc(new Date(o.createdAt).toLocaleString('ru-RU'))) + banner +
      '<div class="adm-two"><div class="adm-card" style="display:grid;gap:14px"><h3 class="adm-h3">Состав</h3>' +
        o.items.map(function (i) { var ip = DATA.products.find(function (x) { return x.id === i.productId; }); return '<div class="mini-line"><img src="' + esc(i.image || Art.make(i.art)) + '" alt=""><div>' + esc(i.name) + '<div class="sub">' + (ip && ip.sku ? 'Арт. ' + esc(ip.sku) + ' · ' : '') + (i.color ? 'Цвет ' + esc(i.color) + ' · ' : '') + 'Размер ' + esc(i.size) + ' · ' + i.qty + ' шт. × ' + fmt(i.price) + (i.refundedQty ? ' · <span class="rf-back">возвращено ' + i.refundedQty + ' шт.</span>' : '') + '</div></div><span class="num">' + fmt(i.price * i.qty) + '</span></div>'; }).join('') +
        '<div class="sum-row"><span>Товары</span><span>' + fmt(o.subtotal) + '</span></div>' +
        (o.promoDiscount ? '<div class="sum-row disc"><span>Промокод ' + esc(o.promoCode) + '</span><span>−' + fmt(o.promoDiscount) + '</span></div>' : '') +
        '<div class="sum-row"><span>' + esc(d.name || 'Доставка') + '</span><span>' + fmt(d.price || 0) + '</span></div>' +
        (o.bonusUsed ? '<div class="sum-row disc"><span>Оплачено бонусами' + (o.bonusReturned ? ' (возвращены покупателю)' : '') + '</span><span>−' + fmt(o.bonusUsed) + '</span></div>' : '') +
        '<div class="sum-row total"><span>Итого деньгами</span><span>' + fmt(o.total) + '</span></div>' +
        (o.bonusEarn ? '<div class="sum-row"><span class="muted">Бонусы за заказ: ' + (o.bonusCredited ? 'начислены' : o.status === 'canceled' ? 'не начисляются — заказ отменён' : 'начислятся ' + (Pricing.bonusConf(DATA.settings).creditOn === 'done' ? 'когда заказ будет выполнен' : 'после оплаты')) + '</span><span class="num">+' + o.bonusEarn + '</span></div>' : '') + '</div>' +
      '<div style="display:grid;gap:16px;align-content:start"><div class="adm-card" style="display:grid;gap:8px"><h3 class="adm-h3">Покупатель</h3><b>' + esc(c.firstName + ' ' + c.lastName) + '</b><span class="copyable">' + esc(A().fmtPhone(c.phone)) + '</span><span class="copyable">' + esc(c.email) + '</span>' + (o.userId ? '<span class="muted" style="font-size:14px">Зарегистрированный покупатель</span>' : '<span class="muted" style="font-size:14px">Без регистрации</span>') + '</div>' +
        requestCard(o) + refundCard(o) + (useCdek(o) ? returnCard(o) : '') +
        '<div class="adm-card" style="display:grid;gap:8px"><h3 class="adm-h3">Доставка</h3><span>' + esc(d.name || '—') + '</span>' + (d.city || d.address ? '<span class="copyable">' + esc([d.city, d.address].filter(Boolean).join(', ')) + '</span>' : '') + (o.comment ? '<span class="muted">Комментарий: ' + esc(o.comment) + '</span>' : '') + '</div>' +
        (useCdek(o) ? cdekCard(o) : manualTrack(o)) +
        '<div class="adm-card adm-form" style="grid-template-columns:1fr"><h3 class="adm-h3">Статус</h3>' +
          fieldHtml({ k: 'status', label: 'Статус заказа', type: 'select', options: Object.keys(A().STATUS).map(function (k) { return [k, A().STATUS[k]]; }) }, o) +
          fieldHtml({ k: 'paymentStatus', label: 'Оплата (' + (o.payment.method === 'online' ? 'онлайн' : o.payment.method === 'bonus' ? 'бонусами' : o.payment.method === 'exchange' ? 'обмен по заказу № ' + (o.exchangeOf ? o.exchangeOf.number : '') : 'при получении') + ')', type: 'select', options: Object.keys(A().PAY).filter(function (k) { return k !== 'refunded' || o.payment.method !== 'online' || o.payment.status === 'refunded'; }).map(function (k) { return [k, A().PAY[k]]; }) }, { paymentStatus: o.payment.status }) +
          fieldHtml({ k: 'note', label: 'Заметка для себя', type: 'textarea', rows: 2 }, { note: o.adminNote || '' }) +
          '<button class="btn" id="oSave">Сохранить</button></div>' +
        historyCard(o) +
        '<div class="adm-card" style="display:grid;gap:10px"><h3 class="adm-h3">Удаление</h3><p class="muted" style="font-size:13px;margin:0">Для тестовых и ошибочных заказов. Товар вернётся на склад, промокод и бонусы — как при отмене. Удаление не отменить.</p><button class="btn ghost" id="oDel" type="button">Удалить заказ</button></div></div></div>';
    bindRefund(o); bindRequest(o);
    if (useCdek(o)) { bindCdekOrder(o); bindReturn(o); }
    bindConfirm($('#oDel'), async function () {
      try { await A().API.adminOrderDelete(o.id); await afterSave('Заказ № ' + o.number + ' удалён', '#/admin?s=orders'); } catch (e) { toast(A().errMsg(e), true); }
    });
    $('#oSave').addEventListener('click', async function () {
      var track = $('#f-track') ? $('#f-track').value.replace(/\s+/g, '') : undefined;
      var patch = { paymentStatus: $('#f-paymentStatus').value, note: $('#f-note').value };
      if (track !== undefined) patch.track = track;
      // если вводят новый трек-номер, статус ставит сервер («Передан в доставку»)
      if (!(track && track !== (o.tracking && o.tracking.number))) patch.status = $('#f-status').value;
      try { var r = await A().API.adminOrder(o.id, patch); await afterSave(notifyMsg(r.trackMailed ? 'Трек-номер сохранён, покупателю отправлено письмо' : track && track !== (o.tracking && o.tracking.number) ? 'Трек-номер сохранён. Письмо не отправлено — проверьте настройки почты' : 'Заказ обновлён', r.notify), '#/admin?s=orders&id=' + o.id); }
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
    m.innerHTML = head(cfg.title, (cfg.searchable ? '<input class="input" id="cSearch" placeholder="Поиск" value="' + esc(q.q || '') + '" style="min-height:40px;width:200px">' : '') + (cfg.headExtra || '') + '<a class="btn sm" href="#/admin?s=' + cfg.key + '&id=new">+ ' + esc(cfg.addLabel) + '</a>', cfg.sub) + (cfg.listTop || '') +
      (list.length ? '<div class="table-wrap adm-table"><table class="sizes' + (cfg.bulk ? ' adm-bulk-table' : '') + '"><thead><tr>' +
        (cfg.bulk ? '<th class="adm-pick-cell"><label class="check adm-pick" title="Выбрать все"><input type="checkbox" id="pickAll" aria-label="Выбрать все"></label></th>' : '') +
        cfg.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        list.map(function (x) { return '<tr data-href="#/admin?s=' + cfg.key + '&id=' + esc(x.id) + '">' + (cfg.bulk ? '<td class="adm-pick-cell"><label class="check adm-pick"><input type="checkbox" data-pick="' + esc(x.id) + '" aria-label="Выбрать"></label></td>' : '') + cfg.row(x).map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
        (cfg.bulk ? '<div class="adm-bar adm-bulk-bar" id="bulkBar" hidden><span class="adm-bulk-n" id="bulkN"></span><button class="btn ghost sm" id="bulkAll"></button><button class="btn ghost sm" id="bulkNone">Снять выбор</button>' + (cfg.bulkOps || '') + '<button class="btn sm" id="bulkDel"></button></div>' : '')
        : '<div class="empty"><h3>Пока пусто</h3><a class="btn ghost" href="#/admin?s=' + cfg.key + '&id=new">' + esc(cfg.addLabel) + '</a></div>');
    var cs = $('#cSearch'); if (cs) cs.addEventListener('change', function () { window.ALB_NAV.go('#/admin?s=' + cfg.key + '&q=' + encodeURIComponent(cs.value)); });
    if (cfg.bulk && list.length) bindBulk(m, cfg, list, q);
    if (cfg.mountList) cfg.mountList(m, q);
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
    if (cfg.onBulkOps) cfg.onBulkOps(m, chosen, q);
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
  /* Массовые изменения товаров (13.60): цена, ±%, скидка, показать или скрыть — для выбранных галочками */
  function bindProductOps(m, chosen, q) {
    var act = $('#bopAct', m), val = $('#bopVal', m), go = $('#bopGo', m); if (!act) return;
    var NEED = { price: 'Новая цена', percent: '+10 или −10', discount: 'Скидка, %' };
    var sync = function () { var a = act.value; val.hidden = !NEED[a]; val.placeholder = NEED[a] || ''; go.disabled = !a || (NEED[a] && val.value === ''); };
    act.addEventListener('change', function () { val.value = ''; sync(); if (!val.hidden) val.focus(); });
    val.addEventListener('input', sync);
    go.addEventListener('click', async function () {
      var ids = chosen(); if (!ids.length || !act.value) return;
      go.disabled = true; go.textContent = 'Применяю…';
      try {
        var r = await A().API.adminPost('products/bulk', { ids: ids, action: act.value, value: Number(val.value) || 0 });
        await afterSave('Изменено: ' + r.changed + ' ' + plural(r.changed, 'товар', 'товара', 'товаров'), '#/admin?s=products' + (q.q ? '&q=' + encodeURIComponent(q.q) : ''));
      } catch (e) { toast(A().errMsg(e), true); go.textContent = 'Применить'; sync(); }
    });
  }
  /* Остатки в Excel (CSV) и обратно: выгрузили, поправили числа в колонке «Остаток», загрузили — сначала показываем, что изменится */
  function bindStockFile(m) {
    var ex = $('#stExport', m), im = $('#stImport', m), pv = $('#stPreview', m); if (!ex) return;
    ex.addEventListener('click', async function () {
      ex.disabled = true;
      try {
        var r = await fetch('api/admin/products/stock.csv', { credentials: 'same-origin' }); if (!r.ok) throw new Error('Не удалось выгрузить остатки');
        var b = await r.blob(), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'ostatki-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        toast('Файл скачан — откройте в Excel, поменяйте «Остаток» и загрузите обратно');
      } catch (e) { toast(A().errMsg(e), true); }
      ex.disabled = false;
    });
    im.addEventListener('change', async function () {
      var f = im.files && im.files[0]; im.value = ''; if (!f) return;
      if (f.size > 2 * 1024 * 1024) { toast('Файл слишком большой', true); return; }
      var text = await f.text();
      try {
        var r = await A().API.adminPost('products/stock', { csv: text, dry: true });
        if (!r.changes.length) { pv.innerHTML = '<div class="adm-card st-pv"><b>Изменений нет</b><p class="muted">Остатки в файле совпадают с сайтом' + (r.errors.length ? '. Не распознано строк: ' + r.errors.length : '') + '.</p></div>'; return; }
        pv.innerHTML = '<div class="adm-card st-pv"><div class="st-pv-h"><b>Изменится ' + r.changes.length + ' ' + plural(r.changes.length, 'размер', 'размера', 'размеров') + '</b><span><button class="btn ghost sm" type="button" id="stCancel">Отмена</button><button class="btn sm" type="button" id="stApply">Применить</button></span></div>' +
          '<div class="table-wrap"><table class="sizes"><thead><tr><th>Товар</th><th>Цвет</th><th>Размер</th><th>Было</th><th>Станет</th></tr></thead><tbody>' +
          r.changes.slice(0, 300).map(function (c) { return '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.color) + '</td><td>' + esc(c.size) + '</td><td class="num">' + c.from + '</td><td class="num"><b class="' + (c.to > c.from ? 'st-up' : 'st-down') + '">' + c.to + '</b></td></tr>'; }).join('') + '</tbody></table></div>' +
          (r.errors.length ? '<p class="form-error">Пропущено строк: ' + r.errors.length + ' — ' + esc(r.errors.slice(0, 3).join('; ')) + '</p>' : '') + '</div>';
        $('#stCancel', pv).addEventListener('click', function () { pv.innerHTML = ''; });
        $('#stApply', pv).addEventListener('click', async function () {
          this.disabled = true;
          try { var x = await A().API.adminPost('products/stock', { csv: text }); await afterSave('Остатки обновлены: ' + x.changed + (x.notify && x.notify.sent ? ' · письма о поступлении: ' + x.notify.sent : ''), '#/admin?s=products'); }
          catch (e) { toast(A().errMsg(e), true); this.disabled = false; }
        });
        pv.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) { toast(A().errMsg(e), true); }
    });
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
      headExtra: '<button class="btn ghost sm" type="button" id="stExport">Остатки в Excel</button><label class="btn ghost sm" id="stImportL">Загрузить остатки<input type="file" id="stImport" accept=".csv,text/csv,.txt" hidden></label>',
      listTop: '<div id="stPreview"></div>',
      bulkOps: '<span class="adm-bops"><select class="select" id="bopAct" aria-label="Что сделать с выбранными"><option value="">Изменить…</option><option value="price">Цена, ₽</option><option value="percent">Цена ±%</option><option value="discount">Скидка %</option><option value="nodiscount">Убрать скидку</option><option value="show">Показать на сайте</option><option value="hide">Скрыть с сайта</option></select><input class="input num" id="bopVal" type="number" step="1" placeholder="0" hidden aria-label="Значение"><button class="btn sm" type="button" id="bopGo" disabled>Применить</button></span>',
      onBulkOps: bindProductOps, mountList: bindStockFile,
      sub: 'Нажмите на строку, чтобы изменить товар: цены, цвета, фото, размеры и остатки. Галочками можно выбрать несколько товаров или все сразу и удалить их.',
      itemTitle: function (x) { return x.name; },
      view: function (x) { return '<a class="btn ghost sm" href="#/product/' + esc(x.slug) + '">Открыть на сайте</a>'; },
      blank: function () { return { name: '', slug: '', gender: 'women', categoryId: (DATA.categories[0] || {}).id || '', price: 0, compareAt: 0, tags: ['new'], description: '', composition: '', care: '', colors: [newColor(1, '#3a3734')], active: true, createdAt: new Date().toISOString().slice(0, 10) }; },
      cols: ['', 'Название', 'Для кого', 'Категория', 'Цвета', 'Цена', 'Остаток', 'В продаже'],
      row: function (p) {
        var c = DATA.categories.find(function (x) { return x.id === p.categoryId; }), st = productStock(p), pr = Pricing.productPrice(p, DATA.promotions);
        var cs = Pricing.colorsOf(p);
        return ['<img class="adm-thumb" src="' + esc(A().imgOf(p)) + '" alt="">', esc(p.name) + (p.sku ? '<div class="muted num" style="font-size:12px">' + esc(p.sku) + '</div>' : ''), esc({ women: 'Женщинам', men: 'Мужчинам', kids: 'Детям' }[p.gender] || 'Унисекс'), esc(c ? c.name : '—'),
          '<span class="card-swatches" title="' + esc(cs.map(function (x) { return x.name; }).join(', ')) + '">' + cs.map(function (x) { return '<i style="background:' + esc(x.hex || 'var(--surface-2)') + '"></i>'; }).join('') + '</span>',
          '<span class="num">' + fmt(pr.price) + (pr.oldPrice ? ' <s class="muted">' + fmt(pr.oldPrice) + '</s>' : '') + '</span>', '<span class="num' + (st === 0 ? ' bad' : st < 4 ? ' warn' : '') + '">' + st + '</span>', onOff(p.active !== false)];
      },
      fields: function () {
        return [
          { section: 'Основное' },
          { k: 'name', label: 'Название', wide: true },
          { k: 'sku', label: 'Артикул', hint: 'Заполнится сам: ALB-0001, ALB-0002… Можно указать свой — латиница, цифры, дефис' },
          { k: 'categoryId', label: 'Категория', type: 'select', options: catOpts() },
          { k: 'gender', label: 'Для кого', type: 'select', options: [['women', 'Женщинам'], ['men', 'Мужчинам'], ['kids', 'Детям'], ['unisex', 'Унисекс — женщинам и мужчинам']] },
          { k: 'price', label: 'Цена, ₽', type: 'number', hint: 'Одна для всех цветов' },
          { k: 'compareAt', label: 'Старая цена, ₽', type: 'number', hint: 'Если больше цены — показывается зачёркнутой. Оставьте 0, если скидки нет.' },
          { k: 'badges', type: 'badges' },
          { k: 'active', label: 'Показывать в магазине', type: 'checkbox' },
          { section: 'Доставка' },
          { k: 'parcel', type: 'parcel' },
          { section: 'Описание' },
          { k: 'description', label: 'Описание', type: 'textarea' },
          { k: 'composition', label: 'Состав — свой текст', type: 'textarea', rows: 2, hint: 'Нужен, только если состава нет среди вариантов в «Характеристиках» ниже' },
          { k: 'care', label: 'Уход — дополнительно', type: 'textarea', rows: 2, hint: 'Основное отмечается значками в «Характеристиках». Сюда — то, чего там нет' },
          { section: 'Образ и предзаказ' },
          { k: 'look', label: 'С этим носят — до 4 вещей', type: 'look', max: 4, hint: 'В карточке товара появится блок «Соберите образ»: покупатель выберет размеры и добавит все вещи одной кнопкой' },
          { k: 'preorder', label: 'Предзаказ: можно заказать размеры, которых нет в наличии', type: 'checkbox', hint: 'Подходит для вещей, которые ещё шьются. Такие заказы приходят с пометкой «предзаказ»' },
          { k: 'preorderShip', label: 'Когда отправим по предзаказу', type: 'date' },
          { k: 'preorderLimit', label: 'Мест в партии', type: 'number', hint: 'Сколько вещей можно заказать заранее. 0 — без ограничения' },
          { section: 'Служебное' },
          { k: 'slug', label: 'Адрес страницы', hint: 'Латиницей. Заполнится сам из названия, если оставить пустым.' },
          { k: 'createdAt', label: 'Дата поступления', type: 'date', hint: 'Для сортировки «Сначала новые»' }
        ];
      },
      extra: function (p) {
        colorsState = clone(Pricing.colorsOf(p));
        return waitingForProduct(p) + specsEditorHtml(p) + '<div class="adm-colors"><h4 class="adm-sub">Цвета, фото и остатки</h4><p class="muted" style="font-size:14px;margin-bottom:14px;max-width:70ch">Все цвета — в одной карточке товара. У каждого цвета свои фото и остатки по размерам. Покупатель сначала выбирает цвет, потом размер. Первый цвет показывается в каталоге первым.</p><div id="colorBlocks"></div><button type="button" class="btn ghost sm" id="colorAdd">+ Добавить цвет</button></div>' + fitEditorHtml(p);
      },
      mount: function (box, item) {
        var p0Fit = function () { return (item && item.fit) || {}; };
        var wrap = $('.adm-colors', box), blocks = $('#colorBlocks', box);
        $('.adm-form', box).insertBefore(wrap, $$('.adm-sub', box)[1]); // перед «Описанием»
        var fitBox = $('.adm-fit', box); if (fitBox) wrap.parentNode.insertBefore(fitBox, wrap.nextSibling);
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
              '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ghost sm" data-szadd>+ Размер</button>' + (i > 0 ? '<button type="button" class="btn ghost sm" data-szcopy>Размеры как у «' + esc(colorsState[0].name || 'первого цвета') + '»</button>' : '') + '</div></div>';
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
        if (fitBox) bindFitEditor(fitBox, p0Fit(), box._syncColors);
        var specBox = $('.adm-specs', box);
        if (specBox) {
          // после «Описания», перед «Служебным»
          var svc = $$('.adm-form > .adm-sub', box).find(function (h) { return /Служебное/.test(h.textContent); });
          if (svc) svc.parentNode.insertBefore(specBox, svc);
          bindSpecsEditor(specBox);
        }
      },
      read: function (box, p) {
        p.colors = clone(box._syncColors());
        var fb = $('.adm-fit', box); if (fb) { var f = readFitEditor(fb); if (f) p.fit = f; else delete p.fit; }
        var sb = $('.adm-specs', box); if (sb) { var sp = readSpecsEditor(sb); if (Object.keys(sp).length) p.specs = sp; else delete p.specs; }
        delete p.color; delete p.images; delete p.sizes; delete p.art;
        if (!p.slug) p.slug = translit(p.name);
        p.slug = translit(p.slug);
      },
      validate: function (p, all) {
        if (!p.name) return 'Укажите название';
        if (!p.price) return 'Укажите цену';
        if (!p.colors.length) return 'Добавьте хотя бы один цвет';
        var badFit = ((p.fit && p.fit.rows) || []).find(function (r) { return (r.hMin && r.hMax && r.hMin > r.hMax) || (r.kMin && r.kMax && r.kMin > r.kMax); });
        if (badFit) return 'Мерки, размер ' + badFit.size + ': «от» больше, чем «до»';
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
      duplicate: function (p) { p.id = uid('p'); p.sku = ''; p.name += ' (копия)'; p.slug = translit(p.name) + '-' + Math.random().toString(36).slice(2, 5); p.active = false; return p; }
    });
    // «Приход товара»: в списке — для любого товара, в карточке — сразу для этого
    var hd = $('.adm-head', m);
    if (hd && q.id !== 'new') { hd.insertAdjacentHTML('beforeend', '<button class="btn ghost rcv-open" type="button" id="rcvOpen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></svg><span>Приход товара</span></button>'); $('#rcvOpen').addEventListener('click', function () { receiveModal(q.id || ''); }); }
  }
  /* ---------- Приход товара ----------
     Пришла партия: сколько штук каждого цвета и размера и сколько стоила одна вещь.
     Остатки растут сразу, сумма закупки попадает в «Финансы», себестоимость пересчитывается */
  function receiveModal(pid) {
    var prods = DATA.products.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
    if (!prods.length) { toast('Сначала добавьте товар', true); return; }
    var p = prods.find(function (x) { return x.id === pid; }) || prods[0];
    var fin = DATA.finance || {}, cats = (fin.categories || []).filter(function (c) { return c.kind === 'purchase'; });
    var today = new Date(); today = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var recent = (DATA.receipts || []).slice().reverse().slice(0, 5);
    A().openModal('<div class="rcv"><span class="eyebrow">Склад</span><h3 class="serif" style="font-size:32px;margin:12px 0 6px">Приход товара</h3><p class="muted rcv-lead">Остатки увеличатся сразу, покупатели из списка «Сообщить о поступлении» получат письмо. Сумма закупки запишется в «Финансы», себестоимость пересчитается.</p>' +
      '<div class="rcv-top"><label class="field"><span>Товар</span><select class="input" id="rcvP">' + prods.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span>Дата</span><input class="input" type="date" id="rcvD" value="' + today + '"></label></div>' +
      '<div id="rcvGrid"></div>' +
      '<div class="rcv-money"><label class="field"><span>Цена одной вещи, ₽ <small class="muted">— пошив, ткань, фурнитура</small></span><input class="input num" type="number" min="0" step="1" id="rcvU" placeholder="Например, 1200"></label>' +
        '<label class="field"><span>Категория в «Финансах»</span><select class="input" id="rcvC">' + cats.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="rcv-cost" role="radiogroup" aria-label="Себестоимость"><label><input type="radio" name="rcvM" value="avg" checked><span><b>Средняя по складу</b><small>старые и новые вещи вместе</small></span></label><label><input type="radio" name="rcvM" value="set"><span><b>Новая цена</b><small>себестоимость = цена этой партии</small></span></label><label><input type="radio" name="rcvM" value="keep"><span><b>Не менять</b><small>оставить как есть</small></span></label></div>' +
      '<label class="field"><span>Комментарий <small class="muted">— необязательно</small></span><input class="input" id="rcvN" maxlength="200" placeholder="Например, партия от швейного цеха «Нить»"></label>' +
      '<div class="rcv-sum" id="rcvSum"></div><p class="form-error" id="rcvErr"></p><button class="btn block" type="button" id="rcvGo">Принять на склад</button>' +
      (recent.length ? '<div class="rcv-hist"><b>Последние приходы</b>' + recent.map(function (r) { return '<div class="rcv-h"><span><b>' + esc(r.name) + '</b><small>' + esc(r.date.split('-').reverse().join('.')) + ' · ' + r.qty + ' шт.' + (r.total ? ' · ' + fmt(r.total) : '') + '</small></span><button type="button" class="link" data-rcvx="' + esc(r.id) + '">Отменить</button></div>'; }).join('') + '</div>' : '') + '</div>');
    var cur = function () { return DATA.products.find(function (x) { return x.id === $('#rcvP').value; }); };
    function grid() {
      var pr = cur(), cs = Pricing.colorsOf(pr), cost = Number((fin.costs || {})[pr.id]) || 0;
      $('#rcvGrid').innerHTML = '<div class="rcv-grid">' + cs.map(function (c) {
        return '<div class="rcv-color"><div class="rcv-ch"><i style="background:' + esc(c.hex || '#ccc') + '"></i><b>' + esc(c.name || 'Цвет') + '</b></div><div class="rcv-sizes">' + (c.sizes || []).map(function (z) {
          return '<label class="rcv-sz"><span>' + esc(z.size) + '</span><input class="input num" type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-c="' + esc(c.id) + '" data-s="' + esc(z.size) + '"><small>было ' + (Number(z.stock) || 0) + '</small></label>';
        }).join('') + '</div></div>';
      }).join('') + '</div><p class="muted rcv-now">Сейчас себестоимость: ' + (cost ? '<b>' + fmt(cost) + '</b>' : 'не указана') + '</p>';
      $$('#rcvGrid input').forEach(function (i) { i.addEventListener('input', sum); });
      sum();
    }
    function lines() { return $$('#rcvGrid input').map(function (i) { return { colorId: i.getAttribute('data-c'), size: i.getAttribute('data-s'), qty: Math.max(0, Math.round(Number(i.value) || 0)) }; }).filter(function (l) { return l.qty > 0; }); }
    function sum() {
      var q = lines().reduce(function (s, l) { return s + l.qty; }, 0), u = Number($('#rcvU').value) || 0, pr = cur(), mode = ($('input[name="rcvM"]:checked') || {}).value;
      var units0 = Pricing.colorsOf(pr).reduce(function (s, c) { return s + (c.sizes || []).reduce(function (t, z) { return t + Math.max(0, Number(z.stock) || 0); }, 0); }, 0), c0 = Number((fin.costs || {})[pr.id]) || 0;
      var c1 = !u || mode === 'keep' ? c0 : mode === 'set' || !c0 || !units0 ? u : Math.round((units0 * c0 + q * u) / (units0 + q));
      $('#rcvSum').innerHTML = '<div><span>Штук</span><b class="num">' + q + '</b></div><div><span>Сумма закупки</span><b class="num">' + fmt(q * u) + '</b></div><div><span>Себестоимость станет</span><b class="num">' + (c1 ? fmt(c1) : '—') + '</b></div>';
      $('#rcvGo').textContent = q ? 'Принять на склад · ' + q + ' шт.' : 'Принять на склад';
    }
    $('#rcvP').addEventListener('change', grid); $('#rcvU').addEventListener('input', sum); $$('input[name="rcvM"]').forEach(function (r) { r.addEventListener('change', sum); });
    grid();
    $('#rcvGo').addEventListener('click', async function () {
      var b = this, err = $('#rcvErr'), ls = lines(); err.textContent = '';
      if (!ls.length) { err.textContent = 'Укажите, сколько штук пришло'; return; }
      if (!cats.length && Number($('#rcvU').value) > 0) { err.textContent = 'В «Финансах» нет категории закупки'; return; }
      b.disabled = true;
      try {
        var r = await A().API.adminPost('finance/receive', { productId: $('#rcvP').value, date: $('#rcvD').value, lines: ls, unitCost: $('#rcvU').value, categoryId: $('#rcvC').value, costMode: ($('input[name="rcvM"]:checked') || {}).value, note: $('#rcvN').value.trim() });
        A().closePanels(); await afterSave('Принято на склад: ' + r.receipt.qty + ' шт.' + (r.receipt.total ? ', закупка ' + fmt(r.receipt.total) + ' записана в «Финансы»' : ''));
      } catch (e) { err.textContent = A().errMsg(e); b.disabled = false; }
    });
    $$('[data-rcvx]').forEach(function (x) { bindConfirm(x, async function () {
      try { await call('DELETE', 'finance/receive/' + x.getAttribute('data-rcvx')); A().closePanels(); await afterSave('Приход отменён: остатки и закупка возвращены'); } catch (e) { $('#rcvErr').textContent = A().errMsg(e); }
    }); });
  }
  // DELETE/GET к API панели (у Store — только POST/PUT)
  async function call(method, path) {
    var r = await fetch('api/admin/' + path, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }); var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.ok === false) throw new Error(j.error || 'Не получилось'); return j;
  }
  /* Характеристики: варианты отмечаются нажатием (js/specs.js), в карточке — блок «Характеристики» */
  function specsEditorHtml(p) {
    var s = p.specs || {};
    var chip = function (k, v, label, on) { return '<button type="button" class="chip spec-chip' + (on ? ' on' : '') + '" data-spec="' + k + '" data-v="' + esc(v) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(label) + '</button>'; };
    var row = function (it) {
      var v = s[it.k], cur = it.multi ? (Array.isArray(v) ? v : []) : v;
      var isCustom = !it.multi && typeof cur === 'string' && cur.indexOf('custom:') === 0;
      return '<div class="spec-row" data-spec-row="' + it.k + '"' + (it.multi ? ' data-multi="1"' : '') + '><span class="spec-label">' + esc(it.label) + (it.multi ? ' <small>можно несколько</small>' : '') + '</span><div class="spec-chips">' +
        it.options.map(function (o) { return chip(it.k, o[0], o[1], it.multi ? cur.indexOf(o[0]) !== -1 : cur === o[0]); }).join('') +
        (it.custom ? '<input class="input spec-custom" data-spec-custom="' + it.k + '" placeholder="' + esc(it.custom) + '" value="' + esc(isCustom ? cur.slice(7) : '') + '">' : '') + '</div></div>';
    };
    var care = s.care || [];
    return '<div class="adm-specs"><h4 class="adm-sub">Характеристики</h4><p class="muted" style="font-size:14px;margin-bottom:16px;max-width:72ch">Отметьте подходящее — в карточке товара появится аккуратный блок «Характеристики», а поисковики получат их в описании товара. Повторное нажатие снимает отметку.</p>' +
      Specs.GROUPS.map(function (g) { return '<div class="spec-group"><h5>' + esc(g.title) + '</h5>' + g.items.map(row).join('') + '</div>'; }).join('') +
      '<div class="spec-group"><h5>Уход</h5><div class="spec-row" data-spec-row="care" data-multi="1"><span class="spec-label">Значки на этикетке <small>можно несколько</small></span><div class="spec-chips">' +
        Specs.CARE.map(function (c) { return '<button type="button" class="chip spec-chip spec-care' + (care.indexOf(c[0]) !== -1 ? ' on' : '') + '" data-spec="care" data-v="' + c[0] + '" aria-pressed="' + (care.indexOf(c[0]) !== -1) + '">' + careIcon(c[0]) + esc(c[1]) + '</button>'; }).join('') + '</div></div></div>' +
    '</div>';
  }
  function careIcon(k) { return window.App && App.careIcon ? App.careIcon(k) : ''; }
  function bindSpecsEditor(el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.spec-chip'); if (!b) return;
      var row = b.closest('[data-spec-row]'), multi = row.hasAttribute('data-multi'), on = !b.classList.contains('on');
      if (!multi) { $$('.spec-chip', row).forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); var ci = $('.spec-custom', row); if (ci && on) ci.value = ''; }
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    el.addEventListener('input', function (e) {
      var ci = e.target.closest('.spec-custom'); if (!ci || !ci.value.trim()) return;
      $$('.spec-chip', ci.closest('[data-spec-row]')).forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    });
  }
  function readSpecsEditor(el) {
    var out = {};
    $$('[data-spec-row]', el).forEach(function (row) {
      var k = row.getAttribute('data-spec-row'), on = $$('.spec-chip.on', row).map(function (b) { return b.getAttribute('data-v'); });
      if (row.hasAttribute('data-multi')) { if (on.length) out[k] = on; return; }
      var ci = $('.spec-custom', row);
      if (on[0]) out[k] = on[0]; else if (ci && ci.value.trim()) out[k] = 'custom:' + ci.value.trim();
    });
    return Specs.clean(out);
  }

  /* Мерки изделия и подбор размера: ширина, длина, рукав и на какой рост/вес рассчитан каждый размер */
  var FIT_TYPICAL = { XS: [150, 165, 45, 58], S: [160, 172, 52, 66], M: [170, 180, 62, 76], L: [176, 186, 72, 86], XL: [182, 192, 82, 96], '2XL': [186, 198, 92, 110], XXL: [186, 198, 92, 110], '3XL': [190, 205, 105, 125] };
  var FIT_COLS = [['w', 'Ширина'], ['l', 'Длина'], ['sl', 'Рукав'], ['hMin', 'Рост от'], ['hMax', 'Рост до'], ['kMin', 'Вес от'], ['kMax', 'Вес до']];
  /* Таблица размеров товара (13.64.3): своя у каждого товара, покупатель видит её в карточке товара.
     Мерки на каждый размер: ширина, длина, рукав, свои столбцы (например «Обхват талии») и рост/вес — на кого рассчитан размер */
  function fitEditorHtml(p) {
    var f = p.fit || {};
    return '<div class="adm-fit"><h4 class="adm-sub">Таблица размеров</h4><p class="muted" style="font-size:14px;margin-bottom:14px;max-width:72ch">Своя у каждого товара — покупатель видит её в карточке товара по кнопке «Таблица размеров». Мерки готовой вещи в сантиметрах на каждый размер: вещь кладут на стол, ширина — от шва до шва под рукавами, длина — от верхней точки плеча до низа. Нужен другой замер — добавьте свой столбец. Рост и вес — на кого рассчитан размер: по ним работает «Подобрать размер».</p>' +
      '<div class="table-wrap"><table class="adm-fit-t"><thead data-fit-head></thead><tbody data-fit-body></tbody></table></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="btn ghost sm" data-fit-col>+ Свой столбец</button><button type="button" class="btn ghost sm" data-fit-sync>Обновить размеры из цветов</button><button type="button" class="btn ghost sm" data-fit-typical>Заполнить пустой рост и вес типовыми для оверсайза</button></div>' +
      '<div class="adm-form" style="margin-top:16px"><label class="field" style="grid-column:1/-1"><span>Подсказка над таблицей</span><input class="input" data-fit-note maxlength="300" value="' + esc(f.note || '') + '" placeholder="Например: брюки измерены в расслабленном виде, длина — по внутреннему шву"></label>' +
      '<label class="field"><span>На модели размер</span><input class="input" data-fit-msize value="' + esc(f.modelSize || '') + '" placeholder="например, L"></label><label class="field"><span>Рост модели, см</span><input class="input" type="number" data-fit-mh value="' + esc(f.modelHeight || '') + '" placeholder="например, 182"></label></div></div>';
  }
  function bindFitEditor(el, fit, getColors) {
    var head = $('[data-fit-head]', el), body = $('[data-fit-body]', el), rows = ((fit && fit.rows) || []).slice(), cols = ((fit && fit.cols) || []).slice();
    function sizes() { var out = []; (getColors() || []).forEach(function (c) { (c.sizes || []).forEach(function (s) { if (s.size && out.indexOf(s.size) === -1) out.push(s.size); }); }); return out; }
    function current() {
      cols = $$('[data-xc]', head).map(function (i) { return i.value.trim().slice(0, 40); });
      return $$('tr', body).filter(function (tr) { return tr.hasAttribute('data-size'); }).map(function (tr) {
        var r = { size: tr.getAttribute('data-size') };
        FIT_COLS.forEach(function (c) { var v = parseFloat(String($('[data-f="' + c[0] + '"]', tr).value).replace(',', '.')); if (v > 0) r[c[0]] = v; });
        var x = $$('[data-x]', tr).map(function (i) { return i.value.trim().slice(0, 30); }); if (x.some(Boolean)) r.x = x;
        return r;
      });
    }
    function draw(list) {
      head.innerHTML = '<tr><th>Размер</th>' + FIT_COLS.slice(0, 3).map(function (c) { return '<th>' + c[1] + ', см</th>'; }).join('') +
        cols.map(function (c, i) { return '<th><span class="adm-cell"><input class="input" data-xc value="' + esc(c) + '" placeholder="Название" aria-label="Название столбца"><button type="button" class="adm-x" data-xdel="' + i + '" title="Удалить столбец">✕</button></span></th>'; }).join('') +
        FIT_COLS.slice(3).map(function (c) { return '<th>' + c[1] + (c[0] === 'kMin' || c[0] === 'kMax' ? ', кг' : ', см') + '</th>'; }).join('') + '</tr>';
      var inp = function (r, c) { return '<td><input class="input num" type="number" step="0.5" min="0" data-f="' + c[0] + '" value="' + esc(r[c[0]] || '') + '" aria-label="' + esc(r.size + ': ' + c[1]) + '"></td>'; };
      body.innerHTML = list.map(function (r) {
        return '<tr data-size="' + esc(r.size) + '"><th>' + esc(r.size) + '</th>' + FIT_COLS.slice(0, 3).map(function (c) { return inp(r, c); }).join('') +
          cols.map(function (c, i) { return '<td><input class="input" data-x value="' + esc((r.x || [])[i] || '') + '" aria-label="' + esc(r.size + ': ' + (c || 'свой столбец')) + '"></td>'; }).join('') +
          FIT_COLS.slice(3).map(function (c) { return inp(r, c); }).join('') + '</tr>';
      }).join('') || '<tr><td colspan="' + (8 + cols.length) + '" class="muted">Сначала добавьте размеры в цвета товара</td></tr>';
    }
    function merge(prev) { return sizes().map(function (sz) { return prev.find(function (r) { return r.size === sz; }) || { size: sz }; }); }
    draw(merge(rows));
    head.addEventListener('click', function (e) {
      var b = e.target.closest('[data-xdel]'); if (!b) return;
      var list = current(), i = +b.getAttribute('data-xdel');
      cols.splice(i, 1); list.forEach(function (r) { if (r.x) r.x.splice(i, 1); }); draw(list);
    });
    $('[data-fit-col]', el).addEventListener('click', function () {
      var list = current(); if (cols.length >= 6) { toast('Не больше 6 своих столбцов', true); return; }
      cols.push(''); draw(list); var ins = $$('[data-xc]', head); ins[ins.length - 1].focus();
    });
    $('[data-fit-sync]', el).addEventListener('click', function () { draw(merge(current())); });
    $('[data-fit-typical]', el).addEventListener('click', function () {
      var list = merge(current()), n = 0;
      list.forEach(function (r) { var t = FIT_TYPICAL[String(r.size).toUpperCase()]; if (!t) return; ['hMin', 'hMax', 'kMin', 'kMax'].forEach(function (k, i) { if (!r[k]) { r[k] = t[i]; n++; } }); });
      draw(list); toast(n ? 'Заполнено — проверьте и поправьте под свои лекала' : 'Нечего заполнять: типовые значения есть для XS–3XL', !n);
    });
    el._fitRows = current;
    el._fitCols = function () { current(); return cols; };
  }
  function readFitEditor(el) {
    var rows = (el._fitRows ? el._fitRows() : []).filter(function (r) { return Object.keys(r).length > 1; });
    var cols = el._fitCols ? el._fitCols() : [];
    // пустые свои столбцы не сохраняем
    var keep = cols.map(function (c, i) { return !!c || rows.some(function (r) { return r.x && r.x[i]; }); });
    var outCols = cols.filter(function (c, i) { return keep[i]; }).map(function (c) { return c || 'Мерка'; });
    rows.forEach(function (r) { if (r.x) { r.x = r.x.filter(function (v, i) { return keep[i]; }); if (!r.x.some(Boolean)) delete r.x; } });
    var ms = $('[data-fit-msize]', el).value.trim().slice(0, 10), mh = Math.round(Number($('[data-fit-mh]', el).value) || 0), note = $('[data-fit-note]', el).value.trim().slice(0, 300);
    if (!rows.length && !ms && !mh && !note) return null;
    return { rows: rows, cols: outCols, note: note, modelSize: ms, modelHeight: mh > 0 ? mh : '' };
  }
  function newColor(n, hex, kind) { return { id: uid('col'), name: '', hex: hex, images: [], sizes: [], art: { kind: kind || 'tee', tone: hex } }; }
  function sizeRow(s) { return '<div class="adm-size-row"><input class="input" data-sz placeholder="Размер" value="' + esc(s.size) + '" aria-label="Размер"><input class="input num" data-st type="number" min="0" placeholder="Остаток" value="' + esc(s.stock) + '" aria-label="Остаток, шт."><span class="muted" style="font-size:14px">шт.</span><button type="button" class="adm-x" data-szrm title="Удалить">✕</button></div>'; }

  // История заказа: оформление, смена статуса и оплаты, трек-номер, возвраты — новое сверху
  function historyCard(o) {
    var h = (o.history || []).slice().reverse();
    if (!h.length) h = [{ at: o.createdAt, text: 'Заказ оформлен на сайте', by: 'customer' }];
    var WHO = { admin: 'в панели', customer: 'покупатель', system: 'автоматически' };
    return '<div class="adm-card"><h3 class="adm-h3">История заказа</h3><ol class="o-hist">' + h.slice(0, 40).map(function (x) {
      return '<li><span class="o-hist-dot" aria-hidden="true"></span><div><b>' + esc(x.text) + '</b><small>' + esc(new Date(x.at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) + ' · ' + (WHO[x.by] || '') + '</small></div></li>';
    }).join('') + '</ol>' + ((o.history || []).length ? '' : '<p class="muted" style="font-size:12.5px;margin:10px 0 0">Подробная история ведётся для заказов с 1 ноября 2026.</p>') + '</div>';
  }

  /* ================= Категории ================= */
  function categories(m, q) {
    collection(m, q, {
      key: 'categories', prefix: 'c', title: 'Категории', newTitle: 'Новая категория', addLabel: 'Добавить категорию',
      sub: 'Категории показываются на главной, в меню и фильтрах каталога в порядке номера.',
      itemTitle: function (x) { return x.name; },
      blank: function () { return { name: '', slug: '', image: '', art: { kind: 'tee', tone: '#3b3b3f' }, order: DATA.categories.length + 1 }; },
      sort: function (a, b) { return (a.order || 0) - (b.order || 0); },
      cols: ['', 'Название', 'Раздел', 'Порядок', 'Товаров'],
      row: function (c) { return ['<img class="adm-thumb" src="' + esc(c.image || Art.make(c.art)) + '" alt="">', esc(c.name), ({ women: 'Женщинам', men: 'Мужчинам', kids: 'Детям', unisex: 'Женщинам и мужчинам' })[c.gender] || '<span class="muted">по товарам</span>', '<span class="num">' + (c.order || 0) + '</span>', '<span class="num">' + DATA.products.filter(function (p) { return p.categoryId === c.id; }).length + '</span>']; },
      fields: function () { return [{ k: 'name', label: 'Название' }, { k: 'gender', label: 'Раздел', type: 'select', options: [['', 'Определять по товарам'], ['women', 'Женщинам'], ['men', 'Мужчинам'], ['kids', 'Детям'], ['unisex', 'Женщинам и мужчинам']], hint: 'В каком разделе показывать категорию в меню, подвале и каталоге. «По товарам» — по тому, для кого товары внутри; пустая категория — по названию (платья и юбки — женские)' }, { k: 'order', label: 'Порядок', type: 'number' }, { k: 'image', label: 'Обложка', type: 'image', hint: 'Вертикальное фото 3:4' }, { k: 'slug', label: 'Адрес', hint: 'Латиницей, заполнится сам' }]; },
      read: function (box, c) { c.slug = translit(c.slug || c.name); },
      validate: function (c, all) { if (!c.name) return 'Укажите название'; if (all.some(function (x) { return x.id !== c.id && x.slug === c.slug; })) return 'Такой адрес уже занят'; return ''; }
    });
    if (q.id && q.id !== 'new') {
      var n = DATA.products.filter(function (p) { return p.categoryId === q.id; }).length;
      if (n) { var del = $('#edDel'); if (del) { del.disabled = true; del.title = 'Сначала перенесите товары в другую категорию'; $('#edErr').textContent = 'В категории ' + n + ' тов. — удалить можно пустую категорию.'; $('#edErr').style.color = 'var(--muted)'; } }
    }
  }

  /* ================= Размерные сетки ================= */
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
    $('#uSearch').addEventListener('change', function (e) { window.ALB_NAV.go('#/admin?s=customers&q=' + encodeURIComponent(e.target.value)); });
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
      '<div class="adm-li"><span>Автообновление</span><span class="' + (u.checkError || stale ? 'bad' : '') + '">' + (u.checkError ? esc(u.checkError) : 'включено, проверка каждую минуту' + (u.checkedAt ? ' (последняя ' + when(u.checkedAt) + ')' : '')) + '</span></div></div>' +
      (u.lastError ? '<p class="form-error" style="margin-top:8px">' + esc(u.lastError) + (u.failedAt ? ' · ' + when(u.failedAt) : '') + '. Сайт работает на прежней версии.</p>' : '');
  }

  /* ================= Бонусная программа ================= */
  var BONUS_OPS = { earn: 'Начислено за заказ', spend: 'Оплата заказа', 'return': 'Возврат за отмену', revoke: 'Забрано: заказ отменён', manual: 'Вручную' };
  function bonusSection(m) {
    settingsForm(m, 'Бонусы', '1 бонус = 1 ₽. Бонусы получают зарегистрированные покупатели. Под каждым товаром на сайте видно, сколько бонусов придёт за покупку, а при оформлении бонусами можно оплатить весь заказ.', [
      { k: 'enabled', label: 'Бонусная программа включена', type: 'checkbox', hint: 'Если выключить, бонусы перестанут начисляться и списываться, но останутся на счетах покупателей' },
      { k: 'percent', label: 'Сколько процентов от покупки начислять', type: 'number', step: 0.5, hint: 'Например, 5 — за товар за 1 500 ₽ придёт 75 бонусов' },
      { k: 'onlineExtra', label: 'Дополнительно за онлайн-оплату, %', type: 'number', step: 0.5, hint: 'Сверху к основному проценту, если покупатель платит онлайн, а не при получении. Такие заказы почти всегда выкупают. 0 — выключено' },
      { k: 'creditOn', label: 'Когда начислять', type: 'select', options: [['paid', 'После оплаты заказа'], ['done', 'Когда заказ выполнен (получен покупателем)']], hint: 'При отмене заказа или возврате денег начисленные бонусы забираются, а потраченные возвращаются' }
    ], {}, function (s) { s.bonus = s.bonus || { enabled: true, percent: 5, creditOn: 'paid' }; return s.bonus; }, function (s, o) {
      if (!(o.percent >= 0 && o.percent <= 100)) return 'Процент должен быть от 0 до 100';
      if (!(o.onlineExtra >= 0 && o.onlineExtra <= 50)) return 'Бонус за онлайн-оплату — от 0 до 50%';
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

  /* ================= Аналитика: своя воронка + Яндекс Метрика ================= */
  function statDays(n) {
    var out = [], st = DATA.stats || {};
    for (var i = n - 1; i >= 0; i--) { var d = new Date(Date.now() + 3 * 36e5 - i * 864e5).toISOString().slice(0, 10); out.push(Object.assign({ day: d, v: 0, p: 0, c: 0, k: 0, pv: 0, src: {}, dev: { m: 0, d: 0 } }, st[d] || {})); }
    // Заказ — одна покупка: без обменов (это тот же заказ), отменённых и брошенных на онлайн-оплате
    var ord = DATA.orders.filter(function (o) { return !o.test && o.payment.method !== 'exchange' && o.status !== 'canceled' && !(o.payment.method === 'online' && o.payment.status !== 'paid' && o.payment.status !== 'refunded'); });
    out.forEach(function (x) {
      var list = ord.filter(function (o) { return new Date(new Date(o.createdAt).getTime() + 3 * 36e5).toISOString().slice(0, 10) === x.day; });
      x.o = list.length; x.rev = list.reduce(function (s, o) { return s + o.total - (o.refunded || 0); }, 0);
    });
    return out;
  }
  function sumDays(days) {
    var t = { v: 0, p: 0, c: 0, k: 0, pv: 0, o: 0, rev: 0, src: {}, m: 0, d: 0 };
    days.forEach(function (x) { ['v', 'p', 'c', 'k', 'pv', 'o', 'rev'].forEach(function (k) { t[k] += x[k] || 0; }); Object.keys(x.src || {}).forEach(function (k) { t.src[k] = (t.src[k] || 0) + x.src[k]; }); t.m += (x.dev || {}).m || 0; t.d += (x.dev || {}).d || 0; });
    return t;
  }
  var SRC_NAMES = { instagram: 'Instagram', telegram: 'Telegram', vk: 'ВКонтакте', yandex: 'Яндекс', google: 'Google', direct: 'Прямые заходы', other: 'Другие сайты' };
  function pct(a, b) { return b ? (Math.round(Math.min(a, b) / b * 1000) / 10).toString().replace('.', ',') + '%' : '—'; }
  function funnelHtml(t) {
    var steps = [['Зашли на сайт', t.v], ['Открыли товар', t.p], ['Положили в корзину', t.c], ['Начали оформление', t.k], ['Оформили заказ', t.o]];
    var max = Math.max(1, t.v), worst = -1, worstRate = 2;
    steps.forEach(function (x, i) { if (i && steps[i - 1][1] >= 5) { var r = x[1] / steps[i - 1][1]; if (r < worstRate) { worstRate = r; worst = i; } } });
    return '<div class="an-funnel">' + steps.map(function (x, i) {
      var h = Math.max(4, Math.min(100, Math.round(x[1] / max * 100)));
      return '<div class="an-step' + (i === worst ? ' is-worst' : '') + '"><div class="an-col"><i style="height:' + h + '%"></i></div><b class="num">' + x[1].toLocaleString('ru-RU') + (i ? ' <span>' + pct(x[1], steps[i - 1][1]) + '</span>' : '') + '</b><small>' + x[0] + (i === worst ? ' · здесь уходят чаще всего' : '') + '</small></div>';
    }).join('') + '</div>';
  }
  /* ================= Финансы (13.46): отчёт о прибыли, операции, себестоимость, настройки ================= */
  // Расчёт — public/js/finance.js; сервер хранит только расходы, себестоимость и ставки
  var FIN_TABS = [['report', 'Отчёт'], ['ops', 'Операции'], ['costs', 'Себестоимость'], ['settings', 'Настройки']];
  var FIN_PER = [['week', 'Неделя'], ['month', 'Месяц'], ['quarter', 'Квартал'], ['year', 'Год'], ['custom', 'Свой период']];
  function finInput() { return { orders: DATA.orders, products: DATA.products, expenses: DATA.expenses || [], finance: DATA.finance || Finance.defaults() }; }
  function finRub(n, sign) { n = Math.round(n || 0); return (n < 0 ? '− ' : sign && n > 0 ? '+ ' : '') + fmt(Math.abs(n)); }
  function finPct(a, b, digits) { if (!b) return '—'; var v = a / b * 100; return (digits ? v.toFixed(1).replace('.', ',') : Math.round(v)) + '%'; }
  // Изменение к прошлому периоду: good — рост это хорошо (выручка, прибыль) или плохо (расходы)
  function finDelta(a, b, good) {
    if (!b && !a) return '<span class="fn-d">—</span>';
    if (!b) return '<span class="fn-d">новое</span>';
    var d = Math.round((a - b) / Math.abs(b) * 100);
    if (!d) return '<span class="fn-d">0%</span>';
    var cls = good === undefined ? '' : (d > 0) === good ? ' up' : ' down';
    return '<span class="fn-d' + cls + '">' + (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) + '%</span>';
  }
  function finLink(q, patch) {
    var o = { s: 'finance', tab: q.tab || 'report', p: q.p || 'month' };
    ['sh', 'from', 'to', 'f', 'miss'].forEach(function (k) { if (q[k]) o[k] = q[k]; });
    Object.keys(patch || {}).forEach(function (k) { if (patch[k] === null || patch[k] === '') delete o[k]; else o[k] = patch[k]; });
    return '#/admin?' + Object.keys(o).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&');
  }
  function finPeriod(q) { return Finance.period(q.p || 'month', Number(q.sh) || 0, q.from, q.to); }

  function financeSection(m, q) {
    if (!window.Finance) { m.innerHTML = '<p class="form-error">Не загрузился модуль расчёта. Обновите страницу.</p>'; return; }
    var tab = FIN_TABS.some(function (t) { return t[0] === q.tab; }) ? q.tab : 'report';
    q.tab = tab;
    var per = finPeriod(q), withPeriod = tab === 'report' || tab === 'ops';
    var perHtml = withPeriod ? '<div class="fn-per fn-noprint">' +
        '<div class="tabs fn-pertabs">' + FIN_PER.map(function (x) { return '<a href="' + finLink(q, { p: x[0], sh: null, from: x[0] === 'custom' ? (q.from || per.from) : null, to: x[0] === 'custom' ? (q.to || per.to) : null }) + '"' + (per.kind === x[0] ? ' class="on"' : '') + '>' + x[1] + '</a>'; }).join('') + '</div>' +
        (per.kind === 'custom'
          ? '<span class="fn-custom"><input class="input" type="date" id="fnFrom" value="' + esc(per.from) + '" aria-label="С"> — <input class="input" type="date" id="fnTo" value="' + esc(per.to) + '" aria-label="По"></span>'
          : '<span class="fn-nav"><a href="' + finLink(q, { sh: (per.shift || 0) + 1 }) + '" aria-label="Раньше">‹</a><b>' + esc(per.label) + '</b>' + (per.shift > 0 ? '<a href="' + finLink(q, { sh: per.shift - 1 || null }) + '" aria-label="Позже">›</a>' : '<span class="fn-nav-off">›</span>') + '</span>') +
      '</div>' : '';
    var acts = (tab === 'report' ? '<button class="btn ghost sm" type="button" id="fnCsv">Excel</button><button class="btn ghost sm" type="button" id="fnPdf">PDF</button>' : tab === 'ops' ? '<button class="btn ghost sm" type="button" id="fnCsv">Excel</button>' : '') +
      (tab === 'report' || tab === 'ops' ? '<button class="btn sm" type="button" id="fnAdd">+ Операция</button>' : '');
    m.innerHTML = '<div class="fn">' + head('Финансы', acts, tab === 'report' ? esc(per.label) + ' · сравнение с ' + esc(per.prevLabel) + '. Продажи, возвраты, комиссии и доставку СДЭК сайт считает сам, остальные расходы вы вносите в «Операциях».' : '') +
      '<div class="tabs adm-tabs fn-noprint">' + FIN_TABS.map(function (t) { return '<a href="' + finLink(q, { tab: t[0], f: null }) + '"' + (t[0] === tab ? ' class="on"' : '') + '>' + t[1] + '</a>'; }).join('') + '</div>' +
      perHtml + '<div id="fnBody"></div></div>';
    var body = $('#fnBody', m);
    if (per.kind === 'custom') ['#fnFrom', '#fnTo'].forEach(function (s) { $(s, m).addEventListener('change', function () { var a = $('#fnFrom', m).value, b = $('#fnTo', m).value; if (a && b) window.ALB_NAV.go(finLink(q, { p: 'custom', from: a, to: b })); }); });
    if ($('#fnAdd', m)) $('#fnAdd', m).addEventListener('click', function () { finExpenseModal(null, q); });
    if (tab === 'report') finReport(body, q, per);
    else if (tab === 'ops') finOps(body, q, per);
    else if (tab === 'costs') finCosts(body, q);
    else finSettings(body, q);
  }

  /* ---------- Отчёт ---------- */
  function finReport(box, q, per) {
    var r = Finance.report(finInput(), per), c = r.cur, p = r.prev, rev = c.revenue;
    var per100 = rev > 0 ? Math.round(c.net / rev * 100) : 0;
    var noCosts = !Object.keys((DATA.finance || {}).costs || {}).length && DATA.products.length;
    var html = '';
    // Без себестоимости прибыль завышена — говорим сразу и ведём туда, где её заполнить
    if (c.missingUnits > 0 || noCosts) html += '<div class="adm-alert fn-alert fn-noprint"><b>' + (c.missingUnits ? 'У ' + c.missingUnits + ' ' + plural(c.missingUnits, 'проданной вещи', 'проданных вещей', 'проданных вещей') + ' не указана себестоимость' : 'Себестоимость товаров ещё не указана') + ' — прибыль получается завышенной.</b> Укажите, сколько стоит пошив, — можно примерно, процентом от цены. <a class="link" href="' + finLink(q, { tab: 'costs', miss: 1 }) + '">Заполнить себестоимость</a></div>';

    // 1. Главное
    var gN = p.net ? Math.round((c.net - p.net) / Math.abs(p.net) * 100) : null;
    html += '<div class="fn-hero"><div class="fn-big' + (c.net < 0 ? ' loss' : '') + '"><span class="fn-eb">' + (c.net < 0 ? 'Убыток' : 'Чистая прибыль') + ' · ' + esc(per.label.toLowerCase()) + '</span><b class="num">' + finRub(c.net) + '</b>' +
      (gN != null ? '<span class="fn-pill' + (c.net >= p.net ? '' : ' bad') + '">' + (c.net >= p.net ? '▲ ' : '▼ ') + Math.abs(gN) + '% к ' + esc(per.prevLabel) + ' · было ' + finRub(p.net) + '</span>' : '') +
      '<p>' + (rev > 0 ? (c.net >= 0 ? 'Из каждых <strong>100 ₽</strong>, которые заплатили покупатели, у вас осталось <strong>' + per100 + ' ₽</strong> — после пошива, доставки, рекламы и налога.' : 'Расходы больше выручки на <strong>' + finRub(-c.net) + '</strong>. Посмотрите ниже, какая строка выросла сильнее всего.') : 'За этот период продаж не было. Расходы, если они есть, — в таблице ниже.') + '</p></div>' +
      '<div class="fn-kpis">' +
        '<div class="adm-stat"><span class="eyebrow">Выручка</span><b class="num">' + finRub(rev) + '</b>' + finDelta(rev, p.revenue, true) + '</div>' +
        '<div class="adm-stat"><span class="eyebrow">Все расходы</span><b class="num">' + finRub(c.expensesAll) + '</b><span class="fn-d">с себестоимостью и налогом</span></div>' +
        '<div class="adm-stat"><span class="eyebrow">Заказов · средний чек</span><b class="num">' + c.orders + (c.orders ? ' · ' + finRub(c.avg) : '') + '</b>' + (p.orders ? '<span class="fn-d' + (c.orders >= p.orders ? ' up' : ' down') + '">' + (c.orders >= p.orders ? '▲ ' : '▼ ') + Math.abs(c.orders - p.orders) + ' ' + plural(Math.abs(c.orders - p.orders), 'заказ', 'заказа', 'заказов') + '</span>' : '<span class="fn-d">оплаченных</span>') + '</div>' +
        '<div class="adm-stat"><span class="eyebrow">Реклама на 1 заказ</span><b class="num">' + (c.orders && c.ads ? finRub(c.adsPerOrder) : '—') + '</b>' + (c.orders && c.ads && p.adsPerOrder ? '<span class="fn-d ' + (c.adsPerOrder > p.adsPerOrder ? 'down' : 'up') + '">' + (c.adsPerOrder > p.adsPerOrder ? '▲ дороже на ' : '▼ дешевле на ') + finRub(Math.abs(c.adsPerOrder - p.adsPerOrder)) + '</span>' : '<span class="fn-d">категория «Реклама»</span>') + '</div>' +
      '</div></div>';

    // 2. Куда уходят 100 ₽
    var parts = [['c1', 'Себестоимость', c.cogs, 'пошив и ткань проданных вещей'], ['c2', 'Продажа и доставка', c.variable, 'СДЭК, комиссия ЮKassa, упаковка'], ['c3', 'Работа магазина', c.fixed, 'реклама, фото, сервисы'], ['c4', 'Налог', c.tax, 'УСН ' + String(r.finance.taxRate).replace('.', ',') + '% с выручки'], ['c5', c.net >= 0 ? 'Ваша прибыль' : 'Убыток', c.net, c.net >= 0 ? 'остаётся вам' : 'расходы больше выручки']];
    if (rev > 0) {
      var base = Math.max(rev, c.cogs + c.variable + c.fixed + c.tax);
      html += '<div class="adm-card fn-card"><h3 class="adm-h3">Куда уходят каждые 100 ₽ выручки</h3><p class="fn-lead">Одной полосой — из чего складывается цена, которую платит покупатель.</p>' +
        '<div class="fn-split">' + parts.filter(function (x) { return x[2] > 0; }).map(function (x) { var w = x[2] / base * 100; return '<div class="' + x[0] + '" style="flex:' + w.toFixed(2) + '" title="' + esc(x[1]) + ': ' + finRub(x[2]) + '">' + (w >= 6 ? Math.round(x[2] / rev * 100) + ' ₽' : '') + '</div>'; }).join('') + '</div>' +
        '<div class="fn-legend">' + parts.map(function (x) { return '<div><span><i class="' + x[0] + '"></i>' + esc(x[1]) + '</span><b class="num">' + finRub(x[2]) + '</b>' + esc(x[3]) + '</div>'; }).join('') + '</div></div>';
    }

    // 3. Отчёт о прибыли
    var row = function (cls, name, hint, a, b, good) {
      return '<tr class="' + cls + '"><td><div class="fn-lbl"><span>' + esc(name) + '</span>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</div></td><td class="r num">' + finRub(a) + '</td><td class="r num">' + (rev ? finPct(a, rev, 1) : '—') + (/sum|final/.test(cls) && rev > 0 ? '<span class="fn-bar"><i style="width:' + Math.max(0, Math.min(100, a / rev * 100)).toFixed(1) + '%"></i></span>' : '') + '</td><td class="r num">' + finRub(b) + '</td><td class="r">' + finDelta(a, b, good) + '</td></tr>';
    };
    var children = function (line) {
      var a = c.lines(line), b = p.lines(line), names = a.map(function (x) { return x.name; });
      b.forEach(function (x) { if (names.indexOf(x.name) === -1) { a.push({ name: x.name, amount: 0 }); names.push(x.name); } });
      return a.map(function (x) { var pv = (b.filter(function (y) { return y.name === x.name; })[0] || {}).amount || 0; return row('minus child', x.name, '', x.amount, pv, false); }).join('');
    };
    html += '<div class="adm-card fn-card"><h3 class="adm-h3">Отчёт о прибыли — шаг за шагом</h3><p class="fn-lead">Сверху — всё, что заплатили покупатели. Каждая строка ниже — что из этого ушло. Серые строки — промежуточные итоги, чёрная внизу — сколько вы заработали.</p>' +
      '<div class="fn-tw"><table class="fn-t fn-pl"><thead><tr><th>Статья</th><th class="r">' + esc(per.label) + '</th><th class="r">Доля выручки</th><th class="r">Было</th><th class="r">Изменение</th></tr></thead><tbody>' +
      row('', 'Продажи', 'оплаченные заказы' + (c.units ? ', ' + c.units + ' ' + plural(c.units, 'вещь', 'вещи', 'вещей') : '') + (c.otherIncome ? ' и доходы вне сайта' : ''), c.sales, p.sales, true) +
      row('minus', 'Возвраты', c.refundOps ? c.refundOps + ' ' + plural(c.refundOps, 'возврат', 'возврата', 'возвратов') + ', деньги вернули покупателям' : 'деньги, которые вернули покупателям', c.refunds, p.refunds, false) +
      row('sum', 'Выручка', 'деньги, которые остались у магазина', rev, p.revenue, true) +
      row('minus', 'Себестоимость проданного', 'сколько стоили вам пошив и ткань этих вещей', c.cogs, p.cogs, false) +
      row('sum', 'Валовая прибыль', 'наценка: цена минус пошив', c.gross, p.gross, true) +
      row('minus', 'Продажа и доставка', 'растут вместе с числом заказов', c.variable, p.variable, false) + children('variable') +
      row('sum', 'Прибыль с продаж', 'сколько приносят сами заказы', c.contribution, p.contribution, true) +
      row('minus', 'Работа магазина', 'платите каждый месяц, даже без заказов', c.fixed, p.fixed, false) + children('fixed') +
      row('sum', 'Прибыль до налога', 'результат работы магазина', c.ebt, p.ebt, true) +
      row('minus', 'Налог УСН ' + String(r.finance.taxRate).replace('.', ',') + '%', 'считается с выручки — отложите заранее', c.tax, p.tax, false) +
      row('final', 'Чистая прибыль', 'ваши деньги', c.net, p.net, true) +
      '</tbody></table></div>' +
      (c.purchase ? '<p class="fn-note">Закупка товара (' + finRub(c.purchase) + ') в прибыль не входит: в расходы попадает себестоимость того, что продали. Закупку видно ниже, в «Живых деньгах».</p>' : '') + '</div>';

    // 4. Прибыль по моделям
    var pr = r.products, top = pr.filter(function (x) { return !x.missing; })[0];
    var tot = pr.reduce(function (s, x) { return { units: s.units + x.units, revenue: s.revenue + x.revenue, profit: s.profit + (x.missing ? 0 : x.profit), known: s.known + (x.missing ? 0 : x.revenue) }; }, { units: 0, revenue: 0, profit: 0, known: 0 });
    html += '<div class="adm-card fn-card"><h3 class="adm-h3">Прибыль по моделям</h3><p class="fn-lead">Какая модель приносит больше всего денег и на какой наценка ниже. Прибыль здесь — цена минус пошив, без доставки и рекламы; возвраты уже вычтены.</p>' +
      (pr.length ? '<div class="fn-tw"><table class="fn-t fn-prod"><thead><tr><th>Модель</th><th class="r">Себестоимость</th><th class="r">Цена</th><th class="r">Продано</th><th class="r">Выручка</th><th class="r">С 1 вещи</th><th class="r">Прибыль</th><th class="r">Доля прибыли</th></tr></thead><tbody>' +
        pr.map(function (x) {
          return '<tr><td>' + esc(x.name) + (x === top && pr.length > 1 ? '<span class="fn-best">лидер</span>' : '') + '</td>' +
            '<td class="r num">' + (x.cost ? finRub(x.cost) : '<a class="link fn-noprint" href="' + finLink(q, { tab: 'costs', miss: 1 }) + '">указать</a>') + '</td><td class="r num">' + finRub(x.price) + '</td><td class="r num">' + x.units + '</td><td class="r num">' + finRub(x.revenue) + '</td>' +
            '<td class="r num">' + (x.missing ? '—' : finRub(x.perUnit)) + '</td><td class="r num">' + (x.missing ? '—' : finRub(x.profit)) + '</td><td class="r">' + (x.missing ? '<span class="fn-mg">нет данных</span>' : '<span class="fn-mg ' + (x.margin >= 0.55 ? 'hi' : x.margin >= 0.4 ? 'mid' : 'lo') + '">' + Math.round(x.margin * 100) + '%</span>') + '</td></tr>';
        }).join('') + '</tbody><tfoot><tr><td>Итого</td><td></td><td></td><td class="r num">' + tot.units + '</td><td class="r num">' + finRub(tot.revenue) + '</td><td></td><td class="r num">' + finRub(tot.profit) + '</td><td class="r">' + (tot.known ? Math.round(tot.profit / tot.known * 100) + '%' : '—') + '</td></tr></tfoot></table></div>' + (tot.known < tot.revenue ? '<p class="fn-note">В итоговой прибыли нет моделей без себестоимости.</p>' : '')
        : '<p class="muted fn-empty">За этот период ничего не продано.</p>') + '</div>';

    // 5. По месяцам
    var ms = r.months, maxN = Math.max.apply(null, ms.map(function (x) { return Math.abs(x.p.net); }).concat([1])), curKey = per.to.slice(0, 7);
    var sum = function (f) { return ms.reduce(function (s, x) { return s + f(x.p); }, 0); };
    var tRev = sum(function (x) { return x.revenue; }), tNet = sum(function (x) { return x.net; });
    var mrow = function (name, f, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + name + '</td>' + ms.map(function (x) { return '<td class="r num' + (x.key === curKey ? ' cur' : '') + '">' + f(x.p) + '</td>'; }).join(''); };
    var money = function (k) { return function (s) { var v = typeof k === 'function' ? k(s) : s[k]; return String(Math.round(v)).replace('-', '− ').replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }; };
    html += '<div class="adm-card fn-card"><h3 class="adm-h3">Чистая прибыль по месяцам</h3><p class="fn-lead">' + (ms.length === 12 ? 'Год' : 'Полгода') + ' в одной таблице: видно, растёт ли магазин и куда сдвигаются расходы.</p>' +
      '<div class="fn-spark" style="grid-template-columns:repeat(' + ms.length + ',minmax(0,1fr))">' + ms.map(function (x) {
        var v = x.p.net, k = Math.round(v / 1000);
        return '<div class="' + (x.key === curKey ? 'cur' : '') + (v < 0 ? ' neg' : '') + '"><em>' + (v ? (Math.abs(v) >= 1000 ? (v < 0 ? '−' : '') + Math.abs(k) + ' тыс.' : finRub(v)) : '0') + '</em><i style="height:' + Math.max(2, Math.round(Math.abs(v) / maxN * 100)) + '%"></i><span>' + x.label + '</span></div>';
      }).join('') + '</div>' +
      '<div class="fn-tw"><table class="fn-t fn-months"><thead><tr><th></th>' + ms.map(function (x) { return '<th class="r' + (x.key === curKey ? ' cur' : '') + '">' + esc(x.full) + (ms[0].year !== ms[ms.length - 1].year ? ' ' + String(x.year).slice(2) : '') + '</th>'; }).join('') + '<th class="r">Итого</th></tr></thead><tbody>' +
        mrow('Выручка', money('revenue')) + '<td class="r num">' + money(function () { return tRev; })() + '</td></tr>' +
        mrow('Себестоимость', money('cogs')) + '<td class="r num">' + money(function () { return sum(function (x) { return x.cogs; }); })() + '</td></tr>' +
        mrow('Расходы', money(function (s) { return s.variable + s.fixed; })) + '<td class="r num">' + money(function () { return sum(function (x) { return x.variable + x.fixed; }); })() + '</td></tr>' +
        mrow('Налог', money('tax')) + '<td class="r num">' + money(function () { return sum(function (x) { return x.tax; }); })() + '</td></tr>' +
        mrow('Чистая прибыль', money('net'), 'total') + '<td class="r num">' + money(function () { return tNet; })() + '</td></tr>' +
        mrow('Остаётся со 100 ₽', function (s) { return s.revenue > 0 ? Math.round(s.net / s.revenue * 100) + ' ₽' : '—'; }) + '<td class="r num">' + (tRev > 0 ? Math.round(tNet / tRev * 100) + ' ₽' : '—') + '</td></tr>' +
      '</tbody></table></div><p class="fn-note">Суммы в рублях.</p></div>';

    // 6. Живые деньги и склад
    var st = r.stock, days = function (d) { return d ? Math.round((Date.now() - new Date(d)) / 864e5) : null; };
    var staleDays = st.stale ? days(st.stale.last) : null;
    html += '<div class="fn-two">' +
      '<div class="adm-card fn-card"><h3 class="adm-h3">Живые деньги за период</h3><p class="fn-lead">Прибыль и деньги на счёте — не одно и то же. Здесь то, что реально пришло и ушло.</p><div class="fn-flow">' +
        '<div class="fn-fl"><span>Пришло от покупателей</span><b class="num up">' + finRub(c.cashIn, true) + '</b><small>оплаченные заказы' + (c.otherIncome ? ' и доходы вне сайта' : '') + '</small></div>' +
        (c.refunds ? '<div class="fn-fl"><span>Вернули покупателям</span><b class="num down">' + finRub(-c.refunds) + '</b><small>возвраты денег</small></div>' : '') +
        '<div class="fn-fl"><span>Закупка товара</span><b class="num down">' + finRub(-c.purchase) + '</b><small>' + (c.purchase ? 'пошив, ткани — вещи пока лежат на складе' : 'в этом периоде закупок не было') + '</small></div>' +
        '<div class="fn-fl"><span>Расходы магазина</span><b class="num down">' + finRub(-(c.variable + c.fixed)) + '</b><small>доставка, комиссии, реклама, фото, сервисы</small></div>' +
        (c.taxpaid ? '<div class="fn-fl"><span>Заплатили налог и взносы</span><b class="num down">' + finRub(-c.taxpaid) + '</b><small>внесено в «Операциях»</small></div>' : '') +
        '<div class="fn-fl tot"><span>Итого за период</span><b class="num">' + finRub(c.cash) + '</b></div>' +
        (c.taxLeft > 0 ? '<div class="fn-fl"><span>Отложить на налог</span><b class="num warn">' + finRub(c.taxLeft) + '</b><small>УСН ' + String(r.finance.taxRate).replace('.', ',') + '% за этот период' + (c.taxpaid ? ', с учётом уплаченного' : '') + '</small></div>' : '') +
      '</div><div class="fn-why"><b>Почему цифра не равна прибыли?</b> ' + (c.cash >= c.net ? 'Себестоимость — это вещи, пошитые раньше: деньги на них ушли в прошлые месяцы. В месяц большой закупки будет наоборот.' : 'В этом периоде вы закупили товара больше, чем продали: деньги ушли в склад и вернутся, когда вещи продадутся.') + '</div></div>' +
      '<div class="adm-card fn-card"><h3 class="adm-h3">Товар на складе</h3><p class="fn-lead">Деньги, которые сейчас «лежат» в вещах.</p><div class="fn-stock">' +
        '<div class="adm-stat"><span class="eyebrow">По себестоимости</span><b class="num">' + finRub(st.atCost) + '</b><span class="fn-d">' + (st.noCost ? st.noCost + ' шт. без себестоимости не учтены' : 'столько вложено') + '</span></div>' +
        '<div class="adm-stat"><span class="eyebrow">По ценам продажи</span><b class="num">' + finRub(st.atPrice) + '</b><span class="fn-d">' + st.units + ' шт., если продать всё</span></div></div><div class="fn-flow">' +
        (st.fastest ? '<div class="fn-fl"><span>Продаётся быстрее всего</span><b>' + esc(st.fastest.name) + '</b><small>' + st.fastest.sold + ' шт. за 30 дней' + (st.fastest.left ? ', осталось ' + st.fastest.left + ' шт.' + (st.fastest.sold ? ' — примерно на ' + Math.max(1, Math.round(st.fastest.left / st.fastest.sold * 30 / 7)) + ' нед.' : '') : ', на складе не осталось') + '</small></div>' : '') +
        (st.stale ? '<div class="fn-fl"><span>Лежит дольше всего</span><b>' + esc(st.stale.name) + '</b><small>' + (staleDays != null ? 'последняя продажа ' + staleDays + ' ' + plural(staleDays, 'день', 'дня', 'дней') + ' назад' : 'ни одной продажи') + ' · на складе ' + st.stale.left + ' шт.</small></div>' : '') +
        (st.low.length ? '<div class="fn-fl"><span>Скоро закончится</span><b>' + st.low.map(function (x) { return esc(x.name + ', ' + (x.color ? x.color.toLowerCase() + ', ' : '') + x.size); }).join('<br>') + '</b><small>продаются, а осталось по 1 шт. или меньше — пора шить ещё</small></div>' : '') +
      '</div></div></div>';

    // 7. Выводы
    html += '<div class="adm-card fn-card"><h3 class="adm-h3">Что видно из отчёта</h3><p class="fn-lead">Главное за период — простыми словами.</p><div class="fn-tips">' + r.tips.map(function (t) { return '<div class="fn-tip ' + t.kind + '"><span class="t">' + esc(t.title) + '</span><p>' + esc(t.text) + '</p><small>' + esc(t.hint) + '</small></div>'; }).join('') + '</div></div>';

    box.innerHTML = html;
    $('#fnPdf').addEventListener('click', function () { window.print(); });
    $('#fnCsv').addEventListener('click', function () { finCsvReport(r, per); });
  }

  /* ---------- Операции ---------- */
  function finOps(box, q, per) {
    var ops = Finance.operations(finInput()).filter(function (x) { return !x.hidden && x.date >= per.from && x.date <= per.to; });
    var f = q.f || 'all', search = '';
    var cats = {}; ((DATA.finance || {}).categories || []).forEach(function (c) { cats[c.id] = c; });
    function draw() {
      var list = ops.filter(function (x) { return f === 'all' || (f === 'in' && x.dir === 'in') || (f === 'out' && x.dir === 'out') || (f === 'manual' && !x.auto); })
        .filter(function (x) { if (!search) return true; var s = (x.cat + ' ' + x.note + ' ' + (x.order ? '№' + x.order.number + ' ' + x.order.number : '')).toLowerCase(); return s.indexOf(search) !== -1; });
      var inS = list.reduce(function (s, x) { return s + (x.dir === 'in' ? x.amount : 0); }, 0), outS = list.reduce(function (s, x) { return s + (x.dir === 'out' ? x.amount : 0); }, 0);
      $('#fnOpsBody', box).innerHTML = list.length ? '<div class="fn-tw"><table class="fn-t fn-ops"><thead><tr><th>Дата</th><th>Тип</th><th>Категория</th><th>Описание</th><th>Откуда</th><th class="r">Сумма</th></tr></thead><tbody>' +
        list.slice(0, 500).map(function (x) {
          var type = x.line === 'refunds' ? 'Возврат' : x.dir === 'in' ? 'Доход' : 'Расход';
          return '<tr' + (x.expense ? ' data-exp="' + esc(x.expense) + '" class="fn-click"' : '') + '><td class="num">' + esc(x.date.split('-').reverse().slice(0, 2).join('.')) + '</td><td><span class="fn-tag ' + (x.dir === 'in' ? 'in' : 'out') + '">' + type + '</span></td><td>' + esc(x.cat) + '</td>' +
            '<td class="fn-desc" title="' + esc(x.note) + '">' + esc(x.note || '—') + (x.receipt ? ' <a class="fn-rcpt" href="' + esc(x.receipt) + '" target="_blank" rel="noopener" title="Фото чека">чек</a>' : '') + '</td>' +
            '<td class="fn-src">' + (x.order ? '<a href="#/admin?s=orders&id=' + esc(x.order.id) + '">Заказ № ' + esc(x.order.number) + '</a><span class="fn-auto">авто</span>' : 'вручную') + '</td>' +
            '<td class="r fn-amt ' + (x.dir === 'in' ? 'in' : 'out') + '">' + (x.dir === 'in' ? '+ ' : '− ') + fmt(Math.round(x.amount)) + '</td></tr>';
        }).join('') + '</tbody><tfoot><tr><td colspan="5">' + list.length + ' ' + plural(list.length, 'операция', 'операции', 'операций') + ' · пришло ' + finRub(inS) + ' · ушло ' + finRub(outS) + (list.length > 500 ? ' · показаны первые 500' : '') + '</td><td class="r fn-amt">' + finRub(inS - outS, true) + '</td></tr></tfoot></table></div>'
        : '<div class="fn-emptybox"><b>' + (search || f !== 'all' ? 'Ничего не нашлось' : 'За этот период операций нет') + '</b><span>Расходы на пошив, рекламу, фото и прочее внесите кнопкой «+ Операция» — они сразу попадут в отчёт.</span></div>';
      $$('tr[data-exp]', box).forEach(function (tr) { tr.addEventListener('click', function (e) { if (e.target.closest('a')) return; var ex = (DATA.expenses || []).find(function (y) { return y.id === tr.getAttribute('data-exp'); }); if (ex) finExpenseModal(ex, q); }); });
    }
    box.innerHTML = '<div class="adm-card fn-card"><div class="fn-toolbar"><div class="fn-chips">' + [['all', 'Все'], ['in', 'Доходы'], ['out', 'Расходы'], ['manual', 'Внесённые вручную']].map(function (x) { return '<button type="button" class="fn-chip' + (x[0] === f ? ' on' : '') + '" data-f="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<input class="input fn-search" id="fnSearch" placeholder="Поиск: заказ, категория…"></div><div id="fnOpsBody"></div>' +
      '<p class="fn-note">Строки «авто» сайт добавляет сам по заказам и пересчитывает при возврате. Свои операции можно открыть, поправить или удалить. Себестоимость в списке не показывается — она в отчёте.</p></div>';
    $$('[data-f]', box).forEach(function (b) { b.addEventListener('click', function () { f = b.getAttribute('data-f'); $$('[data-f]', box).forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }); });
    $('#fnSearch', box).addEventListener('input', function (e) { search = e.target.value.trim().toLowerCase(); draw(); });
    draw();
    $('#fnCsv').addEventListener('click', function () { finCsvOps(ops, per); });
  }

  // Окно операции: расход или доход вручную
  function finExpenseModal(ex, q) {
    var fin = DATA.finance || Finance.defaults(), cats = fin.categories || [];
    var cur = ex ? cats.find(function (c) { return c.id === ex.categoryId; }) : null;
    var isIn = cur ? cur.kind === 'income' : false;
    var today = Finance.dayOf(new Date().toISOString());
    var opts = function (inc) {
      // по умолчанию — первая категория из своего списка (порядок задаётся в настройках)
      var first = (cats.filter(function (c) { return inc ? c.kind === 'income' : c.kind !== 'income'; })[0] || {}).id;
      var sel = ex && cats.some(function (c) { return c.id === ex.categoryId && (c.kind === 'income') === inc; }) ? ex.categoryId : first;
      return Finance.KINDS.filter(function (k) { return inc ? k[0] === 'income' : k[0] !== 'income'; }).map(function (k) {
        var list = cats.filter(function (c) { return c.kind === k[0]; }); if (!list.length) return '';
        return '<optgroup label="' + esc(k[1]) + '">' + list.map(function (c) { return '<option value="' + esc(c.id) + '"' + (sel === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</optgroup>';
      }).join('');
    };
    var receipt = ex ? ex.receipt || '' : '';
    A().openModal('<div class="fn-modal"><h3 class="serif">' + (ex ? 'Операция' : 'Новая операция') + '</h3>' +
      '<div class="tabs fn-dir"><button type="button" data-dir="out"' + (!isIn ? ' class="on"' : '') + '>Расход</button><button type="button" data-dir="in"' + (isIn ? ' class="on"' : '') + '>Доход</button></div>' +
      '<form class="form" id="fnExForm" novalidate><div class="fn-form2"><label class="field"><span>Сумма, ₽</span><input class="input num" id="fxAmount" inputmode="decimal" placeholder="15 000" value="' + esc(ex ? String(ex.amount).replace('.', ',') : '') + '"></label>' +
      '<label class="field"><span>Дата</span><input class="input" type="date" id="fxDate" value="' + esc(ex ? ex.date : today) + '" max="' + today + '"></label></div>' +
      '<label class="field"><span>Категория</span><select class="select" id="fxCat">' + opts(isIn) + '</select><small class="muted fn-kindhint" id="fxHint"></small></label>' +
      '<label class="field"><span>Комментарий</span><input class="input" id="fxNote" maxlength="300" placeholder="Например: партия костюмов, 20 шт." value="' + esc(ex ? ex.note : '') + '"></label>' +
      '<div class="field"><span>Фото чека</span><div class="fn-rc" id="fxRc"></div></div>' +
      '<p class="form-error" id="fxErr"></p><div class="fn-mact"><button class="btn">Сохранить</button>' + (ex ? '<button class="btn ghost" type="button" id="fxDel">Удалить</button>' : '') + '</div></form>' +
      '<p class="fn-note"><a class="link" href="' + finLink(q || {}, { tab: 'settings' }) + '">Свои категории</a> — в настройках финансов.</p></div>');
    var box = $('.fn-modal');
    function hint() { var c = cats.find(function (x) { return x.id === $('#fxCat', box).value; }), k = c && Finance.KINDS.find(function (x) { return x[0] === c.kind; }); $('#fxHint', box).textContent = k ? k[2] : ''; }
    function rc() {
      $('#fxRc', box).innerHTML = receipt ? '<a href="' + esc(receipt) + '" target="_blank" rel="noopener"><img src="' + esc(receipt) + '" alt="Чек"></a><button type="button" class="link" id="fxRcDel">Убрать фото</button>'
        : '<label class="btn ghost sm"><input type="file" accept="image/*" id="fxFile" hidden>Прикрепить фото</label>';
      if (receipt) $('#fxRcDel', box).addEventListener('click', function () { receipt = ''; rc(); });
      else $('#fxFile', box).addEventListener('change', async function (e) {
        var file = e.target.files[0]; if (!file) return;
        $('#fxRc', box).innerHTML = '<span class="muted">Загружаем…</span>';
        try { receipt = await A().API.uploadImage(file); } catch (er) { toast(A().errMsg(er), true); }
        rc();
      });
    }
    $$('[data-dir]', box).forEach(function (b) { b.addEventListener('click', function () { $$('[data-dir]', box).forEach(function (x) { x.classList.toggle('on', x === b); }); $('#fxCat', box).innerHTML = opts(b.getAttribute('data-dir') === 'in'); hint(); }); });
    $('#fxCat', box).addEventListener('change', hint);
    hint(); rc();
    if (!ex) setTimeout(function () { $('#fxAmount', box).focus(); }, 60);
    $('#fnExForm', box).addEventListener('submit', async function (e) {
      e.preventDefault();
      var amount = Number(String($('#fxAmount', box).value).replace(/\s/g, '').replace(',', '.'));
      if (!(amount > 0)) { $('#fxErr', box).textContent = 'Укажите сумму'; return; }
      var btn = e.submitter || $('button.btn', box); btn.disabled = true;
      try {
        await A().API.adminExpense({ id: ex ? ex.id : undefined, amount: amount, date: $('#fxDate', box).value, categoryId: $('#fxCat', box).value, note: $('#fxNote', box).value, receipt: receipt });
        A().closePanels(); await afterSave(ex ? 'Операция сохранена' : 'Операция добавлена');
      } catch (er) { $('#fxErr', box).textContent = A().errMsg(er); btn.disabled = false; }
    });
    if (ex) bindConfirm($('#fxDel', box), async function () {
      try { await A().API.adminExpenseDelete(ex.id); A().closePanels(); await afterSave('Операция удалена'); } catch (er) { $('#fxErr', box).textContent = A().errMsg(er); }
    });
  }

  /* ---------- Себестоимость ---------- */
  function finCosts(box, q) {
    var fin = DATA.finance || Finance.defaults(), costs = Object.assign({}, fin.costs || {}), dirty = false;
    var catName = {}; DATA.categories.forEach(function (c) { catName[c.id] = c.name; });
    var onlyMiss = !!q.miss, search = '';
    var filled = DATA.products.filter(function (p) { return costs[p.id] > 0; }).length;
    box.innerHTML = '<div class="adm-card fn-card"><h3 class="adm-h3">Себестоимость товаров</h3><p class="fn-lead">Сколько вам стоит одна вещь: пошив, ткань, фурнитура, бирки. Можно примерно — отчёт станет точнее, когда уточните. Покупатели эти цифры не видят.</p>' +
      '<div class="fn-cost-top"><div class="fn-progress"><b>' + filled + ' из ' + DATA.products.length + '</b> товаров с себестоимостью<span class="fn-bar"><i style="width:' + (DATA.products.length ? Math.round(filled / DATA.products.length * 100) : 0) + '%"></i></span></div>' +
        '<div class="fn-fill"><span>Заполнить пустые:</span><input class="input num" id="fnPct" type="number" min="1" max="99" value="35" aria-label="Процент от цены"><span>% от цены</span><button class="btn ghost sm" type="button" id="fnFillBtn">Заполнить</button></div></div>' +
      '<div class="fn-toolbar"><label class="check"><input type="checkbox" id="fnMiss"' + (onlyMiss ? ' checked' : '') + '> <span>Только без себестоимости</span></label><input class="input fn-search" id="fnCSearch" placeholder="Поиск по названию"></div>' +
      '<div id="fnCostBody"></div><div class="fn-savebar"><span class="muted" id="fnDirty">Изменений нет</span><button class="btn" type="button" id="fnCostSave">Сохранить</button></div></div>';
    function profitCells(p) {
      var c = costs[p.id], price = Number(p.price) || 0;
      if (!(c > 0)) return '<td class="r num fn-dim">—</td><td class="r"><span class="fn-mg">не указана</span></td>';
      var pr = price - c, mg = price ? pr / price : 0;
      return '<td class="r num">' + finRub(pr) + '</td><td class="r"><span class="fn-mg ' + (mg >= 0.55 ? 'hi' : mg >= 0.4 ? 'mid' : 'lo') + '">' + Math.round(mg * 100) + '%</span></td>';
    }
    function draw() {
      var list = DATA.products.filter(function (p) { return (!onlyMiss || !(costs[p.id] > 0)) && (!search || p.name.toLowerCase().indexOf(search) !== -1); });
      $('#fnCostBody', box).innerHTML = list.length ? '<div class="fn-tw"><table class="fn-t fn-costs"><thead><tr><th>Товар</th><th class="r">Цена</th><th class="r">Себестоимость 1 шт.</th><th class="r">Прибыль с вещи</th><th class="r">Доля прибыли</th></tr></thead><tbody>' +
        list.map(function (p) {
          return '<tr data-id="' + esc(p.id) + '"><td><b>' + esc(p.name) + '</b>' + (p.active === false ? ' <span class="fn-auto">скрыт</span>' : '') + '<small>' + esc(catName[p.categoryId] || '') + '</small></td><td class="r num">' + finRub(p.price) + '</td>' +
            '<td class="r"><span class="fn-cost-in"><input class="input num" inputmode="decimal" data-cost="' + esc(p.id) + '" value="' + esc(costs[p.id] > 0 ? String(costs[p.id]) : '') + '" placeholder="—" aria-label="Себестоимость: ' + esc(p.name) + '"><i>₽</i></span></td>' + profitCells(p) + '</tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="fn-emptybox"><b>' + (onlyMiss ? 'У всех товаров себестоимость указана' : 'Ничего не нашлось') + '</b></div>';
      $$('[data-cost]', box).forEach(function (inp) {
        inp.addEventListener('input', function () {
          var id = inp.getAttribute('data-cost'), v = Number(String(inp.value).replace(/\s/g, '').replace(',', '.'));
          if (v > 0) costs[id] = v; else delete costs[id];
          var tr = inp.closest('tr'), p = DATA.products.find(function (x) { return x.id === id; });
          var tds = tr.querySelectorAll('td'); tds[3].remove(); tds[4].remove(); tr.insertAdjacentHTML('beforeend', profitCells(p));
          mark();
        });
      });
    }
    function mark() { dirty = true; $('#fnDirty', box).textContent = 'Есть несохранённые изменения'; $('#fnDirty', box).className = 'fn-warn'; }
    $('#fnMiss', box).addEventListener('change', function (e) { onlyMiss = e.target.checked; draw(); });
    $('#fnCSearch', box).addEventListener('input', function (e) { search = e.target.value.trim().toLowerCase(); draw(); });
    $('#fnFillBtn', box).addEventListener('click', function () {
      var k = Number($('#fnPct', box).value); if (!(k > 0 && k < 100)) { toast('Укажите процент от 1 до 99', true); return; }
      var n = 0; DATA.products.forEach(function (p) { if (!(costs[p.id] > 0) && p.price > 0) { costs[p.id] = Math.round(p.price * k / 100); n++; } });
      if (!n) { toast('Пустых нет — у всех товаров себестоимость уже указана'); return; }
      draw(); mark(); toast('Заполнено: ' + n + ' ' + plural(n, 'товар', 'товара', 'товаров') + '. Проверьте и сохраните');
    });
    $('#fnCostSave', box).addEventListener('click', async function () {
      var send = {}; DATA.products.forEach(function (p) { send[p.id] = costs[p.id] > 0 ? costs[p.id] : 0; });
      try { DATA.finance = await A().API.adminCosts(send); dirty = false; await afterSave('Себестоимость сохранена'); } catch (e) { toast(A().errMsg(e), true); }
    });
    draw();
  }

  /* ---------- Настройки: налог, комиссии, категории ---------- */
  var FIN_CAT_COLS = [{ k: 'name', label: 'Название категории', flex: 3 }, { k: 'kind', label: 'Куда относится', type: 'select', flex: 2, options: [] }];
  function finSettings(box) {
    var fin = DATA.finance || Finance.defaults(), rt = fin.rates || {};
    FIN_CAT_COLS[1].options = Finance.KINDS.map(function (k) { return [k[0], k[1]]; });
    var used = {}; (DATA.expenses || []).forEach(function (e) { used[e.categoryId] = (used[e.categoryId] || 0) + 1; });
    var numIn = function (id, v, label, unit, hint) { return '<label class="field"><span>' + label + '</span><span class="fn-unit"><input class="input num" id="' + id + '" type="number" min="0" step="0.01" value="' + esc(v) + '"><i>' + unit + '</i></span>' + (hint ? '<small class="muted">' + hint + '</small>' : '') + '</label>'; };
    box.innerHTML = '<div class="fn-two">' +
      '<div class="adm-card fn-card"><h3 class="adm-h3">Налог</h3><p class="fn-lead">УСН «Доходы»: налог считается с выручки — с денег от покупателей за вычетом возвратов.</p>' +
        '<div class="adm-form fn-one">' + numIn('fsTax', fin.taxRate, 'Ставка УСН', '%', 'В Республике Ингушетия — 2%') + '</div>' +
        '<h3 class="adm-h3" style="margin-top:26px">СДЭК</h3><div class="adm-form fn-one">' + numIn('fsCod', fin.codFee, 'Комиссия за наложенный платёж', '%', 'Если покупатели платят при получении. Смотрите в договоре СДЭК; 0 — не учитывать') + '</div>' +
        '<p class="fn-note">Стоимость доставки СДЭК сайт берёт из накладной сам, когда вы оформляете отправление в заказе.</p></div>' +
      '<div class="adm-card fn-card"><h3 class="adm-h3">Комиссия ЮKassa</h3><p class="fn-lead">Как в личном кабинете ЮKassa: комиссия ЮKassa плюс комиссия партнёра. Сайт считает её по способу, которым оплачен каждый заказ.</p>' +
        '<div class="fn-rates"><b>Карты, ЮMoney, SberPay, T-Pay, Alfa Pay</b><div class="adm-form">' + numIn('fsOy', (rt.other || {}).yk, 'ЮKassa', '%') + numIn('fsOp', (rt.other || {}).partner, 'Партнёр', '%') + '</div>' +
        '<b>СБП</b><div class="adm-form">' + numIn('fsSy', (rt.sbp || {}).yk, 'ЮKassa', '%') + numIn('fsSp', (rt.sbp || {}).partner, 'Партнёр', '%') + '</div>' +
        '<div class="adm-form">' + numIn('fsMin', fin.partnerMin, 'Комиссия партнёра не меньше', '₽', 'С одного платежа') + '</div></div>' +
        '<p class="fn-note" id="fsEx"></p></div></div>' +
      '<div class="adm-card fn-card"><h3 class="adm-h3">Категории операций</h3><p class="fn-lead">«Куда относится» решает, в какую строку отчёта попадёт расход. Закупка товара и уплата налога в прибыль не входят — их видно в «Живых деньгах». Категория «Реклама» нужна для показателя «Реклама на 1 заказ».</p>' +
        rowsEditor('cats', FIN_CAT_COLS, fin.categories || []) +
        '<p class="fn-note">' + (Object.keys(used).length ? 'Категорию, в которой уже есть операции, удалить нельзя — сначала перенесите операции в другую.' : '') + '</p></div>' +
      '<div class="adm-actions"><button class="btn" type="button" id="fsSave">Сохранить настройки</button><p class="form-error" id="fsErr"></p></div>';
    bindRows(box, { cats: FIN_CAT_COLS });
    var val = function (id) { return Number(String($('#' + id, box).value).replace(',', '.')) || 0; };
    function example() {
      var m = 10000, o = m * val('fsOy') / 100 + Math.max(m * val('fsOp') / 100, val('fsOp') ? val('fsMin') : 0), s = m * val('fsSy') / 100 + Math.max(m * val('fsSp') / 100, val('fsSp') ? val('fsMin') : 0);
      $('#fsEx', box).innerHTML = 'Пример: с заказа на 10 000 ₽ комиссия ' + fmt(Math.round(o)) + ' при оплате картой и ' + fmt(Math.round(s)) + ' через СБП.';
    }
    $$('input[type=number]', box).forEach(function (i) { i.addEventListener('input', example); });
    example();
    $('#fsSave', box).addEventListener('click', async function () {
      var cats = readRows(box, 'cats', FIN_CAT_COLS);
      if (!cats.length) { $('#fsErr', box).textContent = 'Нужна хотя бы одна категория'; return; }
      var value = { taxRate: val('fsTax'), codFee: val('fsCod'), partnerMin: val('fsMin'), rates: { other: { yk: val('fsOy'), partner: val('fsOp') }, sbp: { yk: val('fsSy'), partner: val('fsSp') } }, categories: cats };
      try { DATA.finance = await A().API.adminFinance(value); $('#fsErr', box).textContent = ''; await afterSave('Настройки финансов сохранены'); } catch (e) { $('#fsErr', box).textContent = A().errMsg(e); }
    });
  }

  /* ---------- Выгрузка для Excel (CSV с разделителем «;» — Excel открывает сразу) ---------- */
  function finDownload(name, rows) {
    var cell = function (v) { if (typeof v === 'number') return String(Math.round(v * 100) / 100).replace('.', ','); v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var text = '﻿' + rows.map(function (r) { return r.map(cell).join(';'); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function finCsvOpsRows(ops) {
    return [['Дата', 'Тип', 'Категория', 'Описание', 'Заказ', 'Сумма, ₽']].concat(ops.map(function (x) { return [x.date.split('-').reverse().join('.'), x.line === 'refunds' ? 'Возврат' : x.dir === 'in' ? 'Доход' : 'Расход', x.cat, x.note, x.order ? x.order.number : 'вручную', (x.dir === 'in' ? 1 : -1) * x.amount]; }));
  }
  function finCsvOps(ops, per) { finDownload('операции ' + per.from + '_' + per.to + '.csv', finCsvOpsRows(ops)); }
  function finCsvReport(r, per) {
    var c = r.cur, p = r.prev, rows = [[DATA.settings.storeName + ' — финансовый отчёт'], ['Период', per.label, per.from + ' — ' + per.to], [], ['Статья', per.label, 'Доля выручки, %', 'Прошлый период']];
    var add = function (name, a, b) { rows.push([name, a, c.revenue ? Math.round(a / c.revenue * 1000) / 10 : '', b]); };
    add('Продажи', c.sales, p.sales); add('− Возвраты', c.refunds, p.refunds); add('Выручка', c.revenue, p.revenue);
    add('− Себестоимость проданного', c.cogs, p.cogs); add('Валовая прибыль', c.gross, p.gross);
    add('− Продажа и доставка', c.variable, p.variable); c.lines('variable').forEach(function (x) { add('    ' + x.name, x.amount, ''); });
    add('Прибыль с продаж', c.contribution, p.contribution);
    add('− Работа магазина', c.fixed, p.fixed); c.lines('fixed').forEach(function (x) { add('    ' + x.name, x.amount, ''); });
    add('Прибыль до налога', c.ebt, p.ebt); add('− Налог УСН ' + r.finance.taxRate + '%', c.tax, p.tax); add('Чистая прибыль', c.net, p.net);
    rows.push([], ['Живые деньги'], ['Пришло от покупателей', c.cashIn], ['Вернули покупателям', -c.refunds], ['Закупка товара', -c.purchase], ['Расходы магазина', -(c.variable + c.fixed)], ['Заплатили налог и взносы', -c.taxpaid], ['Итого', c.cash], ['Отложить на налог', c.taxLeft]);
    rows.push([], ['Прибыль по моделям'], ['Модель', 'Себестоимость', 'Цена', 'Продано', 'Выручка', 'Прибыль с вещи', 'Прибыль', 'Доля прибыли, %']);
    r.products.forEach(function (x) { rows.push([x.name, x.cost || '', x.price, x.units, x.revenue, x.missing ? '' : x.perUnit, x.missing ? '' : x.profit, x.missing ? '' : Math.round(x.margin * 100)]); });
    rows.push([], ['По месяцам'], ['Месяц', 'Выручка', 'Себестоимость', 'Расходы', 'Налог', 'Чистая прибыль']);
    r.months.forEach(function (m) { rows.push([m.full + ' ' + m.year, m.p.revenue, m.p.cogs, m.p.variable + m.p.fixed, m.p.tax, m.p.net]); });
    rows.push([], ['Операции']);
    finCsvOpsRows(r.ops.filter(function (x) { return !x.hidden && x.date >= per.from && x.date <= per.to; })).forEach(function (x) { rows.push(x); });
    finDownload('финансы ' + per.from + '_' + per.to + '.csv', rows);
  }

  function analyticsSection(m, q) {
    var n = Number((q && q.d) || 7) === 30 ? 30 : 7, days = statDays(n), prev = sumDays(statDays(n * 2).slice(0, n)), t = sumDays(days);
    var delta = function (a, b) { if (!b) return ''; var d = Math.round((a - b) / b * 100); return '<span class="an-d ' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d) + '% к прошлым ' + n + ' дн.</span>'; };
    var mk = (DATA.settings.metrika || {}), srcs = Object.keys(t.src).sort(function (a, b) { return t.src[b] - t.src[a]; }), srcTotal = srcs.reduce(function (s, k) { return s + t.src[k]; }, 0);
    var maxV = Math.max(1, Math.max.apply(null, days.map(function (x) { return x.v; })));
    m.innerHTML = head('Аналитика', '<div class="tabs adm-tabs"><a href="#/admin?s=analytics&d=7" class="' + (n === 7 ? 'on' : '') + '">7 дней</a><a href="#/admin?s=analytics&d=30" class="' + (n === 30 ? 'on' : '') + '">30 дней</a></div>',
        'Своя статистика сайта: без cookie и без персональных данных покупателей. Каждый посетитель считается один раз в день, сколько бы раз он ни заходил, а «Просмотры страниц» — все открытия страниц; ваши заходы не считаются. Если открываете магазин с иконки на экране телефона, из Instagram, Telegram или другого браузера, откройте там один раз ссылку <span class="copyable">' + esc(location.origin) + '/?nostat=1</span> — тогда и эти заходы не попадут в статистику. Подробные отчёты, карта кликов и записи визитов — в Яндекс Метрике (подключается ниже).') +
      '<div class="adm-stats an-kpi">' +
        '<div class="adm-stat"><span class="eyebrow">Посетители</span><b class="num">' + t.v.toLocaleString('ru-RU') + '</b>' + delta(t.v, prev.v) + '</div>' +
        '<div class="adm-stat"><span class="eyebrow">Просмотры страниц</span><b class="num">' + t.pv.toLocaleString('ru-RU') + '</b>' + (t.v ? '<span class="an-d">' + String(Math.round(t.pv / t.v * 10) / 10).replace('.', ',') + ' на посетителя</span>' : '') + '</div>' +
        '<div class="adm-stat"><span class="eyebrow">Конверсия в заказ</span><b>' + pct(t.o, t.v) + '</b><span class="an-d">' + t.o + ' ' + plural(t.o, 'заказ', 'заказа', 'заказов') + '</span></div>' +
        '<div class="adm-stat"><span class="eyebrow">Выручка</span><b class="num">' + fmt(t.rev) + '</b>' + delta(t.rev, prev.rev) + '</div>' +
        '<div class="adm-stat"><span class="eyebrow">Средний чек</span><b class="num">' + (t.o ? fmt(Math.round(t.rev / t.o)) : '—') + '</b>' + (t.m + t.d ? '<span class="an-d">с телефона ' + pct(t.m, t.m + t.d) + ' визитов</span>' : '') + '</div>' +
      '</div>' +
      (t.v ? '' : '<div class="adm-alert an-empty"><b>Статистика только начала собираться.</b> Цифры появятся, как только на сайт зайдут первые покупатели — обычно уже в течение часа. Боты и ваши визиты в админку не считаются.</div>') + '<div class="adm-card"><h3 class="adm-h3">Воронка: где уходят покупатели</h3>' + funnelHtml(t) + '</div>' +
      '<div class="adm-two" style="margin-top:16px"><div class="adm-card"><h3 class="adm-h3">Посетители и заказы по дням</h3><div class="an-chart">' + days.map(function (x) {
          return '<div class="an-day" title="' + x.day.split('-').reverse().slice(0, 2).join('.') + ': ' + x.v + ' посет., ' + x.o + ' зак."><div class="an-bar"><i style="height:' + Math.round(x.v / maxV * 100) + '%"></i>' + (x.o ? '<em style="bottom:' + Math.min(96, Math.round(x.v / maxV * 100)) + '%">' + x.o + '</em>' : '') + '</div><span>' + (n === 7 ? ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][new Date(x.day).getDay()] : (Number(x.day.slice(8)) % 5 === 1 ? Number(x.day.slice(8)) : '')) + '</span></div>';
        }).join('') + '</div><p class="muted" style="font-size:12px;margin-top:10px">Столбик — посетители, число над ним — заказы за день</p></div>' +
        '<div class="adm-card"><h3 class="adm-h3">Откуда приходят</h3>' + (srcs.length ? '<div class="an-src">' + srcs.map(function (k) { return '<div class="an-src-row"><span>' + (SRC_NAMES[k] || k) + '</span><span class="an-src-bar"><i style="width:' + Math.round(t.src[k] / srcTotal * 100) + '%"></i></span><b class="num">' + pct(t.src[k], srcTotal) + '</b></div>'; }).join('') + '</div>' : '<p class="muted">Данные появятся после первых посещений.</p>') +
          '<p class="muted" style="font-size:12px;margin-top:12px">Ссылки в соцсетях лучше размечать: <span class="copyable">?utm_source=instagram</span> — тогда переходы считаются точно</p></div></div>' +
      (!can('marketing') ? '' : '<div class="adm-card" style="margin-top:16px"><h3 class="adm-h3">Яндекс Метрика</h3>' +
        '<p class="muted" style="font-size:14px;max-width:70ch;margin-bottom:16px">Создайте счётчик на <a class="link" href="https://metrika.yandex.ru/add" target="_blank" rel="noopener">metrika.yandex.ru</a> (адрес сайта — albakovofficial.ru, галочка «Электронная коммерция»), скопируйте номер счётчика и вставьте сюда. Сайт сам отправит в Метрику просмотры товаров, корзину и заказы.</p>' +
        '<div class="adm-form"><label class="field"><span>Номер счётчика</span><input class="input num" id="mkId" inputmode="numeric" placeholder="Например, 98765432" value="' + esc(mk.id || '') + '"></label>' +
        '<label class="check" style="align-self:end;padding-bottom:12px"><input type="checkbox" id="mkWeb"' + (mk.webvisor ? ' checked' : '') + '> <span>Вебвизор — записи визитов<br><small class="muted">Помогает увидеть, где покупателям неудобно. Поля с телефоном, почтой и адресом Метрика скрывает сама</small></span></label></div>' +
        '<div class="adm-actions" style="margin-top:12px"><button class="btn" id="mkSave" type="button">Сохранить</button>' + (mk.id ? '<a class="btn ghost" href="https://metrika.yandex.ru/dashboard?id=' + esc(mk.id) + '" target="_blank" rel="noopener">Открыть Метрику</a>' : '') + '</div><p class="form-error" id="mkErr"></p></div>');
    if (!can('marketing')) return;
    $('#mkSave').addEventListener('click', async function () {
      var id = $('#mkId').value.replace(/\D/g, '');
      if ($('#mkId').value.trim() && !/^\d{5,12}$/.test(id)) { $('#mkErr').textContent = 'Номер счётчика — это 5–12 цифр'; return; }
      var s = clone(DATA.settings); s.metrika = { id: id, webvisor: $('#mkWeb').checked };
      try { await A().API.adminSave('settings', s); await afterSave(id ? 'Метрика подключена' : 'Метрика отключена'); } catch (e) { $('#mkErr').textContent = A().errMsg(e); }
    });
    seoCard(m);
  }

  /* Поиск: Яндекс Вебмастер, Google Search Console, IndexNow (13.47) */
  // Код подтверждения: можно вставить и весь тег <meta name="yandex-verification" content="…"> — берём только код
  function verifyCode(v) { v = String(v || '').trim(); var mm = /content\s*=\s*["']([^"']+)["']/i.exec(v); return (mm ? mm[1] : v).trim(); }
  function seoCard(m) {
    var sc = DATA.settings.seo || {}, info = DATA.seo || {}, url = info.url || location.origin, last = info.last;
    var step = function (n, done, html) { return '<li class="seo-step' + (done ? ' done' : '') + '"><span class="seo-n">' + (done ? '✓' : n) + '</span><div>' + html + '</div></li>'; };
    var box = document.createElement('div');
    box.className = 'adm-card seo-card'; box.style.marginTop = '16px';
    box.innerHTML = '<h3 class="adm-h3">Поиск: Яндекс и Google</h3>' +
      '<p class="muted" style="font-size:14px;max-width:75ch;margin-bottom:18px">Сайт уже готов для поисковиков: у каждой страницы свой заголовок, описание и разметка товара, есть карта сайта. Но Яндекс и Google сами о новом магазине не узнают — его нужно добавить в их кабинеты. Это делается один раз.</p>' +
      '<div class="seo-facts"><div><span>Карта сайта</span><a class="link" href="' + esc(url) + '/sitemap.xml" target="_blank" rel="noopener">' + esc(url.replace(/^https?:\/\//, '')) + '/sitemap.xml</a><small>' + (info.pages || 0) + ' ' + plural(info.pages || 0, 'страница', 'страницы', 'страниц') + '</small></div>' +
        '<div><span>Фид товаров для Яндекса</span><a class="link" href="' + esc(url) + '/yml.xml" target="_blank" rel="noopener">' + esc(url.replace(/^https?:\/\//, '')) + '/yml.xml</a><small>для Яндекс Товаров и Директа</small></div>' +
        '<div><span>Оповещение Яндекса</span><b class="' + (info.indexnow ? 'ok' : 'warn') + '">' + (info.indexnow ? 'включено' : info.https ? 'выключено' : 'нужен HTTPS') + '</b><small>' + (last ? (last.ok ? 'отправлено ' + last.count + ' ' + plural(last.count, 'адрес', 'адреса', 'адресов') + ' · ' : esc(last.error) + ' · ') + new Date(last.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'ещё ничего не отправляли') + '</small></div></div>' +
      '<ol class="seo-steps">' +
        step(1, !!sc.yandex, '<b>Яндекс Вебмастер.</b> Откройте <a class="link" href="https://webmaster.yandex.ru/sites/add/" target="_blank" rel="noopener">webmaster.yandex.ru</a>, добавьте адрес <span class="copyable">' + esc(url) + '</span>, выберите способ «Мета-тег», скопируйте код (или весь тег) в поле ниже, сохраните и нажмите в Вебмастере «Проверить».') +
        step(2, false, '<b>Карта сайта в Яндексе.</b> В Вебмастере: «Индексирование» → «Файлы Sitemap» → добавьте <span class="copyable">' + esc(url) + '/sitemap.xml</span>. Там же в «Переобход страниц» можно отправить главную.') +
        step(3, false, '<b>Регион.</b> В Вебмастере: «Информация о сайте» → «Региональность» → Россия. Без региона Яндекс хуже показывает магазин в выдаче.') +
        step(4, !!sc.google, '<b>Google Search Console.</b> Откройте <a class="link" href="https://search.google.com/search-console" target="_blank" rel="noopener">search.google.com/search-console</a>, ресурс «Префикс URL» → <span class="copyable">' + esc(url) + '</span>, способ «Тег HTML», код — в поле ниже, сохраните и нажмите «Подтвердить». Потом «Файлы Sitemap» → <span class="copyable">sitemap.xml</span>.') +
        step(5, false, '<b>Карточка в Яндекс Бизнесе</b> (по желанию): <a class="link" href="https://yandex.ru/sprav/add" target="_blank" rel="noopener">yandex.ru/sprav</a> — магазин появится на Картах и справа в выдаче.') +
      '</ol>' +
      '<div class="adm-form" style="margin-top:8px"><label class="field"><span>Код Яндекс Вебмастера</span><input class="input" id="seoYa" placeholder="Например: 1a2b3c4d5e6f7a8b" value="' + esc(sc.yandex || '') + '"></label>' +
        '<label class="field"><span>Код Google Search Console</span><input class="input" id="seoGo" placeholder="Например: AbCdEf…" value="' + esc(sc.google || '') + '"></label>' +
        '<label class="check" style="grid-column:1/-1"><input type="checkbox" id="seoIn"' + (sc.indexnow !== false ? ' checked' : '') + '> <span>Сразу сообщать Яндексу о новых и изменённых товарах и страницах (IndexNow)<br><small class="muted">Робот приходит за ними в течение дня, а не через недели. Bing получает те же адреса.</small></span></label></div>' +
      '<div class="adm-actions" style="margin-top:12px"><button class="btn" id="seoSave" type="button">Сохранить</button><button class="btn ghost" id="seoPing" type="button">Отправить все страницы в Яндекс</button></div><p class="form-error" id="seoErr"></p>';
    m.appendChild(box);
    $('#seoSave', box).addEventListener('click', async function () {
      var ya = verifyCode($('#seoYa', box).value), go = verifyCode($('#seoGo', box).value), bad = function (c) { return c && !/^[A-Za-z0-9_-]{6,120}$/.test(c); };
      if (bad(ya) || bad(go)) { $('#seoErr', box).textContent = 'Код — это латинские буквы и цифры. Скопируйте его из кабинета ещё раз'; return; }
      var s = clone(DATA.settings); s.seo = Object.assign({}, s.seo, { yandex: ya, google: go, indexnow: $('#seoIn', box).checked });
      try { await A().API.adminSave('settings', s); await afterSave('Сохранено. Теперь нажмите «Проверить» в кабинете поисковика'); } catch (e) { $('#seoErr', box).textContent = A().errMsg(e); }
    });
    $('#seoPing', box).addEventListener('click', async function (e) {
      var b = e.currentTarget; b.disabled = true; $('#seoErr', box).textContent = '';
      try { var r = await A().API.adminPost('seo-ping'); await afterSave('Яндекс получил ' + r.last.count + ' ' + plural(r.last.count, 'адрес', 'адреса', 'адресов')); }
      catch (er) { $('#seoErr', box).textContent = A().errMsg(er); b.disabled = false; }
    });
  }

  /* ================= Подарочные сертификаты ================= */
  var GIFT_ST = { active: ['Действует', 'done'], pending: ['Ждёт оплаты', 'pending'], used: ['Использован', 'canceled'], expired: ['Истёк', 'canceled'], canceled: ['Отменён', 'canceled'] };
  function giftsSection(m, q) {
    var list = (DATA.giftcards || []).slice().reverse(), s = clone(DATA.settings), cfg = Object.assign({ enabled: true, nominals: [5000, 10000, 20000, 30000], min: 3000, max: 100000, months: 12 }, s.gifts || {});
    var f = (q && q.f) || 'all', shown = list.filter(function (g) { return f === 'all' || g.state === f; });
    var sold = list.filter(function (g) { return g.state !== 'pending' && g.state !== 'canceled'; }), sum = function (a, k) { return a.reduce(function (t, g) { return t + (g[k] || 0); }, 0); };
    m.innerHTML = head('Подарочные сертификаты', '<button class="btn" id="gNew" type="button">+ Выпустить сертификат</button>', 'Покупатели покупают сертификаты на странице <a class="link" href="#/gift" target="_blank">/gift</a> и оплачивают онлайн. Код уходит получателю письмом. Здесь же можно выпустить сертификат вручную — для подарка или розыгрыша.') +
      '<div class="adm-stats"><div class="adm-stat"><span class="eyebrow">Продано и выпущено</span><b class="num">' + sold.length + '</b></div><div class="adm-stat"><span class="eyebrow">На сумму</span><b class="num">' + fmt(sum(sold, 'amount')) + '</b></div><div class="adm-stat"><span class="eyebrow">Ещё не потрачено</span><b class="num">' + fmt(sum(sold.filter(function (g) { return g.state === 'active'; }), 'balance')) + '</b></div></div>' +
      '<div class="adm-chips">' + [['all', 'Все'], ['active', 'Действуют'], ['used', 'Использованы'], ['pending', 'Ждут оплаты'], ['expired', 'Истекли'], ['canceled', 'Отменены']].map(function (x) { var n = x[0] === 'all' ? list.length : list.filter(function (g) { return g.state === x[0]; }).length; return '<a class="adm-chip' + (f === x[0] ? ' on' : '') + '" href="#/admin?s=gifts&f=' + x[0] + '">' + x[1] + ' <span>' + n + '</span></a>'; }).join('') + '</div>' +
      (shown.length ? '<div class="table-wrap"><table class="sizes"><thead><tr><th>Код</th><th>Сумма</th><th>Остаток</th><th>Получатель</th><th>Письмо</th><th>Действует до</th><th>Статус</th><th></th></tr></thead><tbody>' + shown.map(function (g) {
        var stt = GIFT_ST[g.state] || [g.state, ''];
        return '<tr><td><span class="copyable" style="letter-spacing:.06em">' + esc(g.code) + '</span>' + (g.manual ? ' <small class="muted">вручную</small>' : '') + '</td><td class="num">' + fmt(g.amount) + '</td><td class="num">' + fmt(g.balance) + '</td>' +
          '<td>' + esc((g.to && (g.to.name || g.to.email)) || '—') + (g.to && g.to.email && g.to.name ? '<br><small class="muted">' + esc(g.to.email) + '</small>' : '') + '</td>' +
          '<td>' + (g.sentAt ? 'Отправлено ' + new Date(g.sentAt).toLocaleDateString('ru-RU') : g.sendAt ? 'Отправим ' + g.sendAt.split('-').reverse().join('.') : g.to && g.to.email ? '—' : 'Без письма') + '</td>' +
          '<td>' + (g.expiresAt ? new Date(g.expiresAt).toLocaleDateString('ru-RU') : '—') + '</td><td><span class="status ' + stt[1] + '">' + stt[0] + '</span></td>' +
          '<td class="adm-row-tools" style="white-space:nowrap">' + (g.state === 'active' && g.to && g.to.email ? '<button type="button" data-gsend="' + esc(g.id) + '" title="Отправить письмо ещё раз">✉</button>' : '') + (g.state === 'active' || g.state === 'pending' ? '<button type="button" data-gcancel="' + esc(g.id) + '" title="Отменить">✕</button>' : '') + '</td></tr>' +
          ((g.log || []).length ? '<tr class="g-log"><td colspan="8">' + g.log.map(function (l) { return (l.amount < 0 ? 'Списано ' + fmt(-l.amount) : 'Возвращено ' + fmt(l.amount)) + ' · заказ № ' + esc(l.number || '') + ' · ' + new Date(l.at).toLocaleDateString('ru-RU'); }).join('<br>') + '</td></tr>' : '');
      }).join('') + '</tbody></table></div>' : '<div class="empty"><h3>Сертификатов пока нет</h3><p>Они появятся здесь, когда кто-то купит сертификат или вы выпустите его вручную.</p></div>') +
      '<div class="adm-card" style="margin-top:20px"><h3 class="adm-h3">Настройки</h3><div class="adm-form">' +
        '<label class="check" style="grid-column:1/-1"><input type="checkbox" id="gEn"' + (cfg.enabled ? ' checked' : '') + '> <span>Продавать сертификаты на сайте<br><small class="muted">Покупка работает только с подключённой ЮKassa</small></span></label>' +
        '<label class="field"><span>Номиналы, ₽ — через запятую</span><input class="input" id="gNoms" value="' + esc(cfg.nominals.join(', ')) + '"></label>' +
        '<label class="field"><span>Срок действия, месяцев</span><input class="input num" id="gMonths" type="number" min="1" max="36" value="' + cfg.months + '"></label>' +
        '<label class="field"><span>Своя сумма: от, ₽</span><input class="input num" id="gMin" type="number" value="' + cfg.min + '"></label>' +
        '<label class="field"><span>Своя сумма: до, ₽</span><input class="input num" id="gMax" type="number" value="' + cfg.max + '"></label>' +
      '</div><div class="adm-actions" style="margin-top:14px"><button class="btn" id="gSave" type="button">Сохранить</button></div><p class="form-error" id="gErr"></p></div>';
    m.addEventListener('click', async function (e) {
      var c = e.target.closest('[data-gcancel]'), sn = e.target.closest('[data-gsend]');
      if (c) { if (!confirm('Отменить сертификат? Им больше нельзя будет оплатить заказ.')) return; try { await A().API.adminPost('gifts/' + c.getAttribute('data-gcancel') + '/cancel'); await afterSave('Сертификат отменён'); } catch (ex) { toast(A().errMsg(ex), true); } }
      if (sn) { try { await A().API.adminPost('gifts/' + sn.getAttribute('data-gsend') + '/resend'); toast('Письмо отправлено'); } catch (ex) { toast(A().errMsg(ex), true); } }
    });
    $('#gSave').addEventListener('click', async function () {
      var noms = $('#gNoms').value.split(/[,;\s]+/).map(function (x) { return Math.round(Number(x)); }).filter(function (x) { return x >= 100; }).slice(0, 6);
      if (!noms.length) { $('#gErr').textContent = 'Укажите хотя бы один номинал'; return; }
      s.gifts = { enabled: $('#gEn').checked, nominals: noms, months: Math.max(1, Math.min(36, Number($('#gMonths').value) || 12)), min: Math.max(100, Number($('#gMin').value) || 1000), max: Math.max(1000, Number($('#gMax').value) || 100000) };
      try { await A().API.adminSave('settings', s); await afterSave('Сохранено'); } catch (ex) { $('#gErr').textContent = A().errMsg(ex); }
    });
    $('#gNew').addEventListener('click', function () {
      A().openModal('<h3 class="serif" style="font-size:30px;margin-bottom:6px">Выпустить сертификат</h3><p class="muted" style="margin-bottom:18px;font-size:14px">Без оплаты — для подарка, розыгрыша или замены. Если указать почту, код сразу уйдёт письмом.</p>' +
        '<form class="form" id="gnForm"><label class="field"><span>Сумма, ₽</span><input class="input num" id="gn-amount" type="number" min="100" value="' + (cfg.nominals[1] || cfg.nominals[0]) + '"></label>' +
        '<div class="row2"><label class="field"><span>Имя получателя</span><input class="input" id="gn-name"></label><label class="field"><span>Почта получателя <small class="muted">— необязательно</small></span><input class="input" id="gn-email" type="email"></label></div>' +
        '<label class="field"><span>Пожелание</span><input class="input" id="gn-msg" maxlength="300"></label><p class="form-error" id="gnErr"></p><button class="btn block">Выпустить</button></form>');
      $('#gnForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        try { var r = await A().API.adminPost('gifts', { amount: Number($('#gn-amount').value), toName: $('#gn-name').value, toEmail: $('#gn-email').value, message: $('#gn-msg').value }); A().closePanels(); await afterSave('Сертификат ' + r.gift.code + ' выпущен' + (r.sent ? ' и отправлен' : '')); }
        catch (ex) { $('#gnErr').textContent = A().errMsg(ex); }
      });
    });
  }

  /* ================= Журнал действий (13.60) =================
     Кто, когда и что поменял в панели. Фильтры: раздел, сотрудник, поиск по тексту. Ссылка ведёт к заказу или товару. */
  var AUDIT_AREAS = [['', 'Все разделы'], ['orders', 'Заказы'], ['support', 'Поддержка'], ['content', 'Товары и витрина'], ['customers', 'Покупатели'], ['marketing', 'Рассылки'], ['finance', 'Финансы'], ['settings', 'Настройки'], ['staff', 'Сотрудники'], ['security', 'Входы']];
  var AUDIT_IC = { orders: '<path d="M5 7h14l-1.2 12H6.2z"/><path d="M9 7a3 3 0 0 1 6 0"/>', support: '<path d="M5 6h14v10H9l-4 3z"/>', content: '<path d="M8 4l-4 3 2 3 2-1v11h8V9l2 1 2-3-4-3a4 4 0 0 1-8 0z"/>', customers: '<circle cx="12" cy="9" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>', marketing: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/>', finance: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>', staff: '<circle cx="9" cy="9" r="3"/><path d="M3 19a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M18 19a6 6 0 0 0-2-4.5"/>', security: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>' };
  async function auditSection(m, q) {
    var f = { area: q.area || '', by: q.by || '', q: q.q || '' };
    m.innerHTML = head('Журнал действий', '', 'Все изменения в панели: заказы, товары, цены и остатки, настройки, доступы и входы. Хранятся последние 5000 записей.') +
      '<div class="au-bar"><select class="select" id="auArea" aria-label="Раздел">' + AUDIT_AREAS.map(function (a) { return '<option value="' + a[0] + '"' + (a[0] === f.area ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select>' +
      '<select class="select" id="auBy" aria-label="Сотрудник"><option value="">Все сотрудники</option></select>' +
      '<input class="input" id="auQ" type="search" placeholder="Поиск: номер заказа, товар, слово" value="' + esc(f.q) + '"></div><div id="auList"><div class="loader">…</div></div>';
    var list = $('#auList'), items = [], seq = 0;
    var day = function (iso) { var d = new Date(iso), t = new Date(), y = new Date(Date.now() - 864e5); return d.toDateString() === t.toDateString() ? 'Сегодня' : d.toDateString() === y.toDateString() ? 'Вчера' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' }); };
    var row = function (x) {
      var link = x.ref && x.ref.order ? '#/admin?s=orders&id=' + encodeURIComponent(x.ref.order) : x.ref && x.ref.product ? '#/admin?s=products&id=' + encodeURIComponent(x.ref.product) : '';
      return '<div class="au-row"><span class="au-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + (AUDIT_IC[x.area] || AUDIT_IC.settings) + '</svg></span>' +
        '<div class="au-t">' + (link ? '<a href="' + link + '">' + esc(x.text) + '</a>' : '<span>' + esc(x.text) + '</span>') + '<small>' + esc(x.name || 'Система') + (x.role ? ' · ' + esc(x.role) : '') + '</small></div>' +
        '<time class="num">' + new Date(x.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + '</time></div>';
    };
    var draw = function (more) {
      if (!items.length) { list.innerHTML = '<div class="adm-card au-empty"><p class="muted">' + (f.area || f.by || f.q ? 'Ничего не нашлось — измените фильтры' : 'Пока пусто. Здесь появится каждое изменение в панели') + '</p></div>'; return; }
      var html = '', cur = '';
      items.forEach(function (x) { var d = day(x.at); if (d !== cur) { html += (cur ? '</div>' : '') + '<h3 class="au-day">' + d + '</h3><div class="adm-card au-group">'; cur = d; } html += row(x); });
      list.innerHTML = html + '</div>' + (more ? '<button class="btn ghost" id="auMore" type="button">Показать ещё</button>' : '');
      var mb = $('#auMore'); if (mb) mb.addEventListener('click', function () { load(true); });
    };
    async function load(append) {
      var n = ++seq, prm = { area: f.area, by: f.by, q: f.q }; if (append && items.length) prm.before = items[items.length - 1].at;
      try {
        var r = await A().API.adminAudit(prm); if (n !== seq) return;
        items = append ? items.concat(r.items) : r.items;
        var sel = $('#auBy'); if (sel && sel.options.length === 1) r.people.forEach(function (pp) { var o = document.createElement('option'); o.value = pp.id; o.textContent = pp.name; if (pp.id === f.by) o.selected = true; sel.appendChild(o); });
        draw(r.more);
      } catch (e) { list.innerHTML = '<p class="form-error">' + esc(A().errMsg(e)) + '</p>'; }
    }
    var t = 0;
    $('#auArea').addEventListener('change', function () { f.area = this.value; load(); });
    $('#auBy').addEventListener('change', function () { f.by = this.value; load(); });
    $('#auQ').addEventListener('input', function () { var v = this.value; clearTimeout(t); t = setTimeout(function () { f.q = v.trim(); load(); }, 300); });
    load();
  }

  /* ================= Push-уведомления (13.60) =================
     Каждый сотрудник включает их на своём телефоне и выбирает, что присылать (в пределах своей роли).
     С правом «маркетинг» — рассылка акций покупателям, которые сами согласились их получать. */
  var STAFF_PUSH = {
    order: ['Новый заказ', 'С оплатой при получении — сразу после оформления'], paid: ['Заказ оплачен', 'Онлайн-оплата прошла — пора собирать'],
    support: ['Вопрос покупателя', 'Новые обращения и сообщения в поддержку'], request: ['Заявка на обмен или возврат', 'Покупатель оформил заявку в заказе'],
    returnIn: ['Возврат пришёл на склад', 'Проверьте вещь и завершите возврат'], stock: ['Заканчивается размер', 'После заказа осталось 2 штуки или меньше'],
    digest: ['Итоги дня', 'В 21:00 по Москве: заказы, выручка, вопросы без ответа'], security: ['Вход в панель', 'Кто-то из команды вошёл с нового устройства']
  };
  var PBELL = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>';
  function pnMock(title, body, img, big) {
    return '<div class="pn"><div class="pn-head"><img class="pn-app" src="img/icon-192.png" alt=""><span>' + esc(A().D.settings.storeName || 'ALBAKOV') + '</span><time>сейчас</time></div>' +
      '<div class="pn-main"><div class="pn-txt"><b>' + esc(title) + '</b><p>' + esc(body) + '</p></div>' + (img && !big ? '<img class="pn-thumb" src="' + esc(img) + '" alt="">' : '') + '</div>' +
      (img && big ? '<img class="pn-big" src="' + esc(img) + '" alt="">' : '') + '</div>';
  }
  function pnStage(inner, cls) { return '<div class="pn-stage' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><span class="pn-clock">' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + '</span>' + inner + '</div>'; }
  /* Приложение ALBAKOV на iPhone (13.61): ключ Apple для push. Ключ .p8 вводит владелец, наружу он не отдаётся.
     С ключом сайт сам отдаёт файл Universal Links — ссылки albakovofficial.ru открываются сразу в приложении. */
  async function mountApnsCard(m) {
    var box = document.createElement('div'); box.className = 'adm-card ps-apns'; m.appendChild(box);
    var r; try { r = await A().API.adminApns('GET'); } catch (e) { box.remove(); return; }
    var draw = function () {
      box.innerHTML = '<h3 class="adm-h3">Приложение iPhone</h3>' +
        '<p class="al-hint">Уведомления в приложении ALBAKOV из App Store приходят через Apple. Нужен ключ: Apple Developer → Certificates, Identifiers &amp; Profiles → Keys → «+» → Apple Push Notifications service. Скачайте файл .p8 (даётся один раз) и вставьте его текст сюда.</p>' +
        '<p class="pushs-st' + (r.set ? ' on' : '') + '">' + (r.set ? 'Ключ сохранён · Key ID ' + esc(r.keyId) + ' · Team ID ' + esc(r.teamId) + ' · устройств с приложением: ' + r.devices : 'Ключ ещё не добавлен — в приложении уведомления не придут') + '</p>' +
        '<div class="adm-two"><label class="field"><span>Team ID</span><input class="input" id="apTeam" maxlength="10" autocomplete="off" spellcheck="false" value="' + esc(r.teamId) + '" placeholder="10 символов"></label>' +
        '<label class="field"><span>Key ID</span><input class="input" id="apKey" maxlength="10" autocomplete="off" spellcheck="false" value="' + esc(r.keyId) + '" placeholder="10 символов"></label></div>' +
        '<label class="field"><span>Ключ .p8' + (r.set ? ' <small class="muted">— оставьте пустым, чтобы не менять</small>' : '') + '</span><textarea class="textarea" id="apP8" rows="4" autocomplete="off" spellcheck="false" placeholder="-----BEGIN PRIVATE KEY-----"></textarea></label>' +
        '<div class="ps-bc-act"><button class="btn" type="button" id="apSave">Сохранить ключ</button>' + (r.set ? '<button class="btn ghost" type="button" id="apDel">Удалить ключ</button>' : '') + '</div>' +
        '<p class="al-hint">Bundle ID приложения: ' + esc(r.bundleId) + '. Проверка: откройте эту страницу в приложении на iPhone и нажмите «Проверить» в блоке «Это устройство».</p><p class="form-error" id="apErr"></p>';
      $('#apSave', box).addEventListener('click', async function () {
        var b = this; b.disabled = true; $('#apErr', box).textContent = '';
        try { r = await A().API.adminApns('PUT', { teamId: $('#apTeam', box).value, keyId: $('#apKey', box).value, p8: $('#apP8', box).value }); toast('Ключ Apple сохранён'); draw(); }
        catch (e) { $('#apErr', box).textContent = A().errMsg(e); b.disabled = false; }
      });
      var del = $('#apDel', box); if (del) del.addEventListener('click', async function () {
        if (this.dataset.armed !== '1') { this.dataset.armed = '1'; this.textContent = 'Точно удалить? Нажмите ещё раз'; return; }
        try { r = await A().API.adminApns('DELETE'); toast('Ключ удалён'); draw(); } catch (e) { $('#apErr', box).textContent = A().errMsg(e); }
      });
    };
    draw();
  }
  async function pushSection(m) {
    m.innerHTML = head('Push-уведомления', '', 'Мгновенные уведомления в приложении ALBAKOV для iPhone — даже когда приложение закрыто. Достаточно войти в приложении под своим аккаунтом и разрешить уведомления. Покупателям уведомления о заказе приходят сами, если они их включили.') + '<div class="loader">…</div>';
    var r, st = window.Push ? await Push.state('staff') : 'unsupported';
    try { r = await A().API.adminPush(); } catch (e) { m.querySelector('.loader').outerHTML = '<p class="form-error">' + esc(A().errMsg(e)) + '</p>'; return; }
    var keys = Object.keys(r.prefs || {});
    var dev = st === 'on' ? '<span class="pushs-st on">Включены на этом устройстве</span><span class="pushs-btns"><button class="btn ghost sm" type="button" data-sp="test">Проверить</button><button class="btn ghost sm" type="button" data-sp="off">Выключить</button></span>'
      : st === 'ios-app' ? '<span class="pushs-st">Уведомления панели приходят в приложение ALBAKOV для iPhone: войдите в нём под своим аккаунтом и разрешите уведомления</span>'
      : st === 'denied' ? '<span class="pushs-st">Запрещены в настройках браузера — разрешите уведомления для этого сайта и обновите страницу</span>'
      : st === 'unsupported' ? '<span class="pushs-st">Этот браузер не умеет показывать уведомления</span>'
      : '<span class="pushs-st">Выключены на этом устройстве</span><button class="btn sm" type="button" data-sp="on">Включить на этом устройстве</button>';
    var mk = r.audience !== null && r.audience !== undefined;
    m.innerHTML = head('Push-уведомления', '', 'Мгновенные уведомления в приложении ALBAKOV для iPhone — даже когда приложение закрыто. Достаточно войти в приложении под своим аккаунтом и разрешить уведомления. Покупателям уведомления о заказе приходят сами, если они их включили.') +
      '<div class="adm-two"><div class="adm-card ps-dev"><h3 class="adm-h3">Это устройство</h3>' +
        pnStage(pnMock('Новый заказ № 1042 · 5 798 ₽', 'Анна Смирнова, Москва\nФутболка Оверсайз L, Футболка Оверсайз M', 'img/icon-192.png')) +
        '<div class="pushs-dev">' + PBELL + dev + '</div>' + (r.devices > 1 ? '<p class="al-hint">Всего ваших устройств с уведомлениями: ' + r.devices + '</p>' : '') + '<p class="form-error" id="spErr"></p></div>' +
      '<div class="adm-card"><h3 class="adm-h3">Что присылать мне</h3><p class="al-hint">Только то, что относится к вашей роли. Настройка общая для всех ваших устройств.</p><div class="al-events">' +
        keys.map(function (k) { var x = STAFF_PUSH[k] || [k, '']; return '<label class="al-ev"><span><b>' + x[0] + '</b><small>' + x[1] + '</small></span><span class="adm-switch"><input type="checkbox" data-spk="' + k + '"' + (r.prefs[k] ? ' checked' : '') + '><span></span></span></label>'; }).join('') +
      '</div></div></div>' +
      (mk ? '<div class="adm-card ps-bc"><div class="ps-bc-form"><h3 class="adm-h3">Рассылка покупателям</h3>' +
        '<p class="al-hint">Уходит только тем, кто сам включил «Акции и новинки» в кабинете: сейчас это <b>' + r.audience + ' ' + plural(r.audience, 'устройство', 'устройства', 'устройств') + '</b>' + (r.customers ? ' из ' + r.customers + ' с уведомлениями' : '') + '. Пишите редко и по делу — частые рассылки заставляют отключать уведомления совсем.</p>' +
        '<label class="field"><span>Заголовок <small class="muted" data-cnt="pbT">0/60</small></span><input class="input" id="pbT" maxlength="60" placeholder="Новая коллекция уже на сайте"></label>' +
        '<label class="field"><span>Текст <small class="muted" data-cnt="pbB">0/180</small></span><textarea class="textarea" id="pbB" rows="3" maxlength="180" placeholder="Три футболки с вышивкой AV — размеры разбирают быстро"></textarea></label>' +
        '<label class="field"><span>Куда ведёт</span><input class="input" id="pbU" value="/catalog" placeholder="/catalog"><small class="muted" style="font-size:13px">Адрес страницы на сайте: /catalog, /sale, /product/… — скопируйте из адресной строки всё после домена</small></label>' +
        '<div class="field"><span>Картинка (необязательно)</span><div class="adm-imgs" data-imgs="pushImage" data-single="1"></div><small class="muted" style="font-size:13px">На Android покажется крупно, на iPhone — миниатюрой справа</small></div>' +
        '<div class="ps-bc-act"><button class="btn ghost" type="button" id="pbTest">Прислать пробное мне</button><button class="btn" type="button" id="pbSend"' + (r.audience ? '' : ' disabled') + '>Отправить ' + r.audience + ' ' + plural(r.audience, 'покупателю', 'покупателям', 'покупателям') + '</button></div><p class="form-error" id="pbErr"></p></div>' +
        '<div class="ps-bc-pv"><span class="adm-h3">Так увидят покупатели</span><div class="ps-phones"><div><small>iPhone</small><div id="pvIos"></div></div><div><small>Android</small><div id="pvAnd"></div></div></div></div>' +
        (r.broadcasts && r.broadcasts.length ? '<div class="ps-hist"><h3 class="adm-h3">Отправленные</h3>' + r.broadcasts.map(function (b) { return '<div class="ps-hrow"><span class="num">' + esc(new Date(b.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</span><span><b>' + esc(b.title) + '</b><small>' + esc(b.body) + '</small></span><span class="ps-hn">' + b.sent + ' из ' + b.to + (b.by ? '<small>' + esc(b.by) + '</small>' : '') + '</span></div>'; }).join('') + '</div>' : '') +
      '</div>' : '');
    if (can('staff')) mountApnsCard(m);
    var err = $('#spErr');
    m.onchange = async function (e) {
      var i = e.target.closest('[data-spk]'); if (!i) return;
      r.prefs[i.getAttribute('data-spk')] = i.checked;
      try { await A().API.adminPush(r.prefs); toast('Сохранено'); } catch (ex) { err.textContent = A().errMsg(ex); i.checked = !i.checked; r.prefs[i.getAttribute('data-spk')] = i.checked; }
    };
    $$('[data-sp]', m).forEach(function (b) { b.addEventListener('click', async function () {
      var a = b.getAttribute('data-sp'); err.textContent = '';
      b.disabled = true;
      try {
        if (a === 'on') { await Push.enable('staff'); toast('Уведомления панели включены'); }
        if (a === 'off') { await Push.disable('staff'); toast('Уведомления на этом устройстве выключены'); }
        if (a === 'test') { await Push.test('staff'); toast('Отправили — уведомление появится через пару секунд'); b.disabled = false; return; }
        pushSection(m);
      } catch (ex) { err.textContent = A().errMsg(ex); b.disabled = false; }
    }); });
    if (!mk) return;
    mountImages(m, { pushImage: '' });
    var T = $('#pbT'), B = $('#pbB'), U = $('#pbU'), bErr = $('#pbErr'), armed = false;
    var img = function () { return (imgState.pushImage || [])[0] || ''; };
    var draw = function () {
      $$('[data-cnt]', m).forEach(function (c) { var el = $('#' + c.getAttribute('data-cnt')); c.textContent = el.value.length + '/' + el.maxLength; });
      var t = T.value.trim() || 'Заголовок уведомления', b = B.value.trim() || 'Текст — одна-две строки о главном';
      $('#pvIos').innerHTML = pnStage(pnMock(t, b, img(), false), 'ios');
      $('#pvAnd').innerHTML = pnStage(pnMock(t, b, img(), true), 'and');
      if (armed) { armed = false; $('#pbSend').textContent = 'Отправить ' + r.audience + ' ' + plural(r.audience, 'покупателю', 'покупателям', 'покупателям'); $('#pbSend').classList.remove('danger'); }
    };
    [T, B, U].forEach(function (el) { el.addEventListener('input', draw); });
    new MutationObserver(draw).observe($('[data-imgs="pushImage"]', m), { childList: true });
    draw();
    var payload = function (test) { return { title: T.value.trim(), body: B.value.trim(), url: U.value.trim() || '/', image: img(), test: !!test }; };
    $('#pbTest').addEventListener('click', async function () {
      var b = this; b.disabled = true; bErr.textContent = '';
      try { await A().API.adminPushBroadcast(payload(true)); toast('Пробное уведомление отправлено на ваши устройства'); } catch (ex) { bErr.textContent = A().errMsg(ex); }
      b.disabled = false;
    });
    // Отправка — в два нажатия: сначала кнопка спрашивает «Точно?», без всплывающих окон
    $('#pbSend').addEventListener('click', async function () {
      var b = this; bErr.textContent = '';
      if (!T.value.trim() || !B.value.trim()) { bErr.textContent = 'Напишите заголовок и текст'; return; }
      if (!armed) { armed = true; b.textContent = 'Точно отправить? Нажмите ещё раз'; b.classList.add('danger'); return; }
      b.disabled = true; b.textContent = 'Отправляем…';
      try { var x = await A().API.adminPushBroadcast(payload(false)); toast('Доставлено: ' + x.sent + ' из ' + x.to); pushSection(m); }
      catch (ex) { bErr.textContent = A().errMsg(ex); b.disabled = false; armed = false; draw(); }
    });
  }

  /* ================= Уведомления на почту ================= */
  // Владельцу на основную почту: новые заказы, вопросы покупателей, заканчивающиеся размеры
  function alertsPanel(m) {
    var s = clone(DATA.settings), n = s.ownerNotify = Object.assign({ email: '', events: {} }, s.ownerNotify || {});
    var ev = Object.assign({ order: true, support: true, stock: true }, n.events);
    var main = (s.contacts || {}).email || '', ready = !!A().D.mailReady;
    var KINDS = [['order', 'Новый заказ', 'Состав, покупатель, доставка и оплата. Заказ с онлайн-оплатой приходит, когда деньги поступили'], ['support', 'Вопросы покупателей', 'Новые обращения и сообщения в поддержку'], ['stock', 'Заканчивается размер', 'Когда после заказа осталось 2 штуки или меньше'], ['system', 'Проблемы сайта', 'Ночная резервная копия не сделалась или на сервере кончается место']];
    m.innerHTML = '<p class="mh-lead">Новые заказы, вопросы покупателей и заканчивающиеся размеры приходят письмом на вашу почту — сразу, как только что-то произошло.</p>' +
      '<div class="adm-two"><div class="adm-card al-card"><h3 class="adm-h3">Куда присылать</h3>' +
        '<label class="field"><span>Почта для уведомлений</span><input class="input" id="alEmail" type="email" inputmode="email" autocomplete="email" placeholder="' + esc(main || 'shop@example.ru') + '" value="' + esc(n.email || '') + '"></label>' +
        '<p class="al-hint">' + (main ? 'Пусто — письма уходят на основную почту магазина <b>' + esc(main) + '</b> из раздела «Меню, контакты».' : 'Укажите адрес, на который присылать уведомления.') + '</p>' +
        '<button class="btn" id="alSave" type="button">Сохранить</button>' +
        '<div class="al-test"><h3 class="adm-h3">Проверить</h3><p class="al-hint">Пришлём пример письма — посмотрите, как оно выглядит и не попадает ли в спам.</p><div class="al-tests">' +
          KINDS.map(function (x) { return '<button class="btn ghost sm" type="button" data-al-test="' + x[0] + '"' + (ready ? '' : ' disabled') + '>' + x[1] + '</button>'; }).join('') + '</div></div>' +
        '<p class="form-error" id="alErr"></p></div>' +
      '<div class="adm-card"><h3 class="adm-h3">Что присылать</h3><div class="al-events">' +
        KINDS.map(function (x) { return '<label class="al-ev"><span><b>' + x[1] + '</b><small>' + x[2] + '</small></span><span class="adm-switch"><input type="checkbox" data-al="' + x[0] + '"' + (ev[x[0]] !== false ? ' checked' : '') + '><span></span></span></label>'; }).join('') +
      '</div></div></div>';
    var err = $('#alErr');
    async function persist(msg) { n.events = ev; try { await A().API.adminSave('settings', s); DATA.settings = s; toast(msg || 'Сохранено'); return true; } catch (e) { err.textContent = A().errMsg(e); return false; } }
    $('#alSave').addEventListener('click', function () {
      var v = $('#alEmail').value.trim(); err.textContent = '';
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { err.textContent = 'Проверьте адрес почты'; $('#alEmail').classList.add('invalid'); return; }
      $('#alEmail').classList.remove('invalid'); n.email = v; persist(v ? 'Уведомления будут приходить на ' + v : 'Уведомления будут приходить на основную почту');
    });
    $$('[data-al]', m).forEach(function (i) { i.addEventListener('change', function () { ev[i.getAttribute('data-al')] = i.checked; persist(); }); });
    $$('[data-al-test]', m).forEach(function (b) { b.addEventListener('click', async function () {
      b.disabled = true; err.textContent = '';
      try { var r = await A().API.adminPost('owner-notify/test', { kind: b.getAttribute('data-al-test') }); toast('Отправили «' + b.textContent + '» на ' + r.to); } catch (e) { err.textContent = A().errMsg(e); }
      b.disabled = false;
    }); });
  }

  function homeSettings(m) {
    settingsForm(m, 'Главная страница', 'Тексты, картинки и блоки главной страницы. Выделить слово в заголовке курсивом и цветом: *слово*. Перенос строки — Enter.', [
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
      { section: 'Блок «Преимущества»' },
      { k: 'benefitsEyebrow', label: 'Надзаголовок' },
      { k: 'benefitsTitle', label: 'Заголовок', hint: 'Оставьте пустым, чтобы показать только карточки. Тексты карточек и их иконки — в списке «Преимущества»' },
      { section: 'Блок о бренде' },
      { k: 'editorialEyebrow', label: 'Надзаголовок' },
      { k: 'editorialTitle', label: 'Заголовок' },
      { k: 'editorialText', label: 'Текст', type: 'textarea' },
      { k: 'editorialImage', label: 'Фото', type: 'image' }
    ], {
      benefits: { title: 'Преимущества', cols: [{ k: 'title', label: 'Заголовок' }, { k: 'text', label: 'Описание', flex: 2 }, { k: 'icon', label: 'Иконка', type: 'select', options: [['auto', 'Иконка: по тексту'], ['delivery', 'Доставка — грузовик'], ['quality', 'Качество — медаль'], ['fabric', 'Ткани — стопка тканей'], ['fitting', 'Примерка — футболка'], ['return', 'Возврат — коробка'], ['payment', 'Оплата — карты'], ['gift', 'Подарок / бонусы'], ['cash', 'Наличные'], ['pin', 'Метка на карте'], ['style', 'Стиль — вешалка'], ['gem', 'Индивидуальность — камень'], ['spool', 'Производство — катушка'], ['mail', 'Почта — конверт'], ['chat', 'Чат — облачка'], ['phone', 'Телефон'], ['none', 'Без иконки']] }, { k: 'link', label: 'Ссылка (необязательно)', placeholder: '#/page/delivery' }, { k: 'linkText', label: 'Текст ссылки', placeholder: 'Подробнее' }], get: function (s) { return s.home.benefits; }, set: function (s, v) { s.home.benefits = v; } }
    }, function (s) { return s.home; }, function (s, o) { s.home = Object.assign(s.home, o); });
  }

  /* Разделы «Женщинам», «Мужчинам», «Детям» (13.63): открыт/закрыт и страница «скоро появится» с фото раздела */
  var GENDER_LIST = [['women', 'Женщинам'], ['men', 'Мужчинам'], ['kids', 'Детям']];
  function sectionsSettings(m) {
    var cnt = function (g) { return DATA.products.filter(function (p) { return p.active !== false && p.gender === g; }).length; };
    var defs = [];
    GENDER_LIST.forEach(function (x) {
      var k = x[0];
      defs.push({ section: 'Раздел «' + x[1] + '» · товаров: ' + cnt(k) });
      defs.push({ k: 'open_' + k, label: 'Раздел открыт', type: 'checkbox', hint: 'Если выключить, его товары пропадут из каталога, а покупатель, выбравший этот раздел, увидит страницу «скоро появится».' + (k === 'kids' ? ' Товары унисекс в детский раздел не попадают.' : ' Товары унисекс останутся во взрослом разделе.') });
      defs.push({ k: 'title_' + k, label: 'Заголовок страницы «скоро»', type: 'textarea', rows: 2, hint: 'Enter — перенос строки, *слово* — курсивом' });
      defs.push({ k: 'text_' + k, label: 'Текст страницы «скоро»', type: 'textarea', rows: 2 });
      defs.push({ k: 'image_' + k, label: 'Фото страницы «скоро»', type: 'image', hint: 'Вертикальное фото' });
    });
    settingsForm(m, 'Разделы', 'Здесь можно закрыть раздел, пока в нём нет одежды. У каждого товара раздел задаётся полем «Для кого» в карточке товара.', defs, {},
      function (s) {
        var o = {}, gs = s.genders || {};
        GENDER_LIST.forEach(function (x) { var c = gs[x[0]] || {}, k = x[0]; o['open_' + k] = c.open !== false; o['title_' + k] = c.title || ''; o['text_' + k] = c.text || ''; o['image_' + k] = c.image || ''; });
        return o;
      },
      function (s, o) {
        if (!GENDER_LIST.some(function (x) { return o['open_' + x[0]]; })) return 'Оставьте открытым хотя бы один раздел';
        s.genders = {};
        GENDER_LIST.forEach(function (x) { var k = x[0]; s.genders[k] = { open: o['open_' + k], title: o['title_' + k], text: o['text_' + k], image: o['image_' + k] }; });
        return '';
      });
  }

  function menuSettings(m) {
    settingsForm(m, 'Меню, контакты, соцсети', 'Пункты верхнего меню, контакты в подвале и ссылки на социальные сети. Порядок меняется стрелками.', [
      { section: 'Контакты' },
      { k: 'phone', label: 'Телефон' }, { k: 'email', label: 'Электронная почта' },
      { k: 'address', label: 'Адрес' }, { k: 'hours', label: 'Часы работы' },
      { k: 'appStore', label: 'Приложение в App Store', wide: true, hint: 'Ссылка вида https://apps.apple.com/ru/app/… — появится, когда Apple одобрит приложение. С ней в меню телефона и в подвале появится «Скачать в App Store», а на iPhone — подсказка про уведомления в приложении' },
      { section: 'Кнопка связи' },
      { k: 'fab', label: 'Показывать кнопку связи на всех страницах', type: 'checkbox', wide: true, hint: 'Круглая кнопка в правом нижнем углу: чат поддержки, Telegram из соцсетей, WhatsApp, телефон и почта' },
      { k: 'whatsapp', label: 'WhatsApp', hint: 'Номер для кнопки связи, например +7 999 000-00-00. Пусто — WhatsApp не показывается' }
    ], {
      nav: { title: 'Верхнее меню', hint: 'Ссылки: #/catalog, #/catalog?cat=адрес-категории, #/sale, #/sizes, #/page/адрес-страницы или полный адрес сайта', cols: [{ k: 'label', label: 'Название' }, { k: 'link', label: 'Ссылка', flex: 2 }], get: function (s) { return s.nav; }, set: function (s, v) { s.nav = v; } },
      socials: { title: 'Социальные сети', hint: 'Например: Telegram — https://t.me/ваш_канал', cols: [{ k: 'name', label: 'Название' }, { k: 'url', label: 'Ссылка', flex: 2 }], get: function (s) { return s.socials; }, set: function (s, v) { s.socials = v; } }
    }, function (s) { return s.contacts; }, function (s, o) {
      s.contacts = o;
      if (o.appStore && !/^https:\/\/apps\.apple\.com\//.test(o.appStore)) return 'Ссылка на приложение должна начинаться с https://apps.apple.com/';
      var bad = (s.socials || []).find(function (x) { return !/^https?:\/\//.test(x.url); });
      if (bad) return 'Ссылка на «' + bad.name + '» должна начинаться с https://';
      return '';
    });
  }

  /* ================= Оплата, касса, доставка =================
     Карточки вместо голой формы: у способа оплаты — переключатель и превью «как увидит покупатель»,
     у ЮKassa — статус подключения, у доставки — карточка на каждый способ с понятными полями. */
  function payIc(n) { return '<img src="img/benefits/' + n + '.webp?v=13.57.1" alt="" width="52" height="52" decoding="async">'; }
  var PAY_IC = { card: payIc('payment'), cash: payIc('cash'), truck: payIc('delivery'), pin: payIc('pin') };
  function switchHtml(id, on, label) {
    return '<label class="pm-switch"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span class="pm-track" aria-hidden="true"></span><span class="sr">' + esc(label) + '</span></label>';
  }
  function rub(n) { return Number(n || 0).toLocaleString('ru-RU') + ' ₽'; }
  function deliverySummary(d) {
    var price = Number(d.price) || 0, free = Number(d.freeFrom) || 0;
    if (d.priceAuto && Pricing.cdekMode(d)) return 'по тарифу СДЭК' + (Number(d.markup) ? ' + ' + rub(d.markup) : '') + (free ? ', бесплатно от ' + rub(free) : '');
    if (!price) return 'Бесплатно';
    return rub(price) + (free ? ', бесплатно от ' + rub(free) : '');
  }
  function deliveryCard(d) {
    var id = esc(d.id || uid('d'));
    return '<div class="dm" data-id="' + id + '">' +
      '<div class="dm-ic">' + (d.needsAddress === false ? PAY_IC.pin : PAY_IC.truck) + '</div>' +
      '<div class="dm-body">' +
        '<div class="dm-row dm-row-main">' +
          '<label class="dm-f dm-name"><span>Название</span><input class="input" data-d="name" value="' + esc(d.name || '') + '" placeholder="Например, Курьер по Москве"></label>' +
          '<label class="dm-f dm-desc"><span>Срок или пояснение</span><input class="input" data-d="desc" value="' + esc(d.desc || '') + '" placeholder="Например, 1–2 дня, с примеркой"></label>' +
        '</div>' +
        '<div class="dm-row">' +
          '<label class="dm-f dm-num"><span>Стоимость</span><span class="dm-money"><input class="input num" type="number" min="0" step="10" data-d="price" value="' + (Number(d.price) || 0) + '"><i>₽</i></span><small>0 — бесплатно всегда</small></label>' +
          '<label class="dm-f dm-num"><span>Бесплатно от суммы заказа</span><span class="dm-money"><input class="input num" type="number" min="0" step="500" data-d="freeFrom" value="' + (Number(d.freeFrom) || 0) + '"><i>₽</i></span><small>0 — не делать бесплатной</small></label>' +
          '<div class="dm-f dm-addr"><span>Адрес покупателя</span><label class="dm-toggle">' + '<input type="checkbox" data-d="needsAddress"' + (d.needsAddress !== false ? ' checked' : '') + '><span class="pm-track" aria-hidden="true"></span><b>' + (d.needsAddress !== false ? 'Спросить город и адрес' : 'Не нужен — самовывоз') + '</b></label></div>' +
        '</div>' +
        '<div class="dm-pvz dm-mode"' + (d.needsAddress === false ? ' hidden' : '') + '><span><b>СДЭК</b><small>Город покупатель выбирает из подсказок СДЭК — с областью, без ошибок</small></span>' +
          '<select class="select" data-d="cdekMode" aria-label="Режим СДЭК">' + [['', 'Не СДЭК, адрес вручную'], ['pvz', 'Пункт выдачи из списка'], ['door', 'Курьер до двери']].map(function (o2) { return '<option value="' + o2[0] + '"' + ((Pricing.cdekMode(d) || '') === o2[0] ? ' selected' : '') + '>' + o2[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="dm-auto"' + (d.needsAddress === false || !Pricing.cdekMode(d) ? ' hidden' : '') + '><label class="dm-pvz"><input type="checkbox" data-d="priceAuto"' + (d.priceAuto ? ' checked' : '') + '><span><b>Цена по тарифу СДЭК</b><small>Стоимость считается по городу покупателя из вашего пункта отгрузки. «Стоимость» выше — запасная, если СДЭК не ответил</small></span></label>' +
          '<label class="dm-f dm-num dm-markup"><span>Наценка к тарифу</span><span class="dm-money"><input class="input num" type="number" min="0" step="10" data-d="markup" value="' + (Number(d.markup) || 0) + '"><i>₽</i></span><small>Например, на упаковку. Итог округляется до 10 ₽</small></label></div>' +
        '<p class="dm-preview">Покупатель увидит: <b>' + esc(d.name || 'Без названия') + '</b>' + (d.desc ? ' · ' + esc(d.desc) : '') + ' — <span>' + esc(deliverySummary(d)) + '</span></p>' +
      '</div>' +
      '<div class="dm-tools"><button type="button" data-dm="up" aria-label="Поднять выше" title="Выше">↑</button><button type="button" data-dm="down" aria-label="Опустить ниже" title="Ниже">↓</button><button type="button" data-dm="rm" aria-label="Удалить способ доставки" title="Удалить">✕</button></div>' +
    '</div>';
  }
  function readDelivery(box) {
    return $$('.dm', box).map(function (el) {
      var v = function (k) { return $('[data-d="' + k + '"]', el); };
      return { id: el.getAttribute('data-id'), name: v('name').value.trim(), desc: v('desc').value.trim(), price: Math.max(0, Number(v('price').value) || 0), freeFrom: Math.max(0, Number(v('freeFrom').value) || 0), needsAddress: v('needsAddress').checked, pickupPoint: v('needsAddress').checked && v('cdekMode').value === 'pvz', cdekDoor: v('needsAddress').checked && v('cdekMode').value === 'door',
        priceAuto: v('needsAddress').checked && !!v('cdekMode').value && v('priceAuto').checked, markup: Math.max(0, Number(v('markup').value) || 0) };
    });
  }
  /* ---------- СДЭК: откуда отправляем, упаковка, тариф, услуги ---------- */
  var CDEK_TARIFFS = [[136, 'Посылка склад–склад'], [234, 'Экономичная посылка склад–склад']];
  var CDEK_DOOR = [[137, 'Посылка склад–дверь'], [233, 'Экономичная посылка склад–дверь']];
  function packRow(x) {
    var n = function (k, v, w) { return '<label><input class="input num" data-pk="' + k + '" type="number" min="0" value="' + (Number(v) || 0) + '"><i>' + w + '</i></label>'; };
    return '<div class="cs-pack" data-id="' + esc(x.id) + '"><input class="input" data-pk="name" value="' + esc(x.name) + '" placeholder="Название" aria-label="Название упаковки">' +
      '<div class="cs-pkg">' + n('length', x.length, 'см') + '<span>×</span>' + n('width', x.width, 'см') + '<span>×</span>' + n('height', x.height, 'см') + n('weight', x.weight, 'г') + '</div>' +
      '<button type="button" class="link" data-pk-rm aria-label="Удалить упаковку">✕</button></div>';
  }
  function cdekShipHtml(c) {
    var pk = Object.assign({ weight: 1000, length: 30, width: 25, height: 10 }, c.pkg), sv = c.services || {}, sp = c.shipmentPoint;
    return '<div class="pm-card pm-wide cs-card" id="cdekShip"><div class="pm-top pm-top-flat"><div><b>Отправка заказов в СДЭК</b><span>В заказе появится кнопка «Создать отправление в СДЭК»: заявка, трек-номер покупателю и наклейка на посылку — без личного кабинета СДЭК</span></div></div>' +
      '<div class="pm-f"><span>Пункт СДЭК, куда вы сдаёте посылки</span>' +
        '<div id="csPointNow" class="cs-now"' + (sp ? '' : ' hidden') + '><span class="pvz-pin" aria-hidden="true"></span><div><b id="csPointAddr">' + esc(sp ? sp.address : '') + '</b><small id="csPointCity">' + esc(sp ? sp.city + ' · код ' + sp.code : '') + '</small></div><button type="button" class="link" id="csPointChange">Изменить</button></div>' +
        '<div id="csPointPick" class="cs-pick"' + (sp ? ' hidden' : '') + '><div class="pvz-combo"><input class="input" id="csCity" placeholder="Ваш город, например «Москва»" autocomplete="off"><ul class="pvz-sug" id="csSug" hidden></ul></div><select class="select" id="csPoints" hidden></select></div></div>' +
      '<div class="pm-two">' +
        '<label class="pm-f"><span>Тариф</span><select class="select" id="csTariff">' + CDEK_TARIFFS.map(function (t) { return '<option value="' + t[0] + '"' + (Number(c.tariff || 136) === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select><small>В постаматы — тариф «склад–постамат», подставится сам</small></label>' +
        '<label class="pm-f"><span>Тариф для курьера</span><select class="select" id="csTariffDoor">' + CDEK_DOOR.map(function (t) { return '<option value="' + t[0] + '"' + (Number(c.tariffDoor || 137) === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select><small>Вы сдаёте посылку в пункт, курьер везёт до двери</small></label>' +
      '</div>' +
      '<div class="pm-f"><span>Упаковки</span><small>Размер и вес самой упаковки. В карточке товара выбираете, в какую упаковку он кладётся; посылка берётся по самой крупной вещи, а от 3 вещей — на размер больше</small>' +
        '<div class="cs-packs" id="csPacks">' + Pricing.cdekPacks(c).map(packRow).join('') + '</div><button type="button" class="link" id="csPackAdd" style="justify-self:start;font-size:13px">+ Добавить упаковку</button></div>' +
      '<div class="pm-two">' +
        '<label class="pm-f"><span>Вес вещи, если в карточке не указан</span><span class="dm-money"><input class="input num" id="csW" type="number" min="50" step="50" value="' + pk.weight + '"><i>г</i></span></label>' +
        '<label class="pm-f"><span>Упаковка, если в карточке не выбрана</span><select class="select" id="csDefPack">' + Pricing.cdekPacks(c).map(function (x) { return '<option value="' + esc(x.id) + '"' + (c.defaultPack === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
      '</div>' +
      '<div class="pm-two">' +
        '<label class="pm-f"><span>Возвраты получает (имя или ИП)</span><input class="input" id="csRetName" value="' + esc((c.returnTo && c.returnTo.name) || '') + '" placeholder="ИП Албаков Ибрагим Магомедович"></label>' +
        '<label class="pm-f"><span>Телефон для возвратов</span><input class="input" id="csRetPhone" type="tel" value="' + esc(c.returnTo && c.returnTo.phone ? A().fmtPhone(c.returnTo.phone) : '') + '" placeholder="+7 (___) ___-__-__"><small>СДЭК позвонит, когда возврат придёт в ваш пункт</small></label>' +
      '</div>' +
      '<div class="cs-sv"><span class="cs-sv-h">Услуги для покупателя (включите, если они есть в вашем договоре со СДЭК)</span>' +
        '<label class="check"><input type="checkbox" id="csPart"' + (sv.partDeliv ? ' checked' : '') + '> <span><b>Частичный выкуп</b> — покупатель забирает только то, что подошло, остальное СДЭК везёт вам обратно</span></label>' +
        '<label class="check"><input type="checkbox" id="csTry"' + (sv.tryOn ? ' checked' : '') + '> <span><b>Примерка</b> — покупатель может примерить вещи при получении</span></label></div>' +
      '<div class="pm-key-row"><button type="button" class="btn ghost" id="csSave">Сохранить настройки отправки</button><small id="csState"></small></div></div>';
  }
  function bindCdekShip(s) {
    var box = $('#cdekShip'); if (!box) return;
    var pick = (s.cdek && s.cdek.shipmentPoint) || null, pts = [], timer = 0;
    $('#csPointChange').addEventListener('click', function () { $('#csPointNow').hidden = true; $('#csPointPick').hidden = false; $('#csCity').focus(); });
    $('#csCity').addEventListener('input', function () {
      var v = this.value.trim(); clearTimeout(timer); if (v.length < 2) { $('#csSug').hidden = true; return; }
      timer = setTimeout(async function () {
        try { var list = await A().API.cdekCities(v); $('#csSug').innerHTML = list.map(function (c, i) { return '<li data-i="' + i + '"><b>' + esc(c.city) + '</b><span>' + esc(c.region || '') + '</span></li>'; }).join('') || '<li class="none">Не нашли</li>'; $('#csSug').hidden = false; $('#csSug')._list = list; }
        catch (e) { $('#csSug').innerHTML = '<li class="none">' + esc(A().errMsg(e)) + '</li>'; $('#csSug').hidden = false; }
      }, 250);
    });
    $('#csSug').addEventListener('mousedown', async function (e) {
      var li = e.target.closest('[data-i]'); if (!li) return; e.preventDefault();
      var c = this._list[Number(li.dataset.i)]; $('#csCity').value = c.city + (c.region ? ', ' + c.region : ''); this.hidden = true;
      var sel = $('#csPoints'); sel.hidden = false; sel.innerHTML = '<option>Загружаем пункты…</option>';
      try { pts = (await A().API.cdekPoints(c.code)).filter(function (p) { return p.type === 'pvz'; }); sel.innerHTML = '<option value="">Выберите пункт</option>' + pts.map(function (p, i) { return '<option value="' + i + '">' + esc(p.address + (p.hours ? ' — ' + p.hours : '')) + '</option>'; }).join(''); }
      catch (ex) { sel.innerHTML = '<option>' + esc(A().errMsg(ex)) + '</option>'; }
    });
    $('#csPoints').addEventListener('change', function () {
      var p = pts[Number(this.value)]; if (!p) return;
      pick = { code: p.code, address: p.address, city: p.city + (p.region && p.region !== p.city ? ', ' + p.region : ''), cityCode: p.cityCode };
      $('#csPointAddr').textContent = pick.address; $('#csPointCity').textContent = pick.city + ' · код ' + pick.code; $('#csPointNow').hidden = false; $('#csPointPick').hidden = true;
    });
    $('#csPackAdd').addEventListener('click', function () { $('#csPacks').insertAdjacentHTML('beforeend', packRow({ id: 'pk' + Date.now().toString(36), name: '', length: 30, width: 20, height: 10, weight: 50 })); });
    $('#csPacks').addEventListener('click', function (e) { var b = e.target.closest('[data-pk-rm]'); if (b) b.closest('.cs-pack').remove(); });
    $('#csSave').addEventListener('click', async function () {
      var el = $('#csState');
      try {
        var packs = $$('.cs-pack', box).map(function (r) { var v = function (k) { return $('[data-pk="' + k + '"]', r).value; }; return { id: r.dataset.id, name: v('name').trim() || 'Упаковка', length: v('length'), width: v('width'), height: v('height'), weight: v('weight') }; });
        if (!packs.length) { el.textContent = 'Нужна хотя бы одна упаковка'; el.className = 'warn'; return; }
        var r = await A().API.adminCdek({ check: false, shipmentPoint: pick, tariff: Number($('#csTariff').value), tariffDoor: Number($('#csTariffDoor').value), packs: packs, defaultPack: $('#csDefPack').value, pkg: { weight: $('#csW').value, length: 30, width: 25, height: 10 }, services: { partDeliv: $('#csPart').checked, tryOn: $('#csTry').checked }, returnTo: { name: $('#csRetName').value, phone: $('#csRetPhone').value } });
        DATA.settings.cdek = r.settings.cdek; s.cdek = r.settings.cdek;
        el.textContent = pick ? 'Сохранено' : 'Сохранено. Укажите пункт отгрузки — без него отправление не создать'; el.className = pick ? 'ok' : 'warn';
      } catch (e) { el.textContent = A().errMsg(e); el.className = 'warn'; }
    });
  }
  function paymentSettings(m) {
    var s = clone(DATA.settings), p = s.payment || {}, yk = p.yookassa || {}, ready = A().D.payReady;
    var opt = function (list, cur) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (String(cur) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
    m.innerHTML = head('Оплата и доставка', '', 'Как покупатель платит и как получает заказ. Всё, что меняете здесь, сразу видно при оформлении заказа.') +
      '<div class="pm">' +

      // ---- Способы оплаты
      '<section class="pm-sec"><div class="pm-sec-h"><h2>Способы оплаты</h2><p>Включите хотя бы один. Название — то, что покупатель увидит при оформлении.</p></div>' +
      '<div class="pm-grid">' +
        '<div class="pm-card' + (p.online ? ' on' : '') + '" id="pmOnline"><div class="pm-top"><span class="pm-ic">' + PAY_IC.card + '</span><div><b>Онлайн</b><span>Картой, СБП, SberPay, T-Pay через ЮKassa</span></div>' + switchHtml('f-online', p.online, 'Онлайн-оплата') + '</div>' +
          '<label class="pm-f"><span>Название на сайте</span><input class="input" id="f-onlineLabel" value="' + esc(p.onlineLabel || '') + '" placeholder="Картой или СБП онлайн"></label>' +
          '<div class="pm-state ' + (ready ? 'ok' : 'warn') + '"><i aria-hidden="true"></i>' + (ready ? 'ЮKassa подключена — оплата работает' : 'Не работает, пока не подключена ЮKassa (ниже)') + '</div></div>' +
        '<div class="pm-card' + (p.cod ? ' on' : '') + '" id="pmCod"><div class="pm-top"><span class="pm-ic">' + PAY_IC.cash + '</span><div><b>При получении</b><span>Наличными или картой в пункте выдачи СДЭК</span></div>' + switchHtml('f-cod', p.cod, 'Оплата при получении') + '</div>' +
          '<label class="pm-f"><span>Название на сайте</span><input class="input" id="f-codLabel" value="' + esc(p.codLabel || '') + '" placeholder="При получении"></label>' +
          '<div class="pm-state"><i aria-hidden="true"></i>' + (A().D.cdekReady ? 'Покупатель видит только пункты СДЭК, где принимают оплату. СДЭК возьмёт сумму заказа и доставки и переведёт вам за вычетом комиссии; после вручения заказ отметится оплаченным' : 'Заказ приходит неоплаченным, оплату отмечаете в заказе') + '</div></div>' +
      '</div></section>' +

      // ---- ЮKassa
      '<section class="pm-sec"><div class="pm-sec-h"><h2>ЮKassa</h2><p>Приём онлайн-платежей. Данные — в личном кабинете ЮKassa: «Интеграция» → «Ключи API».</p></div>' +
      '<div class="pm-card pm-wide">' +
        '<div class="pm-seg" role="radiogroup" aria-label="Режим оплаты">' +
          '<label><input type="radio" name="f-provider" value="yookassa"' + (p.provider === 'yookassa' ? ' checked' : '') + '><span><b>ЮKassa</b><small>Настоящие платежи</small></span></label>' +
          '<label><input type="radio" name="f-provider" value="demo"' + (p.provider !== 'yookassa' ? ' checked' : '') + '><span><b>Выключено</b><small>Онлайн-оплата скрыта</small></span></label>' +
        '</div>' +
        '<div class="pm-two">' +
          '<label class="pm-f"><span>shopId магазина</span><input class="input num" id="f-shopId" value="' + esc(yk.shopId || '') + '" placeholder="Например, 1504706" inputmode="numeric"></label>' +
          '<div class="pm-f"><span>Секретный ключ</span><div class="pm-key"><input class="input" id="secKey" type="password" placeholder="Вставьте live_… или test_…" autocomplete="off" aria-label="Секретный ключ"><button type="button" class="btn ghost" id="secSave">Сохранить ключ</button></div><small id="secState">Проверяем…</small></div>' +
        '</div>' +
      '</div></section>' +

      // ---- Чеки
      '<section class="pm-sec"><div class="pm-sec-h"><h2>Чеки по 54-ФЗ</h2><p>ЮKassa отправит чек в налоговую и покупателю на почту. Нужна «Чеки от ЮKassa» или своя онлайн-касса.</p></div>' +
      '<div class="pm-card pm-wide">' +
        '<div class="pm-top pm-top-flat"><div><b>Передавать данные для чека</b><span>Состав заказа и доставка уходят в чек отдельными строками</span></div>' + switchHtml('f-sendReceipt', yk.sendReceipt, 'Передавать данные для чека') + '</div>' +
        '<div class="pm-two">' +
          '<label class="pm-f"><span>Система налогообложения</span><select class="select" id="f-taxSystem">' + opt(TAX, yk.taxSystem) + '</select></label>' +
          '<label class="pm-f"><span>Ставка НДС в чеке</span><select class="select" id="f-vatCode">' + opt(VAT, yk.vatCode) + '</select><small>На УСН и патенте обычно «Без НДС»</small></label>' +
        '</div>' +
      '</div></section>' +

      // ---- Доставка
      '<section class="pm-sec"><div class="pm-sec-h"><h2>Способы доставки</h2><p>Порядок здесь = порядок при оформлении. Первый способ выбран у покупателя по умолчанию.</p></div>' +
      '<div class="dm-list" id="dmList">' + ((s.delivery && s.delivery.methods) || []).map(deliveryCard).join('') + '</div>' +
      '<div class="dm-add"><button type="button" class="btn ghost" data-dm-add="courier">+ Доставка с адресом</button><button type="button" class="btn ghost" data-dm-add="door">+ Курьер СДЭК</button><button type="button" class="btn ghost" data-dm-add="pickup">+ Самовывоз</button></div>' +
      '</section>' +

      // ---- СДЭК
      '<section class="pm-sec"><div class="pm-sec-h"><h2>СДЭК: выбор пункта выдачи</h2><p>Покупатель начинает вводить город — сайт подсказывает населённые пункты с областью (Мурино — Ленинградская обл.) и показывает только пункты СДЭК в выбранном месте. Ключи — в личном кабинете СДЭК: «Интеграция» → «Ключи API» (нужен договор со СДЭК).</p></div>' +
      '<div class="pm-card pm-wide">' +
        '<div class="pm-two">' +
          '<label class="pm-f"><span>Account (идентификатор)</span><input class="input" id="cdekId" value="' + esc((s.cdek && s.cdek.clientId) || '') + '" autocomplete="off" spellcheck="false"></label>' +
          '<label class="pm-f"><span>Secure password (секретный ключ)</span><input class="input" id="cdekSecret" type="password" autocomplete="off" placeholder="Вставьте ключ"></label>' +
        '</div>' +
        '<label class="check"><input type="checkbox" id="cdekTest"' + (s.cdek && s.cdek.test ? ' checked' : '') + '> <span>Тестовая среда СДЭК (только для проверки, данные учебные)</span></label>' +
        '<div class="pm-key-row"><button type="button" class="btn ghost" id="cdekSave">Сохранить и проверить</button><small id="cdekState" class="' + (A().D.cdekReady ? 'ok' : 'warn') + '">' + (A().D.cdekReady ? 'Ключи сохранены — подбор пунктов работает' : 'Не подключено — покупатели вводят адрес пункта вручную') + '</small></div>' +
      '</div>' +
      cdekShipHtml(s.cdek || {}) +
      '</section>' +

      '</div><div class="adm-bar"><button class="btn" id="stSave">Сохранить</button><span class="form-error" id="stErr"></span></div>';

    // переключатели способов оплаты подсвечивают карточку
    [['f-online', 'pmOnline'], ['f-cod', 'pmCod']].forEach(function (x) { $('#' + x[0]).addEventListener('change', function () { $('#' + x[1]).classList.toggle('on', this.checked); }); });

    // доставка: живое превью, порядок, удаление, добавление
    var list = $('#dmList');
    var refresh = function (el) {
      var d = readDelivery(el.parentNode).find(function (x) { return x.id === el.getAttribute('data-id'); });
      $('.dm-preview', el).innerHTML = 'Покупатель увидит: <b>' + esc(d.name || 'Без названия') + '</b>' + (d.desc ? ' · ' + esc(d.desc) : '') + ' — <span>' + esc(deliverySummary(d)) + '</span>';
      $('.dm-addr b', el).textContent = d.needsAddress ? 'Спросить город и адрес' : 'Не нужен — самовывоз';
      $('.dm-ic', el).innerHTML = d.needsAddress ? PAY_IC.truck : PAY_IC.pin;
      $('.dm-pvz', el).hidden = !d.needsAddress;
      $('.dm-auto', el).hidden = !d.needsAddress || !(d.pickupPoint || d.cdekDoor);
    };
    list.addEventListener('input', function (e) { var el = e.target.closest('.dm'); if (el) refresh(el); });
    list.addEventListener('change', function (e) { var el = e.target.closest('.dm'); if (el) refresh(el); });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dm]'); if (!b) return;
      var el = b.closest('.dm'), act = b.getAttribute('data-dm');
      if (act === 'up' && el.previousElementSibling) list.insertBefore(el, el.previousElementSibling);
      if (act === 'down' && el.nextElementSibling) list.insertBefore(el.nextElementSibling, el);
      if (act === 'rm') { if (b.classList.contains('armed')) el.remove(); else { b.classList.add('armed'); b.textContent = 'Удалить?'; setTimeout(function () { if (document.body.contains(b)) { b.classList.remove('armed'); b.textContent = '✕'; } }, 3000); } }
    });
    $$('[data-dm-add]', m).forEach(function (b) { b.addEventListener('click', function () {
      var kind = b.getAttribute('data-dm-add');
      var pick = kind === 'pickup' ? { name: 'Самовывоз', desc: '', price: 0, freeFrom: 0, needsAddress: false }
        : kind === 'door' ? { name: 'Курьером СДЭК', desc: 'До двери по всей России', price: 600, freeFrom: 0, needsAddress: true, cdekDoor: true, pickupPoint: false, priceAuto: true, markup: 0 }
        : { name: '', desc: '', price: 0, freeFrom: 0, needsAddress: true, pickupPoint: false };
      pick.id = uid('d'); list.insertAdjacentHTML('beforeend', deliveryCard(pick)); $('input', list.lastElementChild).focus();
    }); });

    // секретный ключ хранится только на сервере
    var showState = function (r) {
      var el = $('#secState'); if (!el) return;
      el.textContent = !r.hasSecret ? 'Ключ не задан — онлайн-оплата не работает' : /^test_/.test(r.mask) ? 'Сохранён тестовый ключ (' + r.mask + ') — деньги не списываются' : 'Сохранён боевой ключ (' + r.mask + ')';
      el.className = !r.hasSecret || /^test_/.test(r.mask) ? 'warn' : 'ok';
    };
    A().API.adminSecret().then(showState).catch(function () {});
    $('#secSave').addEventListener('click', async function () { try { showState(await A().API.adminSecret($('#secKey').value.trim())); $('#secKey').value = ''; toast('Ключ сохранён'); } catch (e) { toast(A().errMsg(e), true); } });

    // ключи СДЭК: секретный хранится только на сервере, сразу проверяем, что СДЭК их принимает
    $('#cdekSave').addEventListener('click', async function () {
      var b = this, el = $('#cdekState'); b.disabled = true; el.textContent = 'Проверяем ключи в СДЭК…'; el.className = '';
      try {
        var r = await A().API.adminCdek({ clientId: $('#cdekId').value, secret: $('#cdekSecret').value, test: $('#cdekTest').checked });
        DATA.settings.cdek = r.settings.cdek; s.cdek = r.settings.cdek; $('#cdekSecret').value = '';
        el.textContent = r.checked ? 'Подключено' + (r.settings.cdek.test ? ' (тестовая среда)' : '') + ' — покупатели выбирают пункт из списка' : r.error || (!r.hasSecret ? 'Введите Secure password' : 'Не удалось проверить ключи');
        el.className = r.checked ? 'ok' : 'warn';
        A().D.cdekReady = !!(r.settings.cdek.clientId && r.hasSecret);
      } catch (e) { el.textContent = A().errMsg(e); el.className = 'warn'; }
      b.disabled = false;
    });

    bindCdekShip(s);

    $('#stSave').addEventListener('click', async function () {
      var err = $('#stErr'); err.textContent = '';
      var online = $('#f-online').checked, cod = $('#f-cod').checked;
      if (!online && !cod) { err.textContent = 'Включите хотя бы один способ оплаты'; return; }
      var methods = readDelivery(list);
      if (!methods.length) { err.textContent = 'Добавьте хотя бы один способ доставки'; return; }
      if (methods.some(function (x) { return !x.name; })) { err.textContent = 'У каждого способа доставки должно быть название'; return; }
      var prov = ($('input[name="f-provider"]:checked', m) || {}).value || 'demo';
      s.payment = { provider: prov, online: online, cod: cod, onlineLabel: $('#f-onlineLabel').value.trim() || 'Картой или СБП онлайн', codLabel: $('#f-codLabel').value.trim() || 'При получении',
        yookassa: { shopId: $('#f-shopId').value.trim(), sendReceipt: $('#f-sendReceipt').checked, taxSystem: Number($('#f-taxSystem').value), vatCode: Number($('#f-vatCode').value) } };
      s.delivery = Object.assign({}, s.delivery, { methods: methods });
      try { await A().API.adminSave('settings', s); await afterSave('Сохранено', '#/admin?s=payment'); } catch (ex) { err.textContent = A().errMsg(ex); }
    });
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
      { k: 'legal', label: 'Реквизиты продавца', wide: true, hint: 'Например: ИП Фамилия Имя Отчество, ИНН 000000000000, ОГРНИП 000000000000000. Показываются в подвале, в колонке «Контакты», и подставляются в оферту, политику обработки персональных данных и согласие' },
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
    card.innerHTML = '<h4 class="adm-sub" style="margin-top:0;padding-top:0;border-top:0">Вход в панель</h4><p class="muted" style="font-size:14px">Отдельного пароля нет: панель открывается из личного кабинета аккаунтом владельца или сотрудника. Сотрудников и их роли — в разделе <a class="link" href="#/admin?s=staff">«Сотрудники»</a>.</p>' +
      '<h4 class="adm-sub">Нумерация заказов</h4><p class="muted" style="font-size:14px">Номер, который получит следующий заказ. Дальше номера идут по порядку: 1, 2, 3… Уже занятые номера пропускаются.</p><div class="promo-form"><input class="input num" type="number" min="1" step="1" id="orderSeq" placeholder="…" aria-label="Номер следующего заказа"><button type="button" class="btn ghost" id="orderSeqSave">Сохранить</button></div>' +
      backupStatusHtml(DATA.backup) +
      updateStatusHtml(DATA.update) +
      '<h4 class="adm-sub">Состояние магазина</h4><div id="healthBox"><p class="muted" style="font-size:14px">Проверяю…</p></div>' +
      '<h4 class="adm-sub">Резервная копия</h4><p class="muted" style="font-size:14px">Скопируйте данные магазина, чтобы сохранить их или перенести на сервер.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ghost sm" id="bkShow">Показать данные</button>' + '</div><div id="bkBox"></div>';
    m.insertBefore(card, $('.adm-bar', m));
    A().API.adminOrderSeq().then(function (n) { var el = $('#orderSeq'); if (el) el.value = n; }).catch(function () {});
    $('#orderSeqSave').addEventListener('click', async function () {
      try { var n = await A().API.adminOrderSeq(Number($('#orderSeq').value)); $('#orderSeq').value = n; toast('Следующий заказ получит № ' + n); } catch (ex) { toast(A().errMsg(ex), true); }
    });
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
        var pills = [];
        if (x.gender) pills.push('Только «' + ({ women: 'Женщинам', men: 'Мужчинам', kids: 'Детям' }[x.gender] || x.gender) + '»');
        var aud = x.audience || (/tab=register/.test(((x.btn1 && x.btn1.link) || '') + ' ' + ((x.btn2 && x.btn2.link) || '')) ? 'guest' : '');
        if (aud === 'guest') pills.push(x.audience ? 'Только гостям' : 'Новым покупателям'); else if (aud === 'user') pills.push('Только вошедшим');
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
      { k: 'audience', label: 'Кому показывать', type: 'select', options: [['', 'Сам решит: со ссылкой на регистрацию — новым покупателям, пока не воспользовались скидкой'], ['all', 'Всем'], ['guest', 'Только тем, кто не вошёл'], ['user', 'Только вошедшим в личный кабинет']] },
      { k: 'gender', label: 'Для какого раздела', type: 'select', options: [['', 'Всем покупателям'], ['women', 'Только «Женщинам»'], ['men', 'Только «Мужчинам»'], ['kids', 'Только «Детям»']] },
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
      return Object.assign({}, sl, { active: f.active, layout: sl.layout || 'split', audience: f.audience || '', gender: f.gender, eyebrow: f.eyebrow, title: f.title, text: f.text, badge: f.badge, image: f.image, promotionId: f.promotionId, code: f.code, startsAt: f.startsAt, endsAt: f.endsAt, btn1: { label: f.b1l, link: f.b1h }, btn2: { label: f.b2l, link: f.b2h } });
    }
    function preview() {
      var stage = $('#slpvStage', m), wrap = $('#slpv', m), w = mode === 'desk' ? 1280 : 390;
      stage.style.width = w + 'px';
      stage.className = 'slpv-stage ' + mode;
      stage.innerHTML = '<section class="slider sl-g" style="--dur:7s"><div class="slg-card"><div class="slg-track">' + A().slideHtml(current(), 0, 1, true) + '</div></div></section>';
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
        '<label class="check"><input type="checkbox" id="lgTrademark"' + (b.trademark !== false ? ' checked' : '') + '> <span>Знак ® рядом с логотипом и пометка «зарегистрированный товарный знак» в подвале</span></label>' +
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
      b.trademark = $('#lgTrademark', m).checked;
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
      if (e.target.matches('#f-desktop,#f-mobile,#lgTrademark')) { draw(); return; }
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

  /* ================= Поддержка (13.64.3): все обращения с поиском, переписка, карточка покупателя ================= */
  var SUP_STATE = { open: 'Ждёт ответа', answered: 'Отвечено', closed: 'Решено' };
  var SUP_F = [['active', 'В работе'], ['open', 'Ждут ответа'], ['closed', 'Решённые'], ['all', 'Все']];
  function supTime(iso) {
    var d = new Date(iso), t = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? t : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + t;
  }
  function supAgo(a, b) { var m = Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 60000)); return m < 60 ? m + ' мин' : m < 1440 ? Math.round(m / 60) + ' ч' : Math.round(m / 1440) + ' дн'; }
  var supPoll = null, supQ = '', supTopic = '';
  // Поиск: номер обращения, имя, телефон, почта, номер заказа и текст переписки
  function supMatch(t, q) {
    if (!q) return true;
    var d = q.replace(/\D/g, ''), hay = [t.number, t.name, t.email, t.orderNumber, t.topic].concat(t.messages.map(function (x) { return x.text; })).join(' ').toLowerCase();
    return hay.indexOf(q.toLowerCase().replace(/^№\s*/, '')) >= 0 || (d.length >= 4 && String(t.phone || '').replace(/\D/g, '').indexOf(d) >= 0);
  }
  async function supportSection(m, q) {
    clearInterval(supPoll);
    m.innerHTML = head('Поддержка', '', 'Все обращения покупателей хранятся здесь: решённые — в архиве, их находит поиск. Ответ сразу появится у покупателя в кабинете и приложении, придёт письмом и уведомлением.') + '<div class="loader" style="min-height:200px">…</div>';
    var r;
    try { r = await A().API.adminSupport(); } catch (e) { m.lastElementChild.outerHTML = '<p class="form-error">' + esc(A().errMsg(e)) + '</p>'; return; }
    if (!document.body.contains(m)) return;
    var list = r.tickets, templates = r.templates || [], f = q.f || 'active';
    var inF = function (t, k) { return k === 'all' ? true : k === 'closed' ? t.status === 'closed' : k === 'open' ? t.status === 'open' : t.status !== 'closed'; };
    var topics = []; list.forEach(function (t) { if (topics.indexOf(t.topic) < 0) topics.push(t.topic); });
    var cur = q.id ? list.find(function (t) { return t.id === q.id; }) : null;
    var items = function () {
      var shown = list.filter(function (t) { return (supQ ? true : inF(t, f)) && (!supTopic || t.topic === supTopic) && supMatch(t, supQ.trim()); });
      if (!shown.length) return '<p class="as-empty">' + (supQ ? 'Ничего не нашлось. Ищем по номеру обращения, имени, телефону, почте, номеру заказа и тексту.' : f === 'closed' ? 'Решённых обращений пока нет.' : 'Новых вопросов нет. Когда покупатель напишет, обращение появится здесь.') + '</p>';
      return shown.map(function (t) {
        var last = t.messages.filter(function (x) { return x.from !== 'note'; }).slice(-1)[0] || t.messages[0];
        var txt = last.text ? esc(last.text.slice(0, 90)) : (last.files || []).length ? 'Фото' : '';
        return '<a class="as-item' + (cur && cur.id === t.id ? ' on' : '') + (t.unreadShop ? ' unread' : '') + '" href="#/admin?s=support&f=' + f + '&id=' + esc(t.id) + '">' +
          '<span class="as-top"><span class="sup-num' + (t.status !== 'closed' ? ' on' : '') + '">№ ' + esc(t.number) + '</span><b>' + esc(t.name || 'Покупатель') + '</b>' + (t.unreadShop ? '<i class="sc-dot" aria-label="Не прочитано"></i>' : '') + '<time>' + esc(supTime(t.updatedAt)) + '</time></span>' +
          '<span class="as-sub">' + esc(t.topic) + (t.orderNumber ? ' · заказ № ' + esc(t.orderNumber) : '') + (t.assignee ? ' · ' + esc(t.assignee.name) : '') + '</span>' +
          '<span class="as-text">' + (last.from === 'shop' ? 'Вы: ' : '') + txt + '</span>' +
          '<span class="sup-st s-' + t.status + '">' + SUP_STATE[t.status] + '</span></a>';
      }).join('');
    };
    var chips = SUP_F.map(function (x) {
      return '<a class="adm-chip' + (f === x[0] && !supQ ? ' on' : '') + '" href="#/admin?s=support&f=' + x[0] + '">' + x[1] + ' <span>' + list.filter(function (t) { return inF(t, x[0]); }).length + '</span></a>';
    }).join('');
    var pane = cur ? '<section class="as-pane"><div class="loader" style="min-height:300px">…</div></section>'
      : '<section class="as-pane as-pick"><span class="sp-ic"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M5 5h14v11H10l-5 4z"/></svg></span><h3>' + (list.length ? 'Выберите обращение' : 'Обращений пока нет') + '</h3><p>Покупатели пишут из личного кабинета на сайте, из приложения и со страницы заказа.</p></section>';
    m.lastElementChild.outerHTML = '<div class="as' + (cur ? ' as-focus' : '') + '">' +
      '<div class="as-tools"><label class="as-search"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>' +
        '<input type="search" id="asQ" value="' + esc(supQ) + '" placeholder="№ обращения, имя, телефон, почта, заказ или текст" aria-label="Поиск обращений"></label>' +
        '<select class="select as-topic" id="asTopic" aria-label="Тема"><option value="">Все темы</option>' + topics.map(function (x) { return '<option' + (x === supTopic ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>' +
      '<div class="adm-chips">' + chips + '</div>' +
      '<div class="as-grid' + (cur ? ' has-pane' : '') + '"><aside class="as-list" id="asList">' + items() + '</aside>' + pane + '</div></div>';
    var qi = $('#asQ', m);
    qi.addEventListener('input', function () { supQ = qi.value; $('#asList', m).innerHTML = items(); $$('.adm-chip', m).forEach(function (c) { c.classList.toggle('on', !supQ && c.getAttribute('href').indexOf('f=' + f) > 0); }); });
    $('#asTopic', m).addEventListener('change', function (e) { supTopic = e.target.value; $('#asList', m).innerHTML = items(); });
    if (cur) supThread(m, q, cur.id, templates);
  }
  function supNote(x) { return '<div class="msg from-note"><div class="msg-col"><div class="msg-b"><span class="msg-who">Заметка · ' + esc(x.by || 'сотрудник') + '</span><p>' + esc(x.text) + '</p></div><time>' + esc(supTime(x.at)) + '</time></div></div>'; }
  function supMsgs(t) {
    var base = 'api/admin/support/file/', day = '';
    var imgs = function (fs) { return fs && fs.length ? '<span class="sup-ph n' + Math.min(fs.length, 3) + '">' + fs.map(function (f) { var u = base + encodeURIComponent(f); return '<a href="' + u + '" target="_blank" rel="noopener"><img src="' + u + '" alt="Фото" loading="lazy"></a>'; }).join('') + '</span>' : ''; };
    return t.messages.map(function (x) {
      var d = A().msgDay(x.at), sep = d !== day ? '<span class="msg-day">' + esc(d) + '</span>' : ''; day = d;
      if (x.from === 'note') return sep + supNote(x);
      var shop = x.from === 'shop', read = shop && t.userReadAt && t.userReadAt >= x.at;
      return sep + '<div class="msg ' + (shop ? 'from-me' : 'from-shop') + '">' + (!shop ? '<span class="msg-ava" aria-hidden="true">' + esc((t.name || 'П').charAt(0).toUpperCase()) + '</span>' : '') + '<div class="msg-col">' +
        (x.text ? '<div class="msg-b">' + (!shop ? '<span class="msg-who">' + esc(t.name || 'Покупатель') + '</span>' : '') + '<p>' + esc(x.text) + '</p></div>' : '') + imgs(x.files) +
        '<time>' + (shop && x.by ? esc(x.by) + ' · ' : '') + esc(supTime(x.at)) + (shop ? (read ? ' · прочитано' : ' · отправлено') : '') + '</time></div></div>';
    }).join('');
  }
  async function supThread(m, q, id, templates) {
    var pane = $('.as-pane', m), r;
    try { r = await A().API.adminSupportGet(id); } catch (e) { pane.innerHTML = '<p class="form-error">' + esc(A().errMsg(e)) + '</p>'; return; }
    if (!document.body.contains(pane)) return;
    var t = r.ticket, c = r.customer, me = (A().API.user || {}).id, closed = t.status === 'closed';
    var STATUS = A().STATUS, fmt = A().fmt;
    var tpl = function () { return templates.map(function (x, i) { return '<button type="button" class="as-tpl" data-tpl="' + i + '" title="' + esc(x.text) + '">' + esc(x.title) + '</button>'; }).join('') + '<button type="button" class="as-tpl as-tpl-edit" id="asTplEdit">Шаблоны…</button>'; };
    pane.innerHTML = '<div class="as-thread">' +
        '<header class="as-head"><a class="st-back as-back" href="#/admin?s=support&f=' + esc(q.f || 'active') + '" aria-label="Все обращения"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></a>' +
          '<div><b>№ ' + esc(t.number) + ' · ' + esc(t.topic) + '</b><span>Создано ' + esc(supTime(t.createdAt)) + (t.firstReplyAt ? ' · ответили за ' + supAgo(t.createdAt, t.firstReplyAt) : ' · ждёт ответа ' + supAgo(t.createdAt, new Date().toISOString())) + (t.closedAt ? ' · решено ' + (t.closedBy === 'user' ? 'покупателем' : 'магазином') : '') + '</span></div>' +
          '<button type="button" class="btn ghost sm" id="asAssign">' + (t.assignee ? (t.assignee.id === me ? 'Ведёте вы' : 'Ведёт ' + esc(t.assignee.name)) : 'Взять себе') + '</button>' +
          '<button type="button" class="btn sm ' + (closed ? 'ghost' : 'as-solve') + '" id="asToggle">' + (closed ? 'Открыть снова' : 'Решено') + '</button></header>' +
        (t.order ? '<a class="sup-order" href="#/admin?s=orders&id=' + esc(t.order.id) + '"><span class="so-ph">' + (t.order.image ? '<img src="' + esc(t.order.image) + '" alt="">' : '') + '</span><span class="so-t"><b>Заказ № ' + esc(t.order.number) + ' · ' + esc((STATUS[t.order.status] || '').toLowerCase()) + ' · ' + fmt(t.order.total) + '</b><small>' + esc([t.order.name, [t.order.color, t.order.size].filter(Boolean).join(', ')].filter(Boolean).join(' · ')) + '</small></span></a>' : '') +
        '<div class="st-msgs" id="asMsgs">' + supMsgs(t) + '</div>' +
        '<div class="as-send">' +
          '<div class="as-tpls" id="asTpls">' + tpl() + '</div>' +
          '<div class="sup-att" hidden></div>' +
          '<div class="sup-row"><label class="st-attach" aria-label="Прикрепить фото"><input class="sup-file" type="file" accept="image/*" multiple hidden><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 12.5l6.5-6.5a3 3 0 0 1 4.2 4.2l-8 8a5 5 0 0 1-7-7l7.5-7.5"/></svg></label>' +
          '<textarea class="st-text" id="asText" rows="2" maxlength="2000" placeholder="Ответ покупателю" aria-label="Ответ"></textarea>' +
          '<button class="btn" id="asBtn" type="button">Ответить</button></div>' +
          '<div class="as-foot"><label class="check"><input type="checkbox" id="asNote"> <span>Заметка для сотрудников — покупатель её не увидит</span></label><span>Ctrl + Enter — отправить</span></div>' +
        '</div>' +
      '</div>' +
      (c ? '<aside class="as-cust">' +
        '<div class="as-card"><span class="as-me"><span class="msg-ava">' + esc((c.name || 'П').charAt(0).toUpperCase()) + '</span><span><b>' + esc(c.name || 'Покупатель') + '</b><small>С нами с ' + esc(A().fmtDate(c.createdAt).replace(/^\d+\s/, '').replace(/ г\.$/, '')) + ' · ' + c.orders.length + ' ' + A().plural(c.orders.length, 'заказ', 'заказа', 'заказов') + '</small></span></span>' +
          (c.phone ? '<a href="tel:+' + esc(String(c.phone).replace(/\D/g, '')) + '">' + esc(A().fmtPhone(c.phone)) + '</a>' : '') + (c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '') +
          '<span>Бонусы: ' + (c.bonus || 0) + '</span></div>' +
        (c.orders.length ? '<div class="as-card"><b class="as-cap">Заказы</b>' + c.orders.map(function (o) { return '<a class="as-row" href="#/admin?s=orders&id=' + esc(o.id) + '"><span>№ ' + esc(o.number) + ' · ' + esc((STATUS[o.status] || '').toLowerCase()) + '</span><span>' + fmt(o.total) + '</span></a>'; }).join('') + '</div>' : '') +
        (c.tickets.length ? '<div class="as-card"><b class="as-cap">Другие обращения</b>' + c.tickets.map(function (x) { return '<a class="as-row" href="#/admin?s=support&f=all&id=' + esc(x.id) + '"><span>№ ' + esc(x.number) + ' · ' + esc(x.topic) + '</span><span>' + SUP_STATE[x.status].toLowerCase() + '</span></a>'; }).join('') + '</div>' : '') +
      '</aside>' : '<aside class="as-cust"><div class="as-card"><b>' + esc(t.name || 'Покупатель') + '</b><span>Аккаунт удалён</span></div></aside>');
    var box = $('#asMsgs', pane), ta = $('#asText', pane), count = t.messages.length;
    var files = (function () { // те же фото, что у покупателя: уменьшаем в браузере и загружаем сразу
      var st = [], busy = 0, att = $('.sup-att', pane), input = $('.sup-file', pane);
      var draw = function () { att.hidden = !st.length && !busy; att.innerHTML = st.map(function (f, i) { return '<span class="sup-att-i"><img src="' + f.p + '" alt=""><button type="button" data-rm="' + i + '" aria-label="Убрать фото">×</button></span>'; }).join('') + (busy ? '<span class="sup-att-i is-busy"></span>' : ''); };
      att.addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (b) { st.splice(+b.getAttribute('data-rm'), 1); draw(); } });
      input.addEventListener('change', async function () {
        var fl = Array.prototype.slice.call(input.files || []).slice(0, 5 - st.length); input.value = '';
        for (var i = 0; i < fl.length; i++) { busy++; draw(); try { var d = await A().supPhoto(fl[i]), u = await A().API.adminSupportUpload(d); st.push({ n: u.file, p: d }); } catch (e) { toast(A().errMsg(e), true); } busy--; draw(); }
      });
      return { names: function () { return st.map(function (x) { return x.n; }); }, busy: function () { return busy > 0; } };
    })();
    var bottom = function () { box.scrollTop = box.scrollHeight; $$('img', box).forEach(function (im) { if (!im.complete) im.addEventListener('load', function () { box.scrollTop = box.scrollHeight; }, { once: true }); }); };
    bottom();
    if (t.unreadShop) A().API.adminSupportPatch(t.id, { read: true }).then(function () {
      DATA.supportNew = Math.max(0, (DATA.supportNew || 1) - 1);
      var it = $('.as-item.on', m); if (it) { it.classList.remove('unread'); var dot = $('.sc-dot', it); if (dot) dot.remove(); }
      var b = $('.adm-side a[href="#/admin?s=support"] .adm-badge'); if (b) { if (DATA.supportNew) b.textContent = DATA.supportNew; else b.remove(); }
    }).catch(function () {});
    var send = async function () {
      var text = ta.value.trim(), note = $('#asNote', pane).checked, names = note ? [] : files.names();
      if (files.busy()) { toast('Фото ещё загружается', true); return; }
      if (!text && !names.length) { ta.focus(); return; }
      $('#asBtn', pane).disabled = true;
      try { var res = await A().API.adminSupportReply(t.id, text, names, note); toast(note ? 'Заметка сохранена' : res.mailed ? 'Ответ отправлен и продублирован на почту' : 'Ответ отправлен'); supportSection(m, q); return; }
      catch (e) { toast(A().errMsg(e), true); }
      $('#asBtn', pane).disabled = false;
    };
    $('#asBtn', pane).addEventListener('click', send);
    $('#asNote', pane).addEventListener('change', function (e) { ta.placeholder = e.target.checked ? 'Заметка для сотрудников' : 'Ответ покупателю'; $('#asBtn', pane).textContent = e.target.checked ? 'Сохранить заметку' : 'Ответить'; pane.querySelector('.as-send').classList.toggle('is-note', e.target.checked); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
    $('#asTpls', pane).addEventListener('click', function (e) {
      var b = e.target.closest('[data-tpl]');
      if (b) { var x = templates[+b.getAttribute('data-tpl')]; ta.value = (ta.value.trim() ? ta.value.trim() + '\n\n' : '') + x.text; ta.focus(); return; }
      if (e.target.closest('#asTplEdit')) supTplEditor(templates, function (list) { templates = list; $('#asTpls', pane).innerHTML = tpl(); });
    });
    $('#asAssign', pane).addEventListener('click', async function () {
      try { await A().API.adminSupportPatch(t.id, { assign: !(t.assignee && t.assignee.id === me) }); supportSection(m, q); } catch (e) { toast(A().errMsg(e), true); }
    });
    $('#asToggle', pane).addEventListener('click', async function () {
      try { await A().API.adminSupportPatch(t.id, { status: closed ? 'open' : 'closed' }); toast(closed ? 'Обращение открыто снова' : 'Обращение № ' + t.number + ' решено'); supportSection(m, q); } catch (e) { toast(A().errMsg(e), true); }
    });
    supPoll = setInterval(async function () {
      if (!document.body.contains(box)) { clearInterval(supPoll); return; }
      if (document.hidden) return;
      try { var nr = await A().API.adminSupportGet(t.id); if (nr.ticket.messages.length !== count || nr.ticket.userReadAt !== t.userReadAt) { count = nr.ticket.messages.length; t = nr.ticket; box.innerHTML = supMsgs(t); bottom(); } } catch (e) {}
    }, 15000);
  }
  // Шаблоны ответов: название кнопки и текст; одни на всех сотрудников
  function supTplEditor(templates, done) {
    var rows = templates.map(function (x) { return { title: x.title, text: x.text }; });
    A().openModal('<div class="as-tpl-ed"><h2>Шаблоны ответов</h2><p class="muted">Кнопки над полем ответа: нажатие вставляет текст, его можно поправить перед отправкой.</p><div id="tplRows"></div>' +
      '<button type="button" class="btn ghost sm" id="tplAdd">+ Добавить шаблон</button><div class="as-tpl-act"><button type="button" class="btn" id="tplSave">Сохранить</button></div></div>');
    var md = $('#modalBody'), box = $('#tplRows', md);
    var draw = function () { box.innerHTML = rows.map(function (x, i) { return '<div class="as-tpl-row"><input class="input" data-i="' + i + '" data-k="title" maxlength="60" placeholder="Название" value="' + esc(x.title) + '"><textarea class="textarea" data-i="' + i + '" data-k="text" rows="3" maxlength="2000" placeholder="Текст ответа">' + esc(x.text) + '</textarea><button type="button" class="link" data-del="' + i + '">Удалить</button></div>'; }).join(''); };
    draw();
    box.addEventListener('input', function (e) { var el = e.target; if (el.hasAttribute('data-k')) rows[+el.getAttribute('data-i')][el.getAttribute('data-k')] = el.value; });
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (b) { rows.splice(+b.getAttribute('data-del'), 1); draw(); } });
    $('#tplAdd', md).addEventListener('click', function () { rows.push({ title: '', text: '' }); draw(); });
    $('#tplSave', md).addEventListener('click', async function () {
      try { var list = await A().API.adminSupportTemplates(rows); toast('Шаблоны сохранены'); A().closePanels(); done(list); } catch (e) { toast(A().errMsg(e), true); }
    });
  }

  function notifyPanel(m, q, mail) {
    var API = A().API, tab = q.sub === 'letter' ? 'letter' : 'requests', tpl = Mail.tplOf(DATA.settings);
    var wl = DATA.waitlist || [];
    var waiting = wl.filter(function (w) { return w.status === 'waiting' || w.status === 'failed'; });
    var ready = Mail.readyRequests(wl, DATA.products);
    m.innerHTML = '<p class="mh-lead">Если нужного размера или цвета нет, покупатель нажимает на сайте «Сообщить о поступлении» и оставляет почту. Когда вы пополните остаток в карточке товара и сохраните её, письмо уйдёт автоматически — один раз на каждую заявку.</p>' +
      '<ol class="adm-steps"><li><b>Покупатель оставляет заявку</b><span>на странице товара, если размера или цвета нет</span></li><li><b>Вы пополняете остаток</b><span>в разделе «Товары», в нужном цвете и размере</span></li><li><b>Письмо уходит само</b><span>сразу после сохранения товара</span></li></ol>' +
      // Кнопка на сайте — одним переключателем; сколько ждут, видно на вкладке и в карточке сверху
      '<label class="mh-toggle"><span><b>Кнопка «Сообщить о поступлении» на сайте</b><small>' + (tpl.enabled ? 'Покупатели видят её, если размера или цвета нет' : 'Выключена — покупатели её не видят') + '</small></span><span class="adm-switch"><input type="checkbox" id="nToggle"' + (tpl.enabled ? ' checked' : '') + '><span></span></span></label>' +
      (ready.length && !mail.ready ? '<div class="adm-alert">' + ready.length + ' ' + plural(ready.length, 'заявка', 'заявки', 'заявок') + ': товар уже в наличии, но письма не ушли, потому что почта для отправки не настроена. <a class="link" href="#/admin?s=mail&tab=smtp">Подключить почту</a></div>' : '') +
      '<div class="mh-sub">' + [['requests', 'Заявки'], ['letter', 'Текст письма']].map(function (t) { return '<a href="#/admin?s=mail&tab=notify' + (t[0] === 'letter' ? '&sub=letter' : '') + '" class="fn-chip' + (tab === t[0] ? ' on' : '') + '">' + t[1] + '</a>'; }).join('') + '</div><div id="nBody"></div>';
    $('#nToggle').addEventListener('change', async function () {
      var s2 = clone(DATA.settings); s2.notify = Object.assign({}, tpl, { enabled: !tpl.enabled });
      try { await API.adminSave('settings', s2); await afterSave(s2.notify.enabled ? 'Кнопка «Сообщить о поступлении» включена' : 'Кнопка выключена: покупатели её не увидят', '#/admin?s=mail&tab=notify' + (tab === 'letter' ? '&sub=letter' : '')); } catch (e) { toast(A().errMsg(e), true); }
    });
    var body = $('#nBody');
    if (tab === 'letter') return letterTab(body, tpl, mail);
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
      '<div class="adm-head" style="margin:0 0 14px"><div class="adm-filter" style="margin:0">' + [['waiting', 'Ждут'], ['done', 'Отправлены'], ['canceled', 'Отменены'], ['all', 'Все']].map(function (x) { return '<a class="chip' + (f === x[0] ? ' on' : '') + '" href="#/admin?s=mail&tab=notify&f=' + x[0] + '">' + x[1] + '</a>'; }).join('') + '</div>' +
        (ready.length ? '<button class="btn sm" id="nSend">Отправить письма сейчас (' + ready.length + ')</button>' : '') + '</div>' +
      (list.length ? '<div class="table-wrap adm-table"><table class="sizes"><thead><tr><th>Дата</th><th>Почта</th><th>Товар</th><th>Цвет</th><th>Размер</th><th>Статус</th><th></th></tr></thead><tbody>' +
        list.map(function (w) { var i = wInfo(w), st = W_STATUS[w.status] || [w.status, '']; return '<tr><td class="num">' + esc(new Date(w.createdAt).toLocaleDateString('ru-RU')) + '</td><td class="copyable">' + esc(w.email) + '</td><td>' + esc(i.name) + '</td><td>' + swatchInline(i.hex) + esc(i.color) + '</td><td>' + esc(i.size) + '</td><td><span class="status ' + st[1] + '"' + (w.error ? ' title="' + esc(w.error) + '"' : '') + '>' + esc(st[0]) + '</span>' + (w.sentAt && w.status === 'sent' ? '<div class="muted" style="font-size:13px">' + esc(new Date(w.sentAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '</div>' : '') + '</td><td><button class="adm-x" data-wdel="' + esc(w.id) + '" title="Удалить заявку">✕</button></td></tr>'; }).join('') +
        '</tbody></table></div>' :
        '<div class="empty"><h3>' + (f === 'waiting' ? 'Заявок нет' : 'Пусто') + '</h3><p>' + (f === 'waiting' ? 'Когда покупатель попросит сообщить о поступлении, заявка появится здесь.' : 'В этом списке пока ничего нет.') + '</p></div>');
    var sb = $('#nSend'); if (sb) sb.addEventListener('click', async function () {
      sb.disabled = true;
      try { var r = await A().API.adminWaitlistSend(); await afterSave(notifyMsg('Готово', r.notify), '#/admin?s=mail&tab=notify'); } catch (e) { toast(A().errMsg(e), true); sb.disabled = false; }
    });
    $$('[data-wdel]', body).forEach(function (b) { bindConfirm(b, async function () { try { await A().API.adminWaitlistDelete(b.getAttribute('data-wdel')); await afterSave('Заявка удалена', '#/admin?s=mail&tab=notify&f=' + f); } catch (e) { toast(A().errMsg(e), true); } }); });
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
      '<div class="adm-test"><h4 class="adm-sub">Проверить письмо</h4>' + ('<div class="promo-form"><input class="input" id="ltTo" type="email" placeholder="Ваша почта" aria-label="Почта для примера"><button type="button" class="btn ghost" id="ltTest">Отправить пример</button></div>' +
        '<button type="button" class="btn ghost sm" id="ltTestAcc" style="margin-top:8px">Отправить письма регистрации: код и приветствие</button>' + (mail.ready ? '' : '<p class="muted" style="font-size:13px;margin-top:8px">Сначала настройте почту для отправки.</p>')) + '</div></div>' +
      '<div class="adm-preview"><div class="adm-preview-head"><span class="eyebrow">Так покупатель увидит письмо</span><div class="adm-preview-subj"><span class="muted">Тема:</span> <b id="pvSubj"></b></div></div><div id="pvBox" class="adm-preview-box"></div></div></div>';
    var box = $('#ltForm', body), host = $('#pvBox', body), shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host, lastField = null;
    function current() { return readForm(box, defs, Object.assign({}, tpl)); }
    function preview() {
      var t = current(), c = sample ? Pricing.colorsOf(sample)[0] : null;
      var pr = sample ? Pricing.productPrice(sample, DATA.promotions) : { price: 0 };
      var r = Mail.render({ tpl: t, store: DATA.settings.storeName, product: sample ? sample.name : 'Пальто из шерсти', color: c ? c.name : 'Графит', colorHex: c && c.hex, size: c && c.sizes[0] ? c.sizes[0].size : 'M', price: fmt(pr.price), oldPrice: pr.oldPrice ? fmt(pr.oldPrice) : '', url: '#', image: c && c.images && c.images[0] && !/^data:image\/svg/.test(c.images[0]) ? c.images[0] : '', unsubscribe: '#', contacts: [DATA.settings.contacts.phone, DATA.settings.contacts.email].filter(Boolean).join(' · ') });
      $('#pvSubj', body).textContent = r.subject;
      shadow.innerHTML = r.html.replace(/^[\s\S]*?<body[^>]*>/, '<div style="background:#F3F4F6">').replace(/<\/body>[\s\S]*$/, '</div>');
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
      try { await A().API.adminSave('settings', s2); await afterSave('Текст письма сохранён', '#/admin?s=mail&tab=notify&sub=letter'); } catch (e) { $('#ltErr').textContent = A().errMsg(e); }
    });
    var ta = $('#ltTestAcc', body); if (ta) ta.addEventListener('click', async function () {
      var to = $('#ltTo').value.trim(); if (!to) { toast('Впишите почту, куда отправить пример', true); $('#ltTo').focus(); return; }
      ta.disabled = true; var lbl = ta.textContent; ta.textContent = 'Отправляем…';
      try { await A().API.adminMailTestAccount(to); toast('Отправили на ' + to + ' два письма: код подтверждения и «Добро пожаловать»'); } catch (e) { toast(A().errMsg(e), true); }
      ta.disabled = false; ta.textContent = lbl;
    });
    var tb = $('#ltTest', body); if (tb) tb.addEventListener('click', async function () {
      tb.disabled = true; tb.textContent = 'Отправляем…';
      try { await A().API.adminMailTest($('#ltTo').value.trim()); toast('Пример отправлен на ' + $('#ltTo').value.trim() + '. Учтите: сохранённый текст, а не черновик.'); } catch (e) { toast(A().errMsg(e), true); }
      tb.disabled = false; tb.textContent = 'Отправить пример';
    });
  }

  function mailTab(body, mail) {
    var PRESETS = { smtpbz: { host: 'connect.smtp.bz', port: 2525, security: 'starttls' }, yandex: { host: 'smtp.yandex.ru', port: 465, security: 'ssl' }, mailru: { host: 'smtp.mail.ru', port: 465, security: 'ssl' } };
    var defs = [
      { k: 'host', label: 'Сервер исходящей почты (SMTP)', placeholder: 'smtp.yandex.ru' },
      { k: 'port', label: 'Порт', type: 'number' },
      { k: 'security', label: 'Шифрование', type: 'select', options: [['ssl', 'SSL (обычно порт 465)'], ['starttls', 'STARTTLS (обычно порт 587)'], ['none', 'Без шифрования (только для своего сервера)']] },
      { k: 'user', label: 'Логин', placeholder: 'Адрес ящика или логин из сервиса рассылки' },
      { k: 'pass', label: 'Пароль приложения', hint: mail.hasPass ? 'Пароль сохранён. Оставьте поле пустым, чтобы не менять.' : 'Создаётся в настройках безопасности почты. Обычный пароль от ящика не подойдёт.' },
      { k: 'fromEmail', label: 'Адрес отправителя', placeholder: 'Обычно совпадает с логином' },
      { k: 'fromName', label: 'Имя отправителя', placeholder: DATA.settings.storeName },
      { k: 'replyTo', label: 'Адрес для ответов', placeholder: mail.contactEmail || 'info@вашдомен.ru', hint: 'Куда попадёт ответ, если покупатель нажмёт «Ответить» в письме. Пусто — почта из «Контактов»' }
    ];
    body.innerHTML = '<div class="adm-card"><p class="muted" style="font-size:14px;max-width:70ch;margin-bottom:16px">Письма уходят с вашего почтового ящика. Лучше всего — ящик на домене магазина в <b>Яндекс 360</b> или <b>Mail.ru для бизнеса</b>, например <span class="copyable">shop@albakov.ru</span>: такие письма реже попадают в спам.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px"><span class="muted" style="font-size:14px;align-self:center">Заполнить для:</span><button type="button" class="btn ghost sm" data-preset="smtpbz">SMTP.BZ</button><button type="button" class="btn ghost sm" data-preset="yandex">Яндекс 360</button><button type="button" class="btn ghost sm" data-preset="mailru">Mail.ru</button></div>' +
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
      try { await A().API.adminMailSave(m); toast('Настройки почты сохранены. Проверьте их: отправьте себе любое письмо во вкладке «Письма покупателям».'); window.ALB_NAV.go('#/admin?s=mail&tab=smtp&t=' + Date.now()); } catch (e) { $('#mlErr').textContent = A().errMsg(e); }
    });
  }

  /* Клик по строке таблицы */
  document.addEventListener('click', function (e) { if (e.target.closest('.adm-pick')) return; var tr = e.target.closest('tr[data-href]'); if (tr) window.ALB_NAV.go(tr.getAttribute('data-href')); });

  window.Admin = { render: render };
})();
