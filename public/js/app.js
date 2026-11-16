/* Витрина магазина: маршрутизация, страницы, корзина, оформление, личный кабинет. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = Pricing.format;
  var Cart = Store.Cart;
  var API, D, root;

  var ICON = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.3-3.6 4.2-5.4 7.5-5.4s6.2 1.8 7.5 5.4"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 016 0V8"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M3.5 7h17M3.5 12h17M3.5 17h11"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20.2s-7.6-4.6-7.6-10.1A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.6 2.5c0 5.5-7.6 10.1-7.6 10.1z"/></svg>'
  };
  var Fav = Store.Fav, BuyNow = Store.BuyNow;
  // Откуда берутся товары для оформления: «Купить сейчас» (один товар) или корзина
  function coSrc() { return /^#\/checkout\?(.*&)?buy=1/.test(curRoute()) && BuyNow.count() ? BuyNow : Cart; }
  function favBtn(id, cls) { var on = Fav.has(id); return '<button type="button" class="fav-btn' + (cls ? ' ' + cls : '') + (on ? ' on' : '') + '" data-fav="' + esc(id) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Убрать из избранного' : 'В избранное') + '">' + ICON.heart + '</button>'; }

  /* ---------- Помощники ---------- */
  /* Раздел магазина: женщинам / мужчинам / детям / всё. Выбор хранится в браузере покупателя.
     У каждого раздела свой цвет (13.63) — атрибут data-g у <html>, цвета в app.css */
  var GENDERS = { women: 'Женщинам', men: 'Мужчинам', kids: 'Детям' }, LS_G = 'albakov:gender';
  function readGender() { try { return localStorage.getItem(LS_G); } catch (e) { return null; } }
  var genderChoice = readGender(); // null или 'all' — смотрит всё
  function curGender() { return GENDERS[genderChoice] ? genderChoice : ''; }
  function paintGender() { var g = curGender(); if (g) document.documentElement.setAttribute('data-g', g); else document.documentElement.removeAttribute('data-g'); }
  paintGender();
  // Закрытый раздел: его товары не показываются, а вместо витрины — страница «скоро появится»
  function gClosed(g) { var x = g && (D.settings.genders || {})[g]; return !!(x && x.open === false); }
  function onSale(p) { return !(p.gender && p.gender !== 'unisex' && gClosed(p.gender)); }
  function inG(p) { return Pricing.forGender(p, curGender()) && onSale(p); }
  function gProducts() { return D.products.filter(inG); }
  function setGender(g) {
    genderChoice = GENDERS[g] ? g : 'all';
    try { localStorage.setItem(LS_G, genderChoice); } catch (e) {}
    paintGender();
    $$('[data-gender]').forEach(function (b) { var on = b.getAttribute('data-gender') === curGender(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    var ft = $('#app > .footer');
    if (ft) { var tmp = document.createElement('div'); tmp.innerHTML = footerHtml(); ft.replaceWith(tmp.firstElementChild); bindFooter(); }
    routeKeepScroll = true; route();
  }
  // Закрытые разделы не показываются, пока их не откроют в панели (13.64.0); открыт один раздел — переключателя нет
  function openGenders() { return Object.keys(GENDERS).filter(function (g) { return !gClosed(g); }); }
  function genderTabs(cls) {
    var gs = openGenders(); if (gs.length < 2) return '';
    return '<div class="gtabs ' + cls + ' n' + gs.length + '" role="group" aria-label="Раздел">' + gs.map(function (g) { var on = curGender() === g; return '<button class="gtab' + (on ? ' on' : '') + '" data-gender="' + g + '" aria-pressed="' + on + '">' + GENDERS[g] + '</button>'; }).join('') + '</div>';
  }
  function imgOf(p, i) { i = i || 0; var c = p && Pricing.colorsOf(p)[0]; return (c && c.images && c.images[i]) || Art.make(c && c.art); }
  function shownColor(p) { var cs = Pricing.colorsOf(p); return cs.find(function (c) { return Pricing.stockOf(c) > 0; }) || cs[0]; }
  function catById(id) { return D.categories.find(function (c) { return c.id === id; }); }
  function productBySlug(s) { return D.products.find(function (p) { return p.slug === s || p.id === s; }); }
  function priceOf(p) { return Pricing.productPrice(p, D.promotions); }
  function totalStock(p) { return Pricing.colorsOf(p).reduce(function (s, c) { return s + Pricing.stockOf(c); }, 0); }
  function colorNames(p) { return Pricing.colorsOf(p).map(function (c) { return c.name; }).join(' '); }
  function activePromos() { var now = Date.now(); return (D.promotions || []).filter(function (p) { return Pricing.inWindow(p, now); }); }
  function plural(n, a, b, c) { n = Math.abs(n) % 100; var n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; }
  function fmtPhone(d) { d = String(d || '').replace(/\D/g, ''); if (d.length !== 11) return d; return '+7 (' + d.slice(1, 4) + ') ' + d.slice(4, 7) + '-' + d.slice(7, 9) + '-' + d.slice(9, 11); }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return iso; } }
  // Категории текущего раздела: в «Мужчинам» нет платьев и юбок, в «Женщинам» — мужских категорий
  var WOMEN_CAT = /плать|юбк|блуз|сарафан|бюстгал|бель[её] жен|туник|топ[ыи]? жен|колгот|купальник/i, MEN_CAT = /мужск|галстук|запонк|плавки/i;
  function catGender(c) {
    if (GENDERS[c.gender] || c.gender === 'unisex') return c.gender;
    var gs = D.products.filter(function (p) { return p.categoryId === c.id && p.active !== false; }).map(function (p) { return p.gender || 'unisex'; });
    if (gs.length) return Object.keys(GENDERS).find(function (k) { return gs.every(function (g) { return g === k; }); }) || 'unisex';
    return WOMEN_CAT.test(c.name) ? 'women' : MEN_CAT.test(c.name) ? 'men' : 'unisex';
  }
  // «Унисекс» — взрослые разделы; в детском только детское
  function catInG(c) { var g = curGender(), cg = catGender(c); return !g || cg === g || (cg === 'unisex' && g !== 'kids'); }
  // Категории для меню, подвала и фильтров — только те, где в текущем разделе есть товары (пустые не показываем)
  function sortedCats() { var ps = gProducts(); return D.categories.filter(function (c) { return catInG(c) && ps.some(function (p) { return p.categoryId === c.id; }); }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  var STATUS = { new: 'Новый', processing: 'Собирается', shipped: 'Передан в доставку', done: 'Выполнен', canceled: 'Отменён', returned: 'Возврат' };
  var PAY = { pending: 'Ожидает оплаты', paid: 'Оплачен', canceled: 'Оплата не прошла', refunded: 'Деньги возвращены' };

  function md(text) {
    var out = [], list = null;
    String(text || '').split(/\n/).forEach(function (line) {
      var t = line.trim();
      var inline = function (s) {
        return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, a, h) {
          var safe = /^(https?:|#|mailto:|tel:)/.test(h) ? h : '#';
          return '<a href="' + safe + '"' + (/^https?:/.test(h) ? ' target="_blank" rel="noopener"' : '') + '>' + a + '</a>';
        });
      };
      if (/^- /.test(t)) { if (!list) { list = []; } list.push('<li>' + inline(t.slice(2)) + '</li>'); return; }
      if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; }
      if (!t) return;
      if (/^### /.test(t)) out.push('<h3>' + inline(t.slice(4)) + '</h3>');
      else if (/^## /.test(t)) out.push('<h2>' + inline(t.slice(3)) + '</h2>');
      else out.push('<p>' + inline(t) + '</p>');
    });
    if (list) out.push('<ul>' + list.join('') + '</ul>');
    return out.join('');
  }

  function toast(msg, bad) {
    var w = $('.toast-wrap'); if (!w) return;
    var t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; w.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 350); }, 3400);
  }
  function errMsg(e) { return (e && e.userMessage) || (e && e.message) || 'Что-то пошло не так'; }

  function phoneMask(input) {
    input.addEventListener('input', function () {
      var d = input.value.replace(/\D/g, '');
      if (d[0] === '8') d = '7' + d.slice(1);
      if (d && d[0] !== '7') d = '7' + d;
      d = d.slice(0, 11);
      var r = d ? '+7' : '';
      if (d.length > 1) r += ' (' + d.slice(1, 4);
      if (d.length >= 4) r += ') ' + d.slice(4, 7);
      if (d.length >= 7) r += '-' + d.slice(7, 9);
      if (d.length >= 9) r += '-' + d.slice(9, 11);
      input.value = r;
    });
  }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s).trim()); }
  function validPhone(s) { return Store.normPhone(s).length === 11; }

  /* ---------- Каркас ---------- */
  function renderShell() {
    var s = D.settings;
    root.innerHTML =
      '<header class="header"><div class="wrap">' +
        '<nav class="nav" aria-label="Основное меню">' + navLinks() + '</nav>' +
        '<button class="icon-btn burger" data-act="menu" aria-label="Меню">' + ICON.menu + '</button>' +
        '<a class="logo" href="#/" aria-label="' + esc(s.storeName) + ' — на главную">' + brandHtml(s, 'desktop', 'brand-desk') + brandHtml(s, 'mobile', 'brand-mob') + '</a>' +
        '<div class="tools">' + genderTabs('gtabs-head') +
          '<button class="icon-btn" data-act="search" aria-label="Поиск">' + ICON.search + '</button>' +
          '<a class="icon-btn hide-m acc-link" id="accLink" href="#/account" aria-label="Личный кабинет">' + ICON.user + '</a>' +
          '<a class="icon-btn fav-link" href="#/favorites" aria-label="Избранное">' + ICON.heart + '<span class="badge-count fav-count" id="favCount" hidden></span></a>' +
          '<button class="icon-btn" data-act="cart" aria-label="Корзина">' + ICON.bag + '<span class="badge-count" id="cartCount" hidden></span></button>' +
        '</div></div><div class="gbar">' + genderTabs('gtabs-bar') + '</div></header>' +
      '<main id="view"></main>' +
      footerHtml() +
      '<div class="scrim" id="scrim"></div>' +
      '<aside class="drawer left" id="menuDrawer" aria-label="Меню"><div class="drawer-head"><a class="logo" href="#/" aria-label="' + esc(s.storeName) + '">' + brandHtml(s, 'mobile', 'brand-drawer') + '</a><button class="icon-btn" data-act="close">' + ICON.close + '</button></div>' +
        '<div class="drawer-body mm">' + drawerMenuHtml() + '</div></aside>' +
      '<aside class="drawer right" id="cartDrawer" aria-label="Корзина"><div class="drawer-head"><h3>Корзина</h3><button class="icon-btn" data-act="close">' + ICON.close + '</button></div><div class="drawer-body" id="cartBody"></div><div class="drawer-foot" id="cartFoot"></div></aside>' +
      '<div class="modal" id="modal" role="dialog" aria-modal="true"><div class="modal-box"><button class="icon-btn modal-close" data-act="close">' + ICON.close + '</button><div id="modalBody"></div></div></div>' +
      '<div class="toast-wrap" aria-live="polite"></div>' +
      fabHtml() +
      '<button class="to-top" id="toTop" aria-label="Наверх" hidden><svg viewBox="0 0 24 24"><path d="M6 14l6-6 6 6"/></svg></button>';
    updateCartCount(); updateFavCount(); bindFab(); bindFooter();
  }
  // подвал: на телефоне колонки свёрнуты, на компьютере всегда раскрыты
  function bindFooter() {
    var narrow = window.matchMedia && matchMedia('(max-width: 760px)').matches;
    $$('.footer details.fcol').forEach(function (d) { if (narrow) d.removeAttribute('open'); $('summary', d).addEventListener('click', function (e) { if (!(window.matchMedia && matchMedia('(max-width: 760px)').matches)) e.preventDefault(); }); });
  }
  function updateFavCount() { var n = Fav.count(); $$('#favCount, #mmFavCount').forEach(function (b) { b.textContent = n; b.hidden = !n; }); }
  /* Логотип: знак, надпись или название текстом — отдельно для компьютера и телефона */
  function brandMode(s, where) {
    var b = s.brand || {}, mode = b[where] || 'both', hasM = !!(b.mark && b.mark.src), hasW = !!(b.word && b.word.src);
    if (mode === 'both' && !(hasM && hasW)) mode = hasW ? 'word' : hasM ? 'mark' : 'text';
    if (mode === 'word' && !hasW) mode = hasM ? 'mark' : 'text';
    if (mode === 'mark' && !hasM) mode = hasW ? 'word' : 'text';
    return mode;
  }
  function brandHtml(s, where, cls, forceMode) {
    var b = s.brand || {}, mode = forceMode || brandMode(s, where), out = '';
    if (mode === 'both' || mode === 'mark') out += '<img class="brand-mark" src="' + esc(b.mark.src) + '" alt="" width="' + (b.mark.w || 1) + '" height="' + (b.mark.h || 1) + '">';
    if (mode === 'both' || mode === 'word') out += '<img class="brand-word" src="' + esc(b.word.src) + '" alt="" width="' + (b.word.w || 1) + '" height="' + (b.word.h || 1) + '" style="--r:' + ((b.word.w || 1) / (b.word.h || 1)).toFixed(3) + '">';
    if (mode === 'text') out += '<span class="brand-text">' + esc(s.storeName) + '</span>';
    if (b.trademark !== false && mode !== 'mark') out += '<sup class="brand-tm" title="Зарегистрированный товарный знак">®</sup>';
    return '<span class="brand ' + (cls || '') + ' show-' + mode + '" style="--bs:' + ((b.scale || 100) / 100) + '">' + out + '</span>';
  }
  /* Знак бренда — водяным знаком в подвале */
  function footerMark() {
    var b = D.settings.brand || {}, m = b.mark;
    if (!m || !m.src || b.footerMark === false) return '';
    return '<img class="footer-mark" src="' + esc(m.src) + '" alt="" aria-hidden="true" width="' + m.w + '" height="' + m.h + '">';
  }
  // Ссылки из настроек: только адреса сайта, https, почта и телефон — «javascript:» и подобное отбрасываем
  function safeUrl(u) { u = String(u || '').trim(); return /^(https?:\/\/|#|\/|mailto:|tel:)/i.test(u) || /^[\w.-]+(\/|$|\?|#)/.test(u) && !/^[\w.+-]+:/.test(u) ? u : '#/'; }
  // Пункт меню ведёт в пустой раздел (нет новинок, хитов, товаров категории или скидок) — прячем его, пока там пусто
  function navEmpty(link) {
    if (/^[#/]*sizes\b/.test(String(link || ''))) return true; // общей таблицы размеров больше нет (13.64.3) — у каждого товара своя
    var m = /^#?\/?catalog\?(?:.*&)?(tag|cat)=([^&]+)/.exec(String(link || '').replace(/^\//, '#/').replace(/^#\//, ''));
    var ps = gProducts();
    if (m && m[1] === 'tag') return m[2] === 'new' ? !ps.some(function (p) { return (p.tags || []).indexOf('new') !== -1; }) : m[2] === 'hit' ? !hitList(ps).length : false;
    if (m && m[1] === 'cat') { var c = D.categories.find(function (x) { return x.slug === decodeURIComponent(m[2]); }); return !!c && !ps.some(function (p) { return p.categoryId === c.id; }); }
    if (/^#?\/?sale$/.test(String(link || '').replace(/^#\//, '/'))) return !activePromos().length && !ps.some(function (p) { return priceOf(p).onSale; });
    return false;
  }
  /* ---------- Меню на телефоне (13.56): разделы переключателем, кабинет / избранное / заказ — кнопками сверху,
     категории с фото — лентой, остальные пункты — списком с иконками, соцсети — значками ---------- */
  var MM_IC = {
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.5 5.3 5.7.7-4.2 3.9 1.1 5.6L12 16.2 6.9 19l1.1-5.6-4.2-3.9 5.7-.7z"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
    tag: '<svg viewBox="0 0 24 24"><path d="M20 12.5l-7.5 7.5-8.5-8.5V4h7.5z"/><circle cx="8" cy="8" r="1.3"/></svg>',
    ruler: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/></svg>',
    gift: '<svg viewBox="0 0 24 24"><rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M12 9v11M3.5 13h17M12 9c-1.8-3.6-5.5-3.6-5.5-1.3S10 9 12 9zm0 0c1.8-3.6 5.5-3.6 5.5-1.3S14 9 12 9z"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>',
    page: '<svg viewBox="0 0 24 24"><path d="M6 3.5h8l4 4V20.5H6z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>'
  };
  // Значок пункта меню — по ссылке (пункты меняются в «Меню, контакты, соцсети»)
  function mmIcon(link) {
    var l = String(link || '');
    return /tag=new/.test(l) ? MM_IC.star : /^#\/sale/.test(l) ? MM_IC.tag : /^#\/sizes/.test(l) ? MM_IC.ruler : /^#\/catalog/.test(l) ? MM_IC.grid : /about/.test(l) ? MM_IC.info : /^#\/gift/.test(l) ? MM_IC.gift : MM_IC.page;
  }
  // Самая большая скидка из идущих акций в процентах — плашка у «Акций»
  function saleBadge() { var m = 0; activePromos().forEach(function (p) { if (p.type === 'percent' && p.value > m) m = p.value; }); return m ? '<span class="mm-tag">−' + m + '%</span>' : ''; }
  // Документы в меню телефона — плитками: короткое название и подпись (полное — в aria-label)
  var MM_DOCS = {
    offer: ['Оферта', 'Условия покупки', '<svg viewBox="0 0 24 24"><path d="M7 3h7.5L19 7.5v12a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 7 3z"/><path d="M14.5 3v3.5a1 1 0 0 0 1 1H19M8.6 11h6.8M8.6 14h4.4"/><path d="M8.6 18.2c.9-1.3 1.7-1.3 2 0 .3 1.1 1.2 1.1 2.1-.5"/></svg>'],
    privacy: ['Политика', 'Ваши данные', '<svg viewBox="0 0 24 24"><path d="M12 2.8l7.2 2.7v5.6c0 4.6-3 8.4-7.2 10-4.2-1.6-7.2-5.4-7.2-10V5.5z"/><circle cx="12" cy="10.4" r="1.8"/><path d="M12 12.2v3.3"/></svg>'],
    consent: ['Согласие', 'На обработку данных', '<svg viewBox="0 0 24 24"><path d="M12.0 2.8L14.0 4.4L16.6 4.0L17.6 6.4L20.0 7.4L19.6 10.0L21.2 12.0L19.6 14.0L20.0 16.6L17.6 17.6L16.6 20.0L14.0 19.6L12.0 21.2L10.0 19.6L7.4 20.0L6.4 17.6L4.0 16.6L4.4 14.0L2.8 12.0L4.4 10.0L4.0 7.4L6.4 6.4L7.4 4.0L10.0 4.4Z"/><path d="M8.8 12.3l2.2 2.2 4.3-4.6"/></svg>']
  };
  function mmDocs(docs) {
    var order = ['offer', 'privacy', 'consent'];
    return docs.slice().sort(function (a, b) { var x = order.indexOf(a.slug), y = order.indexOf(b.slug); return (x < 0 ? 9 : x) - (y < 0 ? 9 : y); }).map(function (pg) {
      var k = MM_DOCS[pg.slug]; return { pg: pg, t: k ? k[0] : pg.title, s: k ? k[1] : '', ic: k ? k[2] : MM_IC.page };
    });
  }
  function drawerMenuHtml() {
    var nav = (D.settings.nav || []).filter(function (n) { return !navEmpty(n.link); });
    var gift = !D.giftCfg || D.giftCfg.enabled !== false;
    var st = D.settings;
    var docs = D.pages.filter(function (pg) { return pg.inFooter && pg.group === 'legal'; });
    // Владелец вошёл в панель — кнопка «Панель управления» первой строкой меню
    var admin = API.isAdmin ? '<a class="mm-admin" href="#/admin"><span class="mm-admin-ic">' + MM_IC.grid + '</span><span><b>Панель управления</b><small>Заказы, товары, финансы</small></span><span class="mm-ar">' + MM_IC.arrow + '</span></a>' : '';
    // Внизу — документы списком и знак; реквизиты продавца — в подвале сайта и в оферте
    var foot = '<div class="mm-foot">' +
      (docs.length ? '<div class="mm-h"><span>Документы</span></div><nav class="mm-docs" aria-label="Документы">' + mmDocs(docs).map(function (d) {
        return '<a href="#/page/' + esc(d.pg.slug) + '" aria-label="' + esc(d.pg.title) + '"><span class="mm-doc-ic">' + d.ic + '</span><span class="mm-doc-t"><b>' + esc(d.t) + '</b>' + (d.s ? '<small>' + esc(d.s) + '</small>' : '') + '</span></a>';
      }).join('') + '</nav>' : '') +
      '<p class="mm-copy">© ' + new Date().getFullYear() + ' ' + esc(st.storeName) + ((st.brand || {}).trademark !== false ? '®. Все права защищены. ' + esc(st.storeName) + ' — зарегистрированный товарный знак' : '. Все права защищены') + '</p></div>';
    return admin + genderTabs('gtabs-drawer mm-seg') +
      '<div class="mm-quick">' +
        '<a href="#/account">' + ICON.user + '<span>Кабинет</span></a>' +
        '<a href="#/favorites">' + ICON.heart + '<span>Избранное</span><em class="mm-count" id="mmFavCount"' + (Fav.count() ? '' : ' hidden') + '>' + Fav.count() + '</em></a>' +
        '<a href="#/track">' + MM_IC.truck + '<span>Мой заказ</span></a>' +
      '</div>' +
      mmTilesHtml(nav, gift) +
      appMenuHtml() + mmSocialsHtml() + foot;
  }
  /* Пункты меню плитками (13.56): первые четыре — квадратами по два в ряд, остальные — на всю ширину.
     «Акции» — плитка цвета раздела с самой большой скидкой (13.63) */
  function mmTilesHtml(nav, gift) {
    var items = nav.map(function (n) { return { href: safeUrl(n.link), ic: mmIcon(n.link), label: n.label, sale: /^#\/sale/.test(n.link) }; });
    if (gift) items.push({ href: '#/gift', ic: MM_IC.gift, label: 'Подарочные сертификаты' });
    var sq = Math.min(4, items.length); if (sq % 2) sq--; // квадратов всегда чётное число — без дыр в сетке
    return '<nav class="mm-tiles" aria-label="Разделы сайта">' + items.map(function (x, i) {
      var cls = 'mm-tile' + (i < sq ? '' : ' wide') + (x.sale ? ' sale' : '');
      return '<a class="' + cls + '" href="' + esc(x.href) + '"><span class="mm-tile-ic">' + x.ic + '</span>' + (x.sale ? saleBadge() : '') + '<b>' + esc(x.label) + (x.sale && i < sq ? '<small>Скидки на коллекцию</small>' : '') + '</b></a>';
    }).join('') + '</nav>';
  }
  function mmSocialsHtml() {
    var list = (D.settings.socials || []).filter(function (x) { return x.url; });
    if (!list.length) return '';
    return '<div class="mm-soc">' + list.map(function (x) { return '<a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener" aria-label="' + esc(x.name) + '" title="' + esc(x.name) + '">' + SOC_ICON[socialKind(x)] + '</a>'; }).join('') + '<small>Мы в соцсетях</small></div>';
  }
  function navLinks() { return (D.settings.nav || []).filter(function (n) { return !navEmpty(n.link); }).map(function (n) { return '<a href="' + esc(safeUrl(n.link)) + '">' + esc(n.label) + '</a>'; }).join(''); }
  /* Цветные значки соцсетей */
  var SOC_ICON = {
    telegram: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#2AABEE"/><path fill="#fff" d="M7.4 15.6l15.5-6c.7-.3 1.4.2 1.1 1.3l-2.6 12.4c-.2.9-.7 1.1-1.4.7l-4-2.9-1.9 1.9c-.2.2-.4.4-.8.4l.3-4.1 7.4-6.7c.3-.3-.1-.4-.5-.2l-9.1 5.8-3.9-1.2c-.9-.3-.9-.9.2-1.4z"/></svg>',
    vk: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#0077FF"/><path fill="#fff" d="M17 22.3c-6.6 0-10.4-4.5-10.5-12.1h3.3c.1 5.6 2.5 7.9 4.5 8.4v-8.4h3.1v4.8c1.9-.2 4-2.4 4.6-4.8h3.1c-.5 2.9-2.7 5.1-4.2 6 1.5.7 4 2.6 4.9 6.1h-3.4c-.7-2.3-2.6-4.1-5-4.3v4.3h-.4z"/></svg>',
    instagram: '<svg viewBox="0 0 32 32"><defs><radialGradient id="igG" cx="30%" cy="107%" r="150%"><stop offset="0" stop-color="#FDF497"/><stop offset=".05" stop-color="#FDF497"/><stop offset=".45" stop-color="#FD5949"/><stop offset=".6" stop-color="#D6249F"/><stop offset=".9" stop-color="#285AEB"/></radialGradient></defs><circle cx="16" cy="16" r="16" fill="url(#igG)"/><rect x="8.6" y="8.6" width="14.8" height="14.8" rx="4.3" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="16" cy="16" r="3.6" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="20.6" cy="11.4" r="1.1" fill="#fff"/></svg>',
    other: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#1d1d1f"/><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" d="M14.2 17.8l3.6-3.6M13 15.4l-1.6 1.6a3 3 0 004.2 4.2l1.6-1.6M19 16.6l1.6-1.6a3 3 0 00-4.2-4.2L14.8 12.4"/></svg>'
  };
  function socialKind(x) {
    var t = (String(x.url || '') + ' ' + String(x.name || '')).toLowerCase();
    return /t\.me|telegram|телеграм/.test(t) ? 'telegram' : /vk\.com|vk\.ru|вконтакте|\bvk\b/.test(t) ? 'vk' : /instagram|инстаграм/.test(t) ? 'instagram' : 'other';
  }
  function footerHtml() {
    var s = D.settings, c = s.contacts || {};
    var pages = function (g) { return D.pages.filter(function (p) { return p.inFooter && (p.group || 'help') === g; }).map(function (p) { return '<li><a href="#/page/' + esc(p.slug) + '">' + esc(p.title) + '</a></li>'; }).join(''); };
    var socials = (s.socials || []).filter(function (x) { return x.url; });
    var FI = {
      mail: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>',
      phone: '<svg viewBox="0 0 24 24"><path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3A2.5 2.5 0 0 1 17.5 20 14.5 14.5 0 0 1 4 6.5 2.5 2.5 0 0 1 6.5 4z"/></svg>',
      pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
      time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
      chat: '<svg viewBox="0 0 24 24"><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17.5H5A1.5 1.5 0 0 1 3.5 16V7A1.5 1.5 0 0 1 5 5.5z"/><path d="M8 10h8M8 13h5"/></svg>'
    };
    var legal = String(s.legal || '').split(/\s*[,;]\s*/).filter(Boolean);
    // На телефоне колонки «Магазин» и «Покупателям» сворачиваются — подвал не растягивается на три экрана
    var col = function (title, list) { return '<details class="fcol" open><summary><h4>' + title + '</h4><i aria-hidden="true"></i></summary><ul>' + list + '</ul></details>'; };
    return '<footer class="footer">' + footerMark() + '<div class="wrap">' +
      '<div class="f-hero">' +
        '<div class="f-brand"><a class="logo logo-foot" href="#/" aria-label="' + esc(s.storeName) + '">' + brandHtml(s, 'desktop', 'brand-foot') + '</a>' + (s.tagline ? '<p class="f-tag">' + esc(s.tagline) + '</p>' : '') + '</div>' +
        '<div class="f-cta">' +
          '<a class="f-pill f-pill-main" href="#/account?tab=support&new=1"><span class="f-pill-ic">' + FI.chat + '</span><span><b>Написать нам</b><small>Ответим ежедневно с 10:00 до 22:00</small></span></a>' +
          (c.email ? '<a class="f-pill" href="mailto:' + esc(c.email) + '"><span class="f-pill-ic">' + FI.mail + '</span><span><b class="copyable">' + esc(c.email) + '</b><small>Почта для вопросов</small></span></a>' : '') +
        '</div>' +
      '</div>' +
      '<div class="f-grid">' +
        col('Магазин', sortedCats().map(function (x) { return '<li><a href="#/catalog?cat=' + esc(x.slug) + '">' + esc(x.name) + '</a></li>'; }).join('') + '<li><a href="#/catalog?tag=new">Новинки</a></li><li><a href="#/sale">Акции</a></li>' + (D.giftCfg && D.giftCfg.enabled !== false ? '<li><a href="#/gift">Подарочные сертификаты</a></li>' : '')) +
        col('Покупателям', '<li><a href="#/track">Где мой заказ</a></li>' + pages('help') + '' + pages('brand') +
          (appStoreUrl() ? '<li><a href="' + esc(appStoreUrl()) + '" target="_blank" rel="noopener">Приложение для iPhone</a></li>' : '')) +
        col('Личный кабинет', '<li><a href="#/account?tab=orders">Мои заказы</a></li><li><a href="#/favorites">Избранное</a></li>' + (bonusCfg().enabled ? '<li><a href="#/account?tab=bonus">Бонусы</a></li>' : '') + '<li><a href="#/account?tab=support">Поддержка</a></li>') +
        '<div class="fcol fcol-contacts"><h4>Контакты</h4><ul class="f-contacts">' +
          (c.phone ? '<li><span class="f-ic">' + FI.phone + '</span><a href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '" class="copyable">' + esc(c.phone) + '</a></li>' : '') +
          (c.email ? '<li><span class="f-ic">' + FI.mail + '</span><a href="mailto:' + esc(c.email) + '" class="copyable">' + esc(c.email) + '</a></li>' : '') +
          (c.address ? '<li><span class="f-ic">' + FI.pin + '</span><span>' + esc(c.address) + '</span></li>' : '') +
          (c.hours ? '<li><span class="f-ic">' + FI.time + '</span><span>' + esc(c.hours) + '</span></li>' : '') + '</ul>' +
          (socials.length ? '<div class="f-socials">' + socials.map(function (x) { return '<a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener" aria-label="' + esc(x.name) + '"><span class="soc-ic" aria-hidden="true">' + SOC_ICON[socialKind(x)] + '</span><span>' + esc(x.name) + '</span></a>'; }).join('') + '</div>' : '') +
        '</div>' +
      '</div>' +
      (legal.length ? '<div class="f-seller"><span class="f-seller-t">Продавец</span>' + legal.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('<i aria-hidden="true">·</i>') + '</div>' : '') +
      '<div class="footer-bottom"><span>© ' + new Date().getFullYear() + ' ' + esc(s.storeName) + ((s.brand || {}).trademark !== false ? '®. Все права защищены. ' + esc(s.storeName) + ' — зарегистрированный товарный знак' : '. Все права защищены') + '</span>' +
        '<nav class="f-legal" aria-label="Документы">' + D.pages.filter(function (p) { return p.inFooter && p.group === 'legal'; }).map(function (p) { return '<a href="#/page/' + esc(p.slug) + '">' + esc(p.title) + '</a>'; }).join('') + (API.isAdmin ? '<a href="#/admin">Управление</a>' : '') + '</nav></div>' +
    '</div></footer>';
  }

  /* ---------- Приложение ALBAKOV в App Store (13.62) ----------
     Ссылку вписывает владелец (панель → «Меню, контакты, соцсети»), когда приложение пройдёт проверку Apple.
     Внутри самого приложения кнопок «скачать» нет. */
  function appStoreUrl() {
    var u = (D.settings.contacts || {}).appStore || '';
    return /^https:\/\/apps\.apple\.com\//.test(u) && !window.AlbakovApp ? u : '';
  }
  function appMenuHtml() {
    if (!appStoreUrl()) return '';
    return '<div class="mnav-app"><a class="mnav-app-btn" href="' + esc(appStoreUrl()) + '" target="_blank" rel="noopener"><img src="img/icon-192.png" alt="" width="36" height="36"><span><b>Приложение ALBAKOV</b><small>Скачать в App Store</small></span></a></div>';
  }

  function openPanel(id) { closePanels(); $('#' + id).classList.add('open'); $('#scrim').classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closePanels() { $$('.drawer.open, .modal.open, .scrim.open').forEach(function (e) { e.classList.remove('open'); }); document.body.style.overflow = ''; }
  function openModal(html) { $('#modalBody').innerHTML = html; openPanel('modal'); }

  var lastCount = null;
  function updateCartCount() {
    var n = Cart.count(), b = $('#cartCount'); if (!b) return;
    b.textContent = n; b.hidden = !n;
    if (lastCount !== null && n > lastCount) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
    lastCount = n;
  }

  // {free} в объявлении — самый низкий порог «Бесплатно от» из способов доставки (меняется вместе с настройками)
  /* ---------- Карточка товара ---------- */
  // Плашки товара: «Новинка», «Скидка 15%», «Хит продаж» — тексты и цвета из панели управления
  function badgeHtml(p, pr) {
    // самые продаваемые получают плашку «Хит продаж» сами, без отметки в панели
    if (isHit(p) && (p.tags || []).indexOf('hit') === -1) p = Object.assign({}, p, { tags: (p.tags || []).concat('hit') });
    return Pricing.badgesOf(p, pr, D.settings).map(function (b) { return '<span class="badge badge-' + b.key + '" style="--b:' + esc(b.color) + ';--bi:' + b.ink + '">' + esc(b.text) + '</span>'; });
  }
  /* ---------- Хиты продаж: отмеченные в панели + самые продаваемые за 90 дней (порядок считает сервер) ---------- */
  function hitRank(p) { var i = (D.hits || []).indexOf(p.id); return i === -1 ? Infinity : i; }
  function isHit(p) { return (p.tags || []).indexOf('hit') !== -1 || hitRank(p) !== Infinity; }
  // Сначала то, что лучше продаётся; отмеченные вручную без продаж — следом, по новизне
  function hitList(list) {
    return list.filter(isHit).sort(function (a, b) { return (hitRank(a) - hitRank(b)) || String(b.createdAt).localeCompare(String(a.createdAt)); });
  }

  /* ---------- Бонусы: 1 бонус = 1 ₽ ---------- */
  function bonusWord(n) { return plural(n, 'бонус', 'бонуса', 'бонусов'); }
  function bonusNum(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function bonusCfg() { return Pricing.bonusConf(D.settings); }
  // «+75 бонусов» под ценой — сколько придёт за покупку по проценту из панели управления
  function bonusLine(price, cls) {
    var n = Pricing.bonusFor(price, D.settings);
    return n > 0 ? '<span class="' + (cls || 'card-bonus') + '"' + (cls ? '' : ' title="Бонусы за покупку: 1 бонус = 1 ₽ на следующие заказы"') + '><i class="b-ic" aria-hidden="true">Б</i>+' + bonusNum(n) + ' ' + bonusWord(n) + '</span>' : '';
  }
  // Карточка в каталоге. cid — выбранный цвет (переключается кружками прямо в карточке)
  function card(p, cid) {
    var pr = priceOf(p), stock = totalStock(p), cat = catById(p.categoryId), cs = Pricing.colorsOf(p);
    var c0 = (cid && cs.find(function (c) { return c.id === cid; })) || shownColor(p);
    var img0 = (c0.images && c0.images[0]) || Art.make(c0.art), img1 = c0.images && c0.images[1];
    var preOn = p.preorder && Pricing.preorderLeft(p) > 0;
    var tags = stock === 0 ? [preOn ? '<span class="badge badge-pre">Предзаказ</span>' : '<span class="badge badge-out">Нет в наличии</span>'] : badgeHtml(p, pr);
    var cStock = Pricing.stockOf(c0);
    // Под названием: мало осталось — важнее категории
    var sub = cStock > 0 && cStock <= 3 ? '<span class="sub low">' + (cStock === 1 ? 'Последняя вещь' : 'Осталось ' + cStock + ' шт.') + (cs.length > 1 ? ' · ' + esc(c0.name.toLowerCase()) : '') + '</span>'
      : '<span class="sub">' + (cs.length > 1 ? (cat ? esc(cat.name) : '') : esc([cat && cat.name, c0.name].filter(Boolean).join(' · '))) + '</span>';
    var qa = (c0.sizes || []).filter(function (x) { return x.stock > 0; }), one = qa.length === 1 && c0.sizes.length === 1;
    var quick = qa.length ? '<span class="qa"><span class="qa-label">' + (one ? '' : 'Быстро добавить') + '</span><span class="qa-sizes">' + qa.map(function (x) { return '<span class="qa-size" role="button" tabindex="0" data-qa="' + esc(p.id) + '|' + esc(c0.id) + '|' + esc(x.size) + '">' + (one ? 'В корзину' : esc(x.size)) + '</span>'; }).join('') + '</span></span>' +
      // На телефоне наведения нет — кнопка с пакетом открывает выбор размера
      '<span class="qa-btn" role="button" tabindex="0" aria-label="Выбрать размер и добавить в корзину" data-qsheet="' + esc(p.id) + '|' + esc(c0.id) + '">' + bagIcon() + '</span>' : '';
    return '<a class="card" data-card="' + esc(p.id) + '" href="#/product/' + esc(p.slug) + (c0 !== cs[0] ? '?color=' + esc(c0.id) : '') + '"><div class="ph"><div class="tags">' + tags.join('') + '</div>' + favBtn(p.id) + quick +
      '<img src="' + esc(img0) + '" alt="' + esc(p.name + (cs.length > 1 ? ', ' + c0.name.toLowerCase() : '')) + '" loading="lazy">' +
      (img1 ? '<img class="alt" src="' + esc(img1) + '" alt="" loading="lazy">' : '') + '</div>' +
      '<div class="meta"><span class="name">' + esc(p.name) + '</span>' + sub +
      (cs.length > 1 ? '<span class="card-swatches" role="group" aria-label="Цвета">' + cs.slice(0, 5).map(function (c) { return '<i role="button" tabindex="0" class="' + (c === c0 ? 'on' : '') + (Pricing.stockOf(c) ? '' : ' none') + '" style="' + swatchStyle(c) + '" data-sw="' + esc(p.id) + '|' + esc(c.id) + '" title="' + esc(c.name) + '" aria-label="' + esc(c.name) + '" aria-pressed="' + (c === c0) + '"></i>'; }).join('') + (cs.length > 5 ? '<em>+' + (cs.length - 5) + '</em>' : '') + '</span>' : '') +
      '<span class="card-buy">' + priceHtml(pr) + '</span>' + (stock > 0 ? bonusLine(pr.price) : '') + '</div></a>';
  }
  function bagIcon() { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M12 11v5M9.5 13.5h5"/></svg>'; }
  // Размер по сохранённым меркам покупателя (после подбора) — для отметки «ваш» в окне выбора
  function qsRec(p) { if (!fitCanPick(p)) return ''; var sv = fitSaved(), r = sv.done && sv.h && sv.kg ? fitPick(p, sv.h, sv.kg, sv.pref || 'free') : null; return r ? r.row.size : ''; }
  function qsFitHtml(p, c) {
    if (!fitCanPick(p)) return '';
    var rec = qsRec(p), rs = rec && (c.sizes || []).find(function (x) { return x.size === rec; }), recOut = rs && rs.stock <= 0;
    return '<button type="button" class="qs-fit" data-qfit="' + esc(p.id) + '|' + esc(c.id) + '"><span class="qs-fit-ic">' + FIT_IC + '</span><span class="qs-fit-t"><b>' + (rec ? 'Ваш размер — ' + esc(rec) : 'Убедитесь в размере') + '</b><span>' + (recOut ? 'В этом цвете сейчас нет — посмотрите другой цвет' : rec ? 'По вашим меркам. Изменить' : 'Рост и вес — подскажем, как сядет. 10 секунд') + '</span></span><i aria-hidden="true">' + ARROW + '</i></button>';
  }
  // Выбор размера снизу экрана (телефон): цвет, размеры в наличии, «В корзину»
  function quickSheet(pid, cid) {
    var p = D.products.find(function (x) { return x.id === pid; }); if (!p) return;
    var cs = Pricing.colorsOf(p), c = cs.find(function (x) { return x.id === cid; }) || shownColor(p), pr = priceOf(p);
    var img = (c.images && c.images[0]) || Art.make(c.art), rec = qsRec(p);
    openModal('<div class="qs"><div class="qs-top"><img src="' + esc(img) + '" alt=""><div><b class="qs-name">' + esc(p.name) + '</b>' + priceHtml(pr) + (p.sku ? '<span class="qs-sku">Арт. ' + esc(p.sku) + '</span>' : '') + '</div></div>' +
      (cs.length > 1 ? '<div class="qs-row"><span class="qs-l">Цвет: <b>' + esc(c.name) + '</b></span><div class="qs-colors">' + cs.map(function (x) { return '<button type="button" class="qs-color' + (x === c ? ' on' : '') + '" data-qsheet="' + esc(p.id) + '|' + esc(x.id) + '" aria-label="' + esc(x.name) + '" aria-pressed="' + (x === c) + '"' + (Pricing.stockOf(x) ? '' : ' disabled') + '><i style="' + swatchStyle(x) + '"></i></button>'; }).join('') + '</div></div>' : '') +
      qsFitHtml(p, c) +
      '<div class="qs-row"><span class="qs-l">Размер</span><div class="qs-sizes">' + (c.sizes || []).map(function (x) { var isRec = x.size === rec; return x.stock > 0 ? '<button type="button" class="qs-size' + (isRec ? ' rec' : '') + '" data-qa="' + esc(p.id) + '|' + esc(c.id) + '|' + esc(x.size) + '">' + esc(x.size) + (isRec ? '<small>ваш</small>' : x.stock <= 2 ? '<small>' + (x.stock === 1 ? 'последний' : 'мало') + '</small>' : '') + '</button>' : '<button type="button" class="qs-size" disabled>' + esc(x.size) + '</button>'; }).join('') + '</div></div>' +
      '<a class="link qs-more" href="#/product/' + esc(p.slug) + (c !== cs[0] ? '?color=' + esc(c.id) : '') + '">Подробнее о товаре и таблица размеров →</a></div>');
  }
  function priceHtml(pr) { return '<span class="price">' + (pr.oldPrice ? '<span class="now sale">' + fmt(pr.price) + '</span><s>' + fmt(pr.oldPrice) + '</s>' : '<span class="now">' + fmt(pr.price) + '</span>') + '</span>'; }

  /* ---------- Маршрутизация ---------- */
  /* Адреса страниц — обычные: /catalog, /product/palto, /page/delivery (так их видит и индексирует Яндекс).
     Внутри кода маршрут по-прежнему записывается как '#/catalog': ссылки href="#/…" перехватываются
     и открываются без перезагрузки, а старые адреса вида /#/order/… (из писем и закладок) сами
     превращаются в новые. */
  function curRoute() { return '#' + location.pathname + location.search; }
  function toPath(h) { h = String(h || ''); return h.indexOf('#/') === 0 ? h.slice(1) : h; }
  function navTo(h, replace, keep) {
    var u = toPath(h) || '/';
    if (keep) routeKeepScroll = true;
    if (!replace && u === location.pathname + location.search) { route(); return; }
    saveScroll();
    try { history[replace ? 'replaceState' : 'pushState']({ y: keep ? window.scrollY : 0 }, '', u); } catch (e) { location.href = u; return; }
    route();
  }
  /* Прокрутка: «Назад» возвращает на то же место страницы, а переключение вкладок и фильтров не уводит наверх */
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  function saveScroll() { try { history.replaceState(Object.assign({}, history.state, { y: window.scrollY }), ''); } catch (e) {} }
  var userScrolled = 0;
  ['touchstart', 'wheel', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { userScrolled = Date.now(); }, { passive: true }); });
  function restoreScroll(y) {
    var t0 = Date.now(), jump = function () { if (userScrolled > t0) return; window.scrollTo({ top: y, behavior: 'instant' }); };
    jump(); requestAnimationFrame(jump); setTimeout(jump, 120); setTimeout(jump, 400); // картинки и блоки могли догрузиться
  }
  // Ссылка-вкладка или фильтр на той же странице (кабинет, акции, админка) — оставляем прокрутку на месте
  var KEEP_SCROLL = '.tabs, .adm-tabs, .adm-chips, .ost, .chips, .gtabs, [data-keep-scroll]';
  function sameScreen(href) { var u = toPath(href) || '/'; return u.split('?')[0] === location.pathname; }
  function fromOldHash() {
    if (!/^#\//.test(location.hash)) return false;
    try { history.replaceState(null, '', location.hash.slice(1)); return true; } catch (e) { return false; }
  }
  fromOldHash();
  window.ALB_NAV = { go: navTo, cur: curRoute };
  function parseHash() {
    var h = curRoute().replace(/^#\/?/, '');
    var qi = h.indexOf('?'), path = qi === -1 ? h : h.slice(0, qi), q = {};
    var dec = function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } };
    if (qi !== -1) h.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[dec(p[0])] = dec((p[1] || '').replace(/\+/g, ' ')); });
    return { parts: path.split('/').filter(Boolean), q: q };
  }
  /* Заголовок вкладки и адрес страницы для поисковиков — те же, что отдаёт сервер (lib/seo.js) */
  function pageMeta(name, p, q) {
    var s = D.settings, store = s.storeName || 'ALBAKOV', t = store + ' — премиальный интернет-магазин одежды из Ингушетии', canon = location.pathname;
    if (name === 'catalog') {
      var c = q.cat && D.categories.find(function (x) { return x.slug === q.cat; });
      t = c ? c.name + ' — купить в премиальном интернет-магазине ' + store : 'Каталог одежды — премиальный интернет-магазин ' + store;
      canon = c ? '/catalog?cat=' + encodeURIComponent(c.slug) : '/catalog';
    } else if (name === 'product') {
      var pr = productBySlug(p[1]);
      if (pr) t = pr.name + ' — купить за ' + fmt(priceOf(pr).price) + ' в премиальном интернет-магазине ' + store;
    } else if (name === 'page') {
      var pg = D.pages.find(function (x) { return x.slug === p[1]; });
      if (pg) t = pg.slug === 'about' ? 'О бренде ' + store + ' — одежда из Ингушетии' : pg.title + ' — ' + store;
    } else if (name === 'sale') t = 'Акции и скидки — ' + store;
    else if (name === 'favorites') t = 'Избранное — ' + store;
    else if (name === 'track') t = 'Где мой заказ — ' + store;
    else if (name === 'gift') t = 'Подарочный сертификат — ' + store;
    else if (name) t = store + (s.tagline ? ' — ' + s.tagline : '');
    document.title = t;
    var l = document.querySelector('link[rel="canonical"]');
    if (l && ['', 'catalog', 'product', 'page', 'sale'].indexOf(name) !== -1) l.href = location.origin + canon;
  }
  function route() {
    closePanels();
    if (/^#\/(checkout|admin)/.test(curRoute())) hideBonusNotice();
    var r = parseHash(), v = $('#view'), p = r.parts;
    $$('.nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === curRoute()); });
    var name = p[0] || '';
    document.body.setAttribute('data-page', name);   // корзина и оформление прячут кнопку чата на узких экранах (аудит M-3)
    var map = { '': home, catalog: catalog, product: product, sale: sale, sizes: function () { go('#/catalog'); }, cart: cartPage, checkout: checkout, account: account, order: orderPage, page: textPage, favorites: favoritesPage, track: trackPage, gift: giftPage };
    var fn = map.hasOwnProperty(name) ? map[name] : isAdminRoute(name) ? adminPage : notFound;
    if ((name === '' || name === 'catalog' || name === 'sale') && gClosed(curGender())) fn = soonPage;
    try { fn(v, p, r.q); }
    catch (err) {
      // Страница не нарисовалась — показываем понятный экран вместо белого листа, остальной сайт продолжает работать
      if (window.console) console.error(err);
      v.innerHTML = '<div class="wrap"><div class="empty"><h3>Страница не открылась</h3><p>Попробуйте ещё раз — обычно это помогает.</p><div class="empty-acts"><button class="btn" type="button" id="viewReload">Обновить</button><a class="btn ghost" href="#/">На главную</a></div></div></div>';
      $('#viewReload').addEventListener('click', function () { location.reload(); });
    }
    if (fn !== adminPage) statPage();
    if (routeN++ && window.Metrika && fn !== adminPage) setTimeout(function () { Metrika.hit(location.pathname + location.search); }, 50);
    pageMeta(name, p, r.q);
    if ($('.nf', v)) document.title = 'Страница не найдена — ' + (D.settings.storeName || 'ALBAKOV'); // 404, в том числе для удалённого товара
    var fab = $('#fab'); if (fab) { fab.hidden = fn === adminPage || (name === 'account' && r.q.tab === 'support'); fabSet(false); }
    syncHeaderH();
    if (!routeQuiet) { v.classList.remove('view-in'); void v.offsetWidth; v.classList.add('view-in'); }
    if (!routeKeepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
    routeKeepScroll = false; routeQuiet = false;
  }
  var routeKeepScroll = false, routeQuiet = false, slideKeep = 0;
  // Высота шапки в обычном состоянии: на столько первый экран заходит под прозрачную шапку
  function syncHeaderH() {
    var hd = $('.header'), w = hd && $('.wrap', hd); if (!w) return;
    // считаем по полной высоте строки, даже если шапка сейчас сжата прокруткой
    var full = hd.offsetHeight - w.offsetHeight + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 76);
    document.documentElement.style.setProperty('--hdr-h', full + 'px');
  }
  window.addEventListener('resize', syncHeaderH);

  /* ---------- 3D: наклон за курсором (только мышь) ---------- */
  var TILT_SEL = '.card .ph, .cat-ph, .promo-band';
  function initTilt() {
    if (!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
    var cur = null;
    function reset(el) { el.style.transition = 'transform .8s cubic-bezier(.2,.7,.2,1)'; el.style.transform = ''; el.classList.remove('tilting'); }
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest ? e.target.closest(TILT_SEL) : null;
      if (el && (el.closest('.adm-main, .modal, .drawer'))) el = null;
      if (cur && cur !== el) reset(cur);
      cur = el; if (!el) return;
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      var k = el.classList.contains('promo-band') ? 5 : 10;
      el.style.transition = 'transform .18s linear'; el.style.transformOrigin = '50% 50%';
      el.style.transform = 'perspective(1000px) rotateX(' + ((.5 - y) * k).toFixed(2) + 'deg) rotateY(' + ((x - .5) * k).toFixed(2) + 'deg) scale(1.015)';
      el.classList.add('tilting');
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { if (cur) { reset(cur); cur = null; } });
  }
  /* Панель управления (13.57): адрес /admin; открывается только аккаунту владельца или сотрудника —
     остальным это обычная «страница не найдена» */
  function isAdminRoute(name) { return name === 'admin' && !!API.isAdmin; }
  function go(h, keep) { navTo(h, false, keep); }


  /* ---------- Слайдер на первом экране ---------- */
  function slidePromo(sl) { return sl.promotionId ? (D.promotions || []).find(function (p) { return p.id === sl.promotionId; }) : null; }
  function slideVisible(sl, g) {
    if (!sl.active) return false;
    if (!Pricing.inWindow({ active: true, startsAt: sl.startsAt, endsAt: sl.endsAt }, Date.now())) return false;
    if (sl.promotionId) { var pr = slidePromo(sl); if (!pr || !Pricing.inWindow(pr, Date.now())) return false; }
    if (sl.gender && g && sl.gender !== g) return false;
    var who = slideAudience(sl), u = API.user;
    if (who === 'guest' && u) return false;
    if (who === 'user' && !u) return false;
    // Скидка новым покупателям: вошедшему — пока он ею не воспользовался (и пока у него нет заказов: она на первый заказ)
    if (who === 'new' && u && (u.hasOrders || (sl.code && (u.usedPromos || []).indexOf(String(sl.code).toUpperCase()) !== -1))) return false;
    return true;
  }
  /* Кому показывать слайд: guest — только без входа, user — только вошедшим, all — всем.
     Не задано: слайд с кнопкой «Регистрация» — новым покупателям (new): гостям и вошедшим, кто ещё не пользовался скидкой */
  function slideAudience(sl) {
    if (sl.audience === 'guest' || sl.audience === 'user' || sl.audience === 'all') return sl.audience;
    return slideToRegister(sl) ? 'new' : 'all';
  }
  function slideToRegister(sl) { return /tab=register/.test(((sl.btn1 && sl.btn1.link) || '') + ' ' + ((sl.btn2 && sl.btn2.link) || '')); }
  /* Вошедшему слайд с регистрацией показываем без неё: кнопка «Выбрать вещи», в тексте без «Зарегистрируйтесь» */
  function slideForUser(sl) {
    if (!API.user || !slideToRegister(sl)) return sl;
    var x = Object.assign({}, sl), reg = function (b) { return b && /tab=register/.test(b.link || ''); };
    if (reg(x.btn1)) x.btn1 = { label: 'Выбрать вещи', link: '#/catalog' };
    if (reg(x.btn2)) x.btn2 = { label: '', link: '' };
    var t = String(x.text || '').replace(/зарегистрируйтесь\s*(и\s*)?/i, '').trim();
    x.text = t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
    return x;
  }
  function visibleSlides() { var c = D.settings.slider || {}; return c.enabled === false ? [] : (c.slides || []).filter(function (sl) { return slideVisible(sl, curGender()); }).map(slideForUser); }
  /* Слайдер на главной (вариант G, 13.64): фото в скруглённой карточке, внизу стеклянная панель —
     заголовок, текст, промокод, кнопка и стрелки; по верхнему краю панели полоса времени.
     Сверху на фото — надзаголовок и номер слайда. Цвета — палитра раздела (--acc, --acc-grad, --acc-tint) */
  var SL_PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>', SL_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  function slideHtml(sl, i, total, active) {
    var pr = slidePromo(sl);
    var eyebrow = (sl.eyebrow || '') + (pr && pr.endsAt ? (sl.eyebrow ? ' · ' : '') + 'до ' + fmtDate(pr.endsAt) : '');
    var badge = sl.badge || (pr ? (pr.type === 'percent' ? '−' + pr.value + '%' : '−' + fmt(pr.value)) : '');
    // Заголовок: со второй строки — цветом раздела (или *слова в звёздочках*)
    var raw = String(sl.title || '').trim(), nl = raw.indexOf('\n');
    if (raw.indexOf('*') === -1 && nl !== -1) raw = raw.slice(0, nl) + ' *' + raw.slice(nl + 1).replace(/\n/g, ' ') + '*';
    var title = esc(raw.replace(/\n/g, ' ')).replace(/\*(.+?)\*/g, '<em>$1</em>');
    var b1 = sl.btn1 && sl.btn1.label ? sl.btn1 : null, b2 = sl.btn2 && sl.btn2.label ? sl.btn2 : null;
    var h = i === 0 ? 'h1' : 'h2';
    return '<article class="slg-slide' + (active ? ' is-active' : '') + '" aria-roledescription="слайд" aria-label="' + (i + 1) + ' из ' + total + '"' + (active ? '' : ' aria-hidden="true"') + '>' +
      '<img class="slg-img" src="' + esc(sl.image || Art.make({ kind: 'coat', tone: '#3d3d40' })) + '" alt=""' + (i ? ' loading="lazy"' : '') + '>' +
      (eyebrow ? '<span class="slg-chip slg-eb"><i></i>' + esc(eyebrow) + '</span>' : '') +
      '<div class="slg-panel"><div class="slg-prog" aria-hidden="true"><i></i></div><div class="slg-in">' +
        '<' + h + ' class="slg-title">' + (badge ? '<span class="slg-badge">' + esc(badge) + '</span> ' : '') + title + '</' + h + '>' +
        (sl.text ? '<p class="slg-text">' + esc(sl.text) + '</p>' : '') +
        (sl.code ? '<button class="slg-code" data-copy="' + esc(sl.code) + '" title="Скопировать промокод"><span>Промокод</span><b>' + esc(sl.code) + '</b></button>' : '') +
        '<div class="slg-acts">' +
          (b1 ? '<a class="slg-btn" href="' + esc(safeUrl(b1.link || '#/catalog')) + '"><span>' + esc(b1.label) + '</span><i aria-hidden="true">' + ARROW + '</i></a>' : '') +
          (b2 ? '<a class="slg-link" href="' + esc(safeUrl(b2.link || '#/catalog')) + '">' + esc(b2.label) + '</a>' : '') +
          (total > 1 ? '<button class="slg-arrow" data-sl-step="-1" aria-label="Предыдущий слайд">' + SL_PREV + '</button><button class="slg-arrow" data-sl-step="1" aria-label="Следующий слайд">' + SL_NEXT + '</button>' : '') +
        '</div>' +
      '</div></div></article>';
  }
  function sliderHtml(list) {
    var c = D.settings.slider || {}, n = list.length;
    return '<section class="slider sl-g" id="slider" aria-roledescription="карусель" aria-label="Главное" style="--dur:' + Math.max(3, Number(c.interval) || 7) + 's">' +
      '<div class="slg-card"><div class="slg-track">' + list.map(function (sl, i) { return slideHtml(sl, i, n, i === 0); }).join('') + '</div>' +
      (n > 1 ? '<span class="slg-chip slg-num"><b id="slNum">1</b>&nbsp;/ ' + n + '</span>' : '') +
      '</div></section>';
  }
  function initSlider() {
    var el = $('#slider'); if (!el) return;
    var slides = $$('.slg-slide', el), n = slides.length, idx = 0;
    var c = D.settings.slider || {};
    var auto = c.autoplay !== false && n > 1;
    el.classList.toggle('autoplay', auto);
    function show(i) {
      idx = (i + n) % n;
      slides.forEach(function (s, k) {
        var on = k === idx; s.classList.toggle('is-active', on);
        if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
        $$('a,button', s).forEach(function (a) { a.tabIndex = on ? 0 : -1; });
        var pg = $('.slg-prog', s); pg.classList.remove('run'); if (on) { void pg.offsetWidth; pg.classList.add('run'); }
      });
      var num = $('#slNum'); if (num) num.textContent = idx + 1;
    }
    show(slideKeep < n ? slideKeep : 0); slideKeep = 0;
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-sl-step]'); if (a) { show(idx + +a.getAttribute('data-sl-step')); return; }
      var cp = e.target.closest('[data-copy]'); if (cp) {
        var code = cp.getAttribute('data-copy');
        var ok = async function () {
          cp.classList.add('copied');
          setTimeout(function () { cp.classList.remove('copied'); }, 2400);
          var r = null; try { r = (await API.quote([], code)).promo; } catch (ex) {}
          if (r && (r.reason === 'used' || r.reason === 'first')) toast(r.message, true);
          else if (r && r.reason === 'login') toast('Промокод ' + code + ' скопирован. Скидка действует после входа в личный кабинет.');
          else toast('Промокод ' + code + ' скопирован — вставьте его при оформлении заказа');
        };
        try { navigator.clipboard.writeText(code).then(ok, function () { toast('Промокод: ' + code); }); } catch (ex) { toast('Промокод: ' + code); }
      }
    });
    if (auto) el.addEventListener('animationend', function (e) { if (e.target.parentNode && e.target.parentNode.classList.contains('run')) show(idx + 1); });
    el.addEventListener('mouseenter', function () { el.classList.add('paused'); });
    el.addEventListener('mouseleave', function () { el.classList.remove('paused'); });
    el.addEventListener('focusin', function () { el.classList.add('paused'); });
    el.addEventListener('focusout', function () { el.classList.remove('paused'); });
    el.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') show(idx - 1); if (e.key === 'ArrowRight') show(idx + 1); });
    var x0 = null, y0 = 0;
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; el.classList.add('paused'); }, { passive: true });
    el.addEventListener('touchend', function (e) {
      el.classList.remove('paused'); if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }
  document.addEventListener('visibilitychange', function () { var el = $('#slider'); if (el) el.classList.toggle('hidden-tab', document.hidden); });

  /* ---------- Главная ---------- */
  function home(v) {
    var h = D.settings.home || {}, html = '';
    var heroImg = h.heroImage || Art.make(h.heroArt || { kind: 'coat', tone: '#3d3d40' });
    var title = esc(h.heroTitle || '').replace(/\*(.+?)\*/g, '<em>$1</em>');
    var slides = visibleSlides();
    if (slides.length) html += sliderHtml(slides);
    else html += '<section class="hero"><div class="hero-text"><span class="eyebrow">' + esc(h.heroEyebrow || '') + '</span><h1>' + title + '</h1>' +
      (h.heroText ? '<p>' + esc(h.heroText) + '</p>' : '') +
      (h.heroCta ? '<div><a class="btn" href="' + esc(safeUrl(h.heroLink || '#/catalog')) + '">' + esc(h.heroCta) + '</a></div>' : '') +
      '</div><div class="hero-media"><img src="' + esc(heroImg) + '" alt=""></div></section>';
    if (h.showCategories !== false && D.categories.length) {
      html += '<section class="section"><div class="wrap"><div class="section-head"><h2>Категории</h2><a class="link sh-more" href="#/catalog"><span>Весь каталог</span><i aria-hidden="true">' + ARROW + '</i></a></div><div class="cats">' +
        sortedCats().filter(function (c) { return gProducts().some(function (p) { return p.categoryId === c.id; }); }).map(function (c) { return '<a class="cat" href="#/catalog?cat=' + esc(c.slug) + '"><span class="cat-ph"><img src="' + esc(c.image || Art.make(c.art)) + '" alt="" loading="lazy"></span><span class="cat-cap"><span class="cat-name">' + esc(c.name) + '</span><svg class="cat-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M14 7l5 5-5 5"/></svg></span></a>'; }).join('') + '</div></div></section>';
    }
    if (h.showNew !== false) {
      var news = gProducts().filter(function (p) { return (p.tags || []).indexOf('new') !== -1; });
      // если новинок мало — дополняем последними поступлениями раздела, чтобы ряд не выглядел пустым
      if (news.length < 4) news = news.concat(gProducts().filter(function (p) { return news.indexOf(p) === -1; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })).slice(0, 4);
      news = news.slice(0, 8);
      if (news.length) html += '<section class="section"><div class="wrap"><div class="section-head"><h2>Новинки</h2><a class="link sh-more" href="#/catalog?tag=new"><span>Смотреть все</span><i aria-hidden="true">' + ARROW + '</i></a></div><div class="grid">' + news.map(card).join('') + '</div></div></section>';
    }
    if (h.showHits !== false) {
      var hits = hitList(gProducts()).slice(0, 8);
      // на телефоне — лента, которую листают пальцем; на компьютере — сетка
      if (hits.length) html += '<section class="section hits-sec"><div class="wrap"><div class="section-head"><h2>Хиты продаж</h2><a class="link sh-more" href="#/catalog?tag=hit"><span>Смотреть все</span><i aria-hidden="true">' + ARROW + '</i></a></div><div class="grid hits">' + hits.map(card).join('') + '</div></div></section>';
    }
    html += '<div id="recentHome"></div>';
    if (h.showBonus !== false) html += bonusBand(h);
    if (h.showSale !== false) {
      var ap = activePromos()[0];
      if (ap) html += dealBand(ap);
    }
    if (h.showEditorial !== false && h.editorialTitle) html += atelierBlock(h);
    if (h.showBenefits !== false && (h.benefits || []).length) html += benefitsBlock(h);
    v.innerHTML = html;
    initSlider();
    initHomeBlocks(v);
    drawRecent($('#recentHome', v), null);
  }

  /* ---------- Соберите образ: вещи, которые в панели отмечены «С этим носят» ---------- */
  function drawLook(box, p, mainSel) {
    var items = (p.look || []).map(function (id) { return D.products.find(function (x) { return x.id === id && x.id !== p.id && x.active !== false && totalStock(x) > 0; }); }).filter(Boolean).slice(0, 4);
    if (!box || !items.length) return;
    var all = [p].concat(items), st = all.map(function (x, i) { var c = shownColor(x); return { on: true, col: c, size: i === 0 ? null : ((c.sizes || []).filter(function (z) { return z.stock > 0; }).length === 1 ? c.sizes.find(function (z) { return z.stock > 0; }).size : null) }; });
    function sizesOf(i) { return (st[i].col.sizes || []).filter(function (z) { return z.stock > 0; }); }
    function draw() {
      var m = mainSel(); st[0].col = m.col; st[0].size = m.size;
      var chosen = all.filter(function (x, i) { return st[i].on; }), sum = chosen.reduce(function (t, x) { return t + priceOf(x).price; }, 0);
      var old = chosen.reduce(function (t, x) { var pr = priceOf(x); return t + (pr.oldPrice || pr.price); }, 0);
      box.innerHTML = '<section class="section look-sec"><div class="section-head"><h2>Соберите образ</h2></div><div class="look">' +
        '<div class="look-items">' + all.map(function (x, i) {
          var c = st[i].col, img = (c.images && c.images[0]) || Art.make(c.art), pr = priceOf(x), sz = i === 0 ? null : sizesOf(i);
          return '<div class="look-item' + (st[i].on ? '' : ' off') + '">' + (i ? '<span class="look-plus" aria-hidden="true">+</span>' : '') +
            '<a class="look-ph" href="#/product/' + esc(x.slug) + '"><img src="' + esc(img) + '" alt="" loading="lazy"><span class="look-tag">' + (i === 0 ? 'Эта вещь' : esc(c.name)) + '</span></a>' +
            '<div class="look-meta"><a class="look-name" href="#/product/' + esc(x.slug) + '">' + esc(x.name) + '</a><span class="look-price">' + (pr.oldPrice ? '<b class="sale">' + fmt(pr.price) + '</b><s>' + fmt(pr.oldPrice) + '</s>' : '<b>' + fmt(pr.price) + '</b>') + '</span>' +
            (i === 0 ? '<span class="look-hint">' + (st[0].size ? 'Размер ' + esc(st[0].size) : 'Размер — выше, в карточке') + '</span>'
              : '<div class="look-sizes" role="radiogroup" aria-label="Размер">' + sz.map(function (z) { return '<button type="button" class="look-sz' + (st[i].size === z.size ? ' on' : '') + '" data-li="' + i + '" data-lsz="' + esc(z.size) + '">' + esc(z.size) + '</button>'; }).join('') + '</div>' +
                '<button type="button" class="look-toggle" data-lt="' + i + '">' + (st[i].on ? 'Убрать из образа' : 'Вернуть в образ') + '</button>') +
            '</div></div>';
        }).join('') + '</div>' +
        '<aside class="look-sum"><span class="look-k">' + (chosen.length > 1 ? 'Образ из ' + chosen.length + ' ' + plural(chosen.length, 'вещи', 'вещей', 'вещей') : 'Одна вещь') + '</span>' +
          (old > sum ? '<s class="num">' + fmt(old) + '</s>' : '') + '<b class="num">' + fmt(sum) + '</b>' +
          '<button type="button" class="btn look-add"><span>Добавить образ в корзину</span><span class="bn-ic" aria-hidden="true">' + ARROW + '</span></button>' +
          '<p class="look-err" id="lookErr"></p></aside></div></section>';
    }
    draw();
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lsz]'); if (b) { st[+b.getAttribute('data-li')].size = b.getAttribute('data-lsz'); draw(); return; }
      var t = e.target.closest('[data-lt]'); if (t) { var i = +t.getAttribute('data-lt'); st[i].on = !st[i].on; draw(); return; }
      if (e.target.closest('.look-add')) {
        var m = mainSel(); st[0].col = m.col; st[0].size = m.size;
        var miss = all.filter(function (x, i) { return st[i].on && !st[i].size; });
        if (miss.length) {
          $('#lookErr').textContent = miss[0] === p ? 'Выберите размер этой вещи — в карточке выше' : 'Выберите размер: ' + miss.map(function (x) { return x.name; }).join(', ');
          if (miss[0] === p) { var sc = $('#sizeChips'); if (sc) { sc.scrollIntoView({ behavior: 'smooth', block: 'center' }); sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake'); } }
          return;
        }
        var added = 0;
        all.forEach(function (x, i) {
          if (!st[i].on) return;
          var z = (st[i].col.sizes || []).find(function (q) { return q.size === st[i].size; }), inCart = (Cart.find(x.id, st[i].col.id, st[i].size) || { qty: 0 }).qty;
          if (z && (z.stock > inCart || (x.preorder && z.stock <= 0))) { Cart.add(x.id, st[i].col.id, st[i].size, 1); added++; }
        });
        if (added) { toast(added > 1 ? 'Образ из ' + added + ' ' + plural(added, 'вещи', 'вещей', 'вещей') + ' — в корзине' : 'Добавили в корзину'); openCart(); }
        else toast('Эти вещи уже в корзине в максимальном количестве', true);
      }
    });
    // размер главной вещи выбирают в карточке — подхватываем
    ['#sizeChips', '#colorChips'].forEach(function (sel) { var el = $(sel); if (el) el.addEventListener('click', function () { setTimeout(draw, 0); }); });
  }

  /* ---------- Статистика: своя (без cookie) и Яндекс Метрика, если подключена в панели ---------- */
  var routeN = 0;
  // Один браузер — один посетитель в день (по Москве): сколько бы раз человек ни открывал сайт, вкладки
  // или приложение, заход, просмотр товара, корзина и оформление засчитываются ему один раз за день.
  // Свой номер браузера — случайный, без cookie и без данных о человеке; по нему сервер не засчитывает повторы.
  // Владелец магазина не считается: в браузере, где хоть раз входили в панель, статистика не отправляется.
  var statDay = function () { return new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10); };
  function statOff() {
    try {
      // Владелец: вошёл в админку в этом браузере или открыл ссылку с ?nostat=1 (для иконки на экране, Instagram, Telegram и других браузеров телефона)
      if (API.isAdmin || /[?&]nostat=1\b/.test(location.search)) localStorage.setItem('vanta:nostat', '1');
      if (/[?&]nostat=0\b/.test(location.search)) localStorage.removeItem('vanta:nostat');
      return localStorage.getItem('vanta:nostat') === '1' || /^#\/admin/.test(location.hash) || isAdminRoute(location.pathname.split('/')[1] || '');
    } catch (e) { return true; }
  }
  function statId() {
    var id = localStorage.getItem('vanta:sid');
    if (!/^[a-z0-9]{12,40}$/.test(id || '')) { id = (Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 24); localStorage.setItem('vanta:sid', id); }
    return id;
  }
  function stat(e, extra) {
    try {
      if (statOff()) return;
      var k = 'vanta:st2:' + e, day = statDay(); if (localStorage.getItem(k) === day) return; localStorage.setItem(k, day);
      fetch('api/t', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ e: e, id: statId() }, extra || {})) }).catch(function () {});
    } catch (ex) {} // хранилище браузера закрыто (частный режим с запретом) — не считаем вовсе, чтобы не считать дважды
  }
  // Просмотр страницы: каждое открытие страницы, без отсева повторов
  function statPage() {
    try {
      if (statOff()) return;
      fetch('api/t', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ e: 'pv', id: statId() }) }).catch(function () {});
    } catch (ex) {}
  }
  function trafficSource() {
    var q = new URLSearchParams(location.search), utm = (q.get('utm_source') || '').toLowerCase(), r = '';
    try { r = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    if (r === location.hostname) r = '';
    var t = utm + ' ' + r;
    if (/instagram|ig\b|l\.instagram/.test(t)) return 'instagram';
    if (/telegram|t\.me|tg\b/.test(t)) return 'telegram';
    if (/vk\.com|vk\b|vkontakte/.test(t)) return 'vk';
    if (/yandex|ya\.ru|dzen/.test(t)) return 'yandex';
    if (/google/.test(t)) return 'google';
    return t.trim() ? 'other' : 'direct';
  }
  function ecItem(p, colorName, size, qty, price) {
    var cat = catById(p.categoryId);
    return { id: p.id, name: p.name, price: price || priceOf(p).price, brand: D.settings.storeName || 'ALBAKOV', category: cat ? cat.name : '', variant: [colorName, size].filter(Boolean).join(' / '), quantity: qty || 1 };
  }
  function initAnalytics() {
    stat('v', { src: trafficSource(), m: window.matchMedia && matchMedia('(max-width: 760px)').matches ? 1 : 0 });
    var mk = D.settings.metrika || {};
    if (mk.id && window.Metrika) Metrika.init(mk.id, { webvisor: !!mk.webvisor });
    // добавление и удаление из корзины — для «Электронной коммерции» в Метрике
    var add = Cart.add, upd = Cart.update;
    Cart.add = function (pid, cid, size, qty) {
      add.apply(Cart, arguments); stat('c');
      var p = D.products.find(function (x) { return x.id === pid; }); if (p && window.Metrika) { Metrika.ec('add', [ecItem(p, Pricing.colorOf(p, cid).name, size, qty)]); Metrika.goal('cart'); }
    };
    Cart.update = function (pid, cid, size, qty) {
      var prev = Cart.find(pid, cid, size); upd.apply(Cart, arguments);
      var p = D.products.find(function (x) { return x.id === pid; });
      if (p && prev && window.Metrika) { if (qty < prev.qty) Metrika.ec('remove', [ecItem(p, Pricing.colorOf(p, cid).name, size, prev.qty - qty)]); else if (qty > prev.qty) Metrika.ec('add', [ecItem(p, Pricing.colorOf(p, cid).name, size, qty - prev.qty)]); }
    };
  }

  /* ---------- Вы недавно смотрели: последние 12 товаров, хранятся в браузере ---------- */
  var LS_RECENT = 'vanta:recent';
  function recentIds() { try { var a = JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function recentAdd(id) { try { localStorage.setItem(LS_RECENT, JSON.stringify([id].concat(recentIds().filter(function (x) { return x !== id; })).slice(0, 12))); } catch (e) {} }
  function drawRecent(box, exceptId) {
    if (!box) return;
    var list = recentIds().filter(function (id) { return id !== exceptId; }).map(function (id) { return D.products.find(function (p) { return p.id === id && p.active !== false; }); }).filter(Boolean).slice(0, 8);
    if (list.length < (exceptId ? 1 : 2)) { box.innerHTML = ''; return; }
    box.innerHTML = '<section class="section rv-sec"><div class="wrap"><div class="section-head"><h2>Вы недавно смотрели</h2><button type="button" class="link sh-more rv-clear"><span>Очистить</span><i aria-hidden="true">' + ICON.close + '</i></button></div>' +
      '<div class="rv-row">' + list.map(function (p) {
        var c0 = shownColor(p), img = (c0.images && c0.images[0]) || Art.make(c0.art), pr = priceOf(p);
        return '<a class="rv-card" href="#/product/' + esc(p.slug) + '"><span class="rv-ph"><img src="' + esc(img) + '" alt="" loading="lazy">' + favBtn(p.id) + '</span><span class="rv-name">' + esc(p.name) + '</span><span class="rv-price">' + (pr.oldPrice ? '<b class="sale">' + fmt(pr.price) + '</b><s>' + fmt(pr.oldPrice) + '</s>' : '<b>' + fmt(pr.price) + '</b>') + '</span></a>';
      }).join('') + '</div></div></section>';
    $('.rv-clear', box).addEventListener('click', function () { var prev = recentIds(); try { localStorage.removeItem(LS_RECENT); } catch (e) {} box.innerHTML = ''; toastUndo('История просмотров очищена', function () { try { localStorage.setItem(LS_RECENT, JSON.stringify(prev)); } catch (e) {} drawRecent(box, exceptId); }); });
  }

  /* Блок «Преимущества» на главной: карточки с объёмными иконками.
     Иконку можно выбрать в панели; если не выбрана — подбирается по заголовку, затем по описанию */
  var BENEFIT_ICONS = { delivery: '#1ab248', quality: '#e8b84a', fabric: '#c9925e', fitting: '#ff8b74', 'return': '#7b61ff', payment: '#16b5a5', gift: '#f0587c', cash: '#22b45a', pin: '#ff8b74', style: '#c9925e', gem: '#7b61ff', spool: '#ff8b74', mail: '#3e6bf0', chat: '#16b5a5', phone: '#1ab248' };
  var BENEFIT_WORDS = [[/доставк|курьер|сдэк|отправ/, 'delivery'], [/качеств|гаранти|провер/, 'quality'], [/ткан|материал|шерст|кашемир|хлоп|шёлк|шелк|лён|лен\b|трикотаж|пряж/, 'fabric'], [/примерк|подош|примерить/, 'fitting'], [/возврат|обмен|вернуть/, 'return'], [/оплат|карт|рассроч|сплит|долям/, 'payment'], [/подар|упаков/, 'gift']];
  function benefitIcon(b) {
    if (b.icon === 'none') return '';
    if (BENEFIT_ICONS.hasOwnProperty(b.icon)) return b.icon;
    var texts = [b.title, b.text];
    for (var t = 0; t < texts.length; t++) {
      var s = String(texts[t] || '').toLowerCase();
      for (var i = 0; i < BENEFIT_WORDS.length; i++) if (BENEFIT_WORDS[i][0].test(s)) return BENEFIT_WORDS[i][1];
    }
    return '';
  }
  // Короткие предлоги и союзы («в», «у», «по»…) не остаются в конце строки — привязываем к следующему слову
  function glue(s) { return esc(s).replace(/(^|[\s(«])([а-яёА-ЯЁ]{1,2})\s+/g, '$1$2\u00a0'); }
  function benefitsBlock(h) {
    var head = h.benefitsTitle ? '<div class="section-head"><div class="benefits-title">' + (h.benefitsEyebrow ? '<span class="eyebrow">' + esc(h.benefitsEyebrow) + '</span>' : '') + '<h2>' + glue(h.benefitsTitle) + '</h2></div></div>' : '';
    var nb = h.benefits.length;
    // последняя карточка растягивается на остаток ряда (первая занимает две колонки): 4 колонки на компьютере, 2 — на планшете
    var restLg = (nb + 1) % 4, restMd = (nb + 1) % 2;
    var lastSpan = ';--span-lg:' + (restLg ? 5 - restLg : 1) + ';--span-md:' + (restMd ? 2 : 1);
    var cards = h.benefits.map(function (b, i) {
      var ic = benefitIcon(b);
      return '<div class="benefit' + (ic ? '' : ' no-ico') + (b.link ? ' has-link' : '') + '" style="--i:' + i + (i === nb - 1 && nb >= 5 ? lastSpan : '') + (ic ? ';--glow:' + BENEFIT_ICONS[ic] : '') + '">' +
        (ic ? '<div class="benefit-ico"><img src="img/benefits/' + ic + '.webp?v=13.57.1" alt="" width="160" height="160" loading="lazy" decoding="async"></div>' : '') +
        '<div class="benefit-body"><h3>' + glue(b.title) + '</h3>' + (b.text ? '<p>' + glue(b.text) + '</p>' : '') +
        (b.link ? '<a class="benefit-more" href="' + esc(b.link) + '">' + esc(b.linkText || 'Подробнее') + '<span aria-hidden="true">→</span></a>' : '') + '</div></div>';
    }).join('');
    // много карточек — «бенто»: первая крупная на две колонки, остальные сеткой
    var n = h.benefits.length, cls = n >= 5 ? ' bento n' + n : '';
    return '<section class="section benefits-sec"><div class="wrap">' + head + '<div class="benefits' + cls + '">' + cards + '</div></div></section>';
  }

  /* Блок «Бонусная программа» на главной — коротко: процент, одна фраза, три шага, одна кнопка.
     Тексты — в «Главной странице», процент — в разделе «Бонусы» */
  function bonusBand(h) {
    var c = bonusCfg(); if (!c.earn) return '';
    var pct = String(c.percent).replace('.', ','), u = API.user;
    var title = esc(String(h.bonusTitle || 'Возвращаем бонусами').replace(/\{n\}/g, pct)).replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
    var steps = [
      ['Покупайте', pct + '% от суммы заказа возвращаем бонусами'],
      ['Копите', 'Бонусы приходят на счёт ' + (c.creditOn === 'done' ? 'после получения заказа' : 'после оплаты заказа')],
      ['Оплачивайте', 'До 100% стоимости покупки бонусами']
    ];
    var bal = u ? (u.bonus || 0) : 0;
    var act = u
      ? '<a class="btn loyal-btn" href="#/account?tab=bonus"><span>Открыть бонусный счёт</span><span class="db-ic" aria-hidden="true">' + ARROW + '</span></a>'
      : '<a class="btn loyal-btn" href="#/account?tab=register"><span>Присоединиться</span><span class="db-ic" aria-hidden="true">' + ARROW + '</span></a><span class="loyal-note">Регистрация займёт минуту</span>';
    var cardHtml = loyalCardHtml(u, bal);
    return '<section class="section loyal-sec"><div class="wrap"><div class="loyal">' +
      '<div class="loyal-copy">' +
        (h.bonusEyebrow ? '<span class="eyebrow loyal-eb"><i></i>' + esc(h.bonusEyebrow) + '</span>' : '') +
        '<h2><span class="sr">' + pct + '% — </span>' + title + '</h2>' +
        (h.bonusText ? '<p class="loyal-rate">' + esc(h.bonusText) + '</p>' : '') +
        '<ol class="loyal-steps">' + steps.map(function (x, i) { return '<li><span class="ls-n">' + (i + 1) + '</span><span class="ls-ic" aria-hidden="true">' + LOYAL_IC[i] + '</span><b>' + x[0] + '</b><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ol>' +
        '<div class="loyal-act">' + act + '</div>' +
      '</div>' +
      '<div class="loyal-visual">' + cardHtml + '</div>' +
    '</div></div></section>';
  }

  var LOYAL_IC = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18M7 15h4"/></svg>'
  ];

  /* Бонусная карта: знак бренда, процент, имя и баланс. Одна и та же — на главной и в кабинете */
  function loyalCardHtml(u, bal) {
    var c = bonusCfg(), pct = String(c.percent).replace('.', ',');
    var b = D.settings.brand || {}, mark = b.mark && b.mark.src ? '<img class="lc-mark" src="' + esc(b.mark.src) + '" alt="" width="' + (b.mark.w || 1) + '" height="' + (b.mark.h || 1) + '">' : '<span class="lc-word">' + esc(D.settings.storeName || '') + '</span>';
    var holder = u ? [u.firstName, u.lastName].filter(Boolean).join(' ') : '';
    return '<div class="loyal-card" aria-hidden="true"><i class="lc-sheen"></i>' +
      '<div class="lc-top">' + mark + '<span class="lc-label">Бонусный счёт</span></div>' +
      '<div class="lc-pct">' + (c.earn ? pct + '<span>%</span>' : '<span class="lc-sum">' + bonusNum(bal) + '</span>') + '</div>' +
      '<div class="lc-bottom"><span class="lc-holder">' + esc(holder || 'Ваше имя') + '</span><span class="lc-bal"><b>' + bonusNum(bal) + '</b> ' + bonusWord(bal) + '</span></div>' +
    '</div>';
  }
  // Наклон и блик карты за курсором (только мышь)
  function bindCardTilt(card) {
    var vis = card && card.parentNode;
    if (!card || !(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
    vis.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--rx', ((.5 - y) * 14).toFixed(2) + 'deg');
      card.style.setProperty('--ry', ((x - .5) * 18).toFixed(2) + 'deg');
      card.style.setProperty('--sx', (x * 100).toFixed(1) + '%');
      card.classList.add('live');
    });
    vis.addEventListener('pointerleave', function () { card.classList.remove('live'); card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); card.style.removeProperty('--sx'); });
  }

  /* Акция: тёмная карточка — метки, крупная скидка, обратный отсчёт, кнопка и вещи этой акции.
     Одна и та же на главной и на странице «Акции», чтобы блоки выглядели одинаково. */
  function dealCard(ap, home) {
    var pct = ap.type === 'percent';
    var off = pct ? '<span class="do-sign">−</span>' + ap.value + '<span class="do-pct">%</span>' : '−' + fmt(ap.value);
    var cats = ap.scope === 'categories' ? (ap.categoryIds || []).map(catById).filter(Boolean) : [];
    var scope = ap.scope === 'all' ? 'Весь каталог' : cats.length ? cats.map(function (c) { return c.name; }).join(', ') : 'Избранные модели';
    var inPromo = gProducts().filter(function (p) { return p.active !== false; }).map(function (p) { return { p: p, pr: priceOf(p) }; })
      .filter(function (x) { return x.pr.oldPrice && x.pr.promotion && x.pr.promotion.id === ap.id; });
    var items = inPromo.filter(function (x) { return totalStock(x.p) > 0; }).slice(0, 3);
    if (!items.length && home) items = gProducts().filter(function (p) { return p.active !== false; }).map(function (p) { return { p: p, pr: priceOf(p) }; }).filter(function (x) { return x.pr.oldPrice; }).slice(0, 3);
    var n = inPromo.length, href = cats.length === 1 ? '#/catalog?cat=' + encodeURIComponent(cats[0].slug) : home ? '#/sale' : '#/catalog?sale=1';
    var ends = ap.endsAt ? new Date(ap.endsAt + 'T23:59:59+03:00').getTime() : 0;
    var timer = ends ? '<div class="deal-timer" data-ends="' + ends + '" role="timer" aria-label="До конца акции">' +
      [['d', 'дней'], ['h', 'часов'], ['m', 'минут'], ['s', 'секунд']].map(function (u) { return '<span class="st-cell" data-c="' + u[0] + '"><b data-u="' + u[0] + '">00</b><i data-l="' + u[0] + '">' + u[1] + '</i></span>'; }).join('<span class="st-sep" aria-hidden="true">:</span>') + '</div>' : '';
    var tiles = items.map(function (x) {
      var c0 = shownColor(x.p), img = (c0.images && c0.images[0]) || Art.make(c0.art);
      var save = Math.round((1 - x.pr.price / x.pr.oldPrice) * 100);
      return '<a class="deal-item" href="#/product/' + esc(x.p.slug) + '"><span class="si-ph"><img src="' + esc(img) + '" alt="" loading="lazy">' +
        (save > 0 ? '<span class="si-badge">−' + save + '%</span>' : '') + '</span>' +
        '<span class="si-meta"><span class="si-name">' + esc(x.p.name) + '</span><span class="si-price"><b>' + fmt(x.pr.price) + '</b><s>' + fmt(x.pr.oldPrice) + '</s></span></span>' +
        '<span class="si-go" aria-hidden="true">' + ARROW + '</span></a>';
    }).join('');
    return '<div class="deal' + (tiles ? ' n' + items.length : ' no-items') + '">' +
      '<span class="deal-glow" aria-hidden="true"></span><span class="deal-rings" aria-hidden="true"><i></i><i></i><i></i></span><span class="deal-grain" aria-hidden="true"></span>' +
      '<div class="deal-copy">' +
        '<div class="deal-tags"><span class="deal-tag"><i></i>' + esc(scope) + '</span>' + (ap.endsAt ? '<span class="deal-tag soft">до ' + esc(fmtDate(ap.endsAt).replace(/ \d{4} г\.$/, '')) + '</span>' : '') + '</div>' +
        '<div class="deal-off' + (pct ? '' : ' is-money') + '" aria-label="Скидка ' + (pct ? ap.value + '%' : fmt(ap.value)) + '">' + off + '</div>' +
        '<h2>' + esc(ap.title) + '</h2>' +
        (ap.description ? '<p>' + esc(ap.description) + '</p>' : '') +
        timer +
        '<a class="btn deal-btn" href="' + esc(href) + '"><span>' + (n ? 'Смотреть ' + n + ' ' + plural(n, 'вещь', 'вещи', 'вещей') : 'Смотреть товары со скидкой') + '</span><span class="db-ic" aria-hidden="true">' + ARROW + '</span></a>' +
      '</div>' +
      (tiles ? '<div class="deal-items">' + tiles + '</div>' : '') +
    '</div>';
  }
  function dealBand(ap) { return '<section class="section deal-sec"><div class="wrap">' + dealCard(ap, true) + '</div></div></section>'; }
  var ARROW = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* «Ателье»: фото во всю левую половину экрана, заголовок заходит на фото и меняет цвет на его фоне */
  function atelierBlock(h) {
    var about = (D.pages || []).some(function (p) { return p.slug === 'about'; });
    return '<section class="section atelier-sec"><div class="wrap atelier">' +
      '<figure class="atelier-media"><img src="' + esc(h.editorialImage || Art.make(h.editorialArt)) + '" alt="" decoding="async"></figure>' +
      '<div class="atelier-copy">' +
        (h.editorialEyebrow ? '<span class="eyebrow">' + esc(h.editorialEyebrow) + '</span>' : '') +
        '<h2>' + esc(h.editorialTitle) + '</h2>' +
        (h.editorialText ? '<p>' + esc(h.editorialText) + '</p>' : '') +
        '<span class="atelier-seam" data-reveal aria-hidden="true"></span>' +
        (about ? '<a class="link" href="#/page/about">О бренде</a>' : '') +
      '</div>' +
    '</div></section>';
  }

  /* Оживление блоков главной: появление фото и шва при прокрутке, отсчёт акции, блик на бонусной карте */
  var dealTick = null;
  // Обратный отсчёт во всех блоках акций на странице
  function startDealTimers(v) {
    clearInterval(dealTick);
    var ts = $$('.deal-timer', v); if (!ts.length) return;
    var forms = { d: ['день', 'дня', 'дней'], h: ['час', 'часа', 'часов'], m: ['минута', 'минуты', 'минут'], s: ['секунда', 'секунды', 'секунд'] };
    var tick = function () {
      if (!document.body.contains(ts[0])) { clearInterval(dealTick); return; }
      ts.forEach(function (t) {
        var left = Math.max(0, Math.floor((Number(t.getAttribute('data-ends')) - Date.now()) / 1000));
        var vals = { d: Math.floor(left / 86400), h: Math.floor(left % 86400 / 3600), m: Math.floor(left % 3600 / 60), s: left % 60 };
        Object.keys(vals).forEach(function (k) {
          $('[data-u="' + k + '"]', t).textContent = (vals[k] < 10 ? '0' : '') + vals[k];
          $('[data-l="' + k + '"]', t).textContent = plural(vals[k], forms[k][0], forms[k][1], forms[k][2]);
        });
        t.classList.toggle('no-d', vals.d === 0); // когда остались часы, ячейка «дней» с нулём не нужна
      });
    };
    tick(); dealTick = setInterval(tick, 1000);
  }
  function initHomeBlocks(v) {
    // следим за секцией целиком: обрезанный (ещё невидимый) элемент наблюдатель не замечает
    var secs = $$('[data-reveal]', v).map(function (el) { return el.closest('section'); }).filter(function (s, i, a) { return s && a.indexOf(s) === i; });
    if ('IntersectionObserver' in window && secs.length) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { $$('[data-reveal]', e.target).forEach(function (el) { el.classList.add('in'); }); io.unobserve(e.target); } });
      }, { threshold: .2 });
      secs.forEach(function (s) { $$('[data-reveal]', s).forEach(function (el) { el.classList.add('rv-pre'); }); io.observe(s); });
    }
    startDealTimers(v);
    bindCardTilt($('.loyal-card', v));
  }

  /* ---------- Раздел закрыт: «скоро появится» ---------- */
  function soonPage(v) {
    var g = curGender(), cfg = (D.settings.genders || {})[g] || {};
    var other = Object.keys(GENDERS).find(function (k) { return k !== g && !gClosed(k); });
    var img = cfg.image || Art.make(g === 'women' ? { kind: 'dress', tone: '#4a4a4e' } : g === 'kids' ? { kind: 'tee', tone: '#5aa6e6' } : { kind: 'coat', tone: '#2e2e31' });
    var title = esc(cfg.title || (GENDERS[g] + ' — скоро')).replace(/\*(.+?)\*/g, '<em>$1</em>');
    v.innerHTML = '<section class="soon"><div class="soon-media"><img src="' + esc(img) + '" alt=""></div><div class="soon-in">' +
      '<span class="eyebrow">' + esc(GENDERS[g]) + '</span><h1 class="soon-title">' + title + '</h1>' + (cfg.text ? '<p class="soon-text">' + esc(cfg.text) + '</p>' : '') +
      '<div class="slide-actions">' + (other ? '<button class="sbtn sbtn-primary" data-gender-go="' + other + '">Смотреть «' + GENDERS[other] + '»<span class="sbtn-arrow" aria-hidden="true"></span></button>' : '') +
      '<button class="sbtn sbtn-line" data-gender-go="all">Вся коллекция<span class="sbtn-arrow" aria-hidden="true"></span></button></div></div></section>';
  }

  /* Поиск по словам (аудит 16.11, M-8): лишние пробелы и регистр не важны, слова — в любом порядке, ё = е.
     Так же ищет приложение. «оверсайз пальто» найдёт «Пальто оверсайз». */
  function searchWords(q) { return String(q || '').toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean); }
  function textHas(text, words) { var t = String(text || '').toLowerCase().replace(/ё/g, 'е'); return words.every(function (w) { return t.indexOf(w) !== -1; }); }

  /* ---------- Каталог ---------- */
  var SORTS = { popular: 'По умолчанию', new: 'Сначала новые', cheap: 'Сначала дешевле', expensive: 'Сначала дороже' };
  function catalog(v, parts, q) {
    var st = { cat: q.cat || '', tag: q.tag || '', sizes: q.size ? q.size.split(',') : [], colors: q.color ? q.color.split(',') : [], min: q.min || '', max: q.max || '', sale: q.sale === '1', sort: q.sort || 'popular', q: (q.q || '').trim().replace(/\s+/g, ' ') };
    var cat = D.categories.find(function (c) { return c.slug === st.cat; });
    var title = st.q ? 'Поиск: ' + st.q : cat ? cat.name : st.tag === 'new' ? 'Новинки' : st.tag === 'hit' ? 'Хиты продаж' : 'Каталог';
    var gLabel = curGender() ? GENDERS[curGender()] : 'Вся коллекция';
    v.innerHTML = '<div class="wrap"><div class="page-head"><div class="crumbs"><a href="#/">Главная</a><span>/</span><a href="#/catalog">Каталог</a>' + (cat ? '<span>/</span><span>' + esc(cat.name) + '</span>' : '') + '</div><span class="eyebrow">' + esc(gLabel) + '</span><h1>' + esc(title) + '</h1></div>' +
      '<div class="catalog"><aside class="filters" id="filters"></aside><div><div class="toolbar"><span class="muted num" id="found"></span><div style="display:flex;gap:8px"><button class="btn ghost sm only-m" id="openFilters">' + 'Фильтры' + '</button><select class="select" id="sort" aria-label="Сортировка">' + Object.keys(SORTS).map(function (k) { return '<option value="' + k + '"' + (k === st.sort ? ' selected' : '') + '>' + SORTS[k] + '</option>'; }).join('') + '</select></div></div><div class="active-filters" id="activeFilters"></div><div class="grid three" id="results"></div></div></div></div>';

    function allColors() { var out = []; gProducts().forEach(function (p) { Pricing.colorsOf(p).forEach(function (c) { if (!out.some(function (x) { return x.name.toLowerCase() === c.name.toLowerCase(); })) out.push(c); }); }); return out; }
    function allSizes() { var set = []; gProducts().forEach(function (p) { Pricing.colorsOf(p).forEach(function (cc) { (cc.sizes || []).forEach(function (s) { if (set.indexOf(s.size) === -1) set.push(s.size); }); }); }); var order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']; return set.sort(function (a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); if (ia !== -1 && ib !== -1) return ia - ib; if (!isNaN(a) && !isNaN(b)) return a - b; return ia === -1 ? 1 : -1; }); }
    // Размеры в фильтре: буквенные (XS–XXL), цифровые (44, 46…) и остальные (например, «Единый») — отдельными группами
    function sizeFilterHtml() {
      var groups = [['Буквенный', []], ['Цифровой', []], ['Другие', []]];
      allSizes().forEach(function (x) { groups[/^\d*X*[SML]$/i.test(x) ? 0 : /^\d+([.,/-]\d+)?$/.test(x) ? 1 : 2][1].push(x); });
      groups = groups.filter(function (g) { return g[1].length; });
      if (!groups.length) return '';
      return '<div><h4>Размер</h4><div class="sz-groups">' + groups.map(function (g) {
        return '<div class="sz-group"><span class="sz-label">' + g[0] + '</span><div class="sz-grid">' + g[1].map(function (x) {
          var on = st.sizes.indexOf(x) !== -1;
          return '<button class="sz' + (on ? ' on' : '') + (x.length > 4 ? ' wide' : '') + '" data-size="' + esc(x) + '" aria-pressed="' + on + '">' + esc(x) + '</button>';
        }).join('') + '</div></div>';
      }).join('') + '</div></div>';
    }
    function filtersHtml() {
      var gCount = function (g) { return D.products.filter(function (p) { return onSale(p) && Pricing.forGender(p, g); }).length; };
      var inSection = gProducts();
      var cats = sortedCats().map(function (c) { return { c: c, n: inSection.filter(function (p) { return p.categoryId === c.id; }).length }; }).filter(function (x) { return x.n || st.cat === x.c.slug; });
      return (openGenders().length > 1 ? '<div><h4>Раздел</h4><div class="fl-list">' +
          flItem('data-gsel="all"', 'Вся коллекция', gCount(''), !curGender()) +
          openGenders().map(function (g) { return flItem('data-gsel="' + g + '"', GENDERS[g], gCount(g), curGender() === g); }).join('') + '</div></div>' : '') +
        '<div><h4>Категория</h4><div class="fl-list">' + flItem('data-cat=""', 'Все товары', inSection.length, !st.cat) +
          cats.map(function (x) { return flItem('data-cat="' + esc(x.c.slug) + '"', esc(x.c.name), x.n, st.cat === x.c.slug); }).join('') + '</div></div>' +
        sizeFilterHtml() +
        (function () { var cs = allColors(); return cs.length > 1 ? '<div><h4>Цвет</h4><div class="color-filter">' + cs.map(function (c) { var k = c.name.toLowerCase(), on = st.colors.indexOf(k) !== -1; return '<button class="cf' + (on ? ' on' : '') + '" data-colorf="' + esc(k) + '" aria-pressed="' + on + '"><span class="sw" style="' + swatchStyle(c) + '"></span>' + esc(c.name) + '</button>'; }).join('') + '</div></div>' : ''; })() +
        '<div><h4>Цена, ₽</h4><div class="price-range"><input class="input num" inputmode="numeric" placeholder="от" data-min value="' + esc(st.min) + '" aria-label="Цена от"><input class="input num" inputmode="numeric" placeholder="до" data-max value="' + esc(st.max) + '" aria-label="Цена до"></div></div>' +
        '<div class="fl-list"><label class="check"><input type="checkbox" data-sale' + (st.sale ? ' checked' : '') + '> Только со скидкой</label><label class="check"><input type="checkbox" data-new' + (st.tag === 'new' ? ' checked' : '') + '> Только новинки</label></div>' +
        '<button class="link muted" style="justify-self:start;font-size:14px" data-reset>Сбросить фильтры</button>';
    }
    // Пункт фильтра: название и число товаров; выбранный — с подложкой и бронзовой чертой
    function flItem(attr, label, count, on) { return '<button class="fl-item' + (on ? ' on' : '') + '" ' + attr + ' aria-pressed="' + on + '"><span>' + label + '</span><em>' + count + '</em></button>'; }
    function bind(box) {
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-gsel')) { closePanels(); setGender(b.getAttribute('data-gsel')); }
        else if (b.hasAttribute('data-cat')) { st.cat = b.getAttribute('data-cat'); sync(true); }
        else if (b.hasAttribute('data-size')) { var s = b.getAttribute('data-size'), i = st.sizes.indexOf(s); if (i === -1) st.sizes.push(s); else st.sizes.splice(i, 1); sync(); }
        else if (b.hasAttribute('data-colorf')) { var k = b.getAttribute('data-colorf'), j = st.colors.indexOf(k); if (j === -1) st.colors.push(k); else st.colors.splice(j, 1); sync(); }
        else if (b.hasAttribute('data-reset')) { st = { cat: '', tag: '', sizes: [], colors: [], min: '', max: '', sale: false, sort: st.sort, q: '' }; sync(true); }
      });
      box.addEventListener('change', function (e) {
        if (e.target.hasAttribute('data-sale')) st.sale = e.target.checked;
        if (e.target.hasAttribute('data-new')) st.tag = e.target.checked ? 'new' : '';
        if (e.target.hasAttribute('data-min')) st.min = e.target.value.replace(/\D/g, '');
        if (e.target.hasAttribute('data-max')) st.max = e.target.value.replace(/\D/g, '');
        sync();
      });
    }
    function sync(full) {
      var qs = [];
      if (st.cat) qs.push('cat=' + encodeURIComponent(st.cat));
      if (st.tag) qs.push('tag=' + st.tag);
      if (st.sizes.length) qs.push('size=' + encodeURIComponent(st.sizes.join(',')));
      if (st.colors.length) qs.push('color=' + encodeURIComponent(st.colors.join(',')));
      if (st.min) qs.push('min=' + st.min);
      if (st.max) qs.push('max=' + st.max);
      if (st.sale) qs.push('sale=1');
      if (st.sort !== 'popular') qs.push('sort=' + st.sort);
      if (st.q) qs.push('q=' + encodeURIComponent(st.q));
      var h = '#/catalog' + (qs.length ? '?' + qs.join('&') : '');
      if (full) { go(h); return; }
      try { history.replaceState(null, '', toPath(h)); } catch (e) {}
      draw();
    }
    function draw() {
      var list = gProducts().filter(function (p) {
        var c = catById(p.categoryId);
        if (st.cat && (!c || c.slug !== st.cat)) return false;
        if (st.tag === 'hit' ? !isHit(p) : st.tag && (p.tags || []).indexOf(st.tag) === -1) return false;
        var cols = Pricing.colorsOf(p).filter(function (c) { return !st.colors.length || st.colors.indexOf(c.name.toLowerCase()) !== -1; });
        if (!cols.length) return false;
        if (st.sizes.length && !cols.some(function (c) { return (c.sizes || []).some(function (s) { return st.sizes.indexOf(s.size) !== -1 && s.stock > 0; }); })) return false;
        var pr = priceOf(p);
        if (st.min && pr.price < +st.min) return false;
        if (st.max && pr.price > +st.max) return false;
        if (st.sale && !pr.onSale) return false;
        if (st.q && !textHas(p.name + ' ' + (p.sku || '') + ' ' + (p.description || '') + ' ' + colorNames(p) + ' ' + (c ? c.name : ''), searchWords(st.q))) return false;
        return true;
      });
      if (st.tag === 'hit' && st.sort === 'popular') list = hitList(list);
      if (st.sort === 'new') list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      if (st.sort === 'cheap') list.sort(function (a, b) { return priceOf(a).price - priceOf(b).price; });
      if (st.sort === 'expensive') list.sort(function (a, b) { return priceOf(b).price - priceOf(a).price; });
      list.sort(function (a, b) { return (totalStock(a) === 0) - (totalStock(b) === 0); });
      $('#found').textContent = list.length + ' ' + plural(list.length, 'товар', 'товара', 'товаров');
      $('#results').innerHTML = list.length ? list.map(card).join('') : '<div class="empty" style="grid-column:1/-1"><h3>Ничего не нашлось</h3><p>Попробуйте изменить фильтры</p></div>';
      // Выбранные фильтры — чипами над товарами, каждый снимается одним нажатием
      var chips = [];
      if (cat) chips.push(['cat', cat.name]);
      if (st.tag === 'new') chips.push(['tag', 'Новинки']);
      if (st.tag === 'hit') chips.push(['tag', 'Хиты продаж']);
      if (st.sale) chips.push(['sale', 'Со скидкой']);
      st.sizes.forEach(function (x) { chips.push(['size:' + x, 'Размер ' + x]); });
      st.colors.forEach(function (x) { chips.push(['color:' + x, x.charAt(0).toUpperCase() + x.slice(1)]); });
      if (st.min || st.max) chips.push(['price', (st.min ? 'от ' + fmt(st.min) : '') + (st.min && st.max ? ' ' : '') + (st.max ? 'до ' + fmt(st.max) : '')]);
      if (st.q) chips.push(['q', '«' + st.q + '»']);
      $('#activeFilters').innerHTML = chips.length ? chips.map(function (c) { return '<button class="af-chip" data-af="' + esc(c[0]) + '">' + esc(c[1]) + '<i aria-hidden="true"></i><span class="sr">Убрать фильтр</span></button>'; }).join('') + (chips.length > 1 ? '<button class="af-clear" data-af="all">Сбросить всё</button>' : '') : '';
      var f = $('#filters'); f.innerHTML = filtersHtml();
      var m = $('#menuFilters'); if (m) m.innerHTML = filtersHtml() + '<button class="btn block" data-act="close">Показать ' + list.length + '</button>';
    }
    bind($('#filters'));
    $('#activeFilters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-af]'); if (!b) return;
      var k = b.getAttribute('data-af'), full = false;
      if (k === 'all') { st = { cat: '', tag: '', sizes: [], colors: [], min: '', max: '', sale: false, sort: st.sort, q: '' }; full = true; }
      else if (k === 'cat') { st.cat = ''; full = true; }
      else if (k === 'tag') st.tag = '';
      else if (k === 'sale') st.sale = false;
      else if (k === 'price') { st.min = ''; st.max = ''; }
      else if (k === 'q') { st.q = ''; full = true; }
      else if (k.indexOf('size:') === 0) st.sizes = st.sizes.filter(function (x) { return x !== k.slice(5); });
      else if (k.indexOf('color:') === 0) st.colors = st.colors.filter(function (x) { return x !== k.slice(6); });
      sync(full);
    });
    $('#sort').addEventListener('change', function (e) { st.sort = e.target.value; sync(); });
    $('#openFilters').addEventListener('click', function () {
      openModal('<h3 class="serif" style="font-size:32px;margin-bottom:24px">Фильтры</h3><div class="filters" id="menuFilters" style="position:static"></div>');
      bind($('#menuFilters')); draw();
    });
    draw();
  }

  /* ---------- Товар ---------- */
  function product(v, parts, q) {
    var p = productBySlug(parts[1]);
    if (!p) return notFound(v);
    var colors = Pricing.colorsOf(p), notifyOn = ((D.settings.notify || {}).enabled) !== false; // «Сообщить о поступлении» включено, пока его не выключили в панели
    var pr = priceOf(p), cat = catById(p.categoryId);
    // Цвет: из адреса, иначе первый, где что-то есть в наличии
    var col = colors.find(function (c) { return c.id === q.color; }) || colors.find(function (c) { return Pricing.stockOf(c) > 0; }) || colors[0];
    var sel = null, qty = 1;
    var pre = p.preorder && Pricing.preorderLeft(p) > 0, preLeft = Pricing.preorderLeft(p);
    function preDate() { return p.preorderShip ? fmtDate(p.preorderShip).replace(/ \d{4} г\.$/, '') : ''; }
    var related = gProducts().filter(function (x) { return x.id !== p.id && x.categoryId === p.categoryId; }).concat(gProducts().filter(function (x) { return x.id !== p.id && x.categoryId !== p.categoryId; })).slice(0, 4);
    var delivPage = D.pages.find(function (x) { return x.slug === 'delivery'; });

    v.innerHTML = '<div class="wrap"><div class="page-head" style="padding-bottom:20px"><div class="crumbs"><a href="#/">Главная</a><span>/</span><a href="#/catalog">Каталог</a>' + (cat ? '<span>/</span><a href="#/catalog?cat=' + esc(cat.slug) + '">' + esc(cat.name) + '</a>' : '') + '</div></div>' +
      '<div class="product"><div id="galleryBox"></div>' +
      '<div class="pinfo"><div style="display:grid;gap:14px">' + (function () { var b = badgeHtml(p, pr); return b.length ? '<div class="badges-row">' + b.join('') + '</div>' : ''; })() + '<h1>' + esc(p.name) + '</h1>' + (p.sku ? '<span class="p-sku">Арт. <b class="copyable">' + esc(p.sku) + '</b></span>' : '') + specsSummaryHtml(p) + priceHtml(pr) +
        (Pricing.bonusFor(pr.price, D.settings) > 0 ? '<div class="p-bonus">' + bonusLine(pr.price, 'p-bonus-n') + '<span class="muted">за покупку · 1 бонус = 1 ₽. Начислим на бонусный счёт ' + (bonusCfg().creditOn === 'done' ? 'после получения заказа' : 'после оплаты') + ', потратить можно на следующие покупки — хоть все сразу' + (API.user ? '' : '. Нужен <a class="link" href="#/account">личный кабинет</a>') + '</span></div>' : '') +
        (pr.promotion ? '<span class="promo-note">Акция «' + esc(pr.promotion.title) + '»' + (pr.promotion.endsAt ? ' до ' + esc(fmtDate(pr.promotion.endsAt)) : '') + '</span>' : '') +
        (pre ? '<div class="pre-box"><div class="pre-top"><b>Предзаказ</b>' + (p.preorderShip ? '<span>отправим ' + esc(preDate()) + '</span>' : '') + '</div>' +
          (preLeft !== Infinity ? '<span class="pre-bar"><i style="width:' + Math.min(100, Math.round((p.preorderSold || 0) / Number(p.preorderLimit) * 100)) + '%"></i></span><span class="pre-left">' + ((p.preorderSold || 0) ? 'Осталось ' + preLeft + ' ' + plural(preLeft, 'место', 'места', 'мест') + ' из ' + Number(p.preorderLimit) : 'В партии ' + Number(p.preorderLimit) + ' ' + plural(Number(p.preorderLimit), 'место', 'места', 'мест')) + '</span>' : '') +
          '<p>Размеры, которых нет в наличии, можно заказать заранее. Если не успеем к сроку — напишем и вернём деньги, если захотите.</p></div>' : '') + '</div>' +
      '<div><div class="opt-head"><span>Цвет: <b class="color-name" id="colorName"></b></span>' + (colors.length > 1 ? '<span class="muted" style="font-size:13px">' + colors.length + ' ' + plural(colors.length, 'цвет', 'цвета', 'цветов') + '</span>' : '') + '</div>' +
        '<div class="swatch-row" id="colorChips" role="radiogroup" aria-label="Цвет">' + colors.map(function (c) {
          var out = Pricing.stockOf(c) === 0;
          return '<button class="swatch-btn' + (out ? ' out' : '') + '" role="radio" data-color="' + esc(c.id) + '" title="' + esc(c.name) + (out ? ' — нет в наличии' : '') + '" aria-label="' + esc(c.name) + (out ? ', нет в наличии' : '') + '"><span class="sw" style="' + swatchStyle(c) + '"></span></button>';
        }).join('') + '</div></div>' +
      '<div><div class="opt-head"><span>Размер</span>' + (sizeTableRows(p).length ? '<button class="link" style="font-size:14px" id="openChart">Таблица размеров</button>' : '') + '</div>' +
        '<div class="chips" id="sizeChips"></div><p class="stock-note" id="stockNote" style="margin-top:10px"></p>' + fitToolsHtml(p) + '<div id="fitCheck" aria-live="polite"></div></div>' +
      '<div class="sticky-buy"><div class="buy-row"><div class="qty"><button data-q="-1" aria-label="Меньше">−</button><span id="qty">1</span><button data-q="1" aria-label="Больше">+</button></div><button class="btn" id="addBtn">Добавить в корзину</button></div></div>' +
      '<div class="buy-more"><button type="button" class="btn ghost buy-now" id="buyNow"><span>Купить сейчас</span><span class="bn-ic" aria-hidden="true">' + ARROW + '</span></button>' +
        '<button type="button" class="fav-btn fav-wide' + (Fav.has(p.id) ? ' on' : '') + '" data-fav="' + esc(p.id) + '" aria-pressed="' + Fav.has(p.id) + '" aria-label="' + (Fav.has(p.id) ? 'Убрать из избранного' : 'В избранное') + '">' + ICON.heart + '<span class="fav-t">' + (Fav.has(p.id) ? 'В избранном' : 'В избранное') + '</span></button></div>' +
      '<div id="pShip"></div>' + fitGuaranteeHtml() +
      '<div class="acc p-acc">' +
        (p.description ? '<details open>' + accSum('text', 'Описание', '') + '<div class="body p-desc">' + esc(p.description) + '</div></details>' : '') +
        specsHtml(p) +
        (delivPage ? '<details>' + accSum('box', 'Доставка и возврат', 'СДЭК по России · возврат 14 дней') + '<div class="body prose p-deliv">' + md(delivPage.body) + '</div></details>' : '') +
      '</div></div></div>' +
      '<div id="lookBox"></div>' +
      (related.length ? '<section class="section" style="border-top:1px solid var(--line)"><div class="section-head"><h2>Вам может понравиться</h2></div><div class="grid">' + related.map(card).join('') + '</div></section>' : '') + '</div>' +
      '<div id="recentBox"></div>';
    drawRecent($('#recentBox', v), p.id); recentAdd(p.id);
    stat('p'); if (window.Metrika) Metrika.ec('detail', [ecItem(p, (shownColor(p) || {}).name)]);
    drawLook($('#lookBox', v), p, function () { return { col: col, size: sel }; });

    function sizeOf() { return (col.sizes || []).find(function (x) { return x.size === sel; }); }
    function drawGallery() {
      var imgs = (col.images && col.images.length) ? col.images : [Art.make(col.art)];
      var alt = p.name + ', ' + col.name;
      $('#galleryBox').innerHTML = '<div class="gallery"><div class="thumbs">' + (imgs.length > 1 ? imgs.map(function (src, i) { return '<button data-i="' + i + '"' + (i === 0 ? ' class="on"' : '') + ' aria-label="Фото ' + (i + 1) + '"><img src="' + esc(src) + '" alt=""></button>'; }).join('') : '') + '</div>' +
        '<div class="main-img"><img id="mainImg" src="' + esc(imgs[0]) + '" alt="' + esc(alt) + '"></div>' +
        '<div class="slides" id="slides">' + imgs.map(function (src) { return '<img src="' + esc(src) + '" alt="' + esc(alt) + '">'; }).join('') + '</div></div>' +
        (imgs.length > 1 ? '<div class="dots" id="dots">' + imgs.map(function (x, i) { return '<i' + (i === 0 ? ' class="on"' : '') + '></i>'; }).join('') + '</div>' : '');
      $$('.thumbs button').forEach(function (b) { b.addEventListener('click', function () {
        var im = $('#mainImg'); im.classList.add('swap');
        setTimeout(function () { im.src = imgs[+b.getAttribute('data-i')]; im.classList.remove('swap'); }, 180);
        $$('.thumbs button').forEach(function (x) { x.classList.toggle('on', x === b); });
      }); });
      // Лупа: на компьютере фото увеличивается под курсором
      var mi = $('.main-img');
      if (mi && window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
        mi.addEventListener('mouseenter', function () { mi.classList.add('zoom'); });
        mi.addEventListener('mouseleave', function () { mi.classList.remove('zoom'); });
        mi.addEventListener('mousemove', function (e) { var r = mi.getBoundingClientRect(); $('#mainImg').style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%'; });
      }
      var sl = $('#slides'); if (sl && $('#dots')) sl.addEventListener('scroll', function () { var i = Math.round(sl.scrollLeft / sl.clientWidth); $$('#dots i').forEach(function (d, k) { d.classList.toggle('on', k === i); }); }, { passive: true });
    }
    function drawOptions() {
      $('#colorName').textContent = col.name;
      $$('#colorChips .swatch-btn').forEach(function (b) { var on = b.getAttribute('data-color') === col.id; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      var sizes = col.sizes || [], avail = sizes.filter(function (s) { return s.stock > 0; });
      var cur = sizeOf(); if (!cur || (cur.stock <= 0 && !notifyOn && !pre)) sel = null;
      if (!sel && sizes.length === 1 && avail.length) sel = sizes[0].size;
      $('#sizeChips').innerHTML = sizes.map(function (s) {
        var out = s.stock <= 0;
        if (out && pre) return '<button class="chip preo' + (sel === s.size ? ' on' : '') + '" data-size="' + esc(s.size) + '" title="Предзаказ' + (preDate() ? ', отправим ' + esc(preDate()) : '') + '">' + esc(s.size) + '</button>';
        return '<button class="chip' + (out ? ' out' : '') + (!out && bagged(s.size) >= s.stock ? ' in-bag' : '') + (sel === s.size ? ' on' : '') + '" data-size="' + esc(s.size) + '"' +
          (out ? (notifyOn ? ' title="Нет в наличии — можно подписаться на поступление" aria-label="' + esc(s.size) + ' — нет в наличии"' : ' disabled title="Нет в наличии" aria-label="' + esc(s.size) + ' — нет в наличии"') : '') + '>' + esc(s.size) + '</button>';
      }).join('');
      note();
    }
    // Кнопка: «Добавить в корзину» или «Сообщить о поступлении», если выбранного размера или всего цвета нет
    /* Сколько этого цвета и размера уже в корзине (13.64.8): склад списывается только при заказе,
       поэтому «осталось» считаем за вычетом корзины */
    function bagged(size) { return size ? (Cart.find(p.id, col.id, size) || { qty: 0 }).qty : 0; }
    function fullBag() { var s = sizeOf(); return !!s && s.stock > 0 && bagged(s.size) >= s.stock; }
    function waitMode() { if (pre) return false; var s = sizeOf(), anyAvail = (col.sizes || []).some(function (x) { return x.stock > 0; }); return notifyOn && ((s && s.stock <= 0) || !anyAvail); }
    function preMode() { var s = sizeOf(), anyAvail = (col.sizes || []).some(function (x) { return x.stock > 0; }); return pre && ((s && s.stock <= 0) || (!s && !anyAvail)); }
    function updateBtn() {
      var btn = $('#addBtn'), anyAvail = (col.sizes || []).some(function (x) { return x.stock > 0; }), wait = waitMode();
      btn.disabled = !anyAvail && !notifyOn && !pre;
      btn.classList.toggle('ghost', wait);
      btn.textContent = wait ? 'Сообщить о поступлении' : fullBag() ? 'Уже в корзине · перейти' : preMode() ? 'Оформить предзаказ' : anyAvail ? 'Добавить в корзину' : 'Нет в наличии в этом цвете';
      $('.buy-row .qty').hidden = wait || fullBag();
      $('#buyNow').hidden = wait || (!anyAvail && !pre);
    }
    var fcLast = null;
    function drawFitCheck() {
      var box = $('#fitCheck'); if (!box) return;
      var key = col.id + '|' + sel + '|' + JSON.stringify(fitSaved()); if (key === fcLast) return;
      var changed = fcLast !== null; fcLast = key;
      box.innerHTML = fitCheckHtml(p, col, sel);
      var fc = box.firstChild; if (fc && changed) { fc.classList.remove('fc-in'); void fc.offsetWidth; fc.classList.add('fc-in'); }
    }
    function note() {
      var n = $('#stockNote'), s = sizeOf(), anyAvail = (col.sizes || []).some(function (x) { return x.stock > 0; });
      n.className = 'stock-note'; updateBtn(); drawFitCheck();
      if (pre && s && s.stock <= 0) { n.textContent = 'Предзаказ' + (preDate() ? ' · отправим ' + preDate() : '') + (preLeft !== Infinity ? ' · осталось ' + preLeft + ' ' + plural(preLeft, 'место', 'места', 'мест') : ''); n.classList.add('pre'); if (preLeft !== Infinity && qty > preLeft) { qty = preLeft; $('#qty').textContent = qty; } return; }
      if (pre && !s) { n.textContent = 'Выберите размер'; return; }
      if (!anyAvail && (!s || s.stock <= 0)) { n.textContent = notifyOn ? 'Этого цвета сейчас нет. Оставьте почту — напишем, когда он появится.' : (colors.length > 1 ? 'Посмотрите другие цвета' : ''); return; }
      if (!s) { n.textContent = 'Выберите размер'; return; }
      if (s.stock <= 0) { n.textContent = 'Размера ' + s.size + ' сейчас нет. Можем сообщить на почту, когда он появится.'; n.classList.add('low'); return; }
      var inBag = bagged(s.size), l = s.stock - inBag;
      if (l <= 0) n.textContent = s.stock === 1 ? 'Последний размер ' + s.size + ' уже в вашей корзине' : 'Все ' + s.stock + ' шт. размера ' + s.size + ' уже в вашей корзине';
      else if (l <= 2) { n.textContent = 'Осталось ' + l + ' шт.' + (inBag ? ' · ещё ' + inBag + ' в вашей корзине' : ''); n.classList.add('low'); }
      else n.textContent = inBag ? 'В наличии · ' + inBag + ' шт. уже в корзине' : 'В наличии';
      if (qty > Math.max(1, l)) { qty = Math.max(1, l); $('#qty').textContent = qty; }
    }
    drawGallery(); drawOptions();
    $('#colorChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-color]'); if (!b) return;
      var next = colors.find(function (c) { return c.id === b.getAttribute('data-color'); }); if (!next || next === col) return;
      col = next; qty = 1; $('#qty').textContent = 1; drawGallery(); drawOptions();
      try { history.replaceState(null, '', '/product/' + p.slug + '?color=' + encodeURIComponent(col.id)); } catch (ex) {}
    });
    $('#sizeChips').addEventListener('click', function (e) { var b = e.target.closest('[data-size]'); if (!b || b.disabled) return; sel = b.getAttribute('data-size'); $$('#sizeChips .chip').forEach(function (c) { c.classList.toggle('on', c === b); }); note(); });
    $$('[data-q]').forEach(function (b) { b.addEventListener('click', function () { var s = sizeOf(); var max = s ? (s.stock > 0 ? Math.max(1, s.stock - bagged(s.size)) : pre ? (preLeft === Infinity ? 99 : preLeft) : 0) : 99; qty = Math.max(1, Math.min(max, qty + Number(b.getAttribute('data-q')))); $('#qty').textContent = qty; }); });
    // Нет размера: показать, где его выбрать. На телефоне размеры часто ниже края экрана — прокручиваем к ним (аудит N-1, 16.11)
    function askSize() {
      var n = $('#stockNote'); n.textContent = 'Сначала выберите размер'; n.className = 'stock-note low';
      var sc = $('#sizeChips'); if (!sc) return;
      var r = sc.getBoundingClientRect(), bar = document.querySelector('.sticky-buy'), bottom = bar ? bar.getBoundingClientRect().top : innerHeight;
      if (r.top < 70 || r.bottom > bottom - 10) sc.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake');
    }
    $('#addBtn').addEventListener('click', function () {
      if (waitMode()) { openNotify(p, col, sel); return; }
      if (!sel) { askSize(); return; }
      var s = sizeOf(), inCart = (Cart.find(p.id, col.id, sel) || { qty: 0 }).qty;
      if (fullBag()) { openCart(); return; }
      if (pre && s.stock <= 0) { if (preLeft !== Infinity && inCart + qty > preLeft) { toast('По предзаказу осталось ' + preLeft + ' ' + plural(preLeft, 'место', 'места', 'мест'), true); return; } }
      else if (inCart + qty > s.stock) { toast('Можно добавить ещё ' + (s.stock - inCart) + ' шт. — ' + inCart + ' уже в корзине', true); return; }
      Cart.add(p.id, col.id, sel, qty);
      drawOptions();   // размер мог целиком уйти в корзину — значок на размере и «Уже в корзине»
      var ab = $('#addBtn'); ab.classList.add('done'); ab.textContent = 'Добавлено';
      setTimeout(function () { if (document.body.contains(ab)) { ab.classList.remove('done'); updateBtn(); } }, 1600);
      openCart();
    });
    // «Купить сейчас»: оформляем только этот товар, корзину не трогаем
    $('#buyNow').addEventListener('click', function () {
      if (!sel) { askSize(); return; }
      var s = sizeOf(); if (!s || (s.stock <= 0 && !pre)) { toast('Этого размера сейчас нет', true); return; }
      if (s.stock > 0 && qty > s.stock) { toast('В наличии только ' + s.stock + ' шт.', true); return; }
      BuyNow.start(p.id, col.id, sel, qty);
      go('#/checkout?buy=1');
    });
    var oc = $('#openChart'); if (oc) oc.addEventListener('click', function () {
      openModal(sizeTableHtml(p));
    });
    // Подбор размера: выбранный размер сразу отмечается в карточке
    function pickSize(size) {
      var sz = (col.sizes || []).find(function (x) { return x.size === size; });
      if (!sz) return;
      if (sz.stock <= 0 && !notifyOn) { toast('Размера ' + size + ' в цвете «' + col.name + '» сейчас нет', true); return; }
      sel = size; drawOptions();
      var chip = $('#sizeChips [data-size="' + (window.CSS && CSS.escape ? CSS.escape(size) : size) + '"]'); if (chip) chip.focus();
    }
    var ff = $('#fitFind'); if (ff) ff.addEventListener('click', function () { openFitFinder(p, col, pickSize); });
    shipEstimate(p);
    $('#fitCheck').addEventListener('click', function (e) {
      var b = e.target.closest('[data-fc]'); if (!b) return; var k = b.getAttribute('data-fc');
      if (k === 'find') openFitFinder(p, col, pickSize);
      else if (k === 'cmp') openFitCompare(p, col, pickSize);
      else if (k === 'pick') pickSize(b.getAttribute('data-size'));
    });
    if (q.fit === '1' && fitCanPick(p)) setTimeout(function () { openFitFinder(p, col, pickSize); }, 120);
    var fc = $('#fitCompare'); if (fc) fc.addEventListener('click', function () { openFitCompare(p, col, pickSize); });
  }

  /* ---------- Характеристики товара (js/specs.js): таблица, особенности и значки ухода ---------- */
  // Значки ухода — упрощённые символы с этикетки одежды
  function careIcon(k) {
    var tub = '<path d="M3 8l2 11h14l2-11"/><path d="M3 8c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"/>';
    var x = '<path d="M4 4l16 16M20 4L4 20"/>';
    var iron = '<path d="M4 18h16l-2-8H9c-3 0-5 3-5 8z"/><path d="M9 10V7h6"/>';
    var I = {
      w30: tub + '<text x="12" y="17.5" text-anchor="middle" font-size="6.5" font-family="Arial" fill="currentColor" stroke="none">30</text>',
      w40: tub + '<text x="12" y="17.5" text-anchor="middle" font-size="6.5" font-family="Arial" fill="currentColor" stroke="none">40</text>',
      delicate: tub + '<path d="M6 22h12M7 24h10" transform="translate(0,-2.5)"/>',
      inside: '<path d="M8 3l-4 3 2 3 2-1v12h8V8l2 1 2-3-4-3c-1 1.5-2.5 2-4 2s-3-.5-4-2z"/><path d="M10 13h4M12 11v4"/>',
      nobleach: '<path d="M12 4l9 16H3z"/>' + x,
      iron2: iron + '<circle cx="11" cy="14.5" r=".9" fill="currentColor"/><circle cx="14" cy="14.5" r=".9" fill="currentColor"/>',
      noironprint: iron + '<path d="M3 21L21 5"/>',
      nodryer: '<rect x="4" y="4" width="16" height="16" rx="1"/><circle cx="12" cy="12" r="5"/>' + x,
      flat: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M7 12h10"/>',
      nodryclean: '<circle cx="12" cy="12" r="8"/>' + x
    };
    return '<svg class="care-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (I[k] || '') + '</svg>';
  }
  // Короткая выжимка под ценой: «100% хлопок · 240 г/м² · Оверсайз»
  function specsSummaryHtml(p) {
    if (!window.Specs) return '';
    var s = Specs.summary(p); return s.length ? '<div class="spec-sum">' + s.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' : '';
  }
  // Заголовок раздела в карточке: значок, название, короткая подсказка и круглая кнопка «+»
  var ACC_IC = {
    text: '<path d="M5 7h14M5 12h14M5 17h9"/>',
    spec: '<path d="M4 5h9l7 7-8 8-8-8z"/><circle cx="8.5" cy="9.5" r="1.4"/>',
    box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>'
  };
  function accSum(ic, title, hint) {
    return '<summary><span class="acc-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' + ACC_IC[ic] + '</svg></span>' +
      '<span class="acc-t">' + esc(title) + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</span><span class="acc-pm" aria-hidden="true"></span></summary>';
  }
  function specsHtml(p) {
    if (!window.Specs) return p.composition || p.care ? '<details>' + accSum('spec', 'Состав и уход', '') + '<div class="body">' + esc([p.composition, p.care].filter(Boolean).join('\n\n')) + '</div></details>' : '';
    var rows = Specs.list(p), care = Specs.care(p);
    var feat = rows.filter(function (r) { return r.k === 'features'; }), rest = rows.filter(function (r) { return r.k !== 'features'; });
    if (!rest.length && !feat.length && !care.length && !p.care) return '';
    var featTags = feat.length ? feat[0].value.split(', ') : [];
    // Главное о ткани и крое — крупными плитками, остальное — строками
    var HERO = ['composition', 'density', 'fabric', 'fit'];
    var hero = HERO.map(function (k) { return rest.find(function (r) { return r.k === k; }); }).filter(Boolean);
    var main = rest.filter(function (r) { return hero.indexOf(r) === -1; });
    var hint = Specs.summary(p).join(' · ');
    return '<details open>' + accSum('spec', 'Характеристики', hint) + '<div class="body specs">' +
      (hero.length ? '<div class="spec-hero">' + hero.map(function (r) { return '<div class="spec-tile"><span>' + esc(r.label) + '</span><b>' + esc(r.value) + '</b></div>'; }).join('') + '</div>' : '') +
      (main.length ? '<dl class="spec-list">' + main.map(function (r) { return '<div><dt>' + esc(r.label) + '</dt><dd>' + esc(r.value) + '</dd></div>'; }).join('') + '</dl>' : '') +
      (featTags.length ? '<ul class="spec-tags">' + featTags.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      (care.length || p.care ? '<div class="spec-care"><h4>Уход</h4>' + (care.length ? '<ul>' + care.map(function (c) { return '<li>' + careIcon(c[0]) + '<span>' + esc(c[1]) + '</span></li>'; }).join('') + '</ul>' : '') + (p.care ? '<p class="muted">' + esc(p.care) + '</p>' : '') + '</div>' : '') +
    '</div></details>';
  }

  /* ---------- Подбор размера ----------
     В карточке товара (панель → Товары → «Мерки и подбор размера») для каждого размера задаются мерки изделия
     и рост/вес, на которые он рассчитан. Покупатель вводит свой рост и вес и как любит носить —
     сайт советует размер; можно и сравнить наши мерки со своей любимой футболкой. */
  var LS_FIT = 'albakov:fit';
  var FIT_PREF = [['close', 'Ближе к телу'], ['free', 'Свободно, как задумано'], ['xfree', 'Очень свободно']];
  function fitRows(p) { var f = p.fit || {}; return (f.rows || []).filter(function (r) { return r && r.size; }); }
  // Рост и вес для размеров: из панели, а если не заполнены — по типичной сетке (как кнопка «Заполнить типовыми» в панели)
  var FIT_TYPICAL = { XS: [150, 165, 45, 58], S: [160, 172, 52, 66], M: [170, 180, 62, 76], L: [176, 186, 72, 86], XL: [182, 192, 82, 96], '2XL': [186, 198, 92, 110], XXL: [186, 198, 92, 110], '3XL': [190, 205, 105, 125], XXXL: [190, 205, 105, 125] };
  function fitSizes(p) { var out = []; Pricing.colorsOf(p).forEach(function (c) { (c.sizes || []).forEach(function (x) { if (x.size && out.indexOf(x.size) === -1) out.push(x.size); }); }); return out; }
  function fitRangeRows(p) {
    var own = fitRows(p).filter(function (r) { return r.hMin > 0 && r.hMax >= r.hMin && r.kMin > 0 && r.kMax >= r.kMin; });
    if (own.length >= 2) return own;
    var base = fitRows(p), rows = fitSizes(p).map(function (sz) {
      var t = FIT_TYPICAL[String(sz).toUpperCase().replace(/\s+/g, '')]; if (!t) return null;
      return Object.assign({}, base.find(function (r) { return r.size === sz; }) || {}, { size: sz, hMin: t[0], hMax: t[1], kMin: t[2], kMax: t[3], typical: true });
    }).filter(Boolean);
    return rows.length >= 2 ? rows : [];
  }
  function fitCanPick(p) { return fitRangeRows(p).length >= 2; }
  function fitCanCompare(p) { return fitRows(p).filter(function (r) { return r.w > 0 && r.l > 0; }).length >= 2; }
  function fitSaved() { try { return JSON.parse(localStorage.getItem(LS_FIT) || 'null') || {}; } catch (e) { return {}; } }
  function fitSave(o) { try { localStorage.setItem(LS_FIT, JSON.stringify(o)); } catch (e) {} }
  // Размер по росту и весу: ближайший по росту и ближайший по весу, берём больший из двух, затем — поправка на посадку
  function fitPick(p, h, kg, pref) {
    var rows = fitRangeRows(p); if (!rows.length) return null;
    var near = function (v, lo, hi) { return v < lo ? lo - v : v > hi ? v - hi : 0; };
    var arg = function (fn) { var bi = 0, bv = Infinity; rows.forEach(function (r, i) { var v = fn(r); if (v < bv - 1e-9) { bv = v; bi = i; } }); return bi; };
    var ih = arg(function (r) { return near(h, r.hMin, r.hMax) * 10 + Math.abs(h - (r.hMin + r.hMax) / 2) / 100; });
    var ik = arg(function (r) { return near(kg, r.kMin, r.kMax) * 10 + Math.abs(kg - (r.kMin + r.kMax) / 2) / 100; });
    var i = Math.max(ih, ik) + (pref === 'close' ? -1 : pref === 'xfree' ? 1 : 0);
    var outside = near(h, rows[0].hMin, rows[rows.length - 1].hMax) > 6 || near(kg, rows[0].kMin, rows[rows.length - 1].kMax) > 8;
    i = Math.max(0, Math.min(rows.length - 1, i));
    return { row: rows[i], prev: rows[i - 1] || null, next: rows[i + 1] || null, outside: outside };
  }
  function fitToolsHtml(p) {
    var f = p.fit || {}, out = '';
    if (f.modelHeight && f.modelSize) out += '<p class="fit-model">На модели размер <b>' + esc(f.modelSize) + '</b>, рост ' + esc(f.modelHeight) + ' см</p>';
    var a = false, b = fitCanCompare(p) && !fitCanPick(p); // подбор по росту и весу — в блоке «Убедитесь, что размер ваш»
    if (a || b) out += '<div class="fit-tools">' + (a ? '<button type="button" class="btn ghost fit-find" id="fitFind"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="8" width="20" height="8"></rect><path d="M6 8v3M10 8v4M14 8v3M18 8v4"></path></svg>Подобрать размер</button>' : '') +
      (b ? '<button type="button" class="link fit-cmp" id="fitCompare">Сравнить со своей футболкой</button>' : '') + '</div>';
    return out;
  }
  /* Срок и цена доставки на странице товара: город — из оформления заказа или выбранный здесь (по умолчанию Москва) */
  var SHIP_DEFAULT = { code: 44, city: 'Москва', region: '' };
  function shipCity() { try { var sv = JSON.parse(localStorage.getItem('albakov:pvz') || 'null'); if (sv && sv.city && sv.city.code) return sv.city; } catch (e) {} return SHIP_DEFAULT; }
  function shipCitySave(c) { try { var sv = JSON.parse(localStorage.getItem('albakov:pvz') || 'null') || {}; if (!sv.city || sv.city.code !== c.code) localStorage.setItem('albakov:pvz', JSON.stringify({ city: c, pvz: null, addr: '' })); } catch (e) {} }
  function inCity(name) { // «в Москву», «в Санкт-Петербург», «в Казань»
    var n = String(name || ''); if (/а$/.test(n)) return n.replace(/а$/, 'у'); if (/я$/.test(n)) return n.replace(/я$/, 'ю'); return n;
  }
  function daysWord(d) { var m = String(d || '').match(/(\d+)\s*$/); var n = m ? Number(m[1]) : 0; return d ? d + ' ' + plural(n, 'день', 'дня', 'дней') : ''; }
  var shipSeq = 0;
  async function shipEstimate(p) {
    var box = $('#pShip'); if (!box) return;
    var ms = (((D.settings.delivery || {}).methods) || []).filter(function (m) { return Pricing.cdekMode(m); });
    if (!ms.length) return;
    var c = shipCity(), my = ++shipSeq;
    box.innerHTML = '<div class="pship is-load"><div class="pship-head"><span class="pship-ic">' + TRUCK_IC + '</span><span class="pship-t">Доставка в <button type="button" class="pship-city" data-ship-city>' + esc(inCity(c.city)) + '</button></span></div><div class="pship-rows"><span class="pship-skel"></span><span class="pship-skel"></span></div></div>';
    var r = null; try { r = await API.shipEstimate(c.code, p.id); } catch (e) { r = null; }
    if (my !== shipSeq || !document.body.contains(box)) return;
    var list = (r && r.methods) || ms.map(function (m) { return { name: m.name, kind: Pricing.cdekMode(m), price: Number(m.price) || 0, known: !m.priceAuto, days: '', freeFrom: Number(m.freeFrom) || 0 }; });
    var price = priceOf(p).price;
    box.innerHTML = '<div class="pship"><div class="pship-head"><span class="pship-ic">' + TRUCK_IC + '</span><span class="pship-t">Доставка в <button type="button" class="pship-city" data-ship-city aria-label="Изменить город, сейчас ' + esc(c.city) + '">' + esc(inCity(c.city)) + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button></span></div>' +
      '<div class="pship-rows">' + list.map(function (m) {
        var free = m.freeFrom && price >= m.freeFrom;
        return '<div class="pship-row"><span class="pship-n">' + (m.kind === 'door' ? 'Курьером до двери' : 'В пункт выдачи СДЭК') + (m.days ? '<small>' + esc(daysWord(m.days)) + '</small>' : '') + '</span>' +
          '<span class="pship-p">' + (free ? '<b class="ok">Бесплатно</b>' : m.known === false ? 'по тарифу СДЭК<small>цену покажем при оформлении</small>' : m.price ? fmt(m.price) : '<b class="ok">Бесплатно</b>') + (m.freeFrom && !free ? '<small>бесплатно от ' + fmt(m.freeFrom) + '</small>' : '') + '</span></div>';
      }).join('') + '</div>' +
      (r && list.some(function (m) { return m.days; }) ? '<p class="pship-note">Срок СДЭК — со дня отправки заказа. Точную цену покажем при оформлении.</p>' : '') + '</div>';
  }
  function openShipCity(p) {
    openModal('<div class="shipc"><span class="eyebrow">Доставка</span><h3 class="serif">Ваш город</h3><p class="muted">Посчитаем срок и стоимость доставки СДЭК.</p>' +
      '<label class="field"><span>Город</span><input class="input" id="shipQ" autocomplete="address-level2" placeholder="Начните вводить, например Казань" aria-autocomplete="list" aria-controls="shipList"></label><ul class="shipc-list" id="shipList" role="listbox"></ul>' +
      '<div class="shipc-quick">' + [[44, 'Москва'], [137, 'Санкт-Петербург'], [424, 'Казань'], [250, 'Екатеринбург'], [270, 'Новосибирск']].map(function (x) { return '<button type="button" class="chip" data-shc="' + x[0] + '|' + esc(x[1]) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div></div>');
    var q = $('#shipQ'), list = $('#shipList'), t = 0, seq = 0, items = [];
    setTimeout(function () { q.focus(); }, 60);
    function pick(c) { shipCitySave(c); closePanels(); shipEstimate(p); }
    q.addEventListener('input', function () {
      clearTimeout(t); var v = q.value.trim(); if (v.length < 2) { list.innerHTML = ''; return; }
      t = setTimeout(async function () { var my = ++seq; try { var r = await API.cdekCities(v); if (my !== seq) return; items = r; list.innerHTML = r.length ? r.slice(0, 8).map(function (c, i) { return '<li role="option" data-shi="' + i + '"><b>' + esc(c.city) + '</b>' + (c.region ? '<span>' + esc(c.region) + '</span>' : '') + '</li>'; }).join('') : '<li class="muted">Не нашли такой город</li>'; } catch (e) { list.innerHTML = '<li class="muted">' + esc(errMsg(e)) + '</li>'; } }, 250);
    });
    list.addEventListener('click', function (e) { var li = e.target.closest('[data-shi]'); if (li) pick(items[+li.getAttribute('data-shi')]); });
    $('.shipc-quick').addEventListener('click', function (e) { var b = e.target.closest('[data-shc]'); if (b) { var k = b.getAttribute('data-shc').split('|'); pick({ code: +k[0], city: k[1], region: '' }); } });
  }
  /* Блок «Убедитесь, что размер ваш»: до подбора — приглашение, после — персональный вывод под выбранный размер */
  var FIT_IC = '<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><rect x="3" y="13" width="34" height="14" rx="3"/><path d="M9 13v5M14 13v3M19 13v5M24 13v3M29 13v5M34 13v3"/></svg>';
  var FIT_OK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function fitCheckHtml(p, col, sel) {
    if (!fitCanPick(p)) return '';
    var sv = fitSaved(), res = sv.done && sv.h && sv.kg ? fitPick(p, sv.h, sv.kg, sv.pref || 'free') : null;
    var cmp = fitCanCompare(p) ? '<button type="button" class="fc-link" data-fc="cmp">Сравнить со своей футболкой</button>' : '';
    if (!res) {
      return '<div class="fc"><span class="fc-ic">' + FIT_IC + '</span><div class="fc-body"><span class="fc-eye">Подбор размера · 10 секунд</span>' +
        '<b class="fc-title">' + (sel ? 'Убедитесь, что ' + esc(sel) + ' — ваш размер' : 'Не уверены в размере?') + '</b>' +
        '<p class="fc-text">Чтобы вещь села именно так, как задумано, рекомендуем свериться с подбором: укажите рост и вес — подскажем ваш размер и как он сядет.</p>' +
        '<div class="fc-acts"><button type="button" class="fc-btn" data-fc="find">Подобрать размер<i aria-hidden="true">' + ARROW + '</i></button>' + cmp + '</div></div></div>';
    }
    var rec = res.row.size, pref = { close: 'ближе к телу', free: 'свободно', xfree: 'очень свободно' }[sv.pref || 'free'];
    var who = sv.h + ' см · ' + sv.kg + ' кг · ' + pref, recStock = (col.sizes || []).find(function (x) { return x.size === rec; });
    var recOut = recStock && recStock.stock <= 0 ? ' <span class="fc-out">— в этом цвете сейчас нет</span>' : '';
    var state = !sel ? 'rec' : sel === rec ? 'ok' : 'diff';
    return '<div class="fc is-' + state + '"><span class="fc-ic">' + (state === 'ok' ? '<span class="fc-check">' + FIT_OK + '</span>' : FIT_IC) + '</span><div class="fc-body"><span class="fc-eye">Ваши мерки: ' + esc(who) + '</span>' +
      (state === 'ok' ? '<b class="fc-title">' + esc(rec) + ' — ваш размер</b><p class="fc-text">Сядет ' + ({ close: 'аккуратно, ближе к телу', free: 'свободно — так, как задумано', xfree: 'очень свободно, с запасом' }[sv.pref || 'free']) + '. Можно смело добавлять в корзину.</p>'
        : state === 'diff' ? '<b class="fc-title">Вам скорее подойдёт ' + esc(rec) + '</b><p class="fc-text">Вы выбрали ' + esc(sel) + '. По вашим меркам ' + esc(rec) + ' сядет так, как задумано' + recOut + '.</p>'
        : '<b class="fc-title">Ваш размер — ' + esc(rec) + recOut + '</b><p class="fc-text">Подобрали по вашим меркам. Отметьте его ниже или нажмите «Выбрать».</p>') +
      '<div class="fc-acts">' + (state !== 'ok' && !recOut ? '<button type="button" class="fc-btn" data-fc="pick" data-size="' + esc(rec) + '">Выбрать ' + esc(rec) + '</button>' : '') +
        '<button type="button" class="fc-link" data-fc="find">Изменить мерки</button>' + cmp + '</div>' +
      (res.row.typical ? '<p class="fc-typ">По типичной размерной сетке</p>' : '') + '</div></div>';
  }
  function exchangeCfg() { var e = (D.settings && D.settings.exchange) || {}; return { enabled: e.enabled !== false, days: Math.max(1, Math.round(Number(e.days) || 14)), free: e.free !== false }; }
  var EXCH_IC = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"></path><path d="M18 3v4h-4M6 21v-4h4"></path></svg>';
  function fitGuaranteeHtml() {
    var c = exchangeCfg(); if (!c.enabled) return '';
    return '<div class="fit-guar">' + EXCH_IC + '<div><b>' + (c.free ? 'Не подошёл размер — обменяем бесплатно' : 'Не подошёл размер — обменяем') + '</b><span>В течение ' + c.days + ' ' + plural(c.days, 'дня', 'дней', 'дней') + ' после получения — в пару нажатий в личном кабинете. Новый размер отправим, как только вещь вернётся к нам' + (c.free ? ', доставка в обе стороны за наш счёт' : '') + '.</span></div></div>';
  }
  function cm(v) { return v > 0 ? String(v).replace('.', ',') + ' см' : '—'; }
  /* Таблица размеров товара (13.64.3): своя у каждого товара — мерки на каждый размер задаются в панели при создании товара.
     Ширина, длина, рукав, свои столбцы (например «Обхват талии») и рост/вес, на кого рассчитан размер */
  function sizeTableRows(p) {
    var cols = ((p.fit || {}).cols || []);
    return fitRows(p).filter(function (r) { return r.w > 0 || r.l > 0 || r.sl > 0 || r.hMin > 0 || (r.x || []).some(function (v, i) { return cols[i] && String(v || '').trim(); }); });
  }
  function sizeTableHtml(p) {
    var rows = sizeTableRows(p), f = p.fit || {}, cols = f.cols || []; if (!rows.length) return '';
    var has = function (k) { return rows.some(function (r) { return r[k] > 0; }); }, num = function (v) { return v > 0 ? String(v).replace('.', ',') : '—'; };
    var xs = cols.map(function (c, i) { return { name: c, i: i }; }).filter(function (c) { return c.name && rows.some(function (r) { return String((r.x || [])[c.i] || '').trim(); }); });
    var head = '<th>Размер</th>' + (has('w') ? '<th>Ширина, см</th>' : '') + (has('l') ? '<th>Длина, см</th>' : '') + (has('sl') ? '<th>Рукав, см</th>' : '') + xs.map(function (c) { return '<th>' + esc(c.name) + '</th>'; }).join('') + (has('hMin') ? '<th>Рост, см</th>' : '') + (has('kMin') ? '<th>Вес, кг</th>' : '');
    var body = rows.map(function (r) {
      return '<tr><td>' + esc(r.size) + '</td>' + (has('w') ? '<td>' + num(r.w) + '</td>' : '') + (has('l') ? '<td>' + num(r.l) + '</td>' : '') + (has('sl') ? '<td>' + num(r.sl) + '</td>' : '') +
        xs.map(function (c) { var v = String((r.x || [])[c.i] || '').trim(); return '<td>' + (v ? esc(v) : '—') + '</td>'; }).join('') +
        (has('hMin') ? '<td>' + (r.hMin ? r.hMin + '–' + r.hMax : '—') + '</td>' : '') + (has('kMin') ? '<td>' + (r.kMin ? r.kMin + '–' + r.kMax : '—') + '</td>' : '') + '</tr>';
    }).join('');
    var wide = 1 + ['w', 'l', 'sl', 'hMin', 'kMin'].filter(has).length + xs.length > 3;
    return '<span class="eyebrow">' + esc(p.name) + '</span><h3 class="serif" style="font-size:34px;margin:10px 0 6px">Таблица размеров</h3>' +
      '<p class="muted" style="margin-bottom:22px">' + (f.note ? esc(f.note) : 'Мерки этой вещи в сантиметрах: её разложили на столе и измерили. Ширина — от шва до шва под рукавами, длина — от верхней точки плеча до низа.') + '</p>' +
      '<div class="table-wrap" style="margin-bottom:12px"><table class="sizes p-sizes"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      (wide ? '<p class="tw-hint" aria-hidden="true">Таблица листается вбок →</p>' : '') +
      (f.modelSize && f.modelHeight ? '<p class="muted" style="margin-top:14px;font-size:14px">На модели размер ' + esc(f.modelSize) + ', рост ' + esc(f.modelHeight) + ' см</p>' : '');
  }
  function fitStockNote(col, size) {
    var s = (col.sizes || []).find(function (x) { return x.size === size; });
    return !s ? '' : s.stock > 0 ? '' : '<span class="fit-out">В цвете «' + esc(col.name) + '» этого размера сейчас нет</span>';
  }
  function openFitFinder(p, col, onPick) {
    var sv = fitSaved(), st = { h: sv.h || 178, kg: sv.kg || 75, pref: sv.pref || 'free' };
    openModal('<div class="fit-modal"><span class="eyebrow">' + esc(p.name) + '</span><h3 class="serif">Подбор размера</h3>' +
      // Рост и вес — ползунком или цифрами вручную
      '<div class="fit-range"><label for="fitHn">Рост</label><span class="fit-num"><input class="fit-num-in" id="fitHn" type="number" inputmode="numeric" min="145" max="210" step="1" value="' + st.h + '" aria-label="Рост, см"><i>см</i></span><input type="range" id="fitH" min="145" max="210" step="1" value="' + st.h + '" aria-label="Рост"></div>' +
      '<div class="fit-range"><label for="fitKn">Вес</label><span class="fit-num"><input class="fit-num-in" id="fitKn" type="number" inputmode="numeric" min="40" max="150" step="1" value="' + st.kg + '" aria-label="Вес, кг"><i>кг</i></span><input type="range" id="fitK" min="40" max="150" step="1" value="' + st.kg + '" aria-label="Вес"></div>' +
      '<div class="fit-pref" role="radiogroup" aria-label="Как любите носить"><span>Как любите носить</span><div>' + FIT_PREF.map(function (x) { return '<button type="button" class="chip" role="radio" data-pref="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div></div>' +
      '<div class="fit-res" id="fitRes" aria-live="polite"></div>' +
      '<button class="btn block" id="fitOk"></button>' + (fitCanCompare(p) ? '<button type="button" class="link fit-alt" id="fitToCmp">Сравнить со своей футболкой</button>' : '') + '</div>');
    var res = null;
    function draw() {
      if (document.activeElement !== $('#fitHn')) $('#fitHn').value = st.h;
      if (document.activeElement !== $('#fitKn')) $('#fitKn').value = st.kg;
      $('#fitH').value = st.h; $('#fitK').value = st.kg;
      $$('[data-pref]').forEach(function (b) { var on = b.getAttribute('data-pref') === st.pref; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      res = fitPick(p, st.h, st.kg, st.pref); if (!res) return;
      var r = res.row, note = { close: 'Сядет аккуратнее, ближе к телу', free: 'Сядет свободно — так, как задумано', xfree: 'Сядет очень свободно, с запасом' }[st.pref];
      var meas = [r.w > 0 ? ['Ширина', cm(r.w)] : null, r.l > 0 ? ['Длина', cm(r.l)] : null, r.sl > 0 ? ['Рукав', cm(r.sl)] : null].filter(Boolean);
      var tip = res.outside ? 'Ваши параметры на краю нашей сетки — сверьтесь с мерками изделия или со своей футболкой.' :
        st.pref === 'free' && res.prev ? 'Сомневаетесь между ' + esc(res.prev.size) + ' и ' + esc(r.size) + '? Крой уже свободный: ' + esc(res.prev.size) + ' сядет аккуратнее, ' + esc(r.size) + ' — как на фото.' : '';
      $('#fitRes').innerHTML = '<span class="muted">Ваш размер</span><div class="fit-big"><b>' + esc(r.size) + '</b><span>' + note + '</span></div>' +
        (meas.length ? '<div class="fit-meas">' + meas.map(function (m) { return '<div><span>' + m[0] + '</span><b>' + m[1] + '</b></div>'; }).join('') + '</div>' : '') +
        (tip ? '<p class="fit-tip">' + tip + '</p>' : '') + fitStockNote(col, r.size) + (r.typical ? '<p class="fit-typ">Подбор по типичной размерной сетке. Точные мерки изделия — в «Таблице размеров».</p>' : '');
      $('#fitOk').textContent = 'Выбрать размер ' + r.size;
      fitSave(st);
    }
    $('#fitH').addEventListener('input', function (e) { st.h = +e.target.value; draw(); });
    $('#fitK').addEventListener('input', function (e) { st.kg = +e.target.value; draw(); });
    // Ввод цифрами: пересчитываем, как только число попадает в диапазон; при выходе из поля — подтягиваем к границам
    function numIn(id, key, lo, hi) {
      var el = $(id);
      el.addEventListener('input', function () { var v = Math.round(Number(el.value)); if (v >= lo && v <= hi) { st[key] = v; draw(); } });
      el.addEventListener('change', function () { var v = Math.round(Number(el.value)) || st[key]; st[key] = Math.max(lo, Math.min(hi, v)); el.value = st[key]; draw(); });
      el.addEventListener('focus', function () { el.select(); });
    }
    numIn('#fitHn', 'h', 145, 210); numIn('#fitKn', 'kg', 40, 150);
    $('.fit-pref').addEventListener('click', function (e) { var b = e.target.closest('[data-pref]'); if (b) { st.pref = b.getAttribute('data-pref'); draw(); } });
    $('#fitOk').addEventListener('click', function () { if (res) { var sv3 = fitSaved(); sv3.done = 1; fitSave(sv3); closePanels(); onPick(res.row.size); } });
    if ($('#fitToCmp')) $('#fitToCmp').addEventListener('click', function () { openFitCompare(p, col, onPick); });
    draw();
  }
  function openFitCompare(p, col, onPick) {
    var sv = fitSaved(), rows = fitRows(p).filter(function (r) { return r.w > 0 && r.l > 0; });
    openModal('<div class="fit-modal"><span class="eyebrow">' + esc(p.name) + '</span><h3 class="serif">Сравнить со своей</h3>' +
      '<p class="muted">Возьмите футболку, которая сидит на вас идеально, разложите её ровно и измерьте двумя линиями.</p>' +
      '<svg class="fit-scheme" viewBox="0 0 290 200" fill="none" role="img" aria-label="Схема: ширина — по линии подмышек, длина — от плеча до низа"><path d="M80 20 L105 12 Q130 30 155 12 L180 20 L232 56 L212 92 L188 80 L188 188 L72 188 L72 80 L48 92 L28 56 Z" stroke="currentColor" stroke-width="1.5"></path><line x1="72" y1="86" x2="188" y2="86" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"></line><line x1="200" y1="20" x2="200" y2="188" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"></line><text x="130" y="108" text-anchor="middle" font-size="13" fill="currentColor">1 · ширина</text><text x="207" y="140" font-size="13" fill="currentColor">2 · длина</text></svg>' +
      '<div class="fit-in"><label class="field"><span>1 · Ширина, см</span><input class="input" id="fitW" type="number" inputmode="decimal" min="30" max="100" value="' + esc(sv.w || '') + '" placeholder="например, 56"></label>' +
      '<label class="field"><span>2 · Длина, см</span><input class="input" id="fitL" type="number" inputmode="decimal" min="40" max="110" value="' + esc(sv.l || '') + '" placeholder="например, 72"></label></div>' +
      '<div class="fit-cmp-list" id="fitCmp" aria-live="polite"></div><button class="btn block" id="fitOk" hidden></button></div>');
    var best = null;
    function diff(v, word, more, less) { var d = Math.round(v * 10) / 10; return Math.abs(d) < 0.5 ? word + ' как у вашей' : (d > 0 ? more : less) + ' на ' + String(Math.abs(d)).replace('.', ',') + ' см'; }
    function draw() {
      var w = parseFloat(String($('#fitW').value).replace(',', '.')), l = parseFloat(String($('#fitL').value).replace(',', '.'));
      if (!(w > 20 && l > 30)) { $('#fitCmp').innerHTML = '<p class="muted" style="margin:0">Введите обе мерки — покажем, какой наш размер ближе.</p>'; $('#fitOk').hidden = true; best = null; return; }
      var sv2 = fitSaved(); sv2.w = w; sv2.l = l; fitSave(sv2);
      best = rows.reduce(function (b, r) { var sc = Math.abs(r.w - w) * 1.5 + Math.abs(r.l - l); return !b || sc < b.sc ? { r: r, sc: sc } : b; }, null).r;
      $('#fitCmp').innerHTML = rows.map(function (r) {
        return '<div class="fit-cmp-row' + (r === best ? ' on' : '') + '"><b>' + esc(r.size) + '</b><span>' + diff(r.w - w, 'Ширина', 'шире', 'уже') + '</span><span>' + (r === best ? 'ближе всего' : diff(r.l - l, 'Длина', 'длиннее', 'короче')) + '</span></div>';
      }).join('') + fitStockNote(col, best.size);
      $('#fitOk').hidden = false; $('#fitOk').textContent = 'Выбрать размер ' + best.size;
    }
    $('#fitW').addEventListener('input', draw); $('#fitL').addEventListener('input', draw);
    $('#fitOk').addEventListener('click', function () { if (best) { closePanels(); onPick(best.size); } });
    draw();
  }
  /* ---------- Сообщить о поступлении ---------- */
  function openNotify(p, col, size) {
    var out = (col.sizes || []).filter(function (s) { return s.stock <= 0; });
    var wholeOut = out.length === (col.sizes || []).length;
    var opts = (wholeOut && (col.sizes || []).length > 1 ? [['', 'Любой размер']] : []).concat(out.map(function (s) { return [s.size, s.size]; }));
    var pre = size && out.some(function (s) { return s.size === size; }) ? size : opts[0] ? opts[0][0] : '';
    var img = (col.images && col.images[0]) || Art.make(col.art);
    openModal('<div class="notify"><span class="eyebrow">Нет в наличии</span><h3 class="serif">Сообщить о поступлении</h3>' +
      '<p class="muted">Напишем на почту один раз, как только товар появится. Без рассылок.</p>' +
      '<div class="notify-item"><img src="' + esc(img) + '" alt=""><div><b>' + esc(p.name) + '</b><span><i class="sw" style="' + swatchStyle(col) + '"></i>' + esc(col.name) + '</span></div></div>' +
      '<form class="form" id="nfForm" novalidate>' +
        (opts.length > 1 ? '<label class="field"><span>Размер</span><select class="select" id="nf-size">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === pre ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>' : '<p class="notify-size">Размер: <b>' + esc(pre || 'любой') + '</b></p>') +
        '<label class="field"><span>Электронная почта</span><input class="input" id="nf-email" type="email" autocomplete="email" placeholder="name@example.ru" value="' + esc(API.user ? API.user.email : '') + '"></label>' +
        '<label class="check"><input type="checkbox" id="nf-agree"> <span>Даю <a href="#/page/consent" data-page-modal="consent">согласие на обработку</a> адреса почты для этого уведомления</span></label>' +
        '<p class="form-error" id="nfErr"></p><button class="btn block" id="nfBtn">Сообщить мне</button></form></div>');
    var f = $('#nfForm'), e = $('#nf-email'); if (!e.value) setTimeout(function () { e.focus(); }, 60);
    e.addEventListener('input', function () { e.classList.remove('invalid'); $('#nfErr').textContent = ''; });
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var chosen = $('#nf-size') ? $('#nf-size').value : pre, email = e.value.trim();
      if (!validEmail(email)) { e.classList.add('invalid'); $('#nfErr').textContent = 'Проверьте электронную почту'; return; }
      if (!$('#nf-agree').checked) { $('#nfErr').textContent = 'Нужно согласие на обработку адреса почты'; return; }
      var btn = $('#nfBtn'); btn.disabled = true; btn.textContent = 'Отправляем…';
      try {
        var r = await API.subscribe({ productId: p.id, colorId: col.id, size: chosen, email: email, consent: true });
        $('#modalBody').innerHTML = '<div class="notify notify-done"><span class="notify-check" aria-hidden="true"></span><h3 class="serif">' + (r.already ? 'Вы уже в списке' : 'Готово, ждите письма') + '</h3>' +
          '<p class="muted">' + (r.already ? 'Заявка на этот товар уже оставлена.' : 'Мы сохранили вашу заявку.') + ' Как только «' + esc(p.name) + '» в цвете «' + esc(col.name) + '»' + (chosen ? ', размер ' + esc(chosen) + ',' : '') + ' появится в наличии, придёт письмо на <b>' + esc(email) + '</b>.</p>' +
          '<button class="btn ghost" data-act="close">Хорошо</button></div>';
      } catch (ex) { $('#nfErr').textContent = errMsg(ex); btn.disabled = false; btn.textContent = 'Сообщить мне'; }
    });
  }
  function swatchStyle(c) { return c.hex ? 'background:' + esc(c.hex) : 'background:var(--surface-2)'; }


  /* ---------- Акции ---------- */
  function sale(v) {
    var promos = activePromos();
    var items = gProducts().filter(function (p) { return priceOf(p).onSale; });
    v.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Специальные предложения</span><h1>Акции</h1></div>' +
      (promos.length ? '<div class="deals">' + promos.map(function (a) { return dealCard(a, false); }).join('') + '</div>' : '<p class="muted" style="margin-bottom:40px">Сейчас нет активных акций. Подпишитесь на наши соцсети, чтобы не пропустить следующую.</p>') +
      (items.length ? '<div class="section-head"><h2>Товары со скидкой</h2></div><div class="grid" style="padding-bottom:96px">' + items.map(card).join('') + '</div>' : '<div style="padding-bottom:96px"></div>') + '</div>';
    startDealTimers(v);
  }

  /* ---------- Корзина ---------- */
  function preTag(l) { return '<span class="pre-tag">Предзаказ' + (l.shipDate ? ' · отправим ' + esc(fmtDate(l.shipDate).replace(/ \d{4} г\.$/, '')) : '') + '</span>'; }
  function lineHtml(l) {
    return '<div class="cart-line"><a class="ph" href="#/product/' + esc(l.slug) + '?color=' + esc(l.colorId) + '"><img src="' + esc(l.image || Art.make(l.art)) + '" alt=""></a>' +
      '<div class="info"><a href="#/product/' + esc(l.slug) + '?color=' + esc(l.colorId) + '">' + esc(l.name) + '</a><span class="sub">' + (l.color ? 'Цвет: ' + esc(l.color) + ' · ' : '') + 'Размер: ' + esc(l.size) + '</span>' + (l.preorder ? preTag(l) : '') + priceHtml(l) + (l.problem ? '<span class="problem">' + esc(l.problem) + '</span>' : '') + '</div>' +
      '<div class="side"><div class="qty"><button data-line="' + esc(l.productId) + '|' + esc(l.colorId) + '|' + esc(l.size) + '" data-d="-1" aria-label="Меньше">−</button><span class="num">' + l.qty + '</span><button data-line="' + esc(l.productId) + '|' + esc(l.colorId) + '|' + esc(l.size) + '" data-d="1" aria-label="Больше"' + (l.qty >= l.stock ? ' disabled' : '') + '>+</button></div>' +
      '<button class="remove" data-rm="' + esc(l.productId) + '|' + esc(l.colorId) + '|' + esc(l.size) + '">Удалить</button></div></div>';
  }
  function bindLines(box) {
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-line],[data-rm]'); if (!b) return;
      var key = (b.getAttribute('data-line') || b.getAttribute('data-rm')).split('|');
      var l = Cart.find(key[0], key[1], key[2]); if (!l) return;
      Cart.update(key[0], key[1], key[2], b.hasAttribute('data-rm') ? 0 : l.qty + Number(b.getAttribute('data-d')));
    });
  }
  /* Расчёт корзины. Товары, которых больше нет на сайте, убираем из корзины, чтобы они не висели в счётчике */
  async function cartQuote(code, deliveryId, contact, useBonus, extra) {
    var src = coSrc(), lines = src.get(), q = await API.quote(lines, code, deliveryId, contact, useBonus, extra);
    var keep = lines.filter(function (l) { return q.lines.some(function (x) { return x.productId === l.productId && x.size === l.size && (!l.colorId || x.colorId === l.colorId); }); });
    if (keep.length !== lines.length) { src.set(keep); toast('Некоторых товаров больше нет в продаже — мы убрали их из корзины', true); }
    lastCartQ = q;
    return q;
  }
  /* Аудит 16.11 (M-6): вещь закончилась, пока лежала в корзине, — оформление блокируется, а не падает в самом конце.
     Одна кнопка убирает проданное и уменьшает количество до остатка (как в приложении) */
  var lastCartQ = null;
  function cartIssues(q) { return q.lines.filter(function (l) { return l.problem; }); }
  function issueBox(q) {
    var bad = cartIssues(q); if (!bad.length) return '';
    var gone = bad.filter(function (l) { return !/(\d+)\s*шт/.test(l.problem); }).length;
    return '<div class="cart-issue" role="alert"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.2v.3"/></svg>' +
      '<div><b>' + (gone === bad.length ? (bad.length === 1 ? 'Одна вещь закончилась' : 'Часть вещей закончилась') : 'Остатки изменились') + '</b>' +
      '<span>Пока вещи лежали в корзине, их успели купить. Уберите недоступное — и можно оформлять заказ.</span>' +
      '<button type="button" class="btn small" data-fix-cart>Убрать недоступное</button></div></div>';
  }
  function fixCart() {
    var q = lastCartQ; if (!q) return;
    var src = coSrc(), n = 0;
    var out = src.get().map(function (l) {
      var x = q.lines.find(function (y) { return y.productId === l.productId && y.size === l.size && (!l.colorId || y.colorId === l.colorId); });
      if (!x || !x.problem) return l;
      n++; var m = x.problem.match(/(\d+)\s*шт/), max = m ? Number(m[1]) : 0;
      return max > 0 ? Object.assign({}, l, { qty: Math.min(l.qty, max) }) : null;
    }).filter(Boolean);
    if (!n) return;
    src.set(out); toast(out.length ? 'Готово — корзина обновлена' : 'Недоступные вещи убраны');
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-fix-cart]')) fixCart(); });
  function goCheckoutBtn(q) {
    return cartIssues(q).length ? '<button class="btn block" type="button" disabled>Оформить заказ</button>' : '<a class="btn block" href="#/checkout">Оформить заказ</a>';
  }
  function earnRow(q) { return q.bonusEarn > 0 ? '<div class="sum-row bonus-earn"><span><i class="b-ic" aria-hidden="true">Б</i>' + (API.user ? 'Начислим за заказ' : 'Бонусы за заказ') + (q.bonusOnline > 0 ? ' <small class="muted">· из них +' + bonusNum(q.bonusOnline) + ' за онлайн-оплату</small>' : '') + '</span><span>+' + bonusNum(q.bonusEarn) + ' ' + bonusWord(q.bonusEarn) + '</span></div>' : ''; }
  /* Шкала «до бесплатной доставки»: порог — самый низкий «Бесплатно от» среди способов доставки из панели */
  var TRUCK_IC = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5h11v9H3z"/><path d="M14 9.5h3.6l3.4 3.4v2.6h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg>';
  function freeShipBar(sum) {
    var ms = (((D.settings.delivery || {}).methods) || []).filter(function (m) { return Number(m.freeFrom) > 0; });
    if (!ms.length) return '';
    var m = ms.reduce(function (a, b) { return Number(b.freeFrom) < Number(a.freeFrom) ? b : a; }), from = Number(m.freeFrom);
    var where = m.pickupPoint ? ' в пункт выдачи' : m.cdekDoor ? ' курьером' : '';
    var left = Math.max(0, from - sum), pc = Math.min(100, Math.round(sum / from * 100));
    return '<div class="fsb' + (left ? '' : ' done') + '" role="status"><div class="fsb-top"><span class="fsb-ic">' + (left ? TRUCK_IC : FIT_OK) + '</span><span class="fsb-t">' +
      (left ? 'Ещё <b>' + fmt(left) + '</b> — и доставка' + where + ' бесплатно' : '<b>Доставка' + where + ' — бесплатно</b>') + '</span></div>' +
      '<div class="fsb-bar" aria-hidden="true"><i style="width:' + pc + '%"></i></div>' + (left ? '<span class="fsb-note">Бесплатно от ' + fmt(from) + '</span>' : '') + '</div>';
  }
  // В корзине одна вещь в двух размерах — подскажем подобрать размер, чтобы не возвращать лишнее
  function bracketHint(q) {
    var seen = {}, hit = null;
    q.lines.forEach(function (l) { var k = l.productId + '|' + (l.colorId || ''); (seen[k] = seen[k] || []).push(l); });
    Object.keys(seen).some(function (k) { var ls = seen[k]; if (ls.length < 2) return false; var pr = D.products.find(function (x) { return x.id === ls[0].productId; }); if (pr && fitCanPick(pr)) { hit = { p: pr, ls: ls }; return true; } return false; });
    if (!hit) return '';
    return '<div class="fit-hint"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16v.5"></path></svg><div><span>«' + esc(hit.p.name) + '» в корзине в размерах ' + hit.ls.map(function (l) { return esc(l.size); }).join(' и ') + '. Не уверены, какой подойдёт?</span>' +
      '<a class="link" href="#/product/' + esc(hit.p.slug) + '?color=' + esc(hit.ls[0].colorId || '') + '&fit=1">Подобрать размер за 10 секунд</a></div></div>';
  }
  async function renderCartDrawer() {
    var body = $('#cartBody'), foot = $('#cartFoot'); if (!body) return;
    var q = await cartQuote();
    if (!q.lines.length) { body.innerHTML = emptyCartHtml(true); foot.hidden = true; return; }
    foot.hidden = false;
    body.innerHTML = issueBox(q) + bracketHint(q) + q.lines.map(lineHtml).join('');
    foot.innerHTML = freeShipBar(q.subtotal) + (q.saleDiscount ? '<div class="sum-row disc"><span>Скидка</span><span>−' + fmt(q.saleDiscount) + '</span></div>' : '') +
      '<div class="sum-row total"><span>Итого</span><span>' + fmt(q.subtotal) + '</span></div>' + earnRow(q) + '<p class="muted" style="font-size:13px">' + (API.user && API.user.bonus && q.bonus.enabled ? 'Доставка, промокод и оплата бонусами — на следующем шаге' : 'Доставка и промокод — на следующем шаге') + '</p>' +
      goCheckoutBtn(q) + '<a class="btn ghost block" href="#/cart">Перейти в корзину</a>' + remindHtml();
  }
  // Согласие на напоминание о корзине — спрашиваем один раз, у вошедших покупателей; меняется в профиле
  function remindHtml() {
    if (!API.user || API.user.cartRemind !== null || !D.mailReady) return '';
    return '<label class="remind-opt"><input type="checkbox" data-remind> <span><b>Напомнить на почту</b><small>Если не успеете оформить заказ — одно письмо через несколько часов</small></span></label>';
  }
  document.addEventListener('change', async function (e) {
    var r = e.target.closest && e.target.closest('[data-remind]'); if (!r || !API.user) return;
    try { await API.savePrefs({ cartRemind: r.checked }); toast(r.checked ? 'Напомним, если не успеете оформить' : 'Напоминания отключены'); } catch (ex) { toast(errMsg(ex), true); }
  });
  /* Пустая корзина: спокойная карточка с объёмной иконкой, переход в каталог и подсказки, куда заглянуть */
  function emptyCartHtml(compact) {
    var favN = Fav.count(), cats = sortedCats().filter(function (c) { return gProducts().some(function (p) { return p.categoryId === c.id; }); }).slice(0, compact ? 3 : 5);
    return '<div class="ec' + (compact ? ' ec-compact' : '') + '">' +
      '<div class="ec-visual" aria-hidden="true"><span class="ec-ring"></span><span class="ec-bag"><svg viewBox="0 0 48 48"><path class="ec-b1" d="M11 17h26l-2.2 22.4a3 3 0 0 1-3 2.6H16.2a3 3 0 0 1-3-2.6z"/><path class="ec-b2" d="M18 17v-3.5a6 6 0 0 1 12 0V17"/><path class="ec-b3" d="M19 26.5c1.3 1.6 3 2.4 5 2.4s3.7-.8 5-2.4"/></svg></span><i class="ec-dot d1"></i><i class="ec-dot d2"></i><i class="ec-dot d3"></i></div>' +
      '<span class="eyebrow">Корзина</span><h3 class="ec-title">Пока здесь пусто</h3>' +
      '<p class="ec-text">Загляните в каталог — соберём образ из спокойных вещей. Доставим по всей России, примерить можно перед оплатой.</p>' +
      '<div class="ec-acts"><a class="btn ec-go" href="#/catalog"><span>Перейти в каталог</span><span class="bn-ic" aria-hidden="true">' + ARROW + '</span></a>' +
        (favN ? '<a class="btn ghost" href="#/favorites">Избранное · ' + favN + '</a>' : '<a class="btn ghost" href="#/catalog?tag=new">Новинки</a>') + '</div>' +
      (cats.length ? '<div class="ec-cats">' + cats.map(function (c) { return '<a href="#/catalog?cat=' + esc(c.slug) + '">' + esc(c.name) + '</a>'; }).join('') + '</div>' : '') +
    '</div>';
  }
  function openCart() { renderCartDrawer(); openPanel('cartDrawer'); }

  function cartPage(v) {
    v.innerHTML = '<div class="wrap"><div class="page-head"><h1>Корзина</h1></div><div class="checkout"><div id="cpLines"></div><aside class="summary" id="cpSum"></aside></div></div><div id="cpRecent"></div>';
    var draw = async function () {
      var q = await cartQuote();
      if (!q.lines.length) { $('#cpLines').innerHTML = emptyCartHtml(false); drawRecent($('#cpRecent')); $('#cpSum').hidden = true; $('#cpLines').parentNode.classList.add('is-empty'); return; }
      $('#cpSum').hidden = false; $('#cpLines').parentNode.classList.remove('is-empty'); if ($('#cpRecent')) $('#cpRecent').innerHTML = '';
      $('#cpLines').innerHTML = issueBox(q) + bracketHint(q) + q.lines.map(lineHtml).join('');
      $('#cpSum').innerHTML = freeShipBar(q.subtotal) + '<div class="sum-row"><span>' + q.count + ' ' + plural(q.count, 'товар', 'товара', 'товаров') + '</span><span>' + fmt(q.baseTotal) + '</span></div>' +
        (q.saleDiscount ? '<div class="sum-row disc"><span>Скидка по акциям</span><span>−' + fmt(q.saleDiscount) + '</span></div>' : '') +
        '<div class="sum-row total"><span>Итого</span><span>' + fmt(q.subtotal) + '</span></div>' + earnRow(q) +
        (API.user && API.user.bonus && q.bonus.enabled ? '<p class="muted" style="font-size:13px">На бонусном счёте ' + bonusNum(API.user.bonus) + ' ' + bonusWord(API.user.bonus) + ' — спишете при оформлении</p>' : '') + goCheckoutBtn(q) + remindHtml();
    };
    cartPageDraw = draw; draw();
  }
  var cartPageDraw = null, checkoutRedraw = null; // перерисовать сумму на оформлении, когда меняется корзина

  /* ---------- Оформление заказа ---------- */
  function pvzHtml() {
    return '<div class="pvz" id="pvzBox" hidden><div id="pvzCityBox"><label class="field" for="pvz-q"><span>Город или посёлок</span></label>' +
      '<div class="pvz-combo"><input class="input" id="pvz-q" autocomplete="off" spellcheck="false" placeholder="Начните вводить, например «Мурино»" role="combobox" aria-expanded="false" aria-controls="pvzSug" aria-autocomplete="list">' +
      '<ul class="pvz-sug" id="pvzSug" role="listbox" hidden></ul></div>' +
      '<p class="pvz-hint">Выберите свой населённый пункт из списка — область подставится сама. Например, Мурино и Кудрово — это Ленинградская область, а не Санкт-Петербург.</p></div>' +
      '<div class="pvz-pick" id="pvzPick" hidden></div></div>';
  }
  function optIc(n) { return '<span class="opt-ic"><img src="img/benefits/' + n + '.webp?v=13.57.1" alt="" width="48" height="48" decoding="async"></span>'; }
  function coStep(n, id, title, hint, body) {
    return '<section class="cstep" id="cs-' + id + '"><header class="cstep-head"><span class="cstep-n" aria-hidden="true"><i>' + n + '</i><svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9"/></svg></span>' +
      '<div><h3>' + title + '</h3><p>' + hint + '</p></div></header><div class="cstep-body">' + body + '</div></section>';
  }
  function checkout(v) {
    var buy = coSrc() === BuyNow;
    if (coSrc().get().length) { stat('k'); if (window.Metrika) Metrika.goal('checkout'); }
    if (!coSrc().get().length) { v.innerHTML = '<div class="wrap" style="padding-block:clamp(24px,5vw,64px)">' + emptyCartHtml(false) + '</div>'; return; }
    var s = D.settings, u = API.user || {}, methods = (s.delivery && s.delivery.methods) || [], pay = Object.assign({}, s.payment || {});
    if (!D.payReady) pay.online = false; // ЮKassa ещё не подключена — онлайн-оплату не предлагаем
    var st = { deliveryId: methods[0] && methods[0].id, payment: pay.online ? 'online' : 'cod', code: '', useBonus: false, city: null, pvz: null, sumSeq: 0 };
    function curMethod() { return methods.find(function (x) { return x.id === st.deliveryId; }); }
    function cdekMode() { return D.cdekReady ? Pricing.cdekMode(curMethod()) : null; }
    function pvzMode() { return cdekMode() === 'pvz'; }
    function doorMode() { return cdekMode() === 'door'; }
    v.innerHTML = '<div class="wrap"><div class="page-head"><div class="crumbs">' + (buy ? '<a href="javascript:history.back()">Товар</a><span>/</span><span>Быстрая покупка</span>' : '<a href="#/cart">Корзина</a><span>/</span><span>Оформление</span>') + '</div><h1>' + (buy ? 'Быстрая покупка' : 'Оформление заказа') + '</h1>' +
      (buy ? '<p class="buy-note"><span aria-hidden="true">' + ICON.bag + '</span>Оформляем только этот товар — ваша корзина' + (Cart.count() ? ' (' + Cart.count() + ' ' + plural(Cart.count(), 'вещь', 'вещи', 'вещей') + ')' : '') + ' останется без изменений.</p>' : '') + '</div>' +
      '<form class="checkout" id="coForm" novalidate><div>' +
      (!API.user ? '<div class="co-login"><span class="co-login-ic" aria-hidden="true">Б</span><p><b>Уже покупали у нас?</b> <a class="link" href="#/account?back=checkout">Войдите</a>, чтобы копить бонусы и видеть историю заказов. Можно оформить и без регистрации.</p></div>' : '') +
      '<div class="csteps">' +
      coStep(1, 'buyer', 'Покупатель', 'Для связи по заказу и электронного чека',
        '<div class="row2">' +
        '<label class="field"><span>Имя</span><input class="input" id="co-first" autocomplete="given-name" placeholder="Иван" value="' + esc(u.firstName || '') + '"></label>' +
        '<label class="field"><span>Фамилия</span><input class="input" id="co-last" autocomplete="family-name" placeholder="Иванов" value="' + esc(u.lastName || '') + '"></label>' +
        '<label class="field"><span>Телефон</span><input class="input" id="co-phone" type="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" value="' + esc(fmtPhone(u.phone)) + '"></label>' +
        '<label class="field"><span>Электронная почта</span><input class="input" id="co-email" type="email" autocomplete="email" placeholder="mail@example.ru" value="' + esc(u.email || '') + '"></label></div>') +
      coStep(2, 'deliv', 'Доставка', 'Выберите способ и укажите, куда привезти',
        '<div class="options" id="delivOpts"></div>' +
        '<div class="co-addr" id="addrBox"><div class="row2">' +
        '<label class="field"><span>Город или посёлок</span><input class="input" id="co-city" autocomplete="address-level2" placeholder="Москва"></label>' +
        '<label class="field"><span id="co-addr-l">Адрес</span><input class="input" id="co-addr" autocomplete="street-address" placeholder="Улица, дом, квартира"></label></div>' +
        '<p class="pvz-hint" id="addrHint" hidden>Указывайте свой населённый пункт и область: Мурино, Кудрово и Девяткино — это Ленинградская область, а не Санкт-Петербург.</p></div>' +
        pvzHtml() +
        '<details class="co-comment"' + '><summary>Добавить комментарий к заказу</summary><textarea class="textarea" id="co-comment" rows="2" placeholder="Например, удобное время для звонка"></textarea></details>') +
      coStep(3, 'pay', 'Оплата', 'Оплатите заказ сразу после подтверждения',
        '<div class="options" id="payOpts">' +
        (pay.online ? '<label class="option ico"><input type="radio" name="pay" value="online">' + optIc('payment') + '<span><b>' + esc(pay.onlineLabel || 'Онлайн') + (bonusCfg().enabled && bonusCfg().onlineExtra > 0 ? ' <em class="pay-bonus">+' + bonusCfg().onlineExtra + '% бонусами</em>' : '') + '</b><small>Быстро и безопасно через ЮKassa' + (bonusCfg().enabled && bonusCfg().onlineExtra > 0 ? (API.user ? '. Бонусы придут на следующий заказ' : '. Бонусы — для покупателей с личным кабинетом') : '') + '</small><span class="pay-marks" aria-label="Карта «Мир», СБП, SberPay, T-Pay"><i>МИР</i><i>СБП</i><i>SberPay</i><i>T-Pay</i></span></span><span></span></label>' : '') +
        (!pay.online && !pay.cod ? '<p class="demo-note">Оформление заказов временно недоступно — свяжитесь с нами по телефону из раздела «Контакты».</p>' : '') +
        (pay.cod ? '<label class="option ico"><input type="radio" name="pay" value="cod">' + optIc('cash') + '<span><b>' + esc(pay.codLabel || 'При получении') + '</b><small id="codHint">Наличными или картой при получении</small></span><span></span></label>' : '') + '</div>' +
        (pay.online ? '<p class="co-secure" id="coSecure"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg><span>После подтверждения откроется защищённая страница ЮKassa. Данные карты к нам не попадают, чек придёт на почту.</span></p>' : '') +
        '<p class="demo-note bonus-paid" id="bonusPaid" hidden>Заказ полностью оплачен бонусами — платить ничего не нужно.</p>') +
      '</div>' +
      '</div><aside class="summary"><h3 class="serif" style="font-size:28px">Ваш заказ</h3><div id="coSum"></div>' +
        '<div class="promo-form"><input class="input" id="co-code" placeholder="Промокод" autocomplete="off" aria-label="Промокод"><button type="button" class="btn ghost" id="applyCode">Применить</button></div><div class="promo-msg" id="promoMsg"></div>' +
        '<details class="co-gift" id="coGift"><summary>Есть подарочный сертификат?</summary><div class="promo-form"><input class="input" id="co-gift" placeholder="GIFT-XXXX-XXXX" autocomplete="off" autocapitalize="characters" aria-label="Код сертификата"><button type="button" class="btn ghost" id="applyGift">Применить</button></div><div class="gift-msg" id="giftMsg"></div></details>' +
        '<div id="coBonus"></div><div id="coTotals" style="display:grid;gap:10px"></div>' +
        // Оферта и согласие на обработку персональных данных — отдельными галочками (согласие по 152-ФЗ даётся отдельно от других документов)
        '<label class="check"><input type="checkbox" id="co-offer"> <span>Принимаю условия <a href="#/page/offer" data-page-modal="offer">публичной оферты</a></span></label>' +
        '<label class="check"><input type="checkbox" id="co-agree"> <span>Даю <a href="#/page/consent" data-page-modal="consent">согласие на обработку персональных данных</a></span></label>' +
        '<p class="form-error" id="coErr"></p><button class="btn block" id="coSubmit" type="submit">' + (st.payment === 'online' ? 'Оплатить заказ' : 'Подтвердить заказ') + '</button></aside></form></div>';
    phoneMask($('#co-phone'));

    function drawOpts() {
      $('#delivOpts').innerHTML = methods.map(function (m) { return '<label class="option ico' + (st.deliveryId === m.id ? ' on' : '') + '"><input type="radio" name="deliv" value="' + esc(m.id) + '"' + (st.deliveryId === m.id ? ' checked' : '') + '>' + optIc(m.needsAddress === false ? 'pin' : 'delivery') + '<span><b>' + esc(m.name) + '</b><small>' + esc(m.desc || '') + (m.freeFrom ? ' · бесплатно от ' + fmt(m.freeFrom) : '') + '</small></span><span class="num opt-price" data-dp="' + esc(m.id) + '"></span></label>'; }).join('');
      $$('#payOpts .option').forEach(function (o) { var i = $('input', o); i.checked = i.value === st.payment; o.classList.toggle('on', i.checked); });
      var m = methods.find(function (x) { return x.id === st.deliveryId; });
      var cm = cdekMode(), pm = cm === 'pvz';
      $('#addrBox').hidden = !(m && m.needsAddress !== false) || !!cm;
      $('#pvzBox').hidden = !cm;
      // СДЭК без подключённого подбора — вводят адрес пункта вручную, с подсказкой про область
      var manualPvz = !pm && Pricing.isPvzMethod(m);
      $('#co-addr-l').textContent = manualPvz ? 'Адрес пункта выдачи СДЭК' : 'Адрес';
      $('#co-addr').placeholder = manualPvz ? 'Например, Петровский бульвар, 7' : 'Улица, дом, квартира';
      $('#addrHint').hidden = !manualPvz;
      if (cm && !st.pvzInit) { st.pvzInit = true; st.mode = cm; pvzInit(); }
      // сменили пункт выдачи ↔ курьер: город оставляем, перерисовываем пункты или поле адреса
      else if (cm && st.mode !== cm) { st.mode = cm; if (st.city) pickCity(st.city, st.pvz && st.pvz.code); }
      // подсказки под оплатой зависят от выбранного способа
      if ($('#codHint')) $('#codHint').textContent = cm === 'door' ? 'Наличными или картой курьеру' : pm ? 'Наличными или картой в пункте выдачи СДЭК' : 'Наличными или картой при получении';
      $('#cs-pay .cstep-head p').textContent = st.payment === 'cod' ? 'Оплатите заказ при получении — наличными или картой' : 'Оплатите заказ сразу после подтверждения';
      if ($('#coSecure')) $('#coSecure').hidden = st.payment !== 'online' || st.free;
      submitLabel(); coProgress();
    }
    function submitLabel() { var b = $('#coSubmit'); if (b && !b.disabled) b.textContent = st.payment === 'online' && !st.free ? 'Оплатить заказ' : 'Подтвердить заказ'; }
    // Шаг отмечается галочкой, когда в нём всё заполнено
    function coProgress() {
      var ph = String($('#co-phone').value).replace(/\D/g, ''), em = $('#co-email').value.trim();
      var buyer = $('#co-first').value.trim() && ph.length === 11 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
      var m = methods.find(function (x) { return x.id === st.deliveryId; });
      var deliv = m && (m.needsAddress === false || (doorMode() ? !!st.city && (st.addr || '').trim().length >= 5 : pvzMode() ? !!st.pvz : $('#co-city').value.trim() && $('#co-addr').value.trim()));
      var payOk = !!$('#payOpts input:checked') || !$('#payOpts').children.length || $('#payOpts').hidden;
      [['buyer', buyer], ['deliv', deliv], ['pay', payOk && $('#payOpts').children.length]].forEach(function (x) { $('#cs-' + x[0]).classList.toggle('done', !!x[1]); });
    }
    checkoutRedraw = function () { drawSum(); };
    async function drawSum() {
      var contact = { email: $('#co-email').value, phone: $('#co-phone').value }, my = ++st.sumSeq;
      // цена СДЭК считается по городу выбранного пункта
      var extra = cdekMode() && st.city ? { cityCode: st.city.code, pvzType: doorMode() ? 'door' : st.pvz ? st.pvz.type : 'pvz' } : {};
      extra.payment = st.payment; if (st.gift) extra.gift = st.gift;
      var q = await cartQuote(st.code, st.deliveryId, contact, st.useBonus, extra);
      if (my !== st.sumSeq || !$('#coSum')) return q; // ответ пришёл, когда покупатель уже ушёл со страницы
      st.q = q;
      // Товары в заказе: количество и «Убрать» прямо здесь, без возврата в корзину
      st.issues = cartIssues(q).length;
      $('#coSum').innerHTML = issueBox(q) + '<div class="mini-lines co-lines">' + q.lines.map(function (l) {
        var key = esc(l.productId + '|' + (l.colorId || '') + '|' + l.size);
        return '<div class="mini-line co-line"><img src="' + esc(l.image || Art.make(l.art)) + '" alt=""><div><div>' + esc(l.name) + '</div><div class="sub">' + (l.color ? esc(l.color) + ' · ' : '') + 'размер ' + esc(l.size) + (l.problem ? ' · <span style="color:var(--danger)">' + esc(l.problem) + '</span>' : '') + '</div>' + (l.preorder ? preTag(l) : '') +
          '<div class="co-line-acts"><span class="co-qty"><button type="button" data-co-q="-1" data-co-key="' + key + '" aria-label="Меньше"' + (l.qty <= 1 ? ' disabled' : '') + '>−</button><b>' + l.qty + '</b><button type="button" data-co-q="1" data-co-key="' + key + '" aria-label="Больше">+</button></span>' +
          '<button type="button" class="co-rm" data-co-rm="' + key + '">Убрать</button></div></div><span class="num">' + fmt(l.total) + '</span></div>';
      }).join('') + '</div>';
      methods.forEach(function (m) {
        var el = $('[data-dp="' + m.id + '"]'); if (!el) return;
        var after = q.subtotal - q.promoDiscount, free = (m.freeFrom && after >= m.freeFrom) || (q.promo && q.promo.ok && q.promo.type === 'shipping');
        var auto = m.priceAuto && Pricing.cdekMode(m) && D.cdekReady;
        if (auto) { var cur = q.delivery && q.delivery.id === m.id; el.textContent = free ? 'Бесплатно' : cur && !q.delivery.pending ? (q.deliveryPrice ? fmt(q.deliveryPrice) : 'Бесплатно') : 'По тарифу СДЭК'; el.classList.toggle('calc', !free && !(cur && !q.delivery.pending)); return; }
        el.textContent = free || !m.price ? 'Бесплатно' : fmt(m.price);
      });
      if ($('#pvzDeliv')) $('#pvzDeliv').innerHTML = delivLine(q);
      var msg = $('#promoMsg');
      if (q.promo && PROMO_REASONS[q.promo.reason]) { msg.className = 'promo-msg'; msg.innerHTML = promoPlaque(q.promo); }
      else if (q.promo) { msg.textContent = q.promo.message; msg.className = 'promo-msg ' + (q.promo.ok ? 'ok' : 'bad'); } else { msg.textContent = ''; msg.className = 'promo-msg'; }
      $('#coTotals').innerHTML = '<div class="sum-row"><span>Товары</span><span>' + fmt(q.baseTotal) + '</span></div>' +
        (q.saleDiscount ? '<div class="sum-row disc"><span>Скидка по акциям</span><span>−' + fmt(q.saleDiscount) + '</span></div>' : '') +
        (q.promoDiscount ? '<div class="sum-row disc"><span>Промокод ' + esc(q.promo.code) + '</span><span>−' + fmt(q.promoDiscount) + '</span></div>' : '') +
        '<div class="sum-row"><span>Доставка' + (q.delivery && q.delivery.days ? ' <small class="muted">' + esc(q.delivery.days) + ' ' + plural(Number(String(q.delivery.days).split('–').pop()), 'день', 'дня', 'дней') + '</small>' : '') + '</span><span>' + (q.delivery ? (q.delivery.pending ? '<span class="muted">после выбора пункта</span>' : q.deliveryPrice ? fmt(q.deliveryPrice) : 'Бесплатно') : '—') + '</span></div>' +
        (q.bonusUsed ? '<div class="sum-row disc"><span>Оплата бонусами</span><span>−' + fmt(q.bonusUsed) + '</span></div>' : '') +
        (q.giftUsed ? '<div class="sum-row disc"><span>Подарочный сертификат</span><span>−' + fmt(q.giftUsed) + '</span></div>' : '') +
        '<div class="sum-row total"><span>К оплате</span><span>' + fmt(q.total) + '</span></div>' + earnRow(q);
      // Бонусный счёт: переключатель «списать», либо подсказка гостю
      var bal = q.bonus.balance, box = $('#coBonus');
      if (q.bonus.enabled && API.user && bal > 0) {
        box.innerHTML = '<label class="bonus-use' + (st.useBonus ? ' on' : '') + '"><input type="checkbox" id="co-bonus"' + (st.useBonus ? ' checked' : '') + '><span class="bu-switch" aria-hidden="true"></span>' +
          '<span class="bu-text"><b>Списать бонусы</b><small>' + (st.useBonus ? 'Спишем ' + bonusNum(q.bonusUsed) + ' ' + bonusWord(q.bonusUsed) + (bal > q.bonusUsed ? ', останется ' + bonusNum(bal - q.bonusUsed) : '') : 'На счёте ' + bonusNum(bal) + ' ' + bonusWord(bal) + ' · 1 бонус = 1 ₽') + '</small></span><span class="bu-sum num">' + (st.useBonus ? '−' + fmt(q.bonusUsed) : '') + '</span></label>';
      } else if (q.bonus.enabled && !API.user && q.bonusEarn > 0) {
        box.innerHTML = '<p class="bonus-guest"><i class="b-ic" aria-hidden="true">Б</i><span><a class="link" href="#/account?back=checkout">Войдите</a> — и получите +' + bonusNum(q.bonusEarn) + ' ' + bonusWord(q.bonusEarn) + ' за этот заказ</span></p>';
      } else box.innerHTML = '';
      var gm = $('#giftMsg');
      if (gm) gm.innerHTML = !q.gift ? '' : q.gift.ok ? '<div class="gift-ok"><span class="gift-ic" aria-hidden="true">✓</span><div><b>Сертификат ' + esc(q.gift.code) + ' — спишем ' + fmt(q.giftUsed) + '</b><small>' + esc(q.gift.message) + '</small></div><button type="button" class="link" data-gift-clear>Убрать</button></div>' : '<p class="promo-msg bad">' + esc(q.gift.message) + '</p>';
      var free = q.lines.length && q.total === 0;
      $('#bonusPaid').hidden = !free; $('#payOpts').hidden = free; st.free = free;
      if (free) $('#bonusPaid').textContent = 'Заказ полностью оплачен ' + (q.giftUsed && q.bonusUsed ? 'сертификатом и бонусами' : q.giftUsed ? 'подарочным сертификатом' : 'бонусами') + ' — платить ничего не нужно.';
      submitLabel(); if ($('#coSecure')) $('#coSecure').hidden = st.payment !== 'online' || free;
      return q;
    }
    /* ---- Пункт выдачи СДЭК: населённый пункт из списка (с областью) → пункт на карте адресов ---- */
    var LS_PVZ = 'albakov:pvz';
    function pvzSave() { try { localStorage.setItem(LS_PVZ, JSON.stringify({ city: st.city, pvz: st.pvz && st.pvz.code, addr: st.addr || '' })); } catch (e) {} }
    function pvzInit() {
      var q = $('#pvz-q'), sug = $('#pvzSug'), timer = 0, seq = 0, items = [], act = -1;
      function close() { sug.hidden = true; q.setAttribute('aria-expanded', 'false'); act = -1; }
      function paint() {
        sug.innerHTML = items.length ? items.map(function (c, i) { return '<li role="option" id="pvzo' + i + '" data-i="' + i + '"' + (i === act ? ' class="on" aria-selected="true"' : '') + '><b>' + esc(c.city) + '</b><span>' + esc(c.region || 'Россия') + '</span></li>'; }).join('') : '<li class="none">Ничего не нашли. Проверьте название — или впишите соседний город</li>';
        sug.hidden = false; q.setAttribute('aria-expanded', 'true'); q.setAttribute('aria-activedescendant', act >= 0 ? 'pvzo' + act : '');
      }
      q.addEventListener('input', function () {
        clearTimeout(timer); var v = q.value.trim(), my = ++seq;
        if (st.city) { st.city = null; st.pvz = null; st.q = null; $('#pvzPick').hidden = true; coProgress(); drawSum(); }
        if (v.length < 2) { close(); return; }
        timer = setTimeout(async function () {
          try { var r = await API.cdekCities(v); if (my !== seq) return; items = r; act = r.length ? 0 : -1; paint(); }
          catch (e) { if (my !== seq) return; items = []; sug.innerHTML = '<li class="none">' + esc(errMsg(e)) + '</li>'; sug.hidden = false; }
        }, 250);
      });
      q.addEventListener('keydown', function (e) {
        if (sug.hidden || !items.length) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act = (act + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; paint(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (act >= 0) pickCity(items[act]); }
        else if (e.key === 'Escape') close();
      });
      sug.addEventListener('mousedown', function (e) { var li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pickCity(items[Number(li.dataset.i)]); } });
      q.addEventListener('blur', function () { setTimeout(close, 120); });
      $('#pvzBox').addEventListener('click', function (e) {
        if (e.target.closest('[data-pvz-city]')) { st.city = null; st.pvz = null; drawSum(); q.value = ''; $('#pvzPick').hidden = true; $('#pvzCityBox').hidden = false; coProgress(); q.focus(); }
        if (e.target.closest('[data-pvz-change]')) { st.pvz = null; drawPoints(); coProgress(); }
      });
      $('#pvzBox').addEventListener('change', function (e) {
        if (e.target.name === 'pvz') { st.pvz = (st.points || []).find(function (x) { return x.code === e.target.value; }) || null; $('#pvzBox').classList.remove('invalid'); pvzSave(); drawPoints(); coProgress(); drawSum(); }
      });
      $('#pvzBox').addEventListener('input', function (e) {
        if (e.target.id === 'pvz-f') { st.filter = e.target.value; drawPoints(true); }
        if (e.target.id === 'door-addr') { st.addr = e.target.value; e.target.classList.remove('invalid'); pvzSave(); coProgress(); }
      });
      try { var saved = JSON.parse(localStorage.getItem(LS_PVZ) || 'null'); if (saved && saved.city && saved.city.code) { st.addr = saved.addr || ''; pickCity(saved.city, saved.pvz); } } catch (e) {}
    }
    async function pickCity(c, keep) {
      st.city = c; st.pvz = null; st.points = null; st.filter = ''; st.q = null;
      $('#pvz-q').value = c.city; $('#pvzSug').hidden = true; $('#pvzCityBox').hidden = true;
      var box = $('#pvzPick'); box.hidden = false;
      if (doorMode()) {
        // курьер: после города — только улица, дом, квартира
        box.innerHTML = cityChip() + '<label class="field pvz-door"><span>Улица, дом, квартира</span><input class="input" id="door-addr" autocomplete="street-address" placeholder="Например, ул. Ленина, 5, кв. 12" value="' + esc(st.addr || '') + '"></label>' +
          '<p class="pvz-door-note"><span id="pvzDeliv">' + delivLine(st.q) + '</span>' + (doorTry() ? ' · ' + doorTry() : '') + '</p>';
        streetCombo($('#door-addr'), function () { return st.city; });
        pvzSave(); coProgress(); drawSum(); return;
      }
      box.innerHTML = cityChip() + '<div class="pvz-load">Загружаем пункты выдачи…</div>';
      try {
        var pts = await API.cdekPoints(c.code); if (st.city !== c) return;
        st.points = pts;
        if (keep) st.pvz = pts.find(function (x) { return x.code === keep; }) || null;
        if (pts.length === 1 && !st.pvz) st.pvz = pts[0];
        pvzSave(); drawPoints(); coProgress(); drawSum();
      } catch (e) { if (st.city === c) box.innerHTML = cityChip() + '<p class="form-error">' + esc(errMsg(e)) + '</p>'; }
    }
    // Примерка и частичный выкуп — если они включены в договоре со СДЭК
    function tryNote(p) {
      var sv = (D.settings.cdek && D.settings.cdek.services) || {};
      if (!sv.partDeliv && !sv.tryOn) return '';
      return p.fitting && p.type !== 'postamat' ? '<span class="pvz-try">Можно примерить в пункте и забрать только то, что подошло' + (sv.partDeliv ? (st.payment === 'cod' ? ' — платите только за то, что берёте' : ' — за остальное вернём деньги') : '') + '</span>' : '<span class="pvz-try no">В этом пункте нет примерочной' + (sv.partDeliv && p.type !== 'postamat' ? ' — вещи можно проверить при получении и взять только то, что подошло' : '') + '</span>';
    }
    function delivLine(q) {
      var d = q && q.delivery; if (!d || d.pending) return 'Считаем стоимость доставки…';
      return 'Доставка ' + (d.days ? d.days + ' ' + plural(Number(String(d.days).split('–').pop()), 'день', 'дня', 'дней') + ' · ' : '') + (d.price ? fmt(d.price) : 'бесплатно');
    }
    function doorTry() {
      var sv = (D.settings.cdek && D.settings.cdek.services) || {};
      return sv.tryOn ? 'курьер подождёт, пока вы примерите' + (sv.partDeliv ? ', оплачиваете только то, что подошло' : '') : '';
    }
    function codNow() { return st.payment === 'cod' && pvzMode(); }
    function codNote(p) {
      if (st.payment !== 'cod') return '';
      return '<span class="pvz-try">Оплата при получении: ' + (p.cash && p.card ? 'наличными или картой' : p.cash ? 'наличными' : p.card ? 'картой' : 'в пункте выдачи') + '</span>';
    }
    function cityChip() {
      return '<div class="pvz-cityc"><span class="pvz-pin" aria-hidden="true"></span><div><b>' + esc(st.city.city) + '</b><span>' + esc(st.city.region || 'Россия') + '</span></div><button type="button" class="link" data-pvz-city>Другой город</button></div>';
    }
    function drawPoints(listOnly) {
      var box = $('#pvzPick'), pts = st.points || [];
      if (st.pvz) {
        var p = st.pvz;
        box.innerHTML = cityChip() + '<div class="pvz-chosen"><span class="pvz-ok" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9"/></svg></span><div><small>' + (p.type === 'postamat' ? 'Постамат СДЭК' : 'Пункт выдачи СДЭК') + '</small><b>' + esc(p.address) + '</b>' +
          '<span>' + esc([p.hours, p.metro ? 'м. ' + p.metro : ''].filter(Boolean).join(' · ')) + '</span>' + (p.note ? '<span class="pvz-note">' + esc(p.note) + '</span>' : '') + tryNote(p) + codNote(p) + '<span class="pvz-deliv" id="pvzDeliv">' + delivLine(st.q) + '</span></div><button type="button" class="link" data-pvz-change>Изменить</button></div>';
        return;
      }
      var all = pts.length, reset = st.codReset; st.codReset = false;
      if (codNow()) pts = pts.filter(function (p) { return p.cod; });
      if (!pts.length && all) { box.innerHTML = cityChip() + '<p class="pvz-empty">Здесь нет пунктов СДЭК, где можно оплатить при получении. Выберите оплату онлайн — тогда будут доступны все ' + all + ' ' + plural(all, 'пункт', 'пункта', 'пунктов') + '.</p>'; return; }
      if (!pts.length) { box.innerHTML = cityChip() + '<p class="pvz-empty">В этом населённом пункте нет пунктов выдачи СДЭК. Выберите ближайший город.</p>'; return; }
      var f = (st.filter || '').toLowerCase().trim();
      var shown = pts.filter(function (p) { return !f || (p.address + ' ' + p.metro + ' ' + p.name).toLowerCase().indexOf(f) !== -1; });
      var list = shown.length ? shown.map(function (p) {
        return '<label class="pvz-i"><input type="radio" name="pvz" value="' + esc(p.code) + '"><span class="pvz-txt"><b>' + esc(p.address) + '</b><small>' + esc([p.hours, p.metro ? 'м. ' + p.metro : ''].filter(Boolean).join(' · ')) + '</small></span>' +
          '<span class="pvz-tags">' + (p.type === 'postamat' ? '<em>Постамат</em>' : '') + (p.fitting ? '<em>Примерочная</em>' : '') + '</span></label>';
      }).join('') : '<p class="pvz-empty">По «' + esc(st.filter) + '» ничего не нашли</p>';
      if (listOnly && $('#pvzList')) { $('#pvzList').innerHTML = list; return; }
      box.innerHTML = cityChip() + (reset ? '<p class="pvz-warn">Выбранный пункт не принимает оплату при получении — выберите другой</p>' : '') +
        '<div class="pvz-tools"><b>' + pts.length + ' ' + plural(pts.length, 'пункт', 'пункта', 'пунктов') + (codNow() ? ' с оплатой при получении' : ' выдачи') + '</b>' +
        (pts.length > 5 ? '<input class="input" id="pvz-f" type="search" placeholder="Улица или метро" aria-label="Найти пункт по улице или метро" value="' + esc(st.filter || '') + '">' : '') + '</div>' +
        '<div class="pvz-list" id="pvzList" role="radiogroup" aria-label="Пункты выдачи">' + list + '</div>';
    }
    drawOpts(); drawSum();
    // Доставка по адресу без подбора СДЭК: улица и дом — тоже с подсказками
    streetCombo($('#co-addr'), function () { return { city: $('#co-city').value.trim() }; });
    ['#co-first', '#co-phone', '#co-email', '#co-city', '#co-addr'].forEach(function (q) { $(q).addEventListener('input', coProgress); });
    $('#delivOpts').addEventListener('change', function (e) { st.deliveryId = e.target.value; drawOpts(); drawSum(); });
    $('#coBonus').addEventListener('change', function (e) { if (e.target.id === 'co-bonus') { st.useBonus = e.target.checked; drawSum(); } });
    $('#payOpts').addEventListener('change', function (e) {
      st.payment = e.target.value;
      // при оплате при получении подходят не все пункты СДЭК
      if (codNow() && st.pvz && !st.pvz.cod) { st.pvz = null; st.codReset = true; pvzSave(); }
      drawOpts(); drawSum(); if (st.city && st.points) drawPoints();
    });
    $('#applyCode').addEventListener('click', function () { st.code = $('#co-code').value.trim(); drawSum(); });
    $('#applyGift').addEventListener('click', function () { st.gift = $('#co-gift').value.trim(); drawSum(); });
    $('#co-gift').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('#applyGift').click(); } });
    $('#giftMsg').addEventListener('click', function (e) { if (e.target.closest('[data-gift-clear]')) { st.gift = ''; $('#co-gift').value = ''; drawSum(); } });
    $('#promoMsg').addEventListener('click', function (e) {
      if (e.target.closest('[data-promo-clear]')) { st.code = ''; $('#co-code').value = ''; drawSum(); }
      if (e.target.closest('[data-promo-login]')) { try { sessionStorage.setItem('albakov:code', st.code); } catch (ex) {} }
    });
    // вернулись из входа — подставляем промокод, который покупатель вводил
    try { var saved = sessionStorage.getItem('albakov:code'); if (saved) { sessionStorage.removeItem('albakov:code'); st.code = saved; $('#co-code').value = saved; drawSum(); } } catch (ex) {}
    $('#co-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); st.code = e.target.value.trim(); drawSum(); } });
    $('#coForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var f = { firstName: $('#co-first').value.trim(), lastName: $('#co-last').value.trim(), phone: $('#co-phone').value, email: $('#co-email').value.trim() };
      var bad = [];
      [['co-first', f.firstName], ['co-last', f.lastName]].forEach(function (x) { $('#' + x[0]).classList.toggle('invalid', !x[1]); if (!x[1]) bad.push(1); });
      $('#co-phone').classList.toggle('invalid', !validPhone(f.phone)); if (!validPhone(f.phone)) bad.push(1);
      $('#co-email').classList.toggle('invalid', !validEmail(f.email)); if (!validEmail(f.email)) bad.push(1);
      var needAddr = !$('#addrBox').hidden;
      if (pvzMode() && !st.pvz) { bad.push(1); $('#pvzBox').classList.add('invalid'); $('#pvz-q').focus(); }
      if (doorMode() && (!st.city || (st.addr || '').trim().length < 5)) { bad.push(1); $('#pvzBox').classList.add('invalid'); if (!st.city) $('#pvz-q').focus(); else { $('#door-addr').classList.add('invalid'); $('#door-addr').focus(); } }
      if (needAddr) [['co-city'], ['co-addr']].forEach(function (x) { var el = $('#' + x[0]); el.classList.toggle('invalid', !el.value.trim()); if (!el.value.trim()) bad.push(1); });
      var err = $('#coErr');
      if (bad.length) { err.textContent = 'Заполните выделенные поля'; return; }
      if (!$('#co-offer').checked) { err.textContent = 'Примите условия публичной оферты'; return; }
      if (!$('#co-agree').checked) { err.textContent = 'Нужно согласие на обработку персональных данных'; return; }
      if (st.issues) { err.textContent = 'Часть вещей закончилась — нажмите «Убрать недоступное» в блоке «Ваш заказ»'; var ib = $('#coSum .cart-issue'); if (ib) ib.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      err.textContent = '';
      var btn = $('#coSubmit'); btn.disabled = true; btn.textContent = 'Оформляем…';
      try {
        if (!st.idem) st.idem = Array.from(crypto.getRandomValues(new Uint8Array(16)), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
        var r = await API.placeOrder({ gift: st.gift && st.q && st.q.gift && st.q.gift.ok ? st.gift : '', idem: st.idem, lines: coSrc().get(), code: st.code, deliveryId: st.deliveryId, payment: st.payment, useBonus: st.useBonus, customer: f, city: needAddr ? $('#co-city').value.trim() : '', address: needAddr ? $('#co-addr').value.trim() : doorMode() ? (st.addr || '').trim() : '', pvz: pvzMode() && st.pvz ? st.pvz.code : '', cityCode: cdekMode() && st.city ? st.city.code : '', pvzType: st.pvz ? st.pvz.type : '', comment: $('#co-comment').value.trim(), consent: true });
        if (window.Metrika && !r.repeated) { Metrika.ec('purchase', r.order.items.map(function (i) { var pp = D.products.find(function (x) { return x.id === i.productId; }); return pp ? ecItem(pp, i.color, i.size, i.qty, i.price) : { id: i.productId, name: i.name, price: i.price, quantity: i.qty }; }), { id: r.order.number, revenue: r.order.total }); Metrika.goal('order', { order_price: r.order.total, currency: 'RUB' }); }
        if (buy) BuyNow.clear(); else Cart.clear();
        // 13.64.8: онлайн-оплата — сначала страница заказа с отсчётом и кнопкой «Оплатить», ЮKassa — по нажатию
        if (r.payUrl) toast('Заказ оформлен — осталось оплатить');
        go('#/order/' + r.order.id);
      } catch (ex) { err.textContent = errMsg(ex); btn.disabled = false; drawSum(); }
    });
  }

  /* Плашка, когда промокод нельзя применить из-за ограничений по покупателю */
  var PROMO_REASONS = { login: 'Скидка для зарегистрированных', used: 'Скидка уже использована', first: 'Только на первый заказ' };
  function promoPlaque(pr) {
    var act = pr.reason === 'login'
      ? '<a class="link" href="#/account?back=checkout" data-promo-login>Войти или зарегистрироваться</a>'
      : '<button type="button" class="link" data-promo-clear>Убрать промокод</button>';
    return '<div class="promo-plaque pp-' + pr.reason + '" role="status"><span class="pp-icon" aria-hidden="true"></span><div><b>' + PROMO_REASONS[pr.reason] + '</b><p>' + esc(pr.message) + '</p>' + act + '</div></div>';
  }

  /* ---------- Заказ ---------- */
  // Трек-номер: номер крупно, копирование, ссылка на отслеживание в СДЭК
  function trackHtml(o) {
    var t = o.tracking; if (!t) return '';
    return '<div class="trk"><div class="trk-l"><span>Трек-номер ' + esc(t.carrier || 'СДЭК') + '</span><b class="num">' + esc(t.number) + '</b></div>' +
      '<div class="trk-a"><button type="button" class="btn ghost sm" data-copy-track="' + esc(t.number) + '">Скопировать</button><a class="btn sm" href="' + esc(t.url) + '" target="_blank" rel="noopener">Отследить посылку</a></div></div>';
  }
  // Что будет дальше — вместо обещания позвонить
  function orderNext(o) {
    var pickup = o.delivery && !o.delivery.address;
    if (o.status === 'canceled') return 'Заказ отменён.';
    if (o.status === 'returned' || o.payment.status === 'refunded') return 'Деньги по заказу возвращены. На карту они обычно приходят за 1–3 рабочих дня.';
    if (o.payment.method === 'online' && o.payment.status !== 'paid') return 'Заказ ждёт оплаты — после неё сразу начнём сборку.';
    if (o.payment.method === 'cod' && o.payment.status === 'pending' && o.status !== 'done') return 'Оплатите заказ при получении в пункте выдачи — наличными или картой. ' + (o.tracking ? 'Следите за посылкой по трек-номеру ниже.' : 'Когда передадим посылку в СДЭК, пришлём трек-номер на почту.');
    if (o.status === 'done') return 'Заказ получен. Спасибо, что выбрали ALBAKOV.';
    if (o.tracking) return 'Заказ передан в СДЭК — следите за ним по трек-номеру ниже.';
    if (pickup) return 'Соберём заказ и напишем на почту, когда его можно будет забрать.';
    return 'Соберём заказ и передадим в СДЭК, а трек-номер для отслеживания пришлём на почту.';
  }
  // Возврат через СДЭК: номер, который назвать в пункте
  function returnsHtml(o) {
    return (o.returns || []).filter(function (r) { return r.number; }).map(function (r) {
      var got = r.status === 'DELIVERED' || r.status === 'ACCEPTED_AT_PICK_UP_POINT';
      return '<div class="trk ret-c"><div class="trk-l"><span>Возврат через СДЭК</span><b class="num">' + esc(r.number) + '</b>' +
        '<small>' + (got ? 'Посылка у нас — скоро вернём деньги' : 'Отнесите вещи в любой пункт СДЭК и назовите этот номер. Заполнять ничего не нужно') + '</small></div>' +
        '<div class="trk-a"><button type="button" class="btn ghost sm" data-copy-track="' + esc(r.number) + '">Скопировать</button></div></div>';
    }).join('');
  }
  /* ---------- Обмен и возврат из карточки заказа ---------- */
  var REQ_REASONS = [['small', 'Маловата'], ['big', 'Великовата'], ['color', 'Не тот цвет'], ['defect', 'Брак'], ['other', 'Передумал']];
  function reqLines(r) { return r.lines.map(function (l) { return esc(l.name) + (l.color ? ', ' + esc(l.color) : '') + ', ' + esc(l.size) + (r.kind === 'exchange' ? ' → <b>' + esc(l.toSize) + '</b>' : '') + (l.qty > 1 ? ' × ' + l.qty : ''); }).join('<br>'); }
  function reqNote(o, r) {
    var ret = r.returnNumber || (o.returns || []).some(function (x) { return x.uuid === r.returnUuid && x.number; });
    var bring = ret ? 'Отнесите вещь в любой пункт СДЭК и назовите номер возврата выше.' : 'Номер для возврата через СДЭК пришлём на почту и в поддержку — обычно в течение дня.';
    if (r.status === 'declined') return 'Заявка отклонена' + (r.declineNote ? ': ' + esc(r.declineNote) : '') + '. Вопросы — в поддержке.';
    if (r.kind === 'exchange') {
      if (r.exchangeOrderId) return 'Вещь проверили и отправили новый размер — <a class="link" href="#/order/' + esc(r.exchangeOrderId) + '">заказ № ' + esc(r.exchangeNumber) + '</a>.';
      return bring + ' Новый размер уже отложили для вас и отправим, как только вещь придёт к нам и мы её проверим' + (r.free ? '. Доставка в обе стороны — за наш счёт.' : '.');
    }
    if (r.status === 'done') return 'Деньги возвращены.';
    if (r.status === 'received') return 'Вещь пришла и проверена — возвращаем деньги, обычно они приходят за 1–3 рабочих дня.';
    return bring + ' Деньги вернём, когда вещь придёт к нам и мы её проверим.';
  }
  function requestsHtml(o) {
    var list = (o.requests || []).slice().reverse().map(function (r) {
      return '<div class="req-card"><div class="req-ic">' + EXCH_IC + '</div><div><b>' + (r.kind === 'exchange' ? 'Обмен размера' : 'Возврат денег') + ' · ' + esc(r.reasonLabel) + '</b><span class="req-lines">' + reqLines(r) + '</span><p>' + reqNote(o, r) + '</p></div></div>';
    }).join('');
    var st = o.requestState, btn = st && st.ok ? '<div class="req-open"><button class="btn ghost" id="reqOpen">' + EXCH_IC + 'Обменять размер или вернуть</button><small class="muted">до ' + esc(fmtDate(st.until).replace(/ \d{4} г\.$/, '')) + (st.free ? ' · обмен бесплатно' : '') + '</small></div>' : '';
    return list || btn ? '<div class="req-box">' + list + btn + '</div>' : '';
  }
  function openRequest(o, done) {
    var can = (o.requestState && o.requestState.can) || [];
    var items = o.items.map(function (it, idx) { return { it: it, idx: idx, can: can[idx] != null ? can[idx] : it.qty - (it.refundedQty || 0) }; }).filter(function (x) { return x.can > 0; });
    if (!items.length) { toast('В заказе не осталось вещей для обмена или возврата', true); return; }
    var st = { idx: items[0].idx, reason: '', to: '' };
    function sizesOf(it) {
      var pr = D.products.find(function (x) { return x.id === it.productId; }), c = pr && Pricing.colorOf(pr, it.colorId);
      return c ? (c.sizes || []) : [];
    }
    function draw() {
      var x = items.find(function (y) { return y.idx === st.idx; }), it = x.it, sizes = sizesOf(it), cur = sizes.findIndex(function (s) { return s.size === it.size; });
      var exch = st.reason === 'small' || st.reason === 'big';
      if (exch && !st.to) { var nb = sizes[cur + (st.reason === 'small' ? 1 : -1)]; if (nb && nb.stock > 0) st.to = nb.size; }
      var c = exchangeCfg();
      $('#reqBody').innerHTML =
        (items.length > 1 ? '<div class="req-step"><span>Какая вещь?</span><div class="req-items">' + items.map(function (y) { return '<button type="button" class="req-item' + (y.idx === st.idx ? ' on' : '') + '" data-ri="' + y.idx + '"><img src="' + esc(y.it.image || Art.make(y.it.art)) + '" alt=""><span>' + esc(y.it.name) + '<small>' + (y.it.color ? esc(y.it.color) + ' · ' : '') + esc(y.it.size) + '</small></span></button>'; }).join('') + '</div></div>' :
          '<div class="req-one"><img src="' + esc(it.image || Art.make(it.art)) + '" alt=""><span>' + esc(it.name) + '<small>' + (it.color ? esc(it.color) + ' · ' : '') + esc(it.size) + '</small></span></div>') +
        '<div class="req-step"><span>Что не так?</span><div class="chips">' + REQ_REASONS.map(function (r) { return '<button type="button" class="chip' + (st.reason === r[0] ? ' on' : '') + '" data-rr="' + r[0] + '">' + r[1] + '</button>'; }).join('') + '</div></div>' +
        (exch ? '<div class="req-exch">' + EXCH_IC + '<div><b>' + (st.to ? 'Обменяем на ' + esc(st.to) + (c.free ? ' бесплатно' : '') : 'Обменяем на другой размер' + (c.free ? ' бесплатно' : '')) + '</b><span>Сдайте вещь в любом пункте СДЭК. Как только она придёт к нам и мы её проверим, сразу отправим новый размер' + (c.free ? '. Доставка в обе стороны за наш счёт.' : '.') + '</span>' +
          '<div class="chips">' + sizes.filter(function (s) { return s.size !== it.size; }).map(function (s) { return '<button type="button" class="chip' + (st.to === s.size ? ' on' : '') + '" data-rt="' + esc(s.size) + '"' + (s.stock > 0 ? '' : ' disabled title="Нет в наличии"') + '>' + esc(s.size) + '</button>'; }).join('') + '</div></div></div>' : '') +
        (st.reason ? '<label class="field"><span>Комментарий — если хотите</span><textarea class="input" id="reqCom" rows="2" maxlength="500"></textarea></label>' : '') +
        '<p class="form-error" id="reqErr"></p>' +
        (st.reason ? (exch ? '<button class="btn block" id="reqGo" data-kind="exchange"' + (st.to ? '' : ' disabled') + '>' + (st.to ? 'Обменять на ' + esc(st.to) : 'Выберите размер') + '</button><button type="button" class="link req-alt" id="reqRefund">Нет, вернуть деньги</button>' :
          '<button class="btn block" id="reqGo" data-kind="refund">Оформить возврат</button>') : '');
    }
    openModal('<div class="req-modal"><span class="eyebrow">Заказ № ' + esc(o.number) + '</span><h3 class="serif">Обмен и возврат</h3><div id="reqBody"></div></div>');
    draw();
    $('#reqBody').addEventListener('click', async function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.hasAttribute('data-ri')) { st.idx = +b.getAttribute('data-ri'); st.to = ''; draw(); return; }
      if (b.hasAttribute('data-rr')) { st.reason = b.getAttribute('data-rr'); st.to = ''; draw(); return; }
      if (b.hasAttribute('data-rt')) { st.to = b.getAttribute('data-rt'); draw(); return; }
      if (b.id === 'reqRefund' || b.id === 'reqGo') {
        var kind = b.id === 'reqRefund' ? 'refund' : b.getAttribute('data-kind');
        var x = items.find(function (y) { return y.idx === st.idx; });
        var go = $('#reqGo'); go.disabled = true; go.textContent = 'Оформляем…';
        try {
          var no = await API.orderRequest(o.id, { kind: kind, reason: st.reason, comment: $('#reqCom') ? $('#reqCom').value : '', lines: [{ idx: st.idx, qty: x.can > 1 ? 1 : x.can, toSize: kind === 'exchange' ? st.to : '' }] });
          closePanels(); toast(kind === 'exchange' ? 'Заявка на обмен принята' : 'Заявка на возврат принята'); done(no);
        } catch (ex) { $('#reqErr').textContent = errMsg(ex); go.disabled = false; draw(); }
      }
    });
  }
  async function orderPage(v, parts) {
    v.innerHTML = '<div class="loader">…</div>';
    // Ссылка из письма или push несёт секретный ключ заказа (?t=…): запоминаем его и убираем из адресной строки (аудит T-1, 16.11)
    try {
      var qs = new URLSearchParams(location.search), tk = qs.get('t');
      if (tk && /^[a-f0-9]{16,64}$/i.test(tk) && parts[1]) {
        var ot = {}; try { ot = JSON.parse(localStorage.getItem('vanta:otok') || '{}') || {}; } catch (e0) {}
        ot[parts[1]] = tk; try { localStorage.setItem('vanta:otok', JSON.stringify(ot)); } catch (e1) {}
        qs.delete('t'); history.replaceState(history.state, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash);
      }
    } catch (e2) {}
    try {
      var o = await API.getOrder(parts[1]);
      var payLabel = o.payment.method === 'exchange' ? 'Обмен по заказу № ' + (o.exchangeOf ? o.exchangeOf.number : '') : o.payment.method === 'gift' ? 'Оплачен подарочным сертификатом' : o.payment.method === 'bonus' ? 'Оплачен бонусами' : o.payment.method === 'online' ? PAY[o.payment.status] : 'Оплата при получении';
      v.innerHTML = '<div class="wrap"><div class="success"><span class="eyebrow">Заказ № ' + esc(o.number) + '</span><h1>' + (o.status === 'returned' ? 'Возврат оформлен' : o.payExpired ? 'Заказ отменён' : 'Спасибо за заказ') + '</h1>' +
        (o.payExpired ? '' : '<p class="muted" style="max-width:46ch">' + (D.mailReady ? 'Подтверждение придёт на ' + esc(o.customer.email) + (o.payment.method === 'online' && o.payment.status !== 'paid' ? ' после оплаты' : '') + '. ' : '') + orderNext(o) + '</p>') +
        // ждёт оплаты или время вышло — статус заказа («Новый», «Отменён») не показываем, его заменяет статус оплаты
        '<div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center">' + (o.payExpired || (o.payment.method === 'online' && o.payment.status === 'pending') ? '' : '<span class="status ' + esc(o.status) + '">' + esc(STATUS[o.status] || o.status) + '</span>') + '<span class="status ' + esc(o.payment.status) + '">' + esc(payLabel) + '</span></div>' +
        payTimerHtml(o) + trackHtml(o) + '<div class="push-slot" id="pushSlot"></div>' + returnsHtml(o) + (API.user || o.requestState ? requestsHtml(o) : '') +
        '<div class="order-card" style="width:100%;text-align:left">' + o.items.map(function (i) { return '<div class="mini-line"><img src="' + esc(i.image || Art.make(i.art)) + '" alt=""><div><div>' + esc(i.name) + '</div><div class="sub om">' + itemMeta(i) + '</div>' + (i.preorder ? preTag(i) : '') + '</div><span class="num">' + fmt(i.price * i.qty) + '</span></div>'; }).join('') +
          (o.promoDiscount ? '<div class="sum-row disc"><span>Промокод ' + esc(o.promoCode) + '</span><span>−' + fmt(o.promoDiscount) + '</span></div>' : '') +
          '<div class="sum-row"><span>' + esc(o.delivery && o.delivery.name || 'Доставка') + '</span><span>' + (o.delivery && o.delivery.price ? fmt(o.delivery.price) : 'Бесплатно') + '</span></div>' +
          (o.bonusUsed ? '<div class="sum-row disc"><span>Оплачено бонусами</span><span>−' + fmt(o.bonusUsed) + '</span></div>' : '') +
          '<div class="sum-row total"><span>Итого</span><span>' + fmt(o.total) + '</span></div>' +
          (o.refunds || []).map(function (r) { return '<div class="sum-row refund-row"><span>Возврат ' + esc(new Date(r.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })) + '</span><span>−' + fmt(r.amount) + '</span></div>'; }).join('') +
          (o.bonusEarn > 0 && o.status !== 'canceled' && o.status !== 'returned' ? '<div class="sum-row bonus-earn"><span><i class="b-ic" aria-hidden="true">Б</i>' + (o.bonusCredited ? 'Начислено бонусов' : 'Начислим ' + (bonusCfg().creditOn === 'done' ? 'после получения' : 'после оплаты')) + '</span><span>+' + bonusNum(o.bonusEarn) + '</span></div>' : '') + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' + (o.payUrl && o.payment.status === 'pending' ? '<a class="btn" href="' + esc(o.payUrl) + '">Оплатить заказ</a>' : '') + '<a class="btn ghost" href="#/catalog">Продолжить покупки</a>' + (API.user ? '<a class="btn ghost" href="#/account">Мои заказы</a><a class="btn ghost" href="#/account?tab=support&new=1&order=' + esc(o.id) + '">Вопрос по заказу</a>' : '') + '</div></div></div>';
      var ro = $('#reqOpen'); if (ro) ro.addEventListener('click', function () { openRequest(o, function () { orderPage(v, parts); }); });
      mountPayTimer(o, function () { orderPage(v, parts); });
      mountOrderPush(o);
      if (API.user) refreshBonus(); // после оплаты бонусы могли прийти — обновим счёт и покажем уведомление
    } catch (e) {
      // Заказ не открылся: подсказываем, как его найти (аудит T-3, 16.11)
      var nf = e && e.status === 404;
      v.innerHTML = '<div class="wrap"><div class="empty"><h3>Заказ не найден</h3><p>' + (nf ? 'Возможно, он оформлен на другом устройстве. Найдите его по номеру заказа и телефону' + (API.user ? '' : ' или войдите в личный кабинет') + '.' : esc(errMsg(e))) + '</p>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn" href="#/track">Найти по номеру и телефону</a>' + (nf && !API.user ? '<a class="btn ghost" href="#/account">Войти</a>' : '<a class="btn ghost" href="#/">На главную</a>') + '</div></div></div>';
    }
  }

  /* ---------- Время на оплату (13.64.7): 10 минут, как у страницы ЮKassa; отсчёт по часам сервера ----------
     Последние 5 минут — красным. Время вышло — заказ отменён, «Оформить заново» кладёт вещи обратно в корзину. */
  var PAY_WIN = 10 * 60e3;
  function payLeftMs(o) { return o.payBy ? Date.parse(o.payBy) - (Date.now() + (o._skew || 0)) : 0; }
  function mmss(ms) { var t = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
  /* «Проверьте перед оплатой» (13.64.8): что в заказе, куда везём, кто получает */
  function payCheckHtml(o) {
    var n = o.items.reduce(function (a, i) { return a + (i.qty || 1); }, 0), d = o.delivery || {}, c = o.customer || {};
    var ic = function (path) { return '<span class="pc-ic"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg></span>'; };
    var row = function (i, t, sub) { return '<div class="pc-row">' + i + '<div><b>' + esc(t) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div></div>'; };
    return '<div class="paycheck"><span class="pc-cap">Проверьте перед оплатой</span>' +
      row(ic('<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>'), n + ' ' + plural(n, 'вещь', 'вещи', 'вещей') + ' · ' + fmt(o.total), (function () { var g = {}, order = []; o.items.forEach(function (i) { if (!g[i.name]) { g[i.name] = []; order.push(i.name); } g[i.name].push(i.size); }); return order.map(function (n) { return n + ' · ' + g[n].join(', '); }).join('; '); })()) +
      row(ic('<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'), d.name || 'Доставка', [d.city, d.address].filter(Boolean).join(', ')) +
      row(ic('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'), [c.firstName, c.lastName].filter(Boolean).join(' '), c.phone ? fmtPhone(c.phone) : '') +
    '</div>';
  }
  /* Время на оплату вышло (13.64.8): наличие берём с сервера (stockNow) — в каталоге на странице остаток ещё уменьшен
     на этот заказ, и вещь выглядела бы разобранной. В корзину кладём сами один раз; строка уже есть — доводим количество */
  function expiredAvail(i) {
    var p = D.products.find(function (x) { return x.id === i.productId && x.active !== false; }); if (!p) return 0;
    var c = (p.colors || []).find(function (x) { return x.id === i.colorId; }), z = c && (c.sizes || []).find(function (x) { return x.size === i.size; });
    if (!z) return 0;
    return Math.min(i.qty || 1, typeof i.stockNow === 'number' ? i.stockNow : z.stock);
  }
  function ensureInCart(o) {
    o.items.forEach(function (i) { var want = expiredAvail(i); if (want <= 0) return; var have = (Cart.find(i.productId, i.colorId, i.size) || { qty: 0 }).qty; if (want > have) Cart.add(i.productId, i.colorId, i.size, want - have); });
  }
  function lsList(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } }
  function lsPush(k, id) { var a = lsList(k); if (a.indexOf(id) < 0) { a.push(id); try { localStorage.setItem(k, JSON.stringify(a.slice(-200))); } catch (e) {} } }
  // оплачен после срока: деньги пришли — вещи в корзину не кладём
  function paidLate(o) { return o.payExpired && (o.paidAfterCancel || o.payment.status === 'paid' || o.payment.status === 'refunded'); }
  function returnExpired(o) {
    // заказ возобновился (оплата пришла чуть позже срока) — убираем из корзины то, что туда вернули, чтобы не купить второй раз
    if (!o.payExpired && o.status !== 'canceled' && lsList('alb:expiredBack2').indexOf(o.id) >= 0 && lsList('alb:expiredUndo').indexOf(o.id) < 0) {
      o.items.forEach(function (i) { var c = Cart.find(i.productId, i.colorId, i.size); if (c) Cart.update(i.productId, i.colorId, i.size, Math.max(0, c.qty - (i.qty || 1))); });
      lsPush('alb:expiredUndo', o.id); return;
    }
    if (!o.payExpired || paidLate(o) || o.kind === 'gift') return;
    if (lsList('alb:expiredBack2').indexOf(o.id) < 0) { ensureInCart(o); lsPush('alb:expiredBack2', o.id); }
  }
  function payTimerHtml(o) {
    returnExpired(o);
    if (paidLate(o)) {
      // Оплата пришла после отмены, а вещи уже купили — деньги вернёт магазин
      var back2 = o.payment.status === 'refunded';
      var soldOut = function (i) { return (o.resumeMissing || []).indexOf([i.name, i.color, i.size].filter(Boolean).join(' · ')) >= 0; };
      return '<div class="paytm px"><div class="paytm-top"><div style="display:flex;gap:12px;align-items:center"><span class="paytm-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M7 15h4"/></svg></span>' +
        '<div><b class="paytm-t">' + (back2 ? 'Деньги вернули' : 'Оплата пришла после отмены') + '</b><small>Заказ № ' + esc(o.number) + ' отменён</small></div></div></div>' +
        (o.items.some(soldOut) ? '<div class="px-body"><div class="px-grp gone"><span class="pc-cap">Уже купили</span>' + o.items.filter(soldOut).map(function (i) {
          return '<div class="px-it"><span class="px-ph"><img src="' + esc(i.image || Art.make(i.art)) + '" alt=""><i>×</i></span><div><b>' + esc(i.name) + '</b><span class="om">' + itemMeta(i) + '</span></div></div>'; }).join('') + '</div></div>' : '') +
        '<p class="paytm-n">' + (back2 ? 'Деньги ушли на карту, с которой вы платили. Банк зачисляет их от нескольких минут до нескольких дней.' : 'Пока шла оплата, эти вещи успели купить. Мы вернём ' + fmt(o.total) + ' на карту, с которой вы платили, — напишем, когда деньги уйдут.') + '</p>' +
        '<a class="btn ghost" href="#/support">Написать в поддержку</a></div>';
    }
    if (o.payExpired && o.kind === 'gift') {
      // сертификат: «Уже разобрали» тут не к месту — деньги не списаны, его можно оформить заново (аудит M-1)
      return '<div class="paytm px"><div class="paytm-top"><div style="display:flex;gap:12px;align-items:center"><span class="paytm-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8v12M3 12h18M12 8c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1"/></svg></span>' +
        '<div><b class="paytm-t">Сертификат не оплачен</b><small>Заказ № ' + esc(o.number) + ' отменён</small></div></div></div>' +
        '<p class="paytm-n">Время на оплату вышло, деньги не списаны. Оформите сертификат заново — это займёт минуту.</p>' +
        '<a class="btn" href="#/gift">Оформить заново</a></div>';
    }
    if (o.payExpired) {
      var back = o.items.filter(function (i) { return expiredAvail(i) > 0; }), gone = o.items.filter(function (i) { return expiredAvail(i) <= 0; });
      var grp = function (list, cap, ok) {
        return '<div class="px-grp' + (ok ? '' : ' gone') + '"><span class="pc-cap">' + cap + '</span>' + list.map(function (i) {
          return '<div class="px-it"><span class="px-ph"><img src="' + esc(i.image || Art.make(i.art)) + '" alt=""><i>' + (ok ? '✓' : '×') + '</i></span><div><b>' + esc(i.name) + '</b><span class="om">' + itemMeta(i) + '</span></div></div>';
        }).join('') + '</div>';
      };
      return '<div class="paytm px"><div class="paytm-top"><div style="display:flex;gap:12px;align-items:center"><span class="paytm-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg></span>' +
        '<div><b class="paytm-t">Время на оплату вышло</b><small>Заказ № ' + esc(o.number) + ' отменён</small></div></div></div>' +
        '<div class="px-body">' + (back.length ? grp(back, 'Снова в вашей корзине', true) : '') + (gone.length ? grp(gone, 'Уже разобрали', false) : '') + '</div>' +
        '<p class="paytm-n">' + (back.length ? 'Успейте оформить заново, пока вещи в наличии.' : 'Загляните в каталог — там много нового, а этих размеров может появиться ещё.') + '</p>' +
        (back.length ? '<a class="btn" href="#/cart" id="pxCart">Оформить заново</a>' : '<a class="btn" href="#/catalog">В каталог</a>') + '</div>';
    }
    if (!(o.payment.method === 'online' && o.payment.status === 'pending' && o.status !== 'canceled' && o.payUrl && o.payBy)) return '';
    var left = payLeftMs(o), total = PAY_WIN, hot = left <= 5 * 60e3;
    return '<div class="paytm' + (hot ? ' hot' : '') + '" id="payTm"><div class="paytm-top"><div><b class="paytm-t">Заказ ждёт оплаты</b><small>Вещи отложены за вами</small></div>' +
      // таймер — кольцо в цвете раздела: тает вместе со временем, последние 5 минут — красное и мягко пульсирует (13.64.8)
      '<div class="paytm-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="trk" cx="50" cy="50" r="44"/><circle class="val" id="payRing" cx="50" cy="50" r="44" pathLength="100" stroke-dasharray="' + Math.max(0, Math.min(100, left / total * 100)).toFixed(2) + ' 100"/></svg>' +
        '<div class="paytm-clock"><span id="payLeft">' + mmss(left) + '</span><small>осталось</small></div></div></div>' +
      payCheckHtml(o) +
      '<p class="paytm-n" id="payNote">' + (hot ? 'Меньше 5 минут — потом заказ отменится, а вещи вернутся в корзину' : 'Не успеете — заказ отменится, а вещи вернутся в вашу корзину') + '</p>' +
      '<a class="btn" id="payGo" href="' + esc(o.payUrl) + '"' + (left <= 0 ? ' style="display:none"' : '') + '>Оплатить · ' + fmt(o.total) + '</a></div>';
  }
  function mountPayTimer(o, reload) {
    var pxc = $('#pxCart'); if (pxc) pxc.addEventListener('click', function () { ensureInCart(o); });
    var box = $('#payTm'); if (!box) return;
    var timer = setInterval(function () {
      if (!document.body.contains(box)) { clearInterval(timer); return; }
      var left = payLeftMs(o), hot = left <= 5 * 60e3;
      $('#payLeft').textContent = mmss(left); $('#payRing').setAttribute('stroke-dasharray', Math.max(0, Math.min(100, left / PAY_WIN * 100)).toFixed(2) + ' 100');
      if (left <= 0) { $('#payNote').textContent = 'Время вышло — проверяем, не прошла ли оплата…'; $('#payGo').style.display = 'none'; }
      if (hot && left > 0 && !box.classList.contains('hot')) { box.classList.add('hot'); $('#payNote').textContent = 'Меньше 5 минут — потом заказ отменится, а вещи вернутся в корзину'; }
      if (left <= -75000) { clearInterval(timer); reload(); }   // сервер отменит заказ — покажем «Время вышло»
    }, 1000);
  }

  /* ---------- Push-уведомления (13.60): карточка на странице заказа и настройки в кабинете ----------
     Как будет выглядеть уведомление, показываем заранее — на «экране телефона» рядом с кнопкой. */
  var BELL = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>';
  function pushMock(title, body, img) {
    return '<div class="pn-stage" aria-hidden="true"><span class="pn-clock">' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + '</span>' +
      '<div class="pn"><div class="pn-head"><img class="pn-app" src="img/icon-192.png" alt=""><span>' + esc(D.settings.storeName || 'ALBAKOV') + '</span><time>сейчас</time></div>' +
      '<div class="pn-main"><div class="pn-txt"><b>' + esc(title) + '</b><p>' + esc(body) + '</p></div>' + (img ? '<img class="pn-thumb" src="' + esc(img) + '" alt="">' : '') + '</div></div></div>';
  }
  function orderToken(id) { try { return (JSON.parse(localStorage.getItem('vanta:otok') || '{}') || {})[id] || ''; } catch (e) { return ''; } }
  async function mountOrderPush(o) {
    var slot = $('#pushSlot'); if (!slot || !window.Push) return;
    if (['done', 'canceled', 'returned'].indexOf(o.status) !== -1) { slot.remove(); return; }
    var st = await Push.state('customer'), extra = { orderId: o.id, t: orderToken(o.id) };
    if (!document.body.contains(slot)) return;
    if (st === 'on') { Push.link('customer', extra); slot.innerHTML = '<p class="push-on">' + BELL + '<span>Уведомления о заказе включены — сообщим, когда он будет в пути и когда приедет в пункт выдачи.</span></p>'; return; }
    if (st === 'unsupported' || (st === 'ios-app' && !appStoreUrl())) { slot.remove(); return; } // уведомления — только в приложении (13.64.6)
    var pv = o.delivery && o.delivery.pvz, img = (o.items.find(function (i) { return i.image; }) || {}).image || '';
    var mock = pv ? pushMock(pv.type === 'postamat' ? 'Заказ ждёт в постамате' : 'Заказ ждёт в пункте выдачи', (pv.type === 'postamat' ? 'Постамат' : 'Пункт СДЭК') + ' · ' + (pv.address || ''), img)
      : pushMock('Курьер везёт заказ № ' + o.number, 'Сегодня привезём по вашему адресу. Курьер позвонит перед приездом.', img);
    var ios = st === 'ios-app', denied = st === 'denied';
    slot.innerHTML = '<div class="pushc"><div class="pushc-t"><span class="pushc-ic">' + BELL + '</span>' +
      '<h3>Узнайте первым, когда заказ приедет</h3>' +
      '<p>' + (ios ? 'Уведомления о заказе приходят в приложении ALBAKOV для iPhone. Скачайте его, войдите в кабинет — заказ будет там вместе с уведомлениями.' : denied ? 'Уведомления для этого сайта запрещены в настройках браузера. Разрешите их — и сообщим, когда заказ будет в пути и в пункте выдачи.' : 'Одно нажатие — и сообщим, когда заказ будет в пути, когда приедет в пункт выдачи, и напомним забрать. Без рекламы.') + '</p>' +
      (denied ? '' : ios ? '<a class="btn" href="' + esc(appStoreUrl()) + '" target="_blank" rel="noopener">Скачать в App Store</a>' : '<button class="btn" type="button" id="pushGo">Включить уведомления</button>') + '<p class="form-error" id="pushErr"></p></div>' + mock + '</div>';
    var b = $('#pushGo', slot); if (!b) return;
    b.addEventListener('click', async function () {
      b.disabled = true; b.textContent = 'Включаем…';
      try { await Push.enable('customer', extra); toast('Готово — сообщим, как только заказ сдвинется'); mountOrderPush(o); }
      catch (e) { $('#pushErr', slot).textContent = errMsg(e); b.disabled = false; b.textContent = 'Включить уведомления'; }
    });
  }
  /* Окно «Включите уведомления» при входе в приложение (13.60.1): только в установленном приложении,
     пока уведомления на этом устройстве не включены. Системный запрос браузер разрешает показать только по нажатию,
     поэтому сначала — своё окно с примером, а кнопка «Включить» уже вызывает системное «Разрешить».
     «Не сейчас» — спросим снова через 7 дней, всего не больше 3 раз. Сотруднику одно нажатие включает и уведомления панели. */
  var PUSH_ASK = 'albakov:push-ask';
  async function appPushAsk() {
    if (!window.Push || !Push.supported || !Push.installed()) return;
    var cust = await Push.state('customer'), staff = API.isAdmin ? await Push.state('staff') : 'on';
    if (cust !== 'off' && staff !== 'off') return;
    var seen = {}; try { seen = JSON.parse(localStorage.getItem(PUSH_ASK) || '{}') || {}; } catch (e) { return; }
    if ((seen.n || 0) >= 3 || (seen.at && Date.now() - seen.at < 7 * 864e5)) return;
    if ($('.modal.open, .drawer.open')) { setTimeout(appPushAsk, 4000); return; }
    var mark = function () { try { localStorage.setItem(PUSH_ASK, JSON.stringify({ n: (seen.n || 0) + 1, at: Date.now() })); } catch (e) { /* ничего */ } };
    mark();
    var adm = !!API.isAdmin;
    var mock = adm ? pushMock('Новый заказ № 1042 · 5 798 ₽', 'Анна Смирнова, Москва\nФутболка AV, чёрная, L', '') : pushMock('Заказ ждёт в пункте выдачи', 'Пункт СДЭК · Тверская, 1. Можно примерить на месте', '');
    var LI = function (t) { return '<li><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>' + t + '</span></li>'; };
    openModal('<div class="pask">' + mock +
      '<h3>Включите уведомления</h3>' +
      '<ul class="pask-list">' + (adm
        ? LI('Новые заказы и оплаты — сразу') + LI('Вопросы покупателей и заявки на обмен') + LI('Заканчиваются размеры, итоги дня')
        : LI('Заказ в пути и ждёт в пункте выдачи') + LI('Ответы поддержки и обмен размера') + LI('Без рекламы — акции только по желанию')) + '</ul>' +
      '<p class="form-error" id="paskErr"></p>' +
      '<div class="pask-btns"><button class="btn" type="button" id="paskOn">Включить уведомления</button><button class="btn ghost" type="button" data-act="close">Не сейчас</button></div></div>');
    var b = $('#paskOn'); if (!b) return;
    b.addEventListener('click', async function () {
      b.disabled = true; b.textContent = 'Включаем…';
      try {
        if (cust === 'off') await Push.enable('customer');
        if (adm && staff === 'off') await Push.enable('staff');
        try { localStorage.setItem(PUSH_ASK, JSON.stringify({ n: 9, at: Date.now() })); } catch (e) { /* ничего */ }
        closePanels(); toast(adm ? 'Готово — заказы и вопросы будут приходить сразу' : 'Готово — сообщим, как только заказ сдвинется');
      } catch (e) { var er = $('#paskErr'); if (er) er.textContent = errMsg(e); b.disabled = false; b.textContent = 'Включить уведомления'; }
    });
  }
  var PUSH_KINDS = [['orders', 'Заказы', 'В пути, ждёт в пункте выдачи, курьер везёт, напоминание забрать'], ['support', 'Ответы поддержки', 'Когда мы ответили на ваш вопрос'], ['returns', 'Обмен и возврат', 'Новый размер отправлен, деньги вернулись'], ['stock', 'Снова в наличии', 'Размер, о котором вы просили сообщить, появился'], ['bonus', 'Бонусы', 'Начисления на бонусный счёт'], ['promo', 'Акции и новинки', 'Редко и только о важном — по желанию']];
  async function pushSettings(box) {
    if (!box || !window.Push) return;
    var st = await Push.state('customer'), r = null;
    try { r = await API.pushPrefs(); } catch (e) { box.remove(); return; }
    if (!document.body.contains(box)) return;
    var kinds = PUSH_KINDS.filter(function (k) { return k[0] !== 'bonus' || bonusCfg().enabled; });
    var dev = st === 'on' ? '<span class="pushs-st on">Включены на этом устройстве</span><span class="pushs-btns"><button class="btn ghost sm" type="button" data-ps="test">Проверить</button><button class="btn ghost sm" type="button" data-ps="off">Выключить</button></span>'
      : st === 'ios-app' ? '<span class="pushs-st">Уведомления приходят в приложении ALBAKOV для iPhone — там же их можно настроить</span>' + (appStoreUrl() ? '<a class="btn sm" href="' + esc(appStoreUrl()) + '" target="_blank" rel="noopener">Скачать в App Store</a>' : '')
      : st === 'denied' ? '<span class="pushs-st">Запрещены в настройках браузера для этого сайта</span>'
      : st === 'unsupported' ? '<span class="pushs-st">Этот браузер не поддерживает уведомления</span>'
      : '<span class="pushs-st">Выключены на этом устройстве</span><button class="btn sm" type="button" data-ps="on">Включить</button>';
    box.innerHTML = '<legend>Уведомления на телефон</legend><p>Приходят сразу, даже когда сайт закрыт' + (r.devices > 1 ? ' · включены на ' + r.devices + ' ' + plural(r.devices, 'устройстве', 'устройствах', 'устройствах') : '') + '.</p>' +
      '<div class="pushs-dev">' + BELL + dev + '</div>' +
      '<div class="pushs-list">' + kinds.map(function (k) { return '<label class="pushs-row"><span><b>' + k[1] + '</b><small>' + k[2] + '</small></span><span class="adm-switch"><input type="checkbox" data-pk="' + k[0] + '"' + (r.prefs[k[0]] ? ' checked' : '') + '><span></span></span></label>'; }).join('') + '</div>' +
      '<p class="form-error" data-ps-err></p>';
    box._r = r; if (box._bound) return; box._bound = true;
    var err = function () { return $('[data-ps-err]', box) || {}; };
    box.addEventListener('change', async function (e) {
      var i = e.target.closest('[data-pk]'); if (!i) return; var r = box._r;
      r.prefs[i.getAttribute('data-pk')] = i.checked;
      try { await API.pushPrefs(r.prefs); toast('Сохранено'); } catch (ex) { err().textContent = errMsg(ex); i.checked = !i.checked; r.prefs[i.getAttribute('data-pk')] = i.checked; }
    });
    box.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-ps]'); if (!b) return; var a = b.getAttribute('data-ps'); err().textContent = '';
      b.disabled = true;
      try {
        if (a === 'on') { await Push.enable('customer'); toast('Уведомления включены'); }
        if (a === 'off') { await Push.disable('customer'); toast('Уведомления на этом устройстве выключены'); }
        if (a === 'test') { await Push.test('customer'); toast('Отправили — уведомление появится через пару секунд'); }
        if (a !== 'test') pushSettings(box); else b.disabled = false;
      } catch (ex) { err().textContent = errMsg(ex); b.disabled = false; }
    });
  }

  /* ---------- Личный кабинет ---------- */
  /* ---------- Личный кабинет ----------
     Сверху — приветствие и бонусная карта, ниже — вкладки: заказы, бонусы, поддержка, профиль.
     Заказы показываются со шкалой: принят → собирается → в пути → получен. */
  var ACC_ICON = {
    box: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.3v9.4L12 21l-8-4.3V7.3z"/><path d="M4 7.3l8 4.3 8-4.3M12 11.6V21"/></svg>',
    swap: '<svg viewBox="0 0 24 24"><path d="M5 8h13l-3.5-3.5M19 16H6l3.5 3.5"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 16 15H9l-4 3.5V15H4a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 4 5.5z"/><path d="M7 9.5h7M7 12h4.5"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14M10 12h10M16.5 8.5L20 12l-3.5 3.5"/></svg>',
    chev: '<svg class="acc-chev" viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></svg>'
  };
  var ORDER_STEPS = [['new', 'Принят'], ['processing', 'Собирается'], ['shipped', 'В пути'], ['done', 'Получен']];
  var supportPoll = null;
  function account(v, parts, q) {
    clearInterval(supportPoll);
    if (!API.user) return authPage(v, q.tab === 'register' ? 'register' : 'login', q.back || (q.tab === 'support' ? 'support' : ''));
    var u = API.user, bOn = bonusCfg().enabled || (u.bonus || 0) > 0;
    var tab = q.tab || 'orders';
    if (tab === 'bonus' && !bOn) tab = 'orders';
    if (['orders', 'favorites', 'bonus', 'support', 'profile'].indexOf(tab) === -1) tab = 'orders';
    var since = '';
    // «с октября 2026»: месяц в родительном падеже — берём его из полной даты
    try { since = new Date(u.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\d+\s/, '').replace(/ г\.$/, ''); } catch (e) {}
    var focus = tab === 'support' && (q.id || q.new === '1');
    var name = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Покупатель';
    var bal = u.bonus || 0;
    // Кабинет (13.63): карточка покупателя цветом раздела, главное — плитками, остальное — коротким списком
    var tile = function (t, ic, title, sub, id, dot) {
      return '<a class="acc-tile' + (t === tab ? ' on' : '') + '" href="#/account?tab=' + t + '"' + (t === tab ? ' aria-current="page"' : '') + '><span class="acc-tile-ic">' + ic + '</span><b>' + title + '</b><small' + (id ? ' id="' + id + '"' : '') + '>' + sub + '</small>' + (dot ? '<i class="acc-dot" aria-label="Есть ответ"></i>' : '') + '</a>';
    };
    v.innerHTML = '<div class="wrap acc' + (focus ? ' acc-focus' : '') + '">' +
      '<section class="acc-a">' +
        '<div class="acc-card">' +
          '<div class="acc-me"><span class="acc-ava" aria-hidden="true">' + esc((u.firstName || name).charAt(0).toUpperCase()) + '</span><div><h1>' + esc(name) + '</h1>' + (since ? '<small>С нами с ' + esc(since) + '</small>' : '') + '</div>' +
            '<a class="acc-edit" href="#/account?tab=profile" aria-label="Профиль">' + ACC_ICON.edit + '</a></div>' +
          (bOn ? '<a class="acc-bal" href="#/account?tab=bonus"><span><small>Бонусы на счёте</small><b class="num">' + bonusNum(bal) + '</b></span><span class="acc-bal-n">1 бонус = 1 ₽<br>можно оплатить весь заказ</span></a>' : '') +
        '</div>' +
        '<nav class="acc-tiles" aria-label="Разделы кабинета">' +
          tile('orders', ACC_ICON.box, 'Заказы', 'загружаю…', 'accOrdersSub') +
          tile('favorites', ICON.heart, 'Избранное', Fav.count() + ' ' + plural(Fav.count(), 'товар', 'товара', 'товаров')) +
          (exchangeCfg().enabled ? '<a class="acc-tile" href="#/account?tab=orders&exchange=1"><span class="acc-tile-ic">' + ACC_ICON.swap + '</span><b>Обмен и возврат</b><small>оформить по своему заказу</small></a>' : '') +
          tile('support', ACC_ICON.chat, 'Поддержка', 'ответим в чате', '', u.supportUnread) +
        '</nav>' +
      '</section>' +
      (q.exchange === '1' ? '<p class="acc-hint">Откройте заказ и нажмите «Обменять размер или вернуть».</p>' : '') +
      '<div class="acc-body" id="accBody"><div class="loader" style="min-height:240px">…</div></div>' +
      '<nav class="acc-more" aria-label="Ещё">' +
        '<a href="#/account?tab=profile"' + (tab === 'profile' ? ' class="on"' : '') + '>' + ICON.user + '<span>Профиль и уведомления</span>' + ACC_ICON.chev + '</a>' +
        (API.isAdmin ? '<a href="#/admin">' + ACC_ICON.grid + '<span>Панель управления</span>' + ACC_ICON.chev + '</a>' : '') +
        '<button type="button" class="acc-out" id="accOut">' + ACC_ICON.out + '<span>Выйти</span></button>' +
      '</nav>' +
    '</div>';
    $('#accOut').addEventListener('click', async function () { await API.logout(); renderShell(); toast('Вы вышли из аккаунта'); go('#/'); });
    var body = $('#accBody');
    // Подпись у «Заказов»: сколько в работе — после загрузки
    API.myOrders().then(function (list) {
      var f = $('#accOrdersSub'); if (!f || !document.body.contains(f)) return;
      var active = list.filter(function (o) { return o.status !== 'done' && o.status !== 'canceled' && o.status !== 'returned'; }).length;
      f.textContent = active ? active + ' в пути и в работе' : list.length ? list.length + ' ' + plural(list.length, 'заказ', 'заказа', 'заказов') : 'пока нет';
      if (tab === 'orders') body.innerHTML = ordersHtml(list);
    }).catch(function (e) { if (tab === 'orders') body.innerHTML = '<p class="form-error">' + esc(errMsg(e)) + '</p>'; });
    // свежие данные покупателя: баланс, новые начисления, ответы поддержки
    API.myBonus().then(function (r) {
      if (!document.body.contains(body)) return;
      markBonusDot();
      if (!bOn) return;
      if (tab === 'bonus') { body.innerHTML = bonusTabHtml(r.user, r.bonusLog); if (r.user.bonusNews.length) seenBonus(); }
      else showBonusNews();
    }).catch(function () {});
    if (tab === 'profile') profileTab(body, u);
    if (tab === 'support') supportTab(body, q);
    if (tab === 'favorites') { body.innerHTML = '<div class="fav-box" data-compact></div>'; bindFavList($('.fav-box', body)); }
  }

  /* ---------- Адреса доставки ---------- */
  /* Поле с подсказками (город из базы СДЭК, улица и дом): стрелки, Enter, Esc, нажатие пальцем.
     opts: input, fetch(q) → Promise<items>, item(x) → html, pick(x), min — с какой длины искать */
  function bindCombo(o) {
    var q = o.input, box = document.createElement('ul'), timer = 0, seq = 0, items = [], act = -1, id = 'cmb' + Math.random().toString(36).slice(2, 8);
    box.className = 'pvz-sug'; box.id = id; box.setAttribute('role', 'listbox'); box.hidden = true;
    var wrap = document.createElement('div'); wrap.className = 'pvz-combo'; q.parentNode.insertBefore(wrap, q); wrap.appendChild(q); wrap.appendChild(box);
    q.setAttribute('role', 'combobox'); q.setAttribute('aria-autocomplete', 'list'); q.setAttribute('aria-controls', id); q.setAttribute('aria-expanded', 'false'); q.setAttribute('autocomplete', 'off');
    function close() { box.hidden = true; q.setAttribute('aria-expanded', 'false'); act = -1; }
    function paint() {
      if (!items.length) { if (o.empty) { box.innerHTML = '<li class="none">' + o.empty + '</li>'; box.hidden = false; } else close(); return; }
      box.innerHTML = items.map(function (x, i) { return '<li role="option" id="' + id + i + '" data-i="' + i + '"' + (i === act ? ' class="on" aria-selected="true"' : '') + '>' + o.item(x) + '</li>'; }).join('');
      box.hidden = false; q.setAttribute('aria-expanded', 'true');
    }
    function choose(x) { close(); o.pick(x); }
    q.addEventListener('input', function () {
      clearTimeout(timer); var v = q.value.trim(), my = ++seq;
      if (o.onType) o.onType();
      if (v.length < (o.min || 2)) { close(); return; }
      timer = setTimeout(function () {
        Promise.resolve(o.fetch(v)).then(function (r) { if (my !== seq || document.activeElement !== q) return; items = r || []; act = items.length ? 0 : -1; paint(); }, function () { if (my === seq) { items = []; close(); } });
      }, 260);
    });
    q.addEventListener('keydown', function (e) {
      if (box.hidden || !items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act = (act + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (act >= 0) choose(items[act]); }
      else if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
    box.addEventListener('mousedown', function (e) { var li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); choose(items[Number(li.getAttribute('data-i'))]); } });
    q.addEventListener('blur', function () { setTimeout(close, 150); });
    return { close: close };
  }
  // Подсказка улицы: «улица Петровка, 21» — после выбора курсор в конце, остаётся дописать квартиру
  function streetCombo(input, cityOf) {
    return bindCombo({ input: input, min: 3,
      fetch: function (v) { var c = cityOf(); return c && c.city ? API.geoStreet(v, c.city, c.region) : []; },
      item: function (x) { return '<b>' + esc(x.label) + '</b>' + (x.house ? '' : '<span>улица</span>'); },
      pick: function (x) { input.value = x.label + (x.house ? ', кв. ' : ', '); input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {} }
    });
  }

  function orderTrack(o) {
    if (o.status === 'canceled') return '<div class="ao-track is-canceled"><span class="ao-state">Отменён</span></div>';
    if (o.status === 'returned') return '<div class="ao-track is-canceled is-returned"><span class="ao-state">Возврат · вернули ' + fmt(o.refunded || o.total) + '</span></div>';
    var at = Math.max(0, ORDER_STEPS.findIndex(function (s) { return s[0] === o.status; }));
    return '<div class="ao-track" style="--done:' + at + '" aria-label="Статус: ' + esc(ORDER_STEPS[at][1]) + '"><ol>' + ORDER_STEPS.map(function (s, i) {
      return '<li class="' + (i < at ? 'is-done' : i === at ? 'is-now' : '') + '"><i></i><span>' + s[1] + '</span></li>';
    }).join('') + '</ol></div>';
  }
  /* Строка вещи в списках заказов (13.64.7): что за покупка — название, цвет, размер, количество, артикул */
  function itemMeta(i) { return [i.color, i.size, (i.qty || 1) + ' шт.', i.sku ? 'арт. ' + i.sku : ''].filter(Boolean).map(function (x) { return '<i>' + esc(x) + '</i>'; }).join(' · '); }
  function payOpen(o) { return o.payment && o.payment.method === 'online' && o.payment.status === 'pending' && o.status !== 'canceled' && o.payBy && payLeftMs(o) > 0; }
  function ordersHtml(list) {
    list.forEach(returnExpired);   // время на оплату вышло — вещи снова в корзине; заказ возобновился — убираем их обратно
    if (!list.length) return '<div class="acc-empty"><h3>У Вас пока нет заказов</h3><p>Здесь будут отображаться Ваши покупки и информация об их текущем статусе</p><a class="btn" href="#/catalog">Перейти в каталог</a></div>';
    return '<div class="acc-orders">' + list.map(function (o) {
      var n = o.items.reduce(function (s, i) { return s + (i.qty || 1); }, 0), open = payOpen(o);
      var thumbs = o.items.slice(0, 3).map(function (i) { return '<img src="' + esc(i.image || Art.make(i.art)) + '" alt="" loading="lazy">'; }).join('') + (o.items.length > 3 ? '<em>+' + (o.items.length - 3) + '</em>' : '');
      var lines = o.items.slice(0, 2).map(function (i) { return '<div class="ao-it"><b>' + esc(i.name) + '</b><span>' + itemMeta(i) + '</span></div>'; }).join('') +
        (o.items.length > 2 ? '<span class="ao-more">и ещё ' + (o.items.length - 2) + ' ' + plural(o.items.length - 2, 'вещь', 'вещи', 'вещей') + '</span>' : '');
      var pay = open ? '<span class="ao-paybtn' + (payLeftMs(o) <= 5 * 60e3 ? ' hot' : '') + '" data-pay="' + esc(o.payUrl || '') + '" data-payby="' + esc(o.payBy) + '" data-skew="' + (o._skew || 0) + '">Оплатить · осталось <b class="num">' + mmss(payLeftMs(o)) + '</b></span>' : '';
      return '<a class="acc-order" href="#/order/' + esc(o.id) + '">' +
        '<div class="ao-thumbs">' + thumbs + '</div>' +
        '<div class="ao-main"><div class="ao-top"><b>Заказ № ' + esc(o.number) + '</b><span>' + esc(fmtDate(o.createdAt).replace(/ \d{4} г\.$/, '')) + '</span></div>' +
          '<div class="ao-items">' + lines + '</div>' + (open ? '' : orderTrack(o)) + pay +
          (o.tracking && o.status !== 'canceled' && o.status !== 'returned' ? '<span class="ao-trk">СДЭК: <b>' + esc(o.tracking.number) + '</b> · отследить на странице заказа</span>' : '') + '</div>' +
        '<div class="ao-sum"><b class="num">' + fmt(o.total) + '</b><span>' + n + ' ' + plural(n, 'вещь', 'вещи', 'вещей') + '</span></div>' +
      '</a>';
    }).join('') + '</div>';
  }
  /* Живой отсчёт на карточках «Оплатить · осталось» и переход к оплате прямо из списка */
  setInterval(function () {
    document.querySelectorAll('[data-payby]').forEach(function (el) {
      var left = Date.parse(el.getAttribute('data-payby')) - (Date.now() + Number(el.getAttribute('data-skew') || 0)), b = el.querySelector('b');
      if (left <= 0) { el.classList.add('out'); el.removeAttribute('data-payby'); el.textContent = 'Время на оплату вышло'; return; }
      if (b) b.textContent = mmss(left);
      el.classList.toggle('hot', left <= 5 * 60e3);
    });
  }, 1000);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.ao-paybtn[data-pay]'); if (!b || b.classList.contains('out') || !b.getAttribute('data-pay')) return;
    e.preventDefault(); e.stopPropagation(); location.href = b.getAttribute('data-pay');
  }, true);

  function bonusTabHtml(u, log) {
    var c = bonusCfg(), n = u.bonus || 0, pct = String(c.percent).replace('.', ',');
    var steps = [
      ['Покупайте', c.earn ? pct + '% от суммы заказа возвращаем бонусами' : 'Начисление бонусов сейчас приостановлено'],
      ['Копите', 'Бонусы приходят на счёт ' + (c.creditOn === 'done' ? 'после получения заказа' : 'после оплаты заказа')],
      ['Оплачивайте', 'При оформлении заказа, хоть все сразу. 1 бонус = 1 ₽']
    ];
    return '<div class="acc-bonus">' + (c.enabled ? '<div class="ab-card">' + loyalCardHtml(u, n) + '</div>' : '') +
      '<div class="ab-side"><div class="ab-bal"><span>На счёте</span><b class="num">' + bonusNum(n) + '</b><span>' + bonusWord(n) + ' = ' + fmt(n) + '</span></div>' +
        '<ol class="loyal-steps ab-steps">' + steps.map(function (x, i) { return '<li><span class="ls-n">' + (i + 1) + '</span><b>' + x[0] + '</b><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ol>' +
        '<a class="btn" href="#/catalog">' + (n > 0 ? 'Потратить бонусы' : 'Перейти в каталог') + '</a></div>' +
      '<div class="ab-log"><h3>История</h3>' + (log && log.length ? bonusHistoryHtml(log) : '<p class="muted">Операций пока нет. Бонусы придут после первой покупки, и их можно сразу потратить на следующую.</p>') + '</div>' +
    '</div>';
  }

  /* Удаление аккаунта (13.64.0): окно с последствиями и паролем; заказы в пути доставляем, чеки остаются у магазина */
  var DEL_IC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  async function deleteAccount(u) {
    var orders = []; try { orders = await API.myOrders(); } catch (e) { /* без списка заказов окно всё равно покажем */ }
    var going = orders.filter(function (o) { return o.status === 'new' || o.status === 'processing' || o.status === 'shipped'; });
    var li = function (ok, t) { return '<li class="' + (ok ? 'ok' : 'no') + '"><span>' + (ok ? '✓' : '✕') + '</span>' + t + '</li>'; };
    openModal('<div class="del-acc"><span class="del-acc-ic">' + DEL_IC + '</span><h3>Удалить аккаунт?</h3><ul>' +
      li(false, 'Имя, телефон, почта, избранное и корзина удалятся навсегда') +
      (u.bonus > 0 ? li(false, 'Сгорят ' + bonusNum(u.bonus) + ' ' + plural(u.bonus, 'бонус', 'бонуса', 'бонусов')) : '') +
      going.map(function (o) { return li(true, 'Заказ № ' + esc(o.number) + ' — доставим его как обычно'); }).join('') +
      li(true, 'Чеки и история заказов останутся у магазина — так требует закон') + '</ul>' +
      '<form id="delForm" novalidate><label class="field"><span>Пароль — для подтверждения</span><input class="input" id="del-pass" type="password" autocomplete="current-password"></label>' +
      '<p class="form-error" id="delErr"></p><button class="btn danger block">Удалить навсегда</button><button class="btn ghost block" type="button" id="delNo">Отмена</button></form></div>');
    $('#delNo').addEventListener('click', closePanels);
    $('#delForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var pw = $('#del-pass').value; if (!pw) { $('#delErr').textContent = 'Введите пароль'; return; }
      try { await API.deleteAccount(pw); closePanels(); renderShell(); toast('Аккаунт удалён'); go('#/account'); } catch (ex) { $('#delErr').textContent = errMsg(ex); }
    });
  }
  function profileTab(body, u) {
    body.innerHTML = '<form class="acc-profile" id="profForm" novalidate>' +
      '<fieldset><legend>Личные данные</legend><p>Подставляем их при оформлении заказа.</p><div class="row2">' +
        '<label class="field"><span>Имя</span><input class="input" id="pf-first" autocomplete="given-name" value="' + esc(u.firstName) + '"></label>' +
        '<label class="field"><span>Фамилия</span><input class="input" id="pf-last" autocomplete="family-name" value="' + esc(u.lastName) + '"></label></div>' +
        '<div class="row2"><label class="field"><span>Телефон</span><input class="input" id="pf-phone" type="tel" autocomplete="tel" value="' + esc(fmtPhone(u.phone)) + '"></label>' +
        '<label class="field"><span>Электронная почта</span><input class="input" id="pf-email" type="email" autocomplete="email" value="' + esc(u.email) + '"></label></div></fieldset>' +
      '<fieldset><legend>Пароль</legend><p>Заполните, только если хотите сменить пароль.</p>' +
        '<label class="field"><span>Новый пароль</span><input class="input" id="pf-pass" type="password" autocomplete="new-password" placeholder="Не короче 6 символов"></label>' +
        '<label class="field" id="pfCurRow" hidden><span>Текущий пароль</span><input class="input" id="pf-cur" type="password" autocomplete="current-password" placeholder="Для смены пароля или почты"></label></fieldset>' +
      '<fieldset class="pushs" id="pushPrefs"><legend>Уведомления на телефон</legend><div class="loader">…</div></fieldset>' +
      '<fieldset><legend>Письма</legend><p>Только по делу — никаких рассылок.</p><label class="check"><input type="checkbox" data-remind' + (u.cartRemind ? ' checked' : '') + '> <span>Напоминать о товарах в корзине, если я не оформил заказ<br><small class="muted">Одно письмо на корзину, через несколько часов</small></span></label></fieldset>' +
      '<p class="form-error" id="pfErr"></p><div class="acc-profile-act"><button class="btn">Сохранить изменения</button><button class="btn ghost" type="button" id="pfOut">Выйти из аккаунта</button></div></form>' +
      '<button class="acc-del" type="button" id="pfDel"><span class="acc-del-ic">' + DEL_IC + '</span><span><b>Удалить аккаунт</b><small>Личные данные удалятся, бонусы сгорят</small></span></button>';
    phoneMask($('#pf-phone')); pushSettings($('#pushPrefs'));
    // Поле «Текущий пароль» появляется, когда меняют пароль или почту
    var curNeed = function () { var need = !!$('#pf-pass').value || $('#pf-email').value.trim().toLowerCase() !== String(u.email || '').toLowerCase(); $('#pfCurRow').hidden = !need; };
    ['#pf-pass', '#pf-email'].forEach(function (q) { $(q).addEventListener('input', curNeed); });
    $('#pfOut').addEventListener('click', async function () { await API.logout(); renderShell(); toast('Вы вышли из аккаунта'); go('#/'); });
    $('#pfDel').addEventListener('click', function () { deleteAccount(u); });
    $('#profForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var f = { firstName: $('#pf-first').value, lastName: $('#pf-last').value, phone: $('#pf-phone').value, email: $('#pf-email').value, newPassword: $('#pf-pass').value, currentPassword: $('#pf-cur').value };
      var er = !f.firstName.trim() || !f.lastName.trim() ? 'Укажите имя и фамилию' : !validPhone(f.phone) ? 'Проверьте номер телефона' : !validEmail(f.email) ? 'Проверьте электронную почту' : f.newPassword && f.newPassword.length < 6 ? 'Пароль должен быть не короче 6 символов' : '';
      if (er) { $('#pfErr').textContent = er; return; }
      try { await API.updateProfile(f); toast('Изменения сохранены'); go('#/account?tab=profile'); } catch (ex) { $('#pfErr').textContent = errMsg(ex); }
    });
  }

  /* ---------- Поддержка в кабинете (13.64.3, вариант B): обращения с номерами и переписка ----------
     Список — карточки «№ 1043 · тема · статус», переписка — пузыри с фото, отметкой «прочитано» и карточкой заказа,
     новое обращение — тема плиткой, заказ карточкой, до 5 фото. Фото уменьшаются в браузере до 1600 px. */
  var SUPPORT_STATE = { open: 'Ждёт ответа', answered: 'Есть ответ', closed: 'Решено' };
  var SUP_IC = (function () {
    var s = function (d, w) { return '<svg viewBox="0 0 24 24" width="' + (w || 22) + '" height="' + (w || 22) + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
    return {
      back: s('<path d="M19 12H5M11 6l-6 6 6 6"/>'), pen: s('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'), check: s('<path d="M5 12.5l4.5 4.5L19 7"/>', 20),
      clip: s('<path d="M8.5 12.5l6.5-6.5a3 3 0 0 1 4.2 4.2l-8 8a5 5 0 0 1-7-7l7.5-7.5"/>'), send: s('<path d="M12 19V5M6 11l6-6 6 6"/>', 20), chev: s('<path d="M9 6l6 6-6 6"/>', 16),
      ticks: '<svg viewBox="0 0 22 14" width="16" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 7.5l4 4L13 3.5M8 10.5l1 1L17 3.5"/></svg>',
      tick: '<svg viewBox="0 0 22 14" width="12" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5l4 4L15 3.5"/></svg>',
      photo: s('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/>'), x: s('<path d="M6 6l12 12M18 6L6 18"/>', 14),
      'Заказ': s('<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>', 24), 'Доставка': s('<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>', 24),
      'Размер и посадка': s('<path d="M3 9h18v6H3z"/><path d="M7 9v3M11 9v3M15 9v3"/>', 24), 'Возврат и обмен': s('<path d="M9 7L5 11l4 4"/><path d="M5 11h10a4 4 0 0 1 0 8h-2"/>', 24),
      'Другое': '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>'
    };
  })();
  function msgTime(iso) {
    var d = new Date(iso), now = new Date();
    var t = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === now.toDateString() ? t : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ', ' + t;
  }
  function msgClock(iso) { return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
  function msgDay(iso) {
    var d = new Date(iso), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
    return d.toDateString() === now.toDateString() ? 'Сегодня' : d.toDateString() === y.toDateString() ? 'Вчера' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function supportHours() { var h = (D.settings.contacts || {}).hours; return h ? 'Отвечаем ' + h.charAt(0).toLowerCase() + h.slice(1) + '. ' : ''; }
  // Фото: уменьшаем до 1600 px по длинной стороне и сохраняем в JPEG — так iPhone (HEIC) и большие снимки уходят быстро
  function supPhoto(file) {
    return new Promise(function (ok, bad) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error('Не получилось открыть фото')); };
      img.src = url;
    });
  }
  // Поле «прикрепить фото»: выбранные фото сразу загружаются, в отправку идут их имена
  function supFiles(root, uploadFn) {
    var st = { files: [], busy: 0 }, box = $('.sup-att', root), input = $('.sup-file', root);
    var draw = function () {
      box.hidden = !st.files.length && !st.busy;
      box.innerHTML = st.files.map(function (f, i) { return '<span class="sup-att-i"><img src="' + f.preview + '" alt=""><button type="button" data-rm="' + i + '" aria-label="Убрать фото">' + SUP_IC.x + '</button></span>'; }).join('') +
        (st.busy ? '<span class="sup-att-i is-busy" aria-label="Загружаем фото"></span>' : '');
    };
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (b) { st.files.splice(+b.getAttribute('data-rm'), 1); draw(); } });
    input.addEventListener('change', async function () {
      var list = Array.prototype.slice.call(input.files || []).slice(0, 5 - st.files.length); input.value = '';
      if (!list.length) { toast('Не больше 5 фото в одном сообщении'); return; }
      for (var i = 0; i < list.length; i++) {
        st.busy++; draw();
        try { var d = await supPhoto(list[i]), r = await uploadFn(d); st.files.push({ name: r.file, preview: d }); }
        catch (e) { toast(errMsg(e)); }
        st.busy--; draw();
      }
    });
    return { names: function () { return st.files.map(function (f) { return f.name; }); }, busy: function () { return st.busy > 0; }, clear: function () { st.files = []; draw(); } };
  }
  function supImgs(files, base) {
    if (!files || !files.length) return '';
    return '<span class="sup-ph n' + Math.min(files.length, 3) + '">' + files.map(function (f) { var u = base + encodeURIComponent(f); return '<a href="' + u + '" target="_blank" rel="noopener"><img src="' + u + '" alt="Фото" loading="lazy"></a>'; }).join('') + '</span>';
  }
  function supNum(t, on) { return '<span class="sup-num' + (on ? ' on' : '') + '">№ ' + esc(t.number) + '</span>'; }
  function supCard(t, cur) {
    var last = t.messages[t.messages.length - 1], who = last.from === 'shop' ? '<b>' + esc(D.settings.storeName || 'Магазин') + ':</b> ' : 'Вы: ';
    var txt = last.text ? esc(last.text.slice(0, 90)) : (last.files || []).length ? 'Фото' : '';
    return '<a class="sup-card' + (cur && cur.id === t.id ? ' on' : '') + (t.unread ? ' unread' : '') + (t.status === 'closed' ? ' closed' : '') + '" href="#/account?tab=support&id=' + esc(t.id) + '">' +
      '<span class="sc-top">' + supNum(t, t.status !== 'closed') + '<b>' + esc(t.topic) + '</b>' + (t.unread ? '<i class="sc-dot" aria-label="Новый ответ"></i>' : '') + '</span>' +
      '<span class="sc-text">' + who + txt + '</span>' +
      '<span class="sc-meta"><span class="sup-st s-' + t.status + '">' + (t.status === 'closed' ? SUP_IC.check : '') + SUPPORT_STATE[t.status] + '</span>' + (t.orderNumber ? '<span>Заказ № ' + esc(t.orderNumber) + '</span>' : '') + '<time>' + esc(msgTime(t.updatedAt)) + '</time></span></a>';
  }
  async function supportTab(body, q) {
    var r;
    try { r = await API.support(); } catch (e) { body.innerHTML = '<p class="form-error">' + esc(errMsg(e)) + '</p>'; return; }
    if (!document.body.contains(body)) return;
    var list = r.tickets, topics = r.topics;
    var cur = q.id ? list.find(function (t) { return t.id === q.id; }) : null;
    var isNew = q.new === '1' || (!cur && !list.length);
    var open = list.filter(function (t) { return t.status !== 'closed'; }), done = list.filter(function (t) { return t.status === 'closed'; });
    var side = '<aside class="sup-list">' +
      '<a class="sup-write" href="#/account?tab=support&new=1"><span class="sw-ic">' + SUP_IC.pen + '</span><span><b>Написать в поддержку</b><small>' + supportHours() + 'Ответ придёт сюда, на почту и уведомлением</small></span></a>' +
      (open.length ? '<div class="sup-group">' + open.map(function (t) { return supCard(t, cur); }).join('') + '</div>' : '') +
      (done.length ? '<p class="sup-cap">Решённые</p><div class="sup-group">' + done.map(function (t) { return supCard(t, cur); }).join('') + '</div>' : '') +
    '</aside>';
    var pane = cur ? threadHtml(cur) : isNew ? newTicketHtml(topics, q) : '<div class="sup-pick"><span class="sp-ic">' + ACC_ICON.chat + '</span><h3>Выберите обращение</h3><p>Или напишите новое — у него сразу появится номер, по нему вас быстро найдут.</p></div>';
    body.innerHTML = '<div class="sup' + (cur || isNew ? ' has-pane' : '') + '">' + side + '<section class="sup-pane">' + pane + '</section></div>';
    if (cur) bindThread(body, cur);
    else if (isNew) bindNewTicket(body);
  }
  function supOrderCard(o) {
    if (!o) return '';
    return '<a class="sup-order" href="#/order/' + esc(o.id) + '"><span class="so-ph">' + (o.image ? '<img src="' + esc(o.image) + '" alt="">' : '') + '</span>' +
      '<span class="so-t"><b>Заказ № ' + esc(o.number) + ' · ' + esc((STATUS[o.status] || o.status).toLowerCase()) + '</b><small>' + esc([o.name, [o.color, o.size].filter(Boolean).join(', ')].filter(Boolean).join(' · ')) + (o.items > 1 ? ' и ещё ' + (o.items - 1) : '') + '</small></span>' + SUP_IC.chev + '</a>';
  }
  function threadHtml(t) {
    var closed = t.status === 'closed';
    var chips = (!closed ? '<button type="button" class="sup-chip" data-close>' + SUP_IC.check + 'Вопрос решён</button>' : '') +
      (t.order ? '<a class="sup-chip" href="#/order/' + esc(t.order.id) + '">' + (t.topic === 'Возврат и обмен' || t.topic === 'Размер и посадка' ? 'Обменять размер или вернуть' : 'Открыть заказ № ' + esc(t.order.number)) + '</a>' : '');
    return '<div class="sup-thread">' +
      '<header class="st-head"><a class="st-back" href="#/account?tab=support" aria-label="Все обращения">' + SUP_IC.back + '</a>' +
        '<div><b>Обращение № ' + esc(t.number) + '</b><span>' + esc(t.topic) + ' · <em class="s-' + t.status + '">' + SUPPORT_STATE[t.status].toLowerCase() + '</em></span></div>' +
        (!closed ? '<button type="button" class="st-done" data-close aria-label="Вопрос решён" title="Вопрос решён">' + SUP_IC.check + '</button>' : '') + '</header>' +
      supOrderCard(t.order) +
      '<div class="st-msgs" id="stMsgs">' + msgsHtml(t) + '</div>' +
      (chips ? '<div class="sup-chips">' + chips + '</div>' : '') +
      '<form class="st-send" id="stSend">' +
        '<div class="sup-att" hidden></div>' +
        '<div class="sup-row"><label class="st-attach" aria-label="Прикрепить фото"><input class="sup-file" type="file" accept="image/*" multiple hidden>' + SUP_IC.clip + '</label>' +
        '<textarea class="st-text" id="stText" rows="1" placeholder="' + (closed ? 'Написать — обращение откроется снова' : 'Сообщение') + '" maxlength="2000" aria-label="Сообщение"></textarea>' +
        '<button class="st-go" id="stBtn" aria-label="Отправить">' + SUP_IC.send + '</button></div>' +
      '</form>' +
    '</div>';
  }
  function msgsHtml(t) {
    var store = D.settings.storeName || 'Магазин', day = '', base = 'api/support/file/';
    return t.messages.map(function (m) {
      var d = msgDay(m.at), sep = d !== day ? '<span class="msg-day">' + esc(d) + '</span>' : ''; day = d;
      var shop = m.from === 'shop', read = !shop && t.shopReadAt && t.shopReadAt >= m.at;
      var bubble = (m.text ? '<p>' + esc(m.text) + '</p>' : '');
      return sep + '<div class="msg ' + (shop ? 'from-shop' : 'from-me') + '">' + (shop ? '<span class="msg-ava" aria-hidden="true">AV</span>' : '') + '<div class="msg-col">' +
        (shop && bubble ? '<div class="msg-b"><span class="msg-who">' + esc(store) + (m.by ? ' · ' + esc(m.by) : '') + '</span>' + bubble + '</div>' : bubble ? '<div class="msg-b">' + bubble + '</div>' : '') +
        supImgs(m.files, base) +
        '<time>' + esc(msgClock(m.at)) + (!shop ? '<span class="msg-read' + (read ? ' on' : '') + '" title="' + (read ? 'Прочитано' : 'Отправлено') + '">' + (read ? SUP_IC.ticks : SUP_IC.tick) + '</span>' : '') + '</time></div></div>';
    }).join('') + (t.status === 'closed' ? '<span class="msg-day msg-closed">' + SUP_IC.check + 'Вопрос решён · можно написать снова</span>' : '');
  }
  // Переписка — к последнему сообщению, и ещё раз, когда догрузятся фото
  function supBottom(box) { box.scrollTop = box.scrollHeight; $$('img', box).forEach(function (im) { if (!im.complete) im.addEventListener('load', function () { box.scrollTop = box.scrollHeight; }, { once: true }); }); }
  function supGrow(ta) { var f = function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; }; ta.addEventListener('input', f); f(); }
  function bindThread(body, t) {
    var box = $('#stMsgs', body), ta = $('#stText', body), files = supFiles(body, API.supportUpload.bind(API));
    supBottom(box); supGrow(ta);
    var count = t.messages.length;
    if (t.unread) API.supportGet(t.id).then(function () { if (API.user) { API.user.supportUnread = Math.max(0, (API.user.supportUnread || 1) - 1); markBonusDot(); } }).catch(function () {});
    var send = async function () {
      var text = ta.value.trim(), names = files.names();
      if (files.busy()) { toast('Фото ещё загружается'); return; }
      if (!text && !names.length) { ta.focus(); return; }
      var btn = $('#stBtn', body); btn.disabled = true;
      try { await API.supportSend(t.id, text, names); supportTab(body, { id: t.id }); return; }
      catch (e) { toast(errMsg(e)); }
      btn.disabled = false; ta.focus();
    };
    $('#stSend', body).addEventListener('submit', function (e) { e.preventDefault(); send(); });
    // на компьютере Enter — отправить, Shift + Enter — новая строка; на телефоне Enter — новая строка
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (!e.shiftKey && matchMedia('(hover: hover)').matches))) { e.preventDefault(); send(); } });
    $$('[data-close]', body).forEach(function (b) {
      b.addEventListener('click', async function () { try { await API.supportClose(t.id); toast('Рады, что помогли'); supportTab(body, { id: t.id }); } catch (e) { toast(errMsg(e)); } });
    });
    // новые ответы магазина и отметка «прочитано» подгружаются сами, пока переписка открыта
    var seen = t.shopReadAt;
    supportPoll = setInterval(async function () {
      if (!document.body.contains(box)) { clearInterval(supportPoll); return; }
      if (document.hidden) return;
      try { var nt = await API.supportGet(t.id); if (nt.messages.length !== count || nt.shopReadAt !== seen) { count = nt.messages.length; seen = nt.shopReadAt; box.innerHTML = msgsHtml(nt); supBottom(box); } } catch (e) {}
    }, 15000);
  }
  function newTicketHtml(topics, q) {
    return '<form class="sup-new" id="supNew" novalidate>' +
      '<header class="sn-head"><a class="st-back" href="#/account?tab=support" aria-label="Все обращения">' + SUP_IC.back + '</a><h3>Новое обращение</h3></header>' +
      '<fieldset class="sup-topics"><legend>О чём вопрос</legend>' + topics.map(function (t, i) {
        return '<label class="' + (t === 'Другое' ? 'wide' : '') + '"><input type="radio" name="sup-topic" value="' + esc(t) + '"' + ((q.order ? t === 'Заказ' : i === topics.length - 1) ? ' checked' : '') + '><span>' + (SUP_IC[t] || SUP_IC['Другое']) + esc(t) + '</span></label>';
      }).join('') + '</fieldset>' +
      '<fieldset class="sup-orders" id="supOrders" hidden><legend>Какой заказ</legend><div class="so-row" id="supOrderRow"></div></fieldset>' +
      '<label class="field sup-msg"><span>Сообщение</span><textarea class="textarea" id="supText" rows="4" maxlength="2000" placeholder="Что случилось и чем помочь"></textarea></label>' +
      '<div class="sup-add"><label class="sup-add-b" aria-label="Добавить фото"><input class="sup-file" type="file" accept="image/*" multiple hidden>' + SUP_IC.photo + '</label><div class="sup-att" hidden></div><small>Фото вещи или бирки — до 5 штук. Так ответим быстрее</small></div>' +
      '<p class="form-error" id="supErr"></p><button class="btn block" id="supBtn">Отправить</button>' +
      '<p class="sup-foot">' + supportHours() + 'Номер обращения появится сразу — по нему вас быстро найдут.</p></form>';
  }
  function bindNewTicket(body) {
    var q = parseHash().q, picked = q.order || '', files = supFiles(body, API.supportUpload.bind(API));
    API.myOrders().then(function (list) {
      var row = $('#supOrderRow', body); if (!row || !list.length) return;
      $('#supOrders', body).hidden = false;
      var draw = function () {
        row.innerHTML = list.slice(0, 8).map(function (o) {
          var img = (o.items.find(function (i) { return i.image; }) || {}).image;
          return '<button type="button" class="so-card' + (picked === o.id ? ' on' : '') + '" data-o="' + esc(o.id) + '" aria-pressed="' + (picked === o.id) + '"><span class="so-ph">' + (img ? '<img src="' + esc(img) + '" alt="">' : '') + '</span><span><b>№ ' + esc(o.number) + '</b><small>' + esc((STATUS[o.status] || '').toLowerCase()) + '</small></span></button>';
        }).join('') + '<button type="button" class="so-card so-none' + (!picked ? ' on' : '') + '" data-o="" aria-pressed="' + !picked + '">Без заказа</button>';
      };
      draw();
      row.addEventListener('click', function (e) { var b = e.target.closest('[data-o]'); if (!b) return; picked = b.getAttribute('data-o'); draw(); });
    }).catch(function () {});
    $('#supNew', body).addEventListener('submit', async function (e) {
      e.preventDefault();
      var text = $('#supText', body).value.trim(), topic = ($('input[name="sup-topic"]:checked', body) || {}).value, names = files.names();
      if (files.busy()) { $('#supErr', body).textContent = 'Фото ещё загружается'; return; }
      if (!text && !names.length) { $('#supErr', body).textContent = 'Напишите, чем мы можем помочь'; $('#supText', body).focus(); return; }
      var btn = $('#supBtn', body); btn.disabled = true; btn.textContent = 'Отправляем…';
      try { var t = await API.supportCreate({ topic: topic, orderId: picked, text: text, files: names }); toast('Обращение № ' + t.number + ' отправлено'); go('#/account?tab=support&id=' + t.id); }
      catch (ex) { $('#supErr', body).textContent = errMsg(ex); btn.disabled = false; btn.textContent = 'Отправить'; }
    });
  }

  /* ---------- Кнопка связи на всех страницах ---------- */
  var FAB_IC = {
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
    tg: '<svg viewBox="0 0 24 24"><path d="M21 4L3 11l6 2.2M21 4l-3 16-9-6.8M21 4L9 13.2V19l3-3.4"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.6-2-1-1 .9a3.6 3.6 0 0 1-1.8-1.8l.9-1-1-2z"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/></svg>'
  };
  function fabHtml() {
    var c = D.settings.contacts || {};
    if (c.fab === false) return '';
    var tg = (D.settings.socials || []).find(function (x) { return x.url && socialKind(x) === 'telegram' && !/t\.me\/?$/.test(x.url); });
    var wa = String(c.whatsapp || '').replace(/\D/g, '');
    if (wa.length === 11 && wa[0] === '8') wa = '7' + wa.slice(1);
    // Капсулы над кнопкой (13.62.5): подпись и значок, первая — чат (чёрный значок)
    var row = function (href, ic, title, ext) { return '<a class="fp-cap" href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '><span>' + esc(title) + '</span><i class="fp-ic">' + FAB_IC[ic] + '</i></a>'; };
    var rows = row('#/account?tab=support&new=1', 'chat', 'Написать в чат') +
      (tg ? row(safeUrl(tg.url), 'tg', 'Telegram', true) : '') +
      (wa.length >= 10 ? row('https://wa.me/' + wa, 'wa', 'WhatsApp', true) : '') +
      (c.phone ? row('tel:' + c.phone.replace(/[^\d+]/g, ''), 'phone', c.phone) : '') +
      (c.email ? row('mailto:' + c.email, 'mail', c.email) : '');
    return '<div class="fab" id="fab"><div class="fab-panel" id="fabPanel" role="dialog" aria-label="Связаться с нами" hidden>' +
      (c.hours ? '<span class="fp-hours">' + esc(c.hours) + '</span>' : '') + rows + '</div>' +
      '<button class="fab-btn" id="fabBtn" type="button" aria-expanded="false" aria-controls="fabPanel" aria-label="Связаться с нами">' + FAB_IC.chat + '<i class="fab-dot" hidden></i></button></div>';
  }
  function fabSet(open) {
    var fab = $('#fab'), panel = $('#fabPanel'), btn = $('#fabBtn'); if (!fab) return;
    panel.hidden = !open; btn.setAttribute('aria-expanded', open); fab.classList.toggle('open', open);
  }
  var fabBound = false;
  function bindFab() {
    markBonusDot();
    if (fabBound) return; fabBound = true;
    document.addEventListener('click', function (e) {
      if (e.target.closest('#fabBtn')) { fabSet($('#fabPanel').hidden); return; }
      var p = $('#fabPanel');
      if (p && !p.hidden && (e.target.closest('#fabPanel a') || !e.target.closest('#fab'))) fabSet(false);
    });
    document.addEventListener('keydown', function (e) { var p = $('#fabPanel'); if (e.key === 'Escape' && p && !p.hidden) { fabSet(false); $('#fabBtn').focus(); } });
  }

  var BONUS_TYPES = { earn: 'Начислено за заказ', spend: 'Оплата заказа', 'return': 'Возврат за отменённый заказ', revoke: 'Списано: заказ отменён', manual: 'Начисление от магазина' };
  function bonusHistoryHtml(log) {
    if (!log || !log.length) return '<div class="empty" style="text-align:left;justify-items:start;padding-top:0"><h3>Операций пока нет</h3><p>Бонусы придут после первой покупки — их можно сразу потратить на следующую.</p><a class="btn ghost" href="#/catalog">В каталог</a></div>';
    return '<div class="bonus-log">' + log.map(function (e) {
      var title = e.type === 'manual' ? (e.amount > 0 ? 'Начисление от магазина' : 'Списание магазином') : BONUS_TYPES[e.type] || 'Операция';
      return '<div class="bl-row' + (e.seen ? '' : ' is-new') + '"><div><span class="bl-t"><b>' + esc(title) + (e.orderNumber ? ' № ' + esc(e.orderNumber) : '') + '</b>' + (e.seen ? '' : '<em class="bl-new">Новое</em>') + '</span>' +
        '<span class="muted">' + esc(new Date(e.at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) + (e.note ? ' · ' + esc(e.note) : '') + '</span></div>' +
        '<span class="num bl-amt ' + (e.amount > 0 ? 'plus' : 'minus') + '">' + (e.amount > 0 ? '+' : '−') + bonusNum(Math.abs(e.amount)) + '</span></div>';
    }).join('') + '</div>';
  }
  /* Уведомление о начислении: карточка в углу экрана, пока покупатель её не закроет */
  function markBonusDot() {
    var u = API.user, sup = !!(u && u.supportUnread);
    var a = $('#accLink'); if (a) a.classList.toggle('has-dot', !!(u && ((u.bonusNews && u.bonusNews.length) || sup)));
    var f = $('.fab-dot'); if (f) f.hidden = !sup;
    var t = $('.acc-tile[href="#/account?tab=support"]');
    if (t) { var d = $('.acc-dot', t); if (sup && !d) t.insertAdjacentHTML('beforeend', '<i class="acc-dot" aria-label="Есть ответ"></i>'); if (!sup && d) d.remove(); }
  }
  function hideBonusNotice() { var el = $('.bonus-notice'); if (el) { el.classList.add('out'); setTimeout(function () { el.remove(); }, 400); } }
  async function seenBonus() { hideBonusNotice(); try { await API.bonusSeen(); } catch (e) {} markBonusDot(); }
  async function refreshBonus() { try { await API.myBonus(); markBonusDot(); showBonusNews(); } catch (e) {} }
  // Показываем последнее начисление; через 12 секунд карточка уходит сама и считается прочитанной.
  // На оформлении заказа и в панели управления не показываем, чтобы не закрывать кнопки.
  var noticeTimer = null;
  function showBonusNews() {
    var u = API.user, news = u && (u.bonusNews || []).filter(function (e) { return e.amount > 0; }), r = parseHash();
    if (!news || !news.length || r.q.tab === 'bonus' || r.parts[0] === 'checkout' || r.parts[0] === 'admin' || $('.bonus-notice')) return;
    var e = news[0], text = e.type === 'manual' ? (e.note ? esc(e.note) : 'Начисление от магазина') : 'За заказ № ' + esc(e.orderNumber);
    var el = document.createElement('div');
    el.className = 'bonus-notice'; el.setAttribute('role', 'status');
    el.innerHTML = '<i class="b-ic big" aria-hidden="true">Б</i><div><b>+' + bonusNum(e.amount) + ' ' + bonusWord(e.amount) + ' начислено</b><p>' + text + '. На счёте — ' + bonusNum(u.bonus) + ' ' + bonusWord(u.bonus) + '.</p><a class="link" href="#/account?tab=bonus" data-bn-go>Мои бонусы</a></div><button class="bn-x" data-bn-x aria-label="Закрыть">' + ICON.close + '</button>';
    document.body.appendChild(el);
    el.addEventListener('click', function (ev) { if (ev.target.closest('[data-bn-x],[data-bn-go]')) seenBonus(); });
    clearTimeout(noticeTimer); noticeTimer = setTimeout(function () { if (document.body.contains(el)) seenBonus(); }, 12000);
  }
  function backTo(back) { return back === 'checkout' ? '#/checkout' : back === 'support' ? '#/account?tab=support&new=1' : back === 'admin' && API.isAdmin ? '#/admin' : '#/account'; }
  // Справа от входа и регистрации: что даёт аккаунт
  function authAside() {
    var c = bonusCfg(), perks = [];
    if (c.earn) perks.push(['Бонусы с каждой покупки', String(c.percent).replace('.', ',') + '% от суммы заказа возвращаются на счёт. 1 бонус = 1 ₽']);
    perks.push(['Статус заказов', 'Видно, на каком этапе заказ: собирается, в пути или уже ждёт вас']);
    perks.push(['Чат с поддержкой', 'Пишите по любому вопросу — ответ придёт в кабинет и на почту']);
    perks.push(['Быстрое оформление', 'Имя, телефон и почта подставятся в заказ сами']);
    return '<aside class="auth-aside">' + (c.earn ? '<div class="auth-card">' + loyalCardHtml(null, 0) + '</div>' : '') +
      '<ul class="auth-perks">' + perks.map(function (x) { return '<li><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul></aside>';
  }
  /* Восстановление пароля: почта или телефон → код из письма → новый пароль */
  function forgotFlow(login, back) {
    openModal('<span class="eyebrow">Восстановление пароля</span><h3 class="serif" style="font-size:34px;margin:14px 0 8px">Новый пароль</h3>' +
      '<p class="muted" style="margin-bottom:20px">Пришлём код на почту, указанную в аккаунте.</p>' +
      '<form class="form" id="fgForm" novalidate><label class="field"><span>Телефон или электронная почта</span><input class="input" id="fg-login" autocomplete="username" value="' + esc(login || '') + '"></label>' +
      '<p class="form-error" id="fgErr"></p><button class="btn block" id="fgBtn">Получить код</button></form>');
    var form = $('#fgForm'), err = $('#fgErr');
    setTimeout(function () { $('#fg-login').focus(); }, 50);
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); var l = $('#fg-login').value.trim(); if (!l) { err.textContent = 'Укажите телефон или почту'; return; }
      var btn = $('#fgBtn'); btn.disabled = true; btn.textContent = 'Отправляем…';
      var r; try { r = await API.forgot(l); } catch (ex) { err.textContent = errMsg(ex); btn.disabled = false; btn.textContent = 'Получить код'; return; }
      $('#modalBody').innerHTML = '<span class="eyebrow">Восстановление пароля</span><h3 class="serif" style="font-size:34px;margin:14px 0 8px">Введите код</h3>' +
        '<p class="muted" style="margin-bottom:20px">Если аккаунт с такими данными есть, мы отправили код из 6 цифр' + (r.email ? ' на ' + esc(r.email) : '') + '. Проверьте и папку «Спам».</p>' +
        '<form class="form" id="rsForm" novalidate><label class="field"><span>Код из письма</span><input class="input" id="rs-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></label>' +
        '<label class="field"><span>Новый пароль</span><input class="input" id="rs-pass" type="password" autocomplete="new-password" placeholder="Не короче 6 символов"></label>' +
        '<p class="form-error" id="rsErr"></p><button class="btn block" id="rsBtn">Сохранить и войти</button></form>';
      setTimeout(function () { $('#rs-code').focus(); }, 50);
      $('#rsForm').addEventListener('submit', async function (ev) {
        ev.preventDefault(); var e2 = $('#rsErr'), code = $('#rs-code').value.replace(/\D/g, ''), pw = $('#rs-pass').value;
        if (code.length !== 6) { e2.textContent = 'Введите все 6 цифр кода'; return; }
        if (pw.length < 6) { e2.textContent = 'Пароль должен быть не короче 6 символов'; return; }
        var b2 = $('#rsBtn'); b2.disabled = true;
        try { await API.resetPassword(r.id, code, pw); closePanels(); toast('Пароль изменён. С возвращением, ' + API.user.firstName); go(backTo(back)); }
        catch (ex) { e2.textContent = errMsg(ex); b2.disabled = false; }
      });
    });
  }
  function authPage(v, mode, back, pre) {
    pre = pre || {};
    var backQ = back === 'checkout' || back === 'support' || back === 'admin' ? 'back=' + back : '';
    v.innerHTML = '<div class="wrap auth-wrap"><div class="auth-main"><div class="page-head"><span class="eyebrow">Личный кабинет</span><h1>' + (mode === 'login' ? 'Вход' : 'Регистрация') + '</h1>' + (back === 'checkout' ? '<p class="muted" style="max-width:40ch">После входа вы вернётесь к оформлению заказа, а промокод подставится сам.</p>' : back === 'support' ? '<p class="muted" style="max-width:40ch">Войдите, чтобы написать в поддержку: ответ сохранится в кабинете и придёт на почту.</p>' : '') + '</div><div class="auth">' +
      '<div class="tabs"><button data-m="login"' + (mode === 'login' ? ' class="on"' : '') + '>Вход</button><button data-m="register"' + (mode === 'register' ? ' class="on"' : '') + '>Регистрация</button></div>' +
      (mode === 'login' ?
        '<form class="form" id="authForm" novalidate><label class="field"><span>Телефон или электронная почта</span><input class="input" id="lg-login" autocomplete="username"></label>' +
        '<label class="field"><span>Пароль</span><input class="input" id="lg-pass" type="password" autocomplete="current-password"></label><p class="form-error" id="authErr"></p><button class="btn block">Войти</button><div class="auth-links"><button type="button" class="link auth-forgot" id="lgForgot">Забыли пароль?</button><a class="link auth-forgot" href="#/track">Где мой заказ — без входа</a></div></form>'
      :
        '<form class="form" id="authForm" novalidate><div class="row2"><label class="field"><span>Имя</span><input class="input" id="rg-first" autocomplete="given-name" value="' + esc(pre.firstName || '') + '"></label>' +
        '<label class="field"><span>Фамилия</span><input class="input" id="rg-last" autocomplete="family-name" value="' + esc(pre.lastName || '') + '"></label></div>' +
        '<label class="field"><span>Номер телефона</span><input class="input" id="rg-phone" type="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" value="' + esc(pre.phone || '') + '"></label>' +
        '<label class="field"><span>Электронная почта</span><input class="input" id="rg-email" type="email" autocomplete="email" value="' + esc(pre.email || '') + '"></label>' +
        '<label class="field"><span>Пароль</span><input class="input" id="rg-pass" type="password" autocomplete="new-password" placeholder="Не короче 6 символов" value="' + esc(pre.password || '') + '"></label>' +
        // Согласие на обработку персональных данных — отдельной галочкой и отдельным документом (152-ФЗ, ст. 9)
        '<label class="check"><input type="checkbox" id="rg-agree"' + (pre.consent ? ' checked' : '') + '> <span>Даю <a href="#/page/consent" data-page-modal="consent">согласие на обработку персональных данных</a></span></label>' +
        '<p class="form-error" id="authErr"></p><button class="btn block" id="rgBtn">Зарегистрироваться</button>' +
        '<p class="auth-note">Обрабатываем данные по <a href="#/page/privacy" data-page-modal="privacy">политике обработки персональных данных</a>. На почту придёт код из 6 цифр — он подтвердит, что адрес ваш.</p></form>') +
      '<p class="muted auth-switch">' + (mode === 'login' ? 'Нет аккаунта? <button class="link" data-m="register">Зарегистрируйтесь</button>' : 'Уже есть аккаунт? <button class="link" data-m="login">Войдите</button>') + '</p></div></div>' + authAside() + '</div>';
    $$('[data-m]', v).forEach(function (b) { b.addEventListener('click', function () { go('#/account' + (b.getAttribute('data-m') === 'register' ? '?tab=register' + (backQ ? '&' + backQ : '') : (backQ ? '?' + backQ : '')), true); }); });
    if (mode === 'register') phoneMask($('#rg-phone'));
    if (mode === 'login') $('#lgForgot').addEventListener('click', function () { forgotFlow($('#lg-login').value.trim(), back); });
    $('#authForm').addEventListener('submit', async function (e) {
      e.preventDefault(); var err = $('#authErr');
      try {
        if (mode === 'login') {
          if (!$('#lg-login').value.trim() || !$('#lg-pass').value) { err.textContent = 'Введите логин и пароль'; return; }
          var lr = await API.login($('#lg-login').value, $('#lg-pass').value);
          if (lr && lr.confirm) { codeStep(v, lr.confirm, { login: $('#lg-login').value }, back, 'login'); return; }
          toast('С возвращением, ' + API.user.firstName); markBonusDot(); setTimeout(showBonusNews, 600);
        } else {
          var f = { firstName: $('#rg-first').value.trim(), lastName: $('#rg-last').value.trim(), phone: $('#rg-phone').value, email: $('#rg-email').value.trim(), password: $('#rg-pass').value };
          var checks = [['rg-first', !!f.firstName], ['rg-last', !!f.lastName], ['rg-phone', validPhone(f.phone)], ['rg-email', validEmail(f.email)], ['rg-pass', f.password.length >= 6]];
          checks.forEach(function (c) { $('#' + c[0]).classList.toggle('invalid', !c[1]); });
          var firstBad = checks.find(function (c) { return !c[1]; });
          if (firstBad) { err.textContent = { 'rg-first': 'Укажите имя', 'rg-last': 'Укажите фамилию', 'rg-phone': 'Укажите номер телефона полностью', 'rg-email': 'Проверьте электронную почту', 'rg-pass': 'Пароль должен быть не короче 6 символов' }[firstBad[0]]; return; }
          if (!$('#rg-agree').checked) { err.textContent = 'Нужно согласие на обработку персональных данных'; return; }
          f.consent = true;
          var btn = $('#rgBtn'); btn.disabled = true; btn.textContent = 'Отправляем код…';
          var r;
          try { r = await API.register(f); } finally { btn.disabled = false; btn.textContent = 'Зарегистрироваться'; }
          if (r.pending) { codeStep(v, r.pending, f, back); return; }
          afterRegister(back, r.welcome, false);
          return;
        }
        if (API.isAdmin) { renderShell(); if (back !== 'admin') toast('У вас есть доступ к панели управления — она в меню'); } // кнопка «Панель управления» в меню и подвале
        go(backTo(back));
      } catch (ex) { err.textContent = errMsg(ex); }
    });
  }

  /* ---------- Подтверждение почты: код из 6 цифр ---------- */
  // mode 'login' — вход в панель с нового устройства (13.60): тот же ввод кода, другой текст и проверка
  function codeStep(v, pend, f, back, mode) {
    var LG = mode === 'login';
    var cells = ''; for (var i = 0; i < 6; i++) cells += '<input class="code-cell" inputmode="numeric" pattern="[0-9]*" maxlength="6" aria-label="Цифра ' + (i + 1) + ' из 6"' + (i === 0 ? ' autocomplete="one-time-code"' : ' autocomplete="off"') + '>';
    v.innerHTML = '<div class="wrap"><div class="page-head" style="text-align:center;justify-items:center"><span class="eyebrow">' + (LG ? 'Вход в панель' : 'Регистрация') + '</span><h1>' + (LG ? 'Подтвердите вход' : 'Подтвердите почту') + '</h1></div>' +
      '<div class="auth code-step">' +
        '<p class="code-lead">' + (LG ? 'Вы входите с нового устройства в аккаунт с доступом к панели. Для защиты отправили код из 6 цифр на <b>' + esc(pend.email) + '</b>. На этом устройстве код больше не понадобится 90 дней.' : 'Отправили код из 6 цифр на <b>' + esc(pend.email) + '</b>. Код действует ' + pend.minutes + ' минут.') + '</p>' +
        '<form id="codeForm" novalidate><div class="code-cells" role="group" aria-label="Код из письма">' + cells + '</div>' +
          '<p class="form-error" id="codeErr" aria-live="polite"></p><button class="btn block" id="codeBtn">Подтвердить</button></form>' +
        '<div class="code-more"><button class="link" id="codeResend" type="button"></button><button class="link" id="codeBack" type="button">' + (LG ? 'Войти другим аккаунтом' : 'Изменить данные') + '</button></div>' +
        '<p class="auth-note">Письма нет? Проверьте папку «Спам» — иногда код попадает туда.</p>' +
      '</div></div>';
    var box = $$('.code-cell', v), err = $('#codeErr'), btn = $('#codeBtn'), rs = $('#codeResend'), busy = false, timer = null;
    function code() { return box.map(function (c) { return c.value; }).join(''); }
    function fill(from, digits) {
      for (var k = 0; k < digits.length && from + k < 6; k++) box[from + k].value = digits[k];
      var next = Math.min(5, from + digits.length); box[code().length >= 6 ? 5 : next].focus();
      if (code().length === 6) submit();
    }
    function bad(msg, clear) {
      err.textContent = msg;
      var cc = $('.code-cells', v); cc.classList.remove('shake'); void cc.offsetWidth; cc.classList.add('shake');
      if (clear) { box.forEach(function (c) { c.value = ''; }); box[0].focus(); }
    }
    box.forEach(function (c, i) {
      c.addEventListener('input', function () {
        var d = c.value.replace(/\D/g, ''); c.value = '';
        err.textContent = '';
        if (d) fill(i, d);
      });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !c.value && i > 0) { box[i - 1].value = ''; box[i - 1].focus(); e.preventDefault(); }
        if (e.key === 'ArrowLeft' && i > 0) box[i - 1].focus();
        if (e.key === 'ArrowRight' && i < 5) box[i + 1].focus();
      });
      c.addEventListener('paste', function (e) {
        var t = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '');
        if (t) { e.preventDefault(); fill(t.length >= 6 ? 0 : i, t.slice(0, 6)); }
      });
      c.addEventListener('focus', function () { c.select(); });
    });
    async function submit() {
      if (busy) return;
      var c = code(); if (c.length < 6) { bad('Введите все 6 цифр из письма'); return; }
      busy = true; btn.disabled = true; btn.textContent = 'Проверяем…';
      try {
        if (LG) { await API.loginConfirm(pend.id, c); clearInterval(timer); toast('С возвращением, ' + API.user.firstName); markBonusDot(); renderShell(); go(backTo(back)); return; }
        var r = await API.verify(pend.id, c); clearInterval(timer); afterRegister(back, r.welcome, true);
      }
      catch (ex) {
        busy = false; btn.disabled = false; btn.textContent = 'Подтвердить';
        bad(errMsg(ex), true);
        if (ex.status === 410) { rs.hidden = true; }
      }
    }
    $('#codeForm').addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    function countdown(sec) {
      clearInterval(timer); var left = sec;
      var tick = function () {
        if (!document.body.contains(rs)) { clearInterval(timer); return; }
        if (left <= 0) { rs.disabled = false; rs.textContent = 'Отправить код ещё раз'; clearInterval(timer); return; }
        rs.disabled = true; rs.textContent = 'Новый код — через ' + left + ' с'; left--;
      };
      tick(); timer = setInterval(tick, 1000);
    }
    rs.addEventListener('click', async function () {
      rs.disabled = true;
      try { var r = await (LG ? API.loginResend(pend.id) : API.resendCode(pend.id)); toast('Отправили новый код на ' + pend.email); err.textContent = ''; box.forEach(function (c) { c.value = ''; }); box[0].focus(); countdown(r.resendIn || 60); }
      catch (ex) { err.textContent = errMsg(ex); rs.disabled = false; }
    });
    $('#codeBack').addEventListener('click', function () { clearInterval(timer); authPage(v, LG ? 'login' : 'register', back, LG ? {} : Object.assign({}, f)); });
    countdown(pend.resendIn || 60);
    setTimeout(function () { box[0].focus(); }, 60);
  }

  /* После регистрации: переход и окно «Добро пожаловать» — бонусы и промокод на первый заказ */
  function afterRegister(back, w, verified) {
    var u = API.user || {};
    markBonusDot();
    go(backTo(back));
    w = w || {};
    var perks = '';
    if (w.bonusPercent) perks += '<div class="wl-perk"><b>' + esc(String(w.bonusPercent).replace('.', ',')) + '%</b><span>возвращаем бонусами<br>с каждой покупки</span></div>';
    if (w.promo && w.promo.code) perks += '<div class="wl-perk wl-code"><span>Промокод на первый заказ</span><button class="wl-copy" data-wl-copy="' + esc(w.promo.code) + '" title="Скопировать">' + esc(w.promo.code) + '<i>Скопировать</i></button><small>' + esc(w.promo.text) + '</small></div>';
    setTimeout(function () {
      openModal('<div class="welcome">' +
        '<span class="wl-mark" aria-hidden="true"><img src="img/logo-mark.png" alt=""></span>' +
        '<span class="eyebrow">Добро пожаловать</span>' +
        '<h3>' + esc(u.firstName ? 'Здравствуйте, ' + u.firstName + '!' : 'Здравствуйте!') + '</h3>' +
        '<p class="muted">' + (verified ? 'Почта подтверждена, аккаунт создан.' : 'Аккаунт создан.') + (D.mailReady ? ' Письмо с приветствием уже в вашем ящике.' : '') + '</p>' +
        (perks ? '<div class="wl-perks">' + perks + '</div>' : '') +
        '<div class="wl-btns">' + (back === 'checkout'
          ? '<button class="btn block" data-act="close">Продолжить оформление</button>'
          : '<a class="btn" href="#/catalog">За покупками</a><button class="btn ghost" data-act="close">Личный кабинет</button>') + '</div>' +
      '</div>');
      var cp = $('[data-wl-copy]');
      if (cp) cp.addEventListener('click', function () {
        var c = cp.getAttribute('data-wl-copy');
        try { navigator.clipboard.writeText(c).then(function () { cp.classList.add('copied'); $('i', cp).textContent = 'Скопировано'; }, function () { toast('Промокод: ' + c); }); } catch (e) { toast('Промокод: ' + c); }
      });
      $$('.welcome a[href^="#/"]').forEach(function (a) { a.addEventListener('click', function () { closePanels(); }); });
    }, 120);
  }

  /* ---------- Текстовые страницы ---------- */
  // В текстах страниц {продавец}, {адрес}, {почта}, {телефон}, {магазин}, {сайт} заменяются данными из «Настроек» и «Контактов»,
  // поэтому оферта и политика всегда совпадают с реквизитами в подвале
  function fillDoc(t) {
    var s = D.settings || {}, c = s.contacts || {};
    var map = { 'магазин': s.storeName, 'продавец': s.legal || s.storeName, 'почта': c.email, 'телефон': c.phone, 'адрес': c.address, 'сайт': location.host };
    return String(t || '').replace(/\{(магазин|продавец|почта|телефон|адрес|сайт)\}/g, function (m, k) { return map[k] || '—'; });
  }
  function textPage(v, parts) {
    var p = D.pages.find(function (x) { return x.slug === parts[1]; });
    if (!p) return notFound(v);
    if (p.slug === 'about') return aboutPage(v, p);
    if ((p.group || 'help') !== 'legal' && p.slug !== 'contacts') return infoPage(v, p);
    v.innerHTML = '<div class="wrap"><div class="page-head"><div class="crumbs"><a href="#/">Главная</a><span>/</span><span>' + esc(p.title) + '</span></div><h1>' + esc(p.title) + '</h1></div><article class="prose">' + md(fillDoc(p.body)) +
      (p.slug === 'about' || p.slug === 'contacts' ? contactsBlock() : '') + '</article></div>';
  }
  /* «О бренде»: текст страницы из админки раскладывается по дизайну.
     Первая строка **Название. Слоган.** — заголовок; список под вступлением — плашки с иконками;
     разделы «## Стиль», «## Качество», «## Индивидуальность» — карточки-опоры с объёмными иконками;
     остальные «## …» — главы истории; последняя строка *Имя, роль* — подпись основателя. */
  var ABOUT_WORDS = [[/стил|образ|гардероб/, 'style'], [/индивидуал|уникал|характер|личност/, 'gem'], [/петербург|москв|город|родил/, 'pin'], [/фабрик|россии|шьём|шьем|пошив|производ|отшив/, 'spool']];
  function aboutIcon(text) {
    var s = String(text || '').toLowerCase();
    for (var i = 0; i < ABOUT_WORDS.length; i++) if (ABOUT_WORDS[i][0].test(s)) return ABOUT_WORDS[i][1];
    return benefitIcon({ title: text });
  }
  function aboutParse(body) {
    var lines = String(body || '').split(/\n/), doc = { title: '', motto: [], lead: [], facts: [], sections: [], sign: '', closing: '', photo: null, portrait: null }, cur = null;
    lines.forEach(function (raw) {
      var t = raw.trim(); if (!t) return;
      var h = /^##\s+(.+)$/.exec(t);
      if (h) { cur = { title: h[1].replace(/^#+\s*/, ''), paras: [], list: [] }; doc.sections.push(cur); return; }
      // ![подпись](uploads/…jpg) — фотография основателя рядом с его словами
      var ph = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(t);
      // во вступлении — портрет в шапке страницы, в конце — рядом со словами основателя
      if (ph) { if (/^(uploads\/|img\/|https:\/\/)/.test(ph[2])) doc[cur ? 'photo' : 'portrait'] = { alt: ph[1], src: ph[2] }; return; }
      var sg = /^\*([^*].*[^*])\*$/.exec(t);
      if (sg) { doc.sign = sg[1]; return; }
      if (!cur) {
        var b = /^\*\*(.+)\*\*$/.exec(t);
        if (b && !doc.title) {
          var parts = b[1].split(/\.\s+|\.$/).map(function (x) { return x.trim(); }).filter(Boolean);
          doc.title = parts[0] || b[1]; doc.motto = parts.slice(1); return;
        }
        if (/^- /.test(t)) doc.facts.push(t.slice(2)); else doc.lead.push(t);
        return;
      }
      if (/^- /.test(t)) cur.list.push(t.slice(2)); else cur.paras.push(t);
    });
    // короткая фраза прямо перед подписью — заключительные слова основателя
    var last = doc.sections[doc.sections.length - 1];
    if (doc.sign && last && last.paras.length > 1 && last.paras[last.paras.length - 1].length < 90) doc.closing = last.paras.pop();
    return doc;
  }
  function aboutInline(s) { return md(s).replace(/^<p>|<\/p>$/g, ''); }
  function aboutPage(v, p) {
    var d = aboutParse(fillDoc(p.body)), s = D.settings || {}, b = s.brand || {};
    var mark = b.mark && b.mark.src ? b.mark.src : 'img/logo-mark.png';
    var ic = function (n, size) { return '<img src="img/benefits/' + n + '.webp?v=13.57.1" alt="" width="' + size + '" height="' + size + '" loading="lazy" decoding="async">'; };
    var title = d.title || s.storeName || p.title;
    var motto = d.motto.length ? d.motto : String(s.tagline || '').split(/\.\s*/).filter(Boolean);
    // главы истории и опоры: подряд идущие разделы с «своей» иконкой собираются в одну сетку карточек
    var blocks = [], n = 0;
    d.sections.forEach(function (sec) {
      var pillar = /^(стиль|качество|индивидуальность|материал\S*|ткан\S*|крой|детали)$/i.test(sec.title.trim());
      if (pillar) {
        var lastB = blocks[blocks.length - 1];
        if (lastB && lastB.kind === 'pillars') lastB.items.push(sec); else blocks.push({ kind: 'pillars', items: [sec] });
      } else blocks.push({ kind: 'story', sec: sec, n: ++n });
    });
    var paras = function (sec) {
      return sec.paras.map(function (x) { return '<p>' + aboutInline(x) + '</p>'; }).join('') +
        (sec.list.length ? '<ul class="ab-list">' + sec.list.map(function (x) { return '<li>' + aboutInline(x) + '</li>'; }).join('') + '</ul>' : '');
    };
    var body = blocks.map(function (bl) {
      if (bl.kind === 'pillars') {
        return '<section class="ab-pillars-sec"><div class="wrap"><div class="ab-pillars n' + bl.items.length + '">' + bl.items.map(function (sec, i) {
          var icn = aboutIcon(sec.title) || aboutIcon(sec.paras.join(' ')), glow = ABOUT_GLOW[icn] || BENEFIT_ICONS[icn] || '#c2c7cd';
          return '<article class="ab-pillar ab-rv" style="--i:' + i + ';--glow:' + glow + '">' +
            '<span class="ab-pillar-n">' + (i + 1) + '</span>' +
            (icn ? '<div class="ab-pillar-ico">' + ic(icn, 220) + '</div>' : '') +
            '<h2>' + glue(sec.title) + '</h2>' + paras(sec) + '</article>';
        }).join('') + '</div></div></section>';
      }
      var sec = bl.sec, first = sec.paras[0];
      return '<section class="ab-story"><div class="wrap ab-story-in ab-rv">' +
        '<div class="ab-story-head"><span class="ab-num">' + bl.n + '</span><h2>' + glue(sec.title) + '</h2></div>' +
        '<div class="ab-story-body">' + (first ? '<p class="ab-lede">' + aboutInline(first) + '</p>' : '') +
        paras({ paras: sec.paras.slice(1), list: sec.list }) + '</div></div></section>';
    }).join('');

    // сервис: преимущества магазина с иконками доставки, примерки, возврата и оплаты
    var serv = ((s.home && s.home.benefits) || []).map(function (x) { return { b: x, ic: benefitIcon(x) }; })
      .filter(function (x) { return /^(delivery|fitting|return|payment|cash|gift)$/.test(x.ic); }).slice(0, 4);
    var service = serv.length ? '<section class="ab-service"><div class="wrap"><div class="ab-service-row">' + serv.map(function (x, i) {
      return '<div class="ab-serv ab-rv" style="--i:' + i + ';--glow:' + BENEFIT_ICONS[x.ic] + '"><span class="ab-serv-ico">' + ic(x.ic, 96) + '</span><span><b>' + glue(x.b.title) + '</b>' + (x.b.text ? '<small>' + glue(x.b.text) + '</small>' : '') + '</span></div>';
    }).join('') + '</div></div></section>' : '';

    var sign = d.sign ? d.sign.split(/,\s*/) : [];
    var founder = d.sign || d.closing || d.photo ? '<section class="ab-founder-sec"><div class="wrap"><div class="ab-founder ab-rv' + (d.photo ? ' has-photo' : '') + '">' +
      (d.photo ? '<figure class="ab-founder-ph"><img src="' + esc(d.photo.src) + '" alt="' + esc(d.photo.alt || (sign[0] || '')) + '" loading="lazy" decoding="async"></figure><div class="ab-founder-copy">' : '') +
      '<img class="ab-founder-mark" src="' + esc(mark) + '" alt="" aria-hidden="true">' +
      (d.closing ? '<p class="ab-founder-q">' + glue(d.closing) + '</p>' : '') +
      (sign.length ? '<p class="ab-founder-sign"><b>' + esc(sign[0]) + '</b>' + (sign.length > 1 ? '<span>' + esc(sign.slice(1).join(', ')) + '</span>' : '') + '</p>' : '') +
      '<a class="btn" href="#/catalog">Смотреть коллекцию</a>' +
      (d.photo ? '</div>' : '') +
      '</div></div></section>' : '';

    v.innerHTML = '<div class="about">' +
      '<section class="ab-hero"><div class="wrap">' +
        '<div class="crumbs"><a href="#/">Главная</a><span>/</span><span>' + esc(p.title) + '</span></div>' +
        '<div class="ab-hero-grid">' +
          '<div class="ab-hero-copy">' +
            '<span class="eyebrow">' + esc(p.title) + '</span>' +
            (b.word && b.word.src && String(title).toLowerCase() === String(s.storeName || '').toLowerCase()
              ? '<h1 class="ab-word"><img src="' + esc(b.word.src) + '" alt="' + esc(title) + '" width="' + (b.word.w || 960) + '" height="' + (b.word.h || 91) + '"></h1>'
              : '<h1>' + esc(title) + '</h1>') +
            (motto.length ? '<p class="ab-motto">' + motto.map(function (w, i) { return '<span style="--i:' + i + '">' + esc(w) + '</span>'; }).join('') + '</p>' : '') +
            d.lead.map(function (x) { return '<p class="ab-lead">' + aboutInline(x) + '</p>'; }).join('') +
          '</div>' +
          (d.portrait
            ? '<div class="ab-hero-art"><figure class="ab-portrait"><img src="' + esc(d.portrait.src) + '" alt="' + esc(d.portrait.alt) + '" decoding="async">' +
                '<figcaption><img class="ab-portrait-mark" src="' + esc(mark) + '" alt="" aria-hidden="true"><span><b>' + esc(d.portrait.alt || (d.sign.split(/,\s*/)[0] || '')) + '</b>' + (d.sign.indexOf(',') > 0 ? '<small>' + esc(d.sign.split(/,\s*/).slice(1).join(', ')) + '</small>' : '') + '</span></figcaption></figure></div>'
            : '<div class="ab-hero-art" aria-hidden="true"><div class="ab-plate"><img src="' + esc(mark) + '" alt=""><span class="ab-plate-ring"></span></div></div>') +
        '</div>' +
        (d.facts.length ? '<div class="ab-facts">' + d.facts.map(function (f, i) {
          // слово не узнали — всё равно ставим иконку, чтобы плашка не осталась пустой
          var icn = aboutIcon(f) || ['quality', 'gem', 'style'][i % 3];
          return '<div class="ab-fact ab-rv" style="--i:' + i + (icn ? ';--glow:' + (ABOUT_GLOW[icn] || BENEFIT_ICONS[icn]) : '') + '">' + (icn ? '<span class="ab-fact-ico">' + ic(icn, 88) + '</span>' : '') + '<span>' + aboutInline(f) + '</span></div>';
        }).join('') + '</div>' : '') +
      '</div></section>' +
      body + service + founder +
      aboutContacts() +
    '</div>';

    pageBind(v);
  }
  // Копирование контактов и плавное появление блоков на оформленных страницах
  function pageBind(v) {
    $$('.ac-copy', v).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.getAttribute('data-copy'), done = function () { btn.classList.add('copied'); $('i', btn).textContent = 'Скопировано'; setTimeout(function () { btn.classList.remove('copied'); $('i', btn).textContent = 'Скопировать'; }, 2200); };
        try { navigator.clipboard.writeText(t).then(done, function () { toast(btn.getAttribute('data-what') + ': ' + t); }); } catch (ex) { toast(btn.getAttribute('data-what') + ': ' + t); }
      });
    });
    var els = $$('.ab-rv', v);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .15 });
      els.forEach(function (el) { el.classList.add('rv-pre'); io.observe(el); });
    }
  }

  /* Страницы для покупателей («Доставка и оплата», «Обмен и возврат», «Уход за вещами»…):
     вступление — крупно рядом с объёмной иконкой; «## Раздел» — заголовок с иконкой;
     список «- **Заголовок.** текст» — карточки с иконками; «1. …» — шаги; обычные абзацы — текст. */
  var INFO_WORDS = [[/отслеж|трек/, 'mail'], [/бесплатн|бонус|подар/, 'gift'], [/пункт|адрес|метро|город/, 'pin'], [/курьер|доставк|сдэк|отправ|отслеж|трек/, 'delivery'], [/примерк/, 'fitting'],
    [/при получении|наличн|деньги|стоимост|бесплатн|реквизит/, 'cash'], [/онлайн|карт|оплат|сбп|юkassa/, 'payment'], [/бонус|подар/, 'gift'],
    [/возврат|вернуть|обмен/, 'return'], [/уход|стирк|ткан|шерст|кашемир|трикотаж/, 'fabric'], [/почт|письм|напишите/, 'mail'], [/поддержк|чат|вопрос/, 'chat']];
  function infoIcon(t) {
    var x = String(t || '').toLowerCase();
    for (var i = 0; i < INFO_WORDS.length; i++) if (INFO_WORDS[i][0].test(x)) return INFO_WORDS[i][1];
    return '';
  }
  function infoGlow(n) { return BENEFIT_ICONS[n] || '#c2c7cd'; }
  function infoParse(body) {
    var doc = { lead: [], sections: [] }, cur = null, blk = null;
    String(body || '').split(/\n/).forEach(function (raw) {
      var t = raw.trim();
      if (!t) { blk = null; return; }
      var h = /^##\s+(.+)$/.exec(t);
      if (h) { cur = { title: h[1].replace(/^#+\s*/, ''), blocks: [] }; doc.sections.push(cur); blk = null; return; }
      var kind = /^- /.test(t) ? 'ul' : /^\d+[.)]\s+/.test(t) ? 'ol' : 'p';
      var text = kind === 'ul' ? t.slice(2) : kind === 'ol' ? t.replace(/^\d+[.)]\s+/, '') : t;
      if (!cur) { if (kind === 'p') { doc.lead.push(text); return; } cur = { title: '', blocks: [] }; doc.sections.push(cur); }
      if (kind === 'p') { cur.blocks.push({ kind: 'p', items: [text] }); blk = null; return; }
      if (!blk || blk.kind !== kind) { blk = { kind: kind, items: [] }; cur.blocks.push(blk); }
      blk.items.push(text);
    });
    return doc;
  }
  // «**Выбор пункта.** При оформлении…» → заголовок и текст карточки
  function infoItem(t) {
    var m = /^\*\*(.+?)\*\*\s*[—–:-]?\s*(.*)$/.exec(t);
    if (!m) return { title: '', text: t };
    return { title: m[1].replace(/[.:]\s*$/, ''), text: m[2].replace(/^(.)/, function (c) { return c.toUpperCase(); }) };
  }
  function infoPage(v, p) {
    var d = infoParse(fillDoc(p.body));
    // нет вступления — первый абзац первого раздела поднимаем в шапку страницы
    var f = d.sections[0];
    if (!d.lead.length && f && f.blocks[0] && f.blocks[0].kind === 'p') d.lead.push(f.blocks.shift().items[0]);
    var ic = function (n, size) { return n ? '<img src="img/benefits/' + n + '.webp?v=13.57.1" alt="" width="' + size + '" height="' + size + '" loading="lazy" decoding="async">' : ''; };
    var heroIc = infoIcon(p.title) || infoIcon(p.slug === 'returns' ? 'возврат' : p.slug === 'delivery' ? 'доставка' : '') || 'quality';
    var secs = d.sections.map(function (sec, si) {
      var sIc = infoIcon(sec.title);
      var blocks = sec.blocks.map(function (bl) {
        if (bl.kind === 'p') return '<p class="ip-p ab-rv">' + aboutInline(bl.items[0]) + '</p>';
        if (bl.kind === 'ol') return '<ol class="ip-steps">' + bl.items.map(function (x, i) {
          return '<li class="ip-step ab-rv" style="--i:' + i + '"><span class="ip-step-n">' + (i + 1) + '</span><p>' + aboutInline(x) + '</p></li>';
        }).join('') + '</ol>';
        // у всех карточек одна и та же иконка — убираем: повтор выглядит шаблонно
        var its = bl.items.map(infoItem), icons = its.map(function (it) { return infoIcon(it.title) || infoIcon(it.text) || sIc; });
        var uniq = icons.filter(function (x, i, a) { return x && a.indexOf(x) === i; });
        if (its.length > 1 && uniq.length <= 1) icons = icons.map(function () { return ''; });
        return '<div class="ip-cards' + (bl.items.length === 1 ? ' one' : '') + '">' + its.map(function (it, i) {
          var n = icons[i];
          return '<div class="ip-card ab-rv' + (n ? '' : ' no-ico') + '" style="--i:' + (i % 4) + ';--glow:' + infoGlow(n) + '">' +
            (n ? '<span class="ip-card-ico">' + ic(n, 120) + '</span>' : '') +
            '<div>' + (it.title ? '<h3>' + glue(it.title) + '</h3>' : '') + (it.text ? '<p>' + aboutInline(it.text) + '</p>' : '') + '</div></div>';
        }).join('') + '</div>';
      }).join('');
      return '<section class="ip-sec"><div class="wrap">' +
        (sec.title ? '<div class="ip-sec-head ab-rv">' + (sIc ? '<span class="ip-sec-ico" style="--glow:' + infoGlow(sIc) + '">' + ic(sIc, 120) + '</span>' : '') +
          '<div><span class="ab-num">' + (si + 1) + '</span><h2>' + glue(sec.title) + '</h2></div></div>' : '') +
        '<div class="ip-sec-body">' + blocks + '</div></div></section>';
    }).join('');
    v.innerHTML = '<div class="about info">' +
      '<section class="ab-hero ip-hero"><div class="wrap">' +
        '<div class="crumbs"><a href="#/">Главная</a><span>/</span><span>' + esc(p.title) + '</span></div>' +
        '<div class="ab-hero-grid">' +
          '<div class="ab-hero-copy"><span class="eyebrow">Покупателям</span><h1 class="ip-title">' + glue(p.title) + '</h1>' +
            d.lead.map(function (x) { return '<p class="ab-lead">' + aboutInline(x) + '</p>'; }).join('') + '</div>' +
          '<div class="ab-hero-art" aria-hidden="true"><div class="ab-plate ip-plate" style="--glow:' + infoGlow(heroIc) + '">' + ic(heroIc, 320) + '<span class="ab-plate-ring"></span></div></div>' +
        '</div></div></section>' +
      secs + aboutContacts() + '</div>';
    pageBind(v);
  }
  function aboutContacts() {
    var c = (D.settings && D.settings.contacts) || {};
    var tel = String(c.phone || '').replace(/[^\d+]/g, '');
    var ic = function (n) { return '<span class="ac-ico"><img src="img/benefits/' + n + '.webp?v=13.57.1" alt="" width="120" height="120" loading="lazy" decoding="async"></span>'; };
    var arrow = '<span class="ac-go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
    var copy = function (v, what) { return '<button class="ac-copy" type="button" data-copy="' + esc(v) + '" data-what="' + esc(what) + '" aria-label="Скопировать"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg><i>Скопировать</i></button>'; };
    var card = function (cls, glow, href, icon, label, value, extra, i) {
      return '<div class="ac-card ab-rv ' + cls + '" style="--i:' + i + ';--glow:' + glow + '">' +
        '<a class="ac-link" href="' + esc(href) + '"' + (/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '') + '>' + ic(icon) +
        '<span class="ac-text"><small>' + label + '</small><b>' + value + '</b></span>' + arrow + '</a>' + (extra || '') + '</div>';
    };
    var cards = [], i = 0;
    if (c.fab !== false) cards.push(card('ac-chat', '#16b5a5', '#/account?tab=support&new=1', 'chat', 'Чат поддержки', 'Написать нам', '', i++));
    if (c.email) cards.push(card('ac-mail', '#3e6bf0', 'mailto:' + c.email, 'mail', 'Почта', esc(c.email), copy(c.email, 'Почта'), i++));
    if (c.phone) cards.push(card('ac-phone', '#1ab248', 'tel:' + tel, 'phone', 'Телефон', esc(c.phone), copy(c.phone, 'Телефон'), i++));
    if (c.address) cards.push(card('ac-addr', '#ff8b74', 'https://yandex.ru/maps/?text=' + encodeURIComponent(c.address), 'pin', 'Адрес', esc(c.address), '', i++));
    if (!cards.length) return '';
    var socials = (D.settings.socials || []).filter(function (x) { return x.url; });
    var soc = socials.length ? '<div class="ac-socials ab-rv" style="--i:' + i + '"><span>Мы в соцсетях</span><div>' + socials.map(function (x) {
      return '<a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener" aria-label="' + esc(x.name) + '"><span class="soc-ic" aria-hidden="true">' + SOC_ICON[socialKind(x)] + '</span><b>' + esc(x.name) + '</b></a>';
    }).join('') + '</div></div>' : '';
    return '<section class="ab-contacts"><div class="wrap"><div class="ac">' +
      '<div class="ac-intro ab-rv">' +
        '<span class="ab-num">Связь</span>' +
        '<h2>Мы на связи</h2>' +
        '<p>Подскажем с размером, расскажем о ткани и уходе, поможем с заказом и доставкой. Пишите — ответим лично.</p>' +
        (c.hours ? '<p class="ac-hours"><i></i>' + esc(c.hours) + '</p>' : '') +
      '</div>' +
      '<div class="ac-cards">' + cards.join('') + soc + '</div>' +
    '</div></div></section>';
  }
  var ABOUT_GLOW = { style: '#c9925e', gem: '#7b61ff', spool: '#ff8b74', pin: '#ff8b74' };

  function contactsBlock() {
    var c = D.settings.contacts || {};
    return '<h2>Контакты</h2><p>' + [c.phone && '<span class="copyable">' + esc(c.phone) + '</span>', c.email && '<span class="copyable">' + esc(c.email) + '</span>', esc(c.address || ''), esc(c.hours || '')].filter(Boolean).join('<br>') + '</p>';
  }
  /* 404 в стиле сайта: крупные цифры, понятный текст, куда пойти дальше */
  function notFound(v) {
    var cats = sortedCats().slice(0, 5);
    v.innerHTML = '<div class="wrap"><section class="nf">' +
      '<div class="nf-art" aria-hidden="true"><span class="nf-ring"></span><span class="nf-num">4<i>0</i>4</span></div>' +
      '<div class="nf-copy"><span class="eyebrow">Ошибка 404</span><h1 class="nf-title">Такой страницы нет</h1>' +
        '<p class="nf-text">Возможно, ссылка устарела или в адресе опечатка. Вещь могла закончиться — загляните в каталог, там всё, что есть сейчас.</p>' +
        '<div class="nf-acts"><a class="btn nf-go" href="#/catalog"><span>Перейти в каталог</span><span class="bn-ic" aria-hidden="true">' + ARROW + '</span></a><a class="btn ghost" href="#/">На главную</a><button type="button" class="link nf-search" data-act="search">Поиск по сайту</button></div>' +
        (cats.length ? '<div class="nf-cats">' + cats.map(function (c) { return '<a href="#/catalog?cat=' + esc(c.slug) + '">' + esc(c.name) + '</a>'; }).join('') + '</div>' : '') +
      '</div></section></div>';
  }

  /* ---------- Поиск ---------- */
  function openSearch() {
    openModal('<h3 class="serif" style="font-size:34px;margin-bottom:20px">Поиск</h3><form id="sForm"><input class="input" id="sInput" placeholder="Название, цвет или артикул" autocomplete="off" aria-label="Поиск"></form><div id="sRes" style="display:grid;gap:12px;margin-top:20px"></div>');
    var i = $('#sInput'); setTimeout(function () { i.focus(); }, 50);
    i.addEventListener('input', function () {
      var t = i.value.trim().toLowerCase(), words = searchWords(t);
      var res = t.length < 2 ? [] : D.products.filter(onSale).filter(function (p) { var cat = catById(p.categoryId); return textHas(p.name + ' ' + (p.sku || '') + ' ' + colorNames(p) + ' ' + (cat ? cat.name : '') + ' ' + (p.description || '') + ' ' + (window.Specs ? Specs.list(p).map(function (x) { return x.value; }).join(' ') : ''), words); });
      var more = res.length > 6; res = res.slice(0, 6);
      $('#sRes').innerHTML = res.map(function (p) { return '<a class="mini-line" href="#/product/' + esc(p.slug) + '"><img src="' + esc(imgOf(p)) + '" alt=""><div>' + esc(p.name) + '<div class="sub">' + esc(Pricing.colorsOf(p).map(function (c) { return c.name; }).join(', ')) + '</div></div><span class="num">' + fmt(priceOf(p).price) + '</span></a>'; }).join('') + (more ? '<a class="link sh-more" style="margin-top:14px" href="#/catalog?q=' + encodeURIComponent(i.value.trim()) + '"><span>Все результаты</span><i aria-hidden="true">' + ARROW + '</i></a>' : '') || (t.length >= 2 ? '<p class="muted">Ничего не нашлось</p>' : '');
    });
    $('#sForm').addEventListener('submit', function (e) { e.preventDefault(); if (i.value.trim()) go('#/catalog?q=' + encodeURIComponent(i.value.trim())); });
  }

  /* ---------- Админка (подключается из admin.js) ---------- */
  // Панель управления (250 КБ) загружаем только когда её открывают — покупателям она не нужна
  var adminLoading = null;
  /* ---------- Избранное ---------- */
  var favDraw = null;
  function favListHtml(compact) {
    var list = Fav.get().map(function (f) { return D.products.find(function (p) { return p.id === f.id && p.active !== false; }); }).filter(Boolean);
    if (!list.length) return '<div class="fav-empty"><span class="fav-empty-ic" aria-hidden="true">' + ICON.heart + '</span><h3>Здесь пока пусто</h3><p>Нажимайте на сердечко у понравившихся вещей — они соберутся здесь, и к ним легко вернуться.</p><a class="btn" href="#/catalog">Перейти в каталог</a></div>';
    var inStock = list.filter(function (p) { return totalStock(p) > 0; }).length;
    return '<div class="fav-bar"><span class="fav-n">' + list.length + ' ' + plural(list.length, 'вещь', 'вещи', 'вещей') + (inStock < list.length ? ' · в наличии ' + inStock : '') + '</span>' +
      (!API.user && !compact ? '<span class="fav-hint">' + ICON.user + '<span><a class="link" href="#/account">Войдите</a>, чтобы избранное было на всех ваших устройствах</span></span>' : '') +
      '<button type="button" class="link fav-clear" id="favClear">Очистить</button></div>' +
      '<div class="grid fav-grid">' + list.map(card).join('') + '</div>';
  }
  function bindFavList(box) {
    favDraw = function () { box.innerHTML = favListHtml(box.hasAttribute('data-compact')); var c = $('#favClear', box); if (c) c.addEventListener('click', function () { var prev = Fav.get(); Fav.set([]); toastUndo('Избранное очищено', function () { Fav.set(prev); }); }); };
    favDraw();
  }
  function toastUndo(msg, undo) {
    var w = $('.toast-wrap'), t = document.createElement('div'); t.className = 'toast';
    t.innerHTML = '<span>' + esc(msg) + '</span><button type="button" class="toast-undo">Вернуть</button>'; w.appendChild(t);
    $('.toast-undo', t).addEventListener('click', function () { undo(); t.remove(); });
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, 5000);
  }
  /* ---------- Подарочные сертификаты ---------- */
  function giftPage(v) {
    var cfg = D.giftCfg || { enabled: false, nominals: [5000, 10000, 20000], min: 3000, max: 100000, months: 12 }, u = API.user || {};
    var canBuy = cfg.enabled && D.payReady;
    var st = { amount: cfg.nominals[1] || cfg.nominals[0] || 10000, custom: false, when: 'now' };
    var tomorrow = new Date(Date.now() + 864e5 + 3 * 36e5).toISOString().slice(0, 10), maxDate = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
    v.innerHTML = '<div class="wrap gift-page"><div class="page-head"><span class="eyebrow">Подарочные сертификаты</span><h1>Подарите ' + esc(D.settings.storeName || 'ALBAKOV') + '</h1>' +
      '<p class="muted gift-lead">Электронный сертификат придёт получателю на почту — сразу или в день праздника. Им можно оплатить любые вещи, целиком или за несколько покупок.</p></div>' +
      '<div class="gift-grid"><div class="gift-visual"><div class="gift-card" id="gcCard"><i class="gc-glow" aria-hidden="true"></i>' +
        '<div class="gc-top"><span class="gc-word">' + esc(String(D.settings.storeName || 'ALBAKOV').toUpperCase()) + '</span><span class="gc-label">Подарочный сертификат</span></div>' +
        '<b class="gc-amount num" id="gcAmount"></b>' +
        '<div class="gc-bottom"><span id="gcFor">Для получателя</span><span class="gc-code">GIFT-••••-••••</span></div></div>' +
        '<ul class="gift-facts"><li><b>' + cfg.months + ' ' + plural(cfg.months, 'месяц', 'месяца', 'месяцев') + '</b><span>срок действия</span></li><li><b>Не сгорает сразу</b><span>можно тратить в несколько покупок</span></li><li><b>На почту</b><span>в выбранный день</span></li></ul></div>' +
      '<form class="gift-form" id="gfForm" novalidate>' +
        '<div class="gf-sec"><span class="gf-k">Сумма</span><div class="gf-noms">' + cfg.nominals.map(function (n) { return '<button type="button" class="chip" data-nom="' + n + '">' + fmt(n) + '</button>'; }).join('') + '<button type="button" class="chip" data-nom="custom">Своя сумма</button></div>' +
          '<label class="field gf-custom" id="gfCustom" hidden><span>Своя сумма, ₽ <small class="muted">— от ' + fmt(cfg.min) + ' до ' + fmt(cfg.max) + '</small></span><input class="input num" id="gf-amount" inputmode="numeric" placeholder="15 000"></label></div>' +
        '<div class="gf-sec"><span class="gf-k">Кому</span><div class="row2"><label class="field"><span>Имя получателя</span><input class="input" id="gf-to" maxlength="60" placeholder="Анна"></label><label class="field"><span>Почта получателя</span><input class="input" id="gf-email" type="email" placeholder="anna@mail.ru"></label></div>' +
          '<label class="field"><span>Пожелание <small class="muted">— необязательно</small></span><textarea class="textarea" id="gf-msg" rows="2" maxlength="300" placeholder="С днём рождения! Выбери то, что понравится"></textarea></label>' +
          '<div class="gf-when" role="radiogroup" aria-label="Когда отправить"><label><input type="radio" name="gf-when" value="now" checked><span>Отправить сразу после оплаты</span></label><label><input type="radio" name="gf-when" value="date"><span>В выбранный день</span></label></div>' +
          '<label class="field" id="gfDate" hidden><span>Дата отправки <small class="muted">— письмо придёт в 10:00 по Москве</small></span><input class="input" id="gf-date" type="date" min="' + tomorrow + '" max="' + maxDate + '" value="' + tomorrow + '"></label></div>' +
        '<div class="gf-sec"><span class="gf-k">От кого</span><div class="row2"><label class="field"><span>Ваше имя</span><input class="input" id="gf-first" autocomplete="given-name" value="' + esc(u.firstName || '') + '"></label><label class="field"><span>Фамилия</span><input class="input" id="gf-last" autocomplete="family-name" value="' + esc(u.lastName || '') + '"></label>' +
          '<label class="field"><span>Телефон</span><input class="input" id="gf-phone" type="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" value="' + esc(fmtPhone(u.phone)) + '"></label><label class="field"><span>Ваша почта — для чека</span><input class="input" id="gf-me" type="email" autocomplete="email" value="' + esc(u.email || '') + '"></label></div>' +
          '<label class="field"><span>Подпись в сертификате <small class="muted">— необязательно</small></span><input class="input" id="gf-from" maxlength="60" placeholder="Например, Илья" value="' + esc(u.firstName || '') + '"></label></div>' +
        '<label class="check"><input type="checkbox" id="gf-offer"> <span>Принимаю условия <a href="#/page/offer" data-page-modal="offer">публичной оферты</a></span></label>' +
        '<label class="check"><input type="checkbox" id="gf-agree"> <span>Даю <a href="#/page/consent" data-page-modal="consent">согласие на обработку персональных данных</a></span></label>' +
        '<p class="form-error" id="gfErr"></p>' +
        (canBuy ? '<button class="btn block gf-pay" id="gfPay"><span id="gfPayT"></span><span class="bn-ic" aria-hidden="true">' + ARROW + '</span></button><p class="gf-note">Оплата через ЮKassa. Код придёт получателю письмом, вам — чек на почту.</p>'
          : '<div class="gf-soon"><b>Покупка онлайн скоро появится</b><p>Пока сертификат можно заказать, написав нам — оформим и пришлём код на почту.</p><a class="btn ghost" href="#/account?tab=support&new=1">Написать нам</a></div>') +
      '</form></div>' +
      '<section class="gift-check"><div><h2>Проверить остаток</h2><p class="muted">Введите код сертификата — покажем, сколько на нём осталось и до какого числа он действует.</p></div>' +
        '<form class="gc-form" id="gcForm"><input class="input" id="gc-code" placeholder="GIFT-XXXX-XXXX" autocomplete="off" autocapitalize="characters" aria-label="Код сертификата"><button class="btn">Проверить</button></form><div id="gcRes" class="gc-res"></div></section></div>';
    phoneMask($('#gf-phone'));
    function amount() { return st.custom ? Math.round(Number(String($('#gf-amount').value).replace(/\D/g, '')) || 0) : st.amount; }
    function sync() {
      $$('[data-nom]', v).forEach(function (b) { b.classList.toggle('on', st.custom ? b.getAttribute('data-nom') === 'custom' : Number(b.getAttribute('data-nom')) === st.amount); });
      $('#gfCustom').hidden = !st.custom;
      var a = amount(); $('#gcAmount').textContent = a ? fmt(a) : '— ₽';
      var to = $('#gf-to').value.trim(), from = $('#gf-from').value.trim();
      $('#gcFor').textContent = [to ? 'Для ' + to : 'Для получателя', from ? 'от ' + from : ''].filter(Boolean).join(' · ');
      $('#gfDate').hidden = st.when !== 'date';
      if ($('#gfPayT')) $('#gfPayT').textContent = a ? 'Оплатить ' + fmt(a) : 'Выберите сумму';
    }
    v.addEventListener('click', function (e) { var b = e.target.closest('[data-nom]'); if (!b) return; var n = b.getAttribute('data-nom'); st.custom = n === 'custom'; if (!st.custom) st.amount = Number(n); sync(); if (st.custom) $('#gf-amount').focus(); });
    ['gf-to', 'gf-from', 'gf-amount'].forEach(function (id) { $('#' + id).addEventListener('input', sync); });
    $$('input[name="gf-when"]', v).forEach(function (r) { r.addEventListener('change', function () { st.when = r.value; sync(); }); });
    // наклон карты за курсором
    bindCardTilt($('#gcCard'));
    sync();
    $('#gfForm').addEventListener('submit', async function (e) {
      e.preventDefault(); var err = $('#gfErr'); if (!canBuy) return;
      var a = amount(), f = { firstName: $('#gf-first').value.trim(), lastName: $('#gf-last').value.trim(), phone: $('#gf-phone').value, email: $('#gf-me').value.trim() };
      var checks = [['gf-email', validEmail($('#gf-email').value.trim())], ['gf-first', !!f.firstName], ['gf-last', !!f.lastName], ['gf-phone', validPhone(f.phone)], ['gf-me', validEmail(f.email)]];
      checks.forEach(function (c) { $('#' + c[0]).classList.toggle('invalid', !c[1]); });
      if (!(a >= cfg.min && a <= cfg.max)) { err.textContent = 'Сумма — от ' + fmt(cfg.min) + ' до ' + fmt(cfg.max); return; }
      if (checks.some(function (c) { return !c[1]; })) { err.textContent = 'Заполните выделенные поля'; return; }
      if (!$('#gf-offer').checked) { err.textContent = 'Примите условия публичной оферты'; return; }
      if (!$('#gf-agree').checked) { err.textContent = 'Нужно согласие на обработку персональных данных'; return; }
      err.textContent = ''; var b = $('#gfPay'); b.disabled = true; $('#gfPayT').textContent = 'Оформляем…';
      try {
        var r = await API.buyGift({ amount: a, toName: $('#gf-to').value, toEmail: $('#gf-email').value, message: $('#gf-msg').value, fromName: $('#gf-from').value, sendAt: st.when === 'date' ? $('#gf-date').value : '', customer: f, consent: true });
        if (r.payUrl) toast('Сертификат оформлен — осталось оплатить');
        go('#/order/' + r.order.id);
      } catch (ex) { err.textContent = errMsg(ex); b.disabled = false; sync(); }
    });
    $('#gcForm').addEventListener('submit', async function (e) {
      e.preventDefault(); var box = $('#gcRes'), code = $('#gc-code').value.trim(); if (!code) return;
      try {
        var g = await API.checkGift(code);
        box.innerHTML = '<div class="gc-card-res' + (g.state === 'active' ? '' : ' off') + '"><div><span class="gf-k">' + esc(g.code) + '</span><b class="num">' + fmt(g.balance) + '</b><span class="muted">из ' + fmt(g.amount) + (g.expiresAt ? ' · действует до ' + esc(fmtDate(g.expiresAt.slice(0, 10))) : '') + '</span></div>' + (g.message ? '<p>' + esc(g.message) + '</p>' : '<a class="btn ghost" href="#/catalog">Выбрать вещи</a>') + '</div>';
      } catch (ex) { box.innerHTML = '<p class="promo-msg bad">' + esc(errMsg(ex)) + '</p>'; }
    });
  }

  /* ---------- Где мой заказ: без входа, по номеру и телефону ---------- */
  function trackPage(v, parts, q) {
    v.innerHTML = '<div class="wrap trk-page"><div class="page-head"><span class="eyebrow">Без входа в кабинет</span><h1>Где мой заказ</h1>' +
      '<p class="muted trk-lead">Номер заказа есть в письме и SMS после оформления. Телефон — тот, что вы указали в заказе.</p></div>' +
      '<div class="trk-grid"><form class="trk-form" id="trkForm" novalidate>' +
        '<label class="field"><span>Номер заказа</span><input class="input" id="trk-n" inputmode="numeric" autocomplete="off" placeholder="Например, 1042" value="' + esc(q.n || '') + '"></label>' +
        '<label class="field"><span>Телефон из заказа</span><input class="input" id="trk-p" type="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__"></label>' +
        '<p class="form-error" id="trkErr"></p><button class="btn block trk-btn"><span>Найти заказ</span><span class="bn-ic" aria-hidden="true">' + ARROW + '</span></button></form>' +
      '<aside class="trk-aside">' +
        '<div class="trk-tip"><span class="trk-tip-ic">' + ICON.bag + '</span><div><b>Что вы увидите</b><p>Состав заказа, этап доставки, трек-номер СДЭК и куда приедет посылка.</p></div></div>' +
        (API.user ? '<div class="trk-tip"><span class="trk-tip-ic">' + ICON.user + '</span><div><b>Вы вошли в кабинет</b><p>Все ваши заказы — в разделе <a class="link" href="#/account?tab=orders">Мои заказы</a>.</p></div></div>'
          : '<div class="trk-tip"><span class="trk-tip-ic">' + ICON.user + '</span><div><b>Есть аккаунт?</b><p><a class="link" href="#/account">Войдите</a> — там история всех заказов и бонусы.</p></div></div>') +
      '</aside></div></div>';
    phoneMask($('#trk-p'));
    $('#trkForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var n = $('#trk-n').value.replace(/\D/g, ''), ph = $('#trk-p').value, err = $('#trkErr');
      $('#trk-n').classList.toggle('invalid', !n); $('#trk-p').classList.toggle('invalid', !validPhone(ph));
      if (!n) { err.textContent = 'Укажите номер заказа'; return; }
      if (!validPhone(ph)) { err.textContent = 'Укажите телефон полностью'; return; }
      var b = $('.trk-btn'); b.disabled = true; err.textContent = '';
      try { var r = await API.track(n, ph); go('#/order/' + r.id); } catch (ex) { err.textContent = errMsg(ex); b.disabled = false; }
    });
  }
  function favoritesPage(v) {
    v.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Сохранённые вещи</span><h1>Избранное</h1></div><div id="favBox" class="fav-box"></div></div>';
    bindFavList($('#favBox'));
  }

  function adminPage(v, parts, q) {
    if (window.Admin) { window.Admin.render(v, parts, q); return; }
    v.innerHTML = '<div class="loader">…</div>';
    // Панель и шаблоны писем загружаются только тем, кто открыл админку, — покупателям они не нужны
    if (!adminLoading) adminLoading = (function () {
      var ver = ((document.querySelector('script[src*="js/app.js"]') || {}).src || '').split('v=')[1];
      var load = function (src) { return new Promise(function (ok, bad) { var sc = document.createElement('script'); sc.src = src + '?v=' + ver; sc.onload = ok; sc.onerror = bad; document.body.appendChild(sc); }); };
      return (window.Mail ? Promise.resolve() : load('js/mail.js')).then(function () { return window.Finance ? null : load('js/finance.js'); }).then(function () { return load('js/admin.js'); }).catch(function (e) { adminLoading = null; throw e; });
    })();
    adminLoading.then(function () { if (window.Admin && $('#view') === v) window.Admin.render(v, parts, q); },
      function () { v.innerHTML = '<div class="wrap"><div class="empty"><h3>Не удалось загрузить панель</h3><p>Проверьте интернет и обновите страницу.</p></div></div>'; });
  }

  /* ---------- Обновление данных после правок в админке ---------- */
  async function refresh() {
    try { var r = await fetch('api/state', { credentials: 'same-origin' }); var j = await r.json(); if (j.ok) D = j.data; } catch (e) {}
    window.App.D = D;
    // Тихое обновление: та же прокрутка и тот же слайд, страница не мигает
    var act = $('#slider .slg-slide.is-active'); slideKeep = act ? $$('#slider .slg-slide').indexOf(act) : 0;
    var scroll = window.scrollY; renderShell(); routeKeepScroll = true; routeQuiet = true; route(); restoreScroll(scroll);
  }

  /* ---------- Запуск ---------- */
  async function boot() {
    root = document.getElementById('app');
    var c;
    try { c = await Store.connect(); }
    catch (e) {
      // Данные не загрузились, но сервер уже прислал текст страницы (lib/seo.js) — показываем его, а не пустой экран:
      // и покупатель видит товары, и поисковый робот не примет страницу за пустую
      if (root.querySelector('.pre')) {
        document.documentElement.className = document.documentElement.className.replace(/\bjs\b/g, '');
        root.insertAdjacentHTML('afterbegin', '<div class="offline-bar">Не удалось загрузить магазин полностью. <button type="button" id="reloadBtn">Обновить</button></div>');
        document.getElementById('reloadBtn').addEventListener('click', function () { location.reload(); });
        splashOut();
        return;
      }
      root.innerHTML = '<div class="offline"><img src="img/logo-wordmark.png" alt="' + 'ALBAKOV' + '"><h1>Магазин временно недоступен</h1><p>Не удалось связаться с сервером. Проверьте интернет и обновите страницу — обычно это занимает минуту.</p><button class="btn" id="reloadBtn">Обновить страницу</button></div>';
      document.getElementById('reloadBtn').addEventListener('click', function () { location.reload(); });
      splashOut();
      return;
    }
    API = c.api; D = c.data;
    // Покупатель был в разделе, который закрыли, — показываем всю коллекцию
    if (curGender() && gClosed(curGender())) { genderChoice = 'all'; try { localStorage.setItem(LS_G, 'all'); } catch (e) {} paintGender(); }
    window.App = { careIcon: careIcon, API: API, D: D, plural: plural, slideHtml: slideHtml, brandHtml: brandHtml, brandMode: brandMode, esc: esc, fmt: fmt, toast: toast, errMsg: errMsg, imgOf: imgOf, refresh: refresh, go: go, openModal: openModal, closePanels: closePanels, fmtPhone: fmtPhone, fmtDate: fmtDate, STATUS: STATUS, PAY: PAY, supPhoto: supPhoto, msgDay: msgDay };
    renderShell();
    initAnalytics();
    setTimeout(appPushAsk, 2200);
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]'); if (a) {
        var act = a.getAttribute('data-act');
        if (act === 'menu') openPanel('menuDrawer');
        if (act === 'cart') openCart();
        if (act === 'search') openSearch();
        if (act === 'close') closePanels();
      }
      if (e.target.id === 'scrim' || e.target.id === 'modal') closePanels();
      var fb = e.target.closest('[data-fav]');
      if (fb) {
        e.preventDefault(); e.stopPropagation();
        var fid = fb.getAttribute('data-fav'), fp = D.products.find(function (x) { return x.id === fid; }), on = Fav.toggle(fid);
        fb.classList.add('pop'); setTimeout(function () { fb.classList.remove('pop'); }, 450);
        if (fp) toast(on ? '«' + fp.name + '» — в избранном' : 'Убрали из избранного');
        return;
      }
      var sw = e.target.closest('[data-sw]');
      if (sw) {
        e.preventDefault(); e.stopPropagation();
        var ks = sw.getAttribute('data-sw').split('|'), sp = D.products.find(function (x) { return x.id === ks[0]; }), ce = sw.closest('.card');
        if (sp && ce) { var tmp = document.createElement('div'); tmp.innerHTML = card(sp, ks[1]); var nc = tmp.firstChild; ce.replaceWith(nc); var f = nc.querySelector('[data-sw="' + ks[0] + '|' + ks[1] + '"]'); if (f && e.detail === 0) f.focus(); }
        return;
      }
      var qf = e.target.closest('[data-qfit]');
      if (qf) { e.preventDefault(); var kf = qf.getAttribute('data-qfit').split('|'), fp2 = D.products.find(function (x) { return x.id === kf[0]; }); if (fp2) openFitFinder(fp2, Pricing.colorOf(fp2, kf[1]), function () { quickSheet(kf[0], kf[1]); }); return; }
      var shc = e.target.closest('[data-ship-city]');
      if (shc) { e.preventDefault(); var sp2 = productBySlug(location.pathname.split('/')[2] || ''); if (sp2) openShipCity(sp2); return; }
      var qsh = e.target.closest('[data-qsheet]');
      if (qsh) { e.preventDefault(); e.stopPropagation(); var kq = qsh.getAttribute('data-qsheet').split('|'); quickSheet(kq[0], kq[1]); return; }
      var qa = e.target.closest('[data-qa]');
      if (qa) {
        e.preventDefault(); e.stopPropagation();
        var k = qa.getAttribute('data-qa').split('|'), pr = D.products.find(function (x) { return x.id === k[0]; });
        var sz = pr && Pricing.colorOf(pr, k[1]).sizes.find(function (x) { return x.size === k[2]; }), inCart = (Cart.find(k[0], k[1], k[2]) || { qty: 0 }).qty;
        if (!sz || inCart + 1 > sz.stock) { toast('Больше этого размера нет в наличии', true); return; }
        Cart.add(k[0], k[1], k[2], 1); qa.classList.add('added');
        if (qa.closest('.qs')) closePanels();
        toast('«' + pr.name + '», ' + Pricing.colorOf(pr, k[1]).name.toLowerCase() + ', ' + k[2] + ' — в корзине');
        return;
      }
      var gg = e.target.closest('[data-gender-go]'); if (gg) { setGender(gg.getAttribute('data-gender-go')); return; }
      var gb = e.target.closest('[data-gender]');
      if (gb) { var g = gb.getAttribute('data-gender'); setGender(curGender() === g ? 'all' : g); if (gb.closest('.drawer')) closePanels(); return; }
      var pm = e.target.closest('[data-page-modal]');
      if (pm) { var pg = D.pages.find(function (x) { return x.slug === pm.getAttribute('data-page-modal'); }); if (pg) { e.preventDefault(); openModal('<h3 class="serif" style="font-size:34px;margin-bottom:18px">' + esc(pg.title) + '</h3><div class="prose" style="padding:0;font-size:15px">' + md(fillDoc(pg.body)) + '</div>'); return; } }
      // Ссылки внутри магазина открываем без перезагрузки страницы (Ctrl/⌘ + клик — как обычно, в новой вкладке)
      var link = e.target.closest('a[href]');
      if (link && !e.defaultPrevented && e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && !link.target && !link.hasAttribute('download')) {
        var href = link.getAttribute('href');
        if (/^#\//.test(href) || (/^\/(?!\/)/.test(href) && !/^\/(api|uploads|img|css|js|fonts)\//.test(href) && !/\.[a-z0-9]{2,5}($|\?)/i.test(href))) { e.preventDefault(); navTo(href, false, !!link.closest(KEEP_SCROLL) && sameScreen(href)); }
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanels(); });
    // Кружки цвета, размеры и пакет в карточке — кнопки и с клавиатуры
    document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('span[data-qa], i[data-sw], span[data-qsheet]')) { e.preventDefault(); e.target.click(); } });
    // Оформление: изменить количество или убрать товар прямо в блоке «Ваш заказ»
    document.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-co-rm]'), qb = e.target.closest('[data-co-q]');
      if (!rm && !qb) return;
      var k = (rm || qb).getAttribute(rm ? 'data-co-rm' : 'data-co-key').split('|');
      var S = coSrc(), cur = S.find(k[0], k[1] || undefined, k[2]) || S.get().find(function (x) { return x.productId === k[0] && x.size === k[2]; });
      if (!cur) return;
      if (rm) {
        var line = rm.closest('.co-line'); if (line) line.classList.add('leaving');
        setTimeout(function () { S.update(cur.productId, cur.colorId, cur.size, 0); toast('Товар убран из заказа'); if (!S.count()) route(); }, 220);
        return;
      }
      var next = cur.qty + Number(qb.getAttribute('data-co-q'));
      if (next < 1) return;
      var szE = (function () { var pp = D.products.find(function (x) { return x.id === cur.productId; }); var cc = pp && Pricing.colorOf(pp, cur.colorId); return cc && cc.sizes.find(function (x) { return x.size === cur.size; }); })();
      if (szE && next > szE.stock) { toast('В наличии только ' + szE.stock + ' шт.', true); return; }
      S.update(cur.productId, cur.colorId, cur.size, next);
    });
    document.addEventListener('fav:change', function () {
      updateFavCount();
      $$('[data-fav]').forEach(function (b) { var on = Fav.has(b.getAttribute('data-fav')); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Убрать из избранного' : 'В избранное'); var t = $('.fav-t', b); if (t) t.textContent = on ? 'В избранном' : 'В избранное'; });
      if (favDraw && (parseHash().parts[0] === 'favorites' || (parseHash().parts[0] === 'account' && parseHash().q.tab === 'favorites'))) favDraw();
    });
    document.addEventListener('cart:change', function () { updateCartCount(); if ($('#cartDrawer.open')) renderCartDrawer(); if (cartPageDraw && parseHash().parts[0] === 'cart') cartPageDraw(); if (checkoutRedraw && parseHash().parts[0] === 'checkout' && coSrc().count() && $('#coSum')) checkoutRedraw(); });
    bindLines(document);
    // Шапка сжимается при прокрутке
    var ticking = false;
    function onScroll() {
      ticking = false;
      var y = window.scrollY;
      // Шапка становится плотной чуть раньше, чем прилипает к верху (когда уезжает строка объявления), —
      // чтобы под прозрачной шапкой не просвечивал текст страницы
      var hd = $('.header'); if (hd) { var was = hd.classList.contains('scrolled'); if (!was && y > 2) hd.classList.add('scrolled'); else if (was && y < 1) hd.classList.remove('scrolled'); }
      var tt = $('#toTop'); if (tt) { if (tt.hidden) tt.hidden = false; tt.classList.toggle('show', y >= 900); }
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    document.addEventListener('click', function (e) { if (e.target.closest('#toTop')) window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-copy-track]'); if (!b) return;
      var t = b.getAttribute('data-copy-track'), done = function () { b.textContent = 'Скопировано'; setTimeout(function () { b.textContent = 'Скопировать'; }, 1800); };
      try { navigator.clipboard.writeText(t).then(done, function () { toast('Трек-номер: ' + t); }); } catch (ex) { toast('Трек-номер: ' + t); }
    });
    initTilt();
    window.addEventListener('popstate', function (e) { var y = (e.state && e.state.y) || 0; routeKeepScroll = true; route(); restoreScroll(y); });
    // кто-то сменил адрес через #/… (старый код, ссылка без перехвата) — переводим в обычный адрес
    window.addEventListener('hashchange', function () { if (fromOldHash()) route(); });
    route();
    setTimeout(showBonusNews, 2300); // после заставки
    requestAnimationFrame(splashOut);
    setTimeout(cookieNote, 1800);
  }
  /* Сообщение о cookie: один раз на устройстве. Сайт использует только необходимые cookie, без аналитики и рекламы */
  function cookieNote() {
    var k = (D.settings.metrika || {}).id ? 'albakov:cookies2' : 'albakov:cookies'; try { if (localStorage.getItem(k)) return; } catch (e) { return; }
    if (/^#\/admin/.test(curRoute())) return;
    var el = document.createElement('div'); el.className = 'cookie-note'; el.setAttribute('role', 'status');
    el.innerHTML = '<p>' + ((D.settings.metrika || {}).id ? 'Используем cookie для входа, корзины и Яндекс Метрики — она помогает нам делать сайт удобнее.' : 'Используем только необходимые cookie — для входа и корзины.') + ' <a href="#/page/privacy" data-page-modal="privacy">Подробнее</a></p><button class="btn sm" type="button">Понятно</button>';
    document.body.appendChild(el);
    $('button', el).addEventListener('click', function () { try { localStorage.setItem(k, '1'); } catch (e) {} el.classList.add('out'); setTimeout(function () { el.remove(); }, 400); });
  }
  /* Заставка при первом заходе за сеанс: логотип проявляется, линия прорисовывается, затем открывается сайт */
  /* Заставка из index.html: убираем, когда магазин отрисован.
     При первом заходе за сессию даём анимации знака доиграть (не меньше 1,4 с с начала загрузки),
     при переходах и обновлениях страницы — уходит почти сразу */
  function splashOut() {
    // Приложение на iPhone держит свою заставку, пока магазин не отрисован, — сообщаем, что готово
    if (window.AlbakovApp) { try { AlbakovApp.post({ type: 'ready' }); } catch (e) { /* старая версия приложения уберёт заставку сама */ } }
    var el = document.getElementById('splash'); if (!el || el.classList.contains('leave')) return;
    try { sessionStorage.setItem('albakov:intro', '1'); } catch (e) {}
    // при обновлении страницы заставка скрыта ещё до отрисовки (js/splash.js) — просто убираем её
    if (document.documentElement.classList.contains('sp-skip')) { el.remove(); return; }
    // как в приложении: заставка не меньше 1,4 с, затем сайт раскрывается кругом от знака (0,75 с)
    var wait = Math.max(0, 1400 - performance.now());
    setTimeout(function () { el.classList.add('leave'); setTimeout(function () { el.remove(); }, 800); }, wait);
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
