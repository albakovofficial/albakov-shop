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
  /* Раздел магазина: женщинам / мужчинам / всё. Выбор хранится в браузере покупателя */
  var GENDERS = { women: 'Женщинам', men: 'Мужчинам' }, LS_G = 'albakov:gender';
  function readGender() { try { return localStorage.getItem(LS_G); } catch (e) { return null; } }
  var genderChoice = readGender(); // null — ещё не выбирал, 'all' — смотрит всё
  function curGender() { return GENDERS[genderChoice] ? genderChoice : ''; }
  // Закрытый раздел: его товары не показываются, а вместо витрины — страница «скоро появится»
  function gClosed(g) { var x = g && (D.settings.genders || {})[g]; return !!(x && x.open === false); }
  function onSale(p) { return !(p.gender && p.gender !== 'unisex' && gClosed(p.gender)); }
  function inG(p) { return Pricing.forGender(p, curGender()) && onSale(p); }
  function gProducts() { return D.products.filter(inG); }
  function setGender(g) {
    genderChoice = GENDERS[g] ? g : 'all';
    try { localStorage.setItem(LS_G, genderChoice); } catch (e) {}
    $$('[data-gender]').forEach(function (b) { var on = b.getAttribute('data-gender') === curGender(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    var ft = $('#app > .footer'), mn = $('.mnav-sub:not(.mnav-sub-sm)');
    if (ft) { var tmp = document.createElement('div'); tmp.innerHTML = footerHtml(); ft.replaceWith(tmp.firstElementChild); bindFooter(); }
    if (mn) mn.innerHTML = sortedCats().map(function (c) { return '<a href="#/catalog?cat=' + esc(c.slug) + '">' + esc(c.name) + '</a>'; }).join('');
    routeKeepScroll = true; route();
  }
  function genderTabs(cls) {
    return '<div class="gtabs ' + cls + '" role="group" aria-label="Раздел">' + Object.keys(GENDERS).map(function (g) { var on = curGender() === g; return '<button class="gtab' + (on ? ' on' : '') + '" data-gender="' + g + '" aria-pressed="' + on + '">' + GENDERS[g] + (gClosed(g) ? '<small class="soon-tag">скоро</small>' : '') + '</button>'; }).join('') + '</div>';
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
    if (c.gender === 'women' || c.gender === 'men' || c.gender === 'unisex') return c.gender;
    var gs = D.products.filter(function (p) { return p.categoryId === c.id && p.active !== false; }).map(function (p) { return p.gender || 'unisex'; });
    if (gs.length) return gs.every(function (g) { return g === 'women'; }) ? 'women' : gs.every(function (g) { return g === 'men'; }) ? 'men' : 'unisex';
    return WOMEN_CAT.test(c.name) ? 'women' : MEN_CAT.test(c.name) ? 'men' : 'unisex';
  }
  function catInG(c) { var g = curGender(), cg = catGender(c); return !g || cg === 'unisex' || cg === g; }
  function sortedCats() { return D.categories.filter(catInG).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  var STATUS = { new: 'Новый', processing: 'Собирается', shipped: 'Передан в доставку', done: 'Выполнен', canceled: 'Отменён', returned: 'Возврат' };
  var PAY = { pending: 'Ожидает оплаты', paid: 'Оплачен', canceled: 'Оплата отменена', refunded: 'Деньги возвращены' };

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
      (s.announcement ? '<div class="topbar"><div class="wrap">' + esc(s.announcement) + '</div></div>' : '') +
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
        '<div class="drawer-body">' + genderTabs('gtabs-drawer') + '<nav class="mnav">' + navLinks() + '<a href="#/favorites">Избранное</a><a href="#/account">Личный кабинет</a></nav>' +
        '<div class="mnav-sub mnav-sub-sm"><a href="#/gift">Подарочные сертификаты</a><a href="#/track">Где мой заказ</a></div>' +
        '<div class="mnav-sub">' + sortedCats().map(function (c) { return '<a href="#/catalog?cat=' + esc(c.slug) + '">' + esc(c.name) + '</a>'; }).join('') + '</div>' +
        appMenuHtml() + socialsHtml() + '</div></aside>' +
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
  function updateFavCount() { var n = Fav.count(), b = $('#favCount'); if (!b) return; b.textContent = n; b.hidden = !n; }
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
  function navLinks() { return (D.settings.nav || []).map(function (n) { return '<a href="' + esc(safeUrl(n.link)) + '">' + esc(n.label) + '</a>'; }).join(''); }
  /* Соцсети: подпись «Социальные сети», под ней ссылки с цветными значками */
  var SOC_ICON = {
    telegram: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#2AABEE"/><path fill="#fff" d="M7.4 15.6l15.5-6c.7-.3 1.4.2 1.1 1.3l-2.6 12.4c-.2.9-.7 1.1-1.4.7l-4-2.9-1.9 1.9c-.2.2-.4.4-.8.4l.3-4.1 7.4-6.7c.3-.3-.1-.4-.5-.2l-9.1 5.8-3.9-1.2c-.9-.3-.9-.9.2-1.4z"/></svg>',
    vk: '<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#0077FF"/><path fill="#fff" d="M17 22.3c-6.6 0-10.4-4.5-10.5-12.1h3.3c.1 5.6 2.5 7.9 4.5 8.4v-8.4h3.1v4.8c1.9-.2 4-2.4 4.6-4.8h3.1c-.5 2.9-2.7 5.1-4.2 6 1.5.7 4 2.6 4.9 6.1h-3.4c-.7-2.3-2.6-4.1-5-4.3v4.3h-.4z"/></svg>',
    instagram: '<svg viewBox="0 0 32 32"><defs><radialGradient id="igG" cx="30%" cy="107%" r="150%"><stop offset="0" stop-color="#FDF497"/><stop offset=".05" stop-color="#FDF497"/><stop offset=".45" stop-color="#FD5949"/><stop offset=".6" stop-color="#D6249F"/><stop offset=".9" stop-color="#285AEB"/></radialGradient></defs><rect width="32" height="32" rx="9" fill="url(#igG)"/><rect x="8" y="8" width="16" height="16" rx="4.8" fill="none" stroke="#fff" stroke-width="1.9"/><circle cx="16" cy="16" r="3.9" fill="none" stroke="#fff" stroke-width="1.9"/><circle cx="21.1" cy="10.9" r="1.2" fill="#fff"/></svg>',
    other: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#1d1d1f"/><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" d="M14.2 17.8l3.6-3.6M13 15.4l-1.6 1.6a3 3 0 004.2 4.2l1.6-1.6M19 16.6l1.6-1.6a3 3 0 00-4.2-4.2L14.8 12.4"/></svg>'
  };
  function socialKind(x) {
    var t = (String(x.url || '') + ' ' + String(x.name || '')).toLowerCase();
    return /t\.me|telegram|телеграм/.test(t) ? 'telegram' : /vk\.com|vk\.ru|вконтакте|\bvk\b/.test(t) ? 'vk' : /instagram|инстаграм/.test(t) ? 'instagram' : 'other';
  }
  function socialsHtml() {
    var list = (D.settings.socials || []).filter(function (x) { return x.url; });
    if (!list.length) return '';
    return '<div class="socials"><h4 class="socials-title">Социальные сети</h4><ul>' + list.map(function (x) {
      return '<li><a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener"><span class="soc-ic" aria-hidden="true">' + SOC_ICON[socialKind(x)] + '</span><span>' + esc(x.name) + '</span></a></li>';
    }).join('') + '</ul></div>';
  }
  // Реквизиты продавца — в колонке «Контакты», каждая часть с новой строки
  function legalHtml(legal) {
    var parts = String(legal || '').split(/\s*[,;]\s*/).filter(Boolean);
    return parts.length ? '<div class="foot-legal"><span class="foot-legal-t">Продавец</span>' + parts.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' : '';
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
        col('Покупателям', '<li><a href="#/track">Где мой заказ</a></li>' + pages('help') + '<li><a href="#/sizes">Таблица размеров</a></li>' + pages('brand') +
          '<li data-inst="installed-hide"' + (window.Install && Install.isInstalled() ? ' hidden' : '') + '><button class="foot-btn" data-act="install">Приложение на телефон</button></li>') +
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

  /* ---------- Приложение: значок на экране «Домой» (логика — в install.js) ---------- */
  function appMenuHtml() {
    if (!window.Install) return '';
    return '<div class="mnav-app">' +
      '<button class="mnav-app-btn" data-act="install" data-inst="offer"' + (Install.canOffer() ? '' : ' hidden') + '><img src="img/icon-192.png" alt="" width="36" height="36"><span><b>Приложение ALBAKOV</b><small>Значок на экране «Домой»</small></span></button>' +
    '</div>';
  }
  function installBannerHtml() {
    if (!window.Install || !Install.isMobile) return '';
    return '<div class="wrap"><div class="inst-banner" data-inst="banner"' + (Install.showBanner() ? '' : ' hidden') + '>' +
      '<img src="img/icon-192.png" alt="" width="44" height="44">' +
      '<div class="inst-banner-text"><b>Приложение ALBAKOV</b><span>Открывается на весь экран</span></div>' +
      '<button class="inst-banner-btn" data-act="install">Установить</button>' +
      '<button class="inst-banner-x" data-act="install-hide" aria-label="Скрыть">' + ICON.close + '</button></div></div>';
  }
  function syncInstall() {
    if (!window.Install) return;
    $$('[data-inst="offer"]').forEach(function (el) { el.hidden = !Install.canOffer(); });
    $$('[data-inst="banner"]').forEach(function (el) { el.hidden = !Install.showBanner(); });
    $$('[data-inst="installed-hide"]').forEach(function (el) { el.hidden = Install.isInstalled(); });
  }
  document.addEventListener('install:change', syncInstall);

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
    return n > 0 ? '<span class="' + (cls || 'card-bonus') + '"><i class="b-ic" aria-hidden="true">Б</i>+' + bonusNum(n) + ' ' + bonusWord(n) + '</span>' : '';
  }
  function card(p) {
    var pr = priceOf(p), stock = totalStock(p), cat = catById(p.categoryId), cs = Pricing.colorsOf(p), c0 = shownColor(p);
    var img0 = (c0.images && c0.images[0]) || Art.make(c0.art), img1 = c0.images && c0.images[1];
    var preOn = p.preorder && Pricing.preorderLeft(p) > 0;
    var tags = stock === 0 ? [preOn ? '<span class="badge badge-pre">Предзаказ</span>' : '<span class="badge badge-out">Нет в наличии</span>'] : badgeHtml(p, pr);
    var sub = cs.length > 1 ? (cat ? esc(cat.name) : '') : esc([cat && cat.name, c0.name].filter(Boolean).join(' · '));
    var qa = (c0.sizes || []).filter(function (x) { return x.stock > 0; });
    var quick = qa.length ? '<span class="qa"><span class="qa-label">' + (qa.length === 1 && c0.sizes.length === 1 ? '' : 'Быстро добавить') + '</span><span class="qa-sizes">' + qa.map(function (x) { return '<span class="qa-size" role="button" data-qa="' + esc(p.id) + '|' + esc(c0.id) + '|' + esc(x.size) + '">' + (qa.length === 1 && c0.sizes.length === 1 ? 'В корзину' : esc(x.size)) + '</span>'; }).join('') + '</span></span>' : '';
    return '<a class="card" href="#/product/' + esc(p.slug) + (c0 !== cs[0] ? '?color=' + esc(c0.id) : '') + '"><div class="ph"><div class="tags">' + tags.join('') + '</div>' + favBtn(p.id) + quick +
      '<img src="' + esc(img0) + '" alt="' + esc(p.name) + '" loading="lazy">' +
      (img1 ? '<img class="alt" src="' + esc(img1) + '" alt="" loading="lazy">' : '') + '</div>' +
      '<div class="meta"><span class="name">' + esc(p.name) + '</span><span class="sub">' + sub + '</span>' +
      (cs.length > 1 ? '<span class="card-swatches" title="' + esc(cs.map(function (c) { return c.name; }).join(', ')) + '">' + cs.slice(0, 5).map(function (c) { return '<i style="' + swatchStyle(c) + '"></i>'; }).join('') + (cs.length > 5 ? '<em>+' + (cs.length - 5) + '</em>' : '') + '<span class="sr">' + cs.length + ' ' + plural(cs.length, 'цвет', 'цвета', 'цветов') + '</span></span>' : '') +
      '<span class="card-buy">' + priceHtml(pr) + '</span>' + bonusLine(pr.price) + '</div></a>';
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
  var KEEP_SCROLL = '.acc-tabs, .tabs, .adm-tabs, .adm-chips, .ost, .chips, .gtabs, [data-keep-scroll]';
  function sameScreen(href) { var u = toPath(href) || '/'; return u.split('?')[0] === location.pathname; }
  function fromOldHash() {
    if (!/^#\//.test(location.hash)) return false;
    try { history.replaceState(null, '', location.hash.slice(1)); return true; } catch (e) { return false; }
  }
  fromOldHash();
  window.ALB_NAV = { go: navTo, cur: curRoute, path: toPath };
  function parseHash() {
    var h = curRoute().replace(/^#\/?/, '');
    var qi = h.indexOf('?'), path = qi === -1 ? h : h.slice(0, qi), q = {};
    var dec = function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } };
    if (qi !== -1) h.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[dec(p[0])] = dec((p[1] || '').replace(/\+/g, ' ')); });
    return { parts: path.split('/').filter(Boolean), q: q };
  }
  /* Заголовок вкладки и адрес страницы для поисковиков — те же, что отдаёт сервер (lib/seo.js) */
  function pageMeta(name, p, q) {
    var s = D.settings, store = s.storeName || 'ALBAKOV', t = store + ' — интернет-магазин одежды из Санкт-Петербурга', canon = location.pathname;
    if (name === 'catalog') {
      var c = q.cat && D.categories.find(function (x) { return x.slug === q.cat; });
      t = c ? c.name + ' — купить в интернет-магазине ' + store : 'Каталог одежды — интернет-магазин ' + store;
      canon = c ? '/catalog?cat=' + encodeURIComponent(c.slug) : '/catalog';
    } else if (name === 'product') {
      var pr = productBySlug(p[1]);
      if (pr) t = pr.name + ' — купить за ' + fmt(priceOf(pr).price) + ' в интернет-магазине ' + store;
    } else if (name === 'page') {
      var pg = D.pages.find(function (x) { return x.slug === p[1]; });
      if (pg) t = pg.slug === 'about' ? 'О бренде ' + store + ' — одежда из Санкт-Петербурга' : pg.title + ' — ' + store;
    } else if (name === 'sale') t = 'Акции и скидки — ' + store;
    else if (name === 'sizes') t = 'Таблица размеров — ' + store;
    else if (name === 'favorites') t = 'Избранное — ' + store;
    else if (name === 'track') t = 'Где мой заказ — ' + store;
    else if (name === 'gift') t = 'Подарочный сертификат — ' + store;
    else if (name) t = store + (s.tagline ? ' — ' + s.tagline : '');
    document.title = t;
    var l = document.querySelector('link[rel="canonical"]');
    if (l && ['', 'catalog', 'product', 'page', 'sale', 'sizes'].indexOf(name) !== -1) l.href = location.origin + canon;
  }
  function route() {
    closePanels();
    if (/^#\/(checkout|admin)/.test(curRoute())) hideBonusNotice();
    var r = parseHash(), v = $('#view'), p = r.parts;
    $$('.nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === curRoute()); });
    var name = p[0] || '';
    var map = { '': home, catalog: catalog, product: product, sale: sale, sizes: sizes, cart: cartPage, checkout: checkout, account: account, order: orderPage, page: textPage, favorites: favoritesPage, track: trackPage, gift: giftPage };
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
    document.body.classList.toggle('hero-under', !!$('#view > .slider:first-child'));
    var fab = $('#fab'); if (fab) { fab.hidden = fn === adminPage || (name === 'account' && r.q.tab === 'support'); fabSet(false); }
    syncHeaderH();
    v.classList.remove('view-in'); void v.offsetWidth; v.classList.add('view-in');
    if (!routeKeepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
    routeKeepScroll = false;
  }
  var routeKeepScroll = false;
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
  /* Вход в панель управления: секретный адрес (в данных хранится только его отпечаток).
     Пока адрес не задан, работает #/admin. После входа #/admin открывается всегда. */
  function hashPath(str) {
    str = String(str || '').toLowerCase();
    var h1 = 0xdeadbeef ^ 7, h2 = 0x41c6ce57 ^ 7;
    for (var i = 0; i < str.length; i++) { var ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  function isAdminRoute(name) {
    if (!name) return false;
    if (name === 'admin' && API.isAdmin) return true;
    var h = D.settings.adminPathHash;
    return h ? hashPath(name) === h : name === 'admin';
  }
  function go(h, keep) { navTo(h, false, keep); }


  /* ---------- Слайдер на первом экране ---------- */
  function slidePromo(sl) { return sl.promotionId ? (D.promotions || []).find(function (p) { return p.id === sl.promotionId; }) : null; }
  function slideVisible(sl, g) {
    if (!sl.active) return false;
    if (!Pricing.inWindow({ active: true, startsAt: sl.startsAt, endsAt: sl.endsAt }, Date.now())) return false;
    if (sl.promotionId) { var pr = slidePromo(sl); if (!pr || !Pricing.inWindow(pr, Date.now())) return false; }
    if (sl.gender && g && sl.gender !== g) return false;
    return true;
  }
  function visibleSlides() { var c = D.settings.slider || {}; return c.enabled === false ? [] : (c.slides || []).filter(function (sl) { return slideVisible(sl, curGender()); }); }
  function slideHtml(sl, i, total, active) {
    var pr = slidePromo(sl);
    var eyebrow = (sl.eyebrow || '') + (pr && pr.endsAt ? (sl.eyebrow ? ' · ' : '') + 'до ' + fmtDate(pr.endsAt) : '');
    var badge = sl.badge || (pr ? (pr.type === 'percent' ? '−' + pr.value + '%' : '−' + fmt(pr.value)) : '');
    var title = esc(sl.title || '').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/^([−–-]\s?\d[\d\s]*(?:%|₽)?)/, '<span class="st-off">$1</span>');
    var btn = function (b, cls, arrow) { return b && b.label ? '<a class="sbtn ' + cls + '" href="' + esc(safeUrl(b.link || '#/catalog')) + '"><span>' + esc(b.label) + '</span>' + (cls === 'sbtn-primary' ? '<span class="sbtn-ic" aria-hidden="true">' + ARROW + '</span>' : arrow ? '<span class="sbtn-arrow" aria-hidden="true"></span>' : '') + '</a>' : ''; };
    return '<article class="slide layout-' + (sl.layout === 'full' ? 'full' : 'split') + (active ? ' is-active' : '') + '" aria-roledescription="слайд" aria-label="' + (i + 1) + ' из ' + total + '"' + (active ? '' : ' aria-hidden="true"') + '>' +
      '<div class="slide-media"><img src="' + esc(sl.image || Art.make({ kind: 'coat', tone: '#3d3d40' })) + '" alt=""' + (i ? ' loading="lazy"' : '') + '></div>' +
      '<div class="slide-body">' +
        (eyebrow ? '<span class="eyebrow slide-eb"><i></i>' + esc(eyebrow) + '</span>' : '') +
        (badge ? '<span class="slide-badge">' + esc(badge) + '</span>' : '') +
        '<' + (i === 0 ? 'h1' : 'h2') + ' class="slide-title">' + title + '</' + (i === 0 ? 'h1' : 'h2') + '>' +
        (sl.text ? '<p class="slide-text">' + esc(sl.text) + '</p>' : '') +
        (sl.code ? '<button class="slide-code" data-copy="' + esc(sl.code) + '" title="Скопировать промокод"><span>Промокод</span><b>' + esc(sl.code) + '</b><i>Скопировать</i><svg class="sc-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button>' : '') +
        ((sl.btn1 && sl.btn1.label) || (sl.btn2 && sl.btn2.label) ? '<div class="slide-actions">' + btn(sl.btn1, 'sbtn-primary', true) + btn(sl.btn2, 'sbtn-line', true) + '</div>' : '') +
      '</div></article>';
  }
  function sliderHtml(list) {
    var c = D.settings.slider || {}, n = list.length;
    return '<section class="slider" id="slider" aria-roledescription="карусель" aria-label="Главное" style="--dur:' + Math.max(3, Number(c.interval) || 7) + 's">' +
      '<div class="sl-track">' + list.map(function (sl, i) { return slideHtml(sl, i, n, i === 0); }).join('') + '</div>' +
      (n > 1 ? '<div class="slider-ui">' +
        '<div class="sl-dots">' + list.map(function (sl, i) { return '<button class="sl-dot' + (i === 0 ? ' on' : '') + '" data-sl="' + i + '" aria-label="Слайд ' + (i + 1) + '"><b>' + (i + 1) + '</b><i></i></button>'; }).join('') + '</div>' +
        '<div class="sl-arrows"><button class="sl-arrow" data-sl-step="-1" aria-label="Предыдущий слайд"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><button class="sl-arrow" data-sl-step="1" aria-label="Следующий слайд"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div></div>' : '') +
      '</section>';
  }
  function initSlider() {
    var el = $('#slider'); if (!el) return;
    var slides = $$('.slide', el), dots = $$('.sl-dot', el), n = slides.length, idx = 0;
    var c = D.settings.slider || {};
    var auto = c.autoplay !== false && n > 1;
    el.classList.toggle('autoplay', auto);
    function show(i) {
      idx = (i + n) % n;
      slides.forEach(function (s, k) {
        var on = k === idx; s.classList.toggle('is-active', on);
        if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
        $$('a,button', s).forEach(function (a) { a.tabIndex = on ? 0 : -1; });
      });
      dots.forEach(function (d, k) { d.classList.remove('on'); if (k === idx) { void d.offsetWidth; d.classList.add('on'); } });
      var num = $('#slNum'); if (num) num.textContent = idx + 1;
    }
    show(0);
    el.addEventListener('click', function (e) {
      var d = e.target.closest('[data-sl]'); if (d) { show(+d.getAttribute('data-sl')); return; }
      var a = e.target.closest('[data-sl-step]'); if (a) { show(idx + +a.getAttribute('data-sl-step')); return; }
      var cp = e.target.closest('[data-copy]'); if (cp) {
        var code = cp.getAttribute('data-copy');
        var ok = async function () {
          cp.classList.add('copied'); $('i', cp).textContent = 'Скопировано';
          setTimeout(function () { cp.classList.remove('copied'); $('i', cp).textContent = 'Скопировать'; }, 2400);
          var r = null; try { r = (await API.quote([], code)).promo; } catch (ex) {}
          if (r && (r.reason === 'used' || r.reason === 'first')) toast(r.message, true);
          else if (r && r.reason === 'login') toast('Промокод ' + code + ' скопирован. Скидка действует после входа в личный кабинет.');
          else toast('Промокод ' + code + ' скопирован — вставьте его при оформлении заказа');
        };
        try { navigator.clipboard.writeText(code).then(ok, function () { toast('Промокод: ' + code); }); } catch (ex) { toast('Промокод: ' + code); }
      }
    });
    if (auto) el.addEventListener('animationend', function (e) { if (e.target.parentNode && e.target.parentNode.classList.contains('on')) show(idx + 1); });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--px', ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
      el.style.setProperty('--py', ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
    });
    el.addEventListener('mouseleave', function () { el.style.setProperty('--px', 0); el.style.setProperty('--py', 0); });
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
    html += installBannerHtml();
    if (h.showCategories !== false && D.categories.length) {
      html += '<section class="section"><div class="wrap"><div class="section-head"><h2>Категории</h2><a class="link sh-more" href="#/catalog"><span>Весь каталог</span><i aria-hidden="true">' + ARROW + '</i></a></div><div class="cats">' +
        sortedCats().filter(function (c) { return gProducts().some(function (p) { return p.categoryId === c.id; }); }).map(function (c) { return '<a class="cat" href="#/catalog?cat=' + esc(c.slug) + '"><span class="cat-ph"><img src="' + esc(c.image || Art.make(c.art)) + '" alt="" loading="lazy"></span><span class="cat-cap"><span class="cat-name">' + esc(c.name) + '</span><svg class="cat-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M14 7l5 5-5 5"/></svg></span></a>'; }).join('') + '</div></div></section>';
    }
    if (h.showNew !== false) {
      var news = gProducts().filter(function (p) { return (p.tags || []).indexOf('new') !== -1; });
      // если новинок мало — дополняем последними поступлениями раздела, чтобы ряд не выглядел пустым
      if (news.length < 4) news = news.concat(gProducts().filter(function (p) { return news.indexOf(p) === -1; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })).slice(0, 4);
      news = news.slice(0, 8);
      if (news.length) html += '<section class="section"><div class="wrap"><div class="section-head"><h2>Новинки' + (curGender() ? ' <em class="h-sub">' + GENDERS[curGender()].toLowerCase() + '</em>' : '') + '</h2><a class="link sh-more" href="#/catalog?tag=new"><span>Смотреть все</span><i aria-hidden="true">' + ARROW + '</i></a></div><div class="grid">' + news.map(card).join('') + '</div></div></section>';
    }
    if (h.showHits !== false) {
      var hits = hitList(gProducts()).slice(0, 8);
      // на телефоне — лента, которую листают пальцем; на компьютере — сетка
      if (hits.length) html += '<section class="section hits-sec"><div class="wrap"><div class="section-head"><h2>Хиты продаж' + (curGender() ? ' <em class="h-sub">' + GENDERS[curGender()].toLowerCase() + '</em>' : '') + '</h2><a class="link sh-more" href="#/catalog?tag=hit"><span>Смотреть все</span><i aria-hidden="true">' + ARROW + '</i></a></div><div class="grid hits">' + hits.map(card).join('') + '</div></div></section>';
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
      var k = 'vanta:st:' + e, day = statDay(); if (localStorage.getItem(k) === day) return; localStorage.setItem(k, day);
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
        (ic ? '<div class="benefit-ico"><img src="img/benefits/' + ic + '.webp?v=13.32.1" alt="" width="160" height="160" loading="lazy" decoding="async"></div>' : '') +
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
      ['Оплачивайте', 'Тратьте на следующие покупки, хоть все сразу']
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

  /* Акция на главной: тёмная полоса, крупная скидка, обратный отсчёт и товары, на которые она действует */
  function dealBand(ap) {
    var pct = ap.type === 'percent';
    var off = pct ? '<span class="do-sign">−</span>' + ap.value + '<span class="do-pct">%</span>' : '−' + fmt(ap.value);
    var items = gProducts().filter(function (p) { return p.active !== false && totalStock(p) > 0; }).map(function (p) { return { p: p, pr: priceOf(p) }; })
      .filter(function (x) { return x.pr.oldPrice && x.pr.promotion && x.pr.promotion.id === ap.id; }).slice(0, 3);
    if (!items.length) items = gProducts().filter(function (p) { return p.active !== false; }).map(function (p) { return { p: p, pr: priceOf(p) }; }).filter(function (x) { return x.pr.oldPrice; }).slice(0, 3);
    var ends = ap.endsAt ? new Date(ap.endsAt + 'T23:59:59').getTime() : 0;
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
    return '<section class="section deal-sec"><div class="wrap"><div class="deal' + (tiles ? ' n' + items.length : ' no-items') + '">' +
      '<span class="deal-glow" aria-hidden="true"></span><span class="deal-grain" aria-hidden="true"></span>' +
      '<div class="deal-copy">' +
        '<span class="deal-when"><i></i>Акция' + (ap.endsAt ? ' до ' + esc(fmtDate(ap.endsAt).replace(/ \d{4} г\.$/, '')) : '') + '</span>' +
        '<div class="deal-off' + (pct ? '' : ' is-money') + '" aria-hidden="true">' + off + '</div>' +
        '<h2>' + esc(ap.title) + '</h2>' +
        (ap.description ? '<p>' + esc(ap.description) + '</p>' : '') +
        timer +
        '<a class="btn deal-btn" href="#/sale"><span>Смотреть товары со скидкой</span><span class="db-ic" aria-hidden="true">' + ARROW + '</span></a>' +
      '</div>' +
      (tiles ? '<div class="deal-items">' + tiles + '</div>' : '') +
    '</div></div></section>';
  }
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
  function initHomeBlocks(v) {
    // следим за секцией целиком: обрезанный (ещё невидимый) элемент наблюдатель не замечает
    var secs = $$('[data-reveal]', v).map(function (el) { return el.closest('section'); }).filter(function (s, i, a) { return s && a.indexOf(s) === i; });
    if ('IntersectionObserver' in window && secs.length) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { $$('[data-reveal]', e.target).forEach(function (el) { el.classList.add('in'); }); io.unobserve(e.target); } });
      }, { threshold: .2 });
      secs.forEach(function (s) { $$('[data-reveal]', s).forEach(function (el) { el.classList.add('rv-pre'); }); io.observe(s); });
    }
    clearInterval(dealTick);
    var t = $('.deal-timer', v);
    if (t) {
      var end = Number(t.getAttribute('data-ends'));
      var forms = { d: ['день', 'дня', 'дней'], h: ['час', 'часа', 'часов'], m: ['минута', 'минуты', 'минут'], s: ['секунда', 'секунды', 'секунд'] };
      var tick = function () {
        if (!document.body.contains(t)) { clearInterval(dealTick); return; }
        var left = Math.max(0, Math.floor((end - Date.now()) / 1000));
        var vals = { d: Math.floor(left / 86400), h: Math.floor(left % 86400 / 3600), m: Math.floor(left % 3600 / 60), s: left % 60 };
        Object.keys(vals).forEach(function (k) {
          $('[data-u="' + k + '"]', t).textContent = (vals[k] < 10 ? '0' : '') + vals[k];
          $('[data-l="' + k + '"]', t).textContent = plural(vals[k], forms[k][0], forms[k][1], forms[k][2]);
        });
        // Когда остались часы, ячейка «дней» с нулём не нужна
        t.classList.toggle('no-d', vals.d === 0);
      };
      tick(); dealTick = setInterval(tick, 1000);
    }
    bindCardTilt($('.loyal-card', v));
  }

  /* ---------- Раздел закрыт: «скоро появится» ---------- */
  function soonPage(v) {
    var g = curGender(), cfg = (D.settings.genders || {})[g] || {}, other = g === 'women' ? 'men' : 'women';
    var gw = (D.settings.gateway || {})[g] || {};
    var img = gw.image || Art.make(g === 'women' ? { kind: 'dress', tone: '#4a4a4e' } : { kind: 'coat', tone: '#2e2e31' });
    var title = esc(cfg.title || (GENDERS[g] + ' — скоро')).replace(/\*(.+?)\*/g, '<em>$1</em>');
    v.innerHTML = '<section class="soon"><div class="soon-media"><img src="' + esc(img) + '" alt=""></div><div class="soon-in">' +
      '<span class="eyebrow">' + esc(GENDERS[g]) + '</span><h1 class="soon-title">' + title + '</h1>' + (cfg.text ? '<p class="soon-text">' + esc(cfg.text) + '</p>' : '') +
      '<div class="slide-actions">' + (!gClosed(other) ? '<button class="sbtn sbtn-primary" data-gender-go="' + other + '">Смотреть «' + GENDERS[other] + '»<span class="sbtn-arrow" aria-hidden="true"></span></button>' : '') +
      '<button class="sbtn sbtn-line" data-gender-go="all">Вся коллекция<span class="sbtn-arrow" aria-hidden="true"></span></button></div></div></section>';
  }

  /* ---------- Каталог ---------- */
  var SORTS = { popular: 'По умолчанию', new: 'Сначала новые', cheap: 'Сначала дешевле', expensive: 'Сначала дороже' };
  function catalog(v, parts, q) {
    var st = { cat: q.cat || '', tag: q.tag || '', sizes: q.size ? q.size.split(',') : [], colors: q.color ? q.color.split(',') : [], min: q.min || '', max: q.max || '', sale: q.sale === '1', sort: q.sort || 'popular', q: q.q || '' };
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
      return '<div><h4>Раздел</h4><div class="fl-list">' +
          flItem('data-gsel="all"', 'Вся коллекция', gCount(''), !curGender()) +
          Object.keys(GENDERS).map(function (g) { return flItem('data-gsel="' + g + '"', GENDERS[g], gClosed(g) ? 'скоро' : gCount(g), curGender() === g); }).join('') + '</div></div>' +
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
        if (st.q) { var t = (p.name + ' ' + (p.description || '') + ' ' + colorNames(p) + ' ' + (c ? c.name : '')).toLowerCase(); if (t.indexOf(st.q.toLowerCase()) === -1) return false; }
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
    var chart = D.sizeCharts.find(function (c) { return c.id === p.sizeChartId; });
    // Цвет: из адреса, иначе первый, где что-то есть в наличии
    var col = colors.find(function (c) { return c.id === q.color; }) || colors.find(function (c) { return Pricing.stockOf(c) > 0; }) || colors[0];
    var sel = null, qty = 1;
    var pre = p.preorder && Pricing.preorderLeft(p) > 0, preLeft = Pricing.preorderLeft(p);
    function preDate() { return p.preorderShip ? fmtDate(p.preorderShip).replace(/ \d{4} г\.$/, '') : ''; }
    var related = gProducts().filter(function (x) { return x.id !== p.id && x.categoryId === p.categoryId; }).concat(gProducts().filter(function (x) { return x.id !== p.id && x.categoryId !== p.categoryId; })).slice(0, 4);
    var delivPage = D.pages.find(function (x) { return x.slug === 'delivery'; });

    v.innerHTML = '<div class="wrap"><div class="page-head" style="padding-bottom:20px"><div class="crumbs"><a href="#/">Главная</a><span>/</span><a href="#/catalog">Каталог</a>' + (cat ? '<span>/</span><a href="#/catalog?cat=' + esc(cat.slug) + '">' + esc(cat.name) + '</a>' : '') + '</div></div>' +
      '<div class="product"><div id="galleryBox"></div>' +
      '<div class="pinfo"><div style="display:grid;gap:14px">' + (function () { var b = badgeHtml(p, pr); return b.length ? '<div class="badges-row">' + b.join('') + '</div>' : ''; })() + '<h1>' + esc(p.name) + '</h1>' + specsSummaryHtml(p) + priceHtml(pr) +
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
      '<div><div class="opt-head"><span>Размер</span>' + (chart || fitCanCompare(p) ? '<button class="link" style="font-size:14px" id="openChart">' + (chart ? 'Таблица размеров' : 'Мерки изделия') + '</button>' : '') + '</div>' +
        '<div class="chips" id="sizeChips"></div><p class="stock-note" id="stockNote" style="margin-top:10px"></p>' + fitToolsHtml(p) + '</div>' +
      '<div class="sticky-buy"><div class="buy-row"><div class="qty"><button data-q="-1" aria-label="Меньше">−</button><span id="qty">1</span><button data-q="1" aria-label="Больше">+</button></div><button class="btn" id="addBtn">Добавить в корзину</button></div></div>' +
      '<div class="buy-more"><button type="button" class="btn ghost buy-now" id="buyNow"><span>Купить сейчас</span><span class="bn-ic" aria-hidden="true">' + ARROW + '</span></button>' +
        '<button type="button" class="fav-btn fav-wide' + (Fav.has(p.id) ? ' on' : '') + '" data-fav="' + esc(p.id) + '" aria-pressed="' + Fav.has(p.id) + '" aria-label="' + (Fav.has(p.id) ? 'Убрать из избранного' : 'В избранное') + '">' + ICON.heart + '<span class="fav-t">' + (Fav.has(p.id) ? 'В избранном' : 'В избранное') + '</span></button></div>' +
      fitGuaranteeHtml() +
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
        return '<button class="chip' + (out ? ' out' : '') + (sel === s.size ? ' on' : '') + '" data-size="' + esc(s.size) + '"' +
          (out ? (notifyOn ? ' title="Нет в наличии — можно подписаться на поступление" aria-label="' + esc(s.size) + ' — нет в наличии"' : ' disabled title="Нет в наличии" aria-label="' + esc(s.size) + ' — нет в наличии"') : '') + '>' + esc(s.size) + '</button>';
      }).join('');
      note();
    }
    // Кнопка: «Добавить в корзину» или «Сообщить о поступлении», если выбранного размера или всего цвета нет
    function waitMode() { if (pre) return false; var s = sizeOf(), anyAvail = (col.sizes || []).some(function (x) { return x.stock > 0; }); return notifyOn && ((s && s.stock <= 0) || !anyAvail); }
    function preMode() { var s = sizeOf(), anyAvail = (col.sizes || []).some(function (x) { return x.stock > 0; }); return pre && ((s && s.stock <= 0) || (!s && !anyAvail)); }
    function updateBtn() {
      var btn = $('#addBtn'), anyAvail = (col.sizes || []).some(function (x) { return x.stock > 0; }), wait = waitMode();
      btn.disabled = !anyAvail && !notifyOn && !pre;
      btn.classList.toggle('ghost', wait);
      btn.textContent = wait ? 'Сообщить о поступлении' : preMode() ? 'Оформить предзаказ' : anyAvail ? 'Добавить в корзину' : 'Нет в наличии в этом цвете';
      $('.buy-row .qty').hidden = wait;
      $('#buyNow').hidden = wait || (!anyAvail && !pre);
    }
    function note() {
      var n = $('#stockNote'), s = sizeOf(), anyAvail = (col.sizes || []).some(function (x) { return x.stock > 0; });
      n.className = 'stock-note'; updateBtn();
      if (pre && s && s.stock <= 0) { n.textContent = 'Предзаказ' + (preDate() ? ' · отправим ' + preDate() : '') + (preLeft !== Infinity ? ' · осталось ' + preLeft + ' ' + plural(preLeft, 'место', 'места', 'мест') : ''); n.classList.add('pre'); if (preLeft !== Infinity && qty > preLeft) { qty = preLeft; $('#qty').textContent = qty; } return; }
      if (pre && !s) { n.textContent = 'Выберите размер'; return; }
      if (!anyAvail && (!s || s.stock <= 0)) { n.textContent = notifyOn ? 'Этого цвета сейчас нет. Оставьте почту — напишем, когда он появится.' : (colors.length > 1 ? 'Посмотрите другие цвета' : ''); return; }
      if (!s) { n.textContent = 'Выберите размер'; return; }
      if (s.stock <= 0) { n.textContent = 'Размера ' + s.size + ' сейчас нет. Можем сообщить на почту, когда он появится.'; n.classList.add('low'); return; }
      if (s.stock <= 2) { n.textContent = 'Осталось ' + s.stock + ' шт.'; n.classList.add('low'); } else n.textContent = 'В наличии';
      if (qty > s.stock) { qty = s.stock; $('#qty').textContent = qty; }
    }
    drawGallery(); drawOptions();
    $('#colorChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-color]'); if (!b) return;
      var next = colors.find(function (c) { return c.id === b.getAttribute('data-color'); }); if (!next || next === col) return;
      col = next; qty = 1; $('#qty').textContent = 1; drawGallery(); drawOptions();
      try { history.replaceState(null, '', '/product/' + p.slug + '?color=' + encodeURIComponent(col.id)); } catch (ex) {}
    });
    $('#sizeChips').addEventListener('click', function (e) { var b = e.target.closest('[data-size]'); if (!b || b.disabled) return; sel = b.getAttribute('data-size'); $$('#sizeChips .chip').forEach(function (c) { c.classList.toggle('on', c === b); }); note(); });
    $$('[data-q]').forEach(function (b) { b.addEventListener('click', function () { var s = sizeOf(); var max = s ? (s.stock > 0 ? s.stock : pre ? (preLeft === Infinity ? 99 : preLeft) : 0) : 99; qty = Math.max(1, Math.min(max, qty + Number(b.getAttribute('data-q')))); $('#qty').textContent = qty; }); });
    $('#addBtn').addEventListener('click', function () {
      if (waitMode()) { openNotify(p, col, sel); return; }
      if (!sel) { var n = $('#stockNote'); n.textContent = 'Сначала выберите размер'; n.className = 'stock-note low'; var sc0 = $('#sizeChips'); if (sc0) { sc0.classList.remove('shake'); void sc0.offsetWidth; sc0.classList.add('shake'); } return; }
      var s = sizeOf(), inCart = (Cart.find(p.id, col.id, sel) || { qty: 0 }).qty;
      if (pre && s.stock <= 0) { if (preLeft !== Infinity && inCart + qty > preLeft) { toast('По предзаказу осталось ' + preLeft + ' ' + plural(preLeft, 'место', 'места', 'мест'), true); return; } }
      else if (inCart + qty > s.stock) { toast('В наличии только ' + s.stock + ' шт. этого размера в цвете «' + col.name + '»', true); return; }
      Cart.add(p.id, col.id, sel, qty);
      var ab = $('#addBtn'); ab.classList.add('done'); ab.textContent = 'Добавлено';
      setTimeout(function () { if (document.body.contains(ab)) { ab.classList.remove('done'); ab.textContent = 'Добавить в корзину'; } }, 1600);
      openCart();
    });
    // «Купить сейчас»: оформляем только этот товар, корзину не трогаем
    $('#buyNow').addEventListener('click', function () {
      if (!sel) { var n = $('#stockNote'); n.textContent = 'Сначала выберите размер'; n.className = 'stock-note low'; var sc = $('#sizeChips'); if (sc) { sc.classList.remove('shake'); void sc.offsetWidth; sc.classList.add('shake'); } return; }
      var s = sizeOf(); if (!s || (s.stock <= 0 && !pre)) { toast('Этого размера сейчас нет', true); return; }
      if (s.stock > 0 && qty > s.stock) { toast('В наличии только ' + s.stock + ' шт.', true); return; }
      BuyNow.start(p.id, col.id, sel, qty);
      go('#/checkout?buy=1');
    });
    var oc = $('#openChart'); if (oc) oc.addEventListener('click', function () {
      openModal(fitMeasuresHtml(p) + (chart ? '<h3 class="serif" style="font-size:34px;margin-bottom:6px">Таблица размеров</h3><p class="muted" style="margin-bottom:22px">' + esc(chart.name) + '</p>' + chartTable(chart) + (chart.note ? '<p class="muted" style="margin-top:16px;font-size:14px">' + esc(chart.note) + '</p>' : '') + measureHtml() : ''));
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
  function fitRangeRows(p) { return fitRows(p).filter(function (r) { return r.hMin > 0 && r.hMax >= r.hMin && r.kMin > 0 && r.kMax >= r.kMin; }); }
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
    var a = fitCanPick(p), b = fitCanCompare(p);
    if (a || b) out += '<div class="fit-tools">' + (a ? '<button type="button" class="btn ghost fit-find" id="fitFind"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="8" width="20" height="8"></rect><path d="M6 8v3M10 8v4M14 8v3M18 8v4"></path></svg>Подобрать размер</button>' : '') +
      (b ? '<button type="button" class="link fit-cmp" id="fitCompare">Сравнить со своей футболкой</button>' : '') + '</div>';
    return out;
  }
  function exchangeCfg() { var e = (D.settings && D.settings.exchange) || {}; return { enabled: e.enabled !== false, days: Math.max(1, Math.round(Number(e.days) || 14)), free: e.free !== false }; }
  var EXCH_IC = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"></path><path d="M18 3v4h-4M6 21v-4h4"></path></svg>';
  function fitGuaranteeHtml() {
    var c = exchangeCfg(); if (!c.enabled) return '';
    return '<div class="fit-guar">' + EXCH_IC + '<div><b>' + (c.free ? 'Не подошёл размер — обменяем бесплатно' : 'Не подошёл размер — обменяем') + '</b><span>В течение ' + c.days + ' ' + plural(c.days, 'дня', 'дней', 'дней') + ' после получения — в пару нажатий в личном кабинете. Новый размер отправим, как только вещь вернётся к нам' + (c.free ? ', доставка в обе стороны за наш счёт' : '') + '.</span></div></div>';
  }
  function cm(v) { return v > 0 ? String(v).replace('.', ',') + ' см' : '—'; }
  function fitMeasuresHtml(p) {
    var rows = fitRows(p).filter(function (r) { return r.w > 0 || r.l > 0 || r.sl > 0; }); if (!rows.length) return '';
    var hasSl = rows.some(function (r) { return r.sl > 0; }), hasH = rows.some(function (r) { return r.hMin > 0; });
    return '<h3 class="serif" style="font-size:34px;margin-bottom:6px">Мерки изделия</h3><p class="muted" style="margin-bottom:22px">Футболку разложили на столе и измерили. Ширина — от шва до шва под рукавами, длина — от верхней точки плеча до низа.</p>' +
      '<div class="table-wrap" style="margin-bottom:36px"><table class="sizes"><thead><tr><th>Размер</th><th>Ширина</th><th>Длина</th>' + (hasSl ? '<th>Рукав</th>' : '') + (hasH ? '<th>Рост</th><th>Вес</th>' : '') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + esc(r.size) + '</td><td>' + cm(r.w) + '</td><td>' + cm(r.l) + '</td>' + (hasSl ? '<td>' + cm(r.sl) + '</td>' : '') + (hasH ? '<td>' + (r.hMin ? r.hMin + '–' + r.hMax : '—') + '</td><td>' + (r.kMin ? r.kMin + '–' + r.kMax + ' кг' : '—') + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div>';
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
        (tip ? '<p class="fit-tip">' + tip + '</p>' : '') + fitStockNote(col, r.size);
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
    $('#fitOk').addEventListener('click', function () { if (res) { closePanels(); onPick(res.row.size); } });
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
  function chartTable(c) {
    return '<div class="table-wrap"><table class="sizes"><thead><tr>' + (c.columns || []).map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (c.rows || []).map(function (r) { return '<tr>' + (c.columns || []).map(function (x, i) { return '<td>' + esc(r[i] || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
      ((c.columns || []).length > 3 ? '<p class="tw-hint" aria-hidden="true">Таблица листается вбок →</p>' : '');
  }
  function measureHtml() {
    return '<div class="how-measure"><div><b>Обхват груди</b>По самым выступающим точкам, лента горизонтально под мышками.</div><div><b>Обхват талии</b>По самой узкой части туловища, не затягивая ленту.</div><div><b>Обхват бёдер</b>По самым выступающим точкам ягодиц.</div></div>';
  }

  /* ---------- Акции ---------- */
  function sale(v) {
    var promos = activePromos();
    var items = gProducts().filter(function (p) { return priceOf(p).onSale; });
    v.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Специальные предложения</span><h1>Акции</h1></div>' +
      (promos.length ? '<div style="display:grid;gap:12px;margin-bottom:56px">' + promos.map(function (a) {
        var scope = a.scope === 'all' ? 'На весь каталог' : a.scope === 'categories' ? 'Категории: ' + (a.categoryIds || []).map(function (id) { var c = catById(id); return c ? c.name : ''; }).filter(Boolean).join(', ') : 'На отдельные товары';
        return '<div class="promo-band"><div><span class="eyebrow">' + esc(scope) + (a.endsAt ? ' · до ' + esc(fmtDate(a.endsAt)) : '') + '</span><h3 style="margin-top:12px">' + esc(a.title) + '</h3><p>' + esc(a.description || '') + '</p></div><div class="pct">' + (a.type === 'percent' ? '−' + a.value + '%' : '−' + fmt(a.value)) + '</div></div>';
      }).join('') + '</div>' : '<p class="muted" style="margin-bottom:40px">Сейчас нет активных акций. Подпишитесь на наши соцсети, чтобы не пропустить следующую.</p>') +
      (items.length ? '<div class="section-head"><h2>Товары со скидкой</h2></div><div class="grid" style="padding-bottom:96px">' + items.map(card).join('') + '</div>' : '<div style="padding-bottom:96px"></div>') + '</div>';
  }

  /* ---------- Размеры ---------- */
  function sizes(v, parts, q) {
    var charts = D.sizeCharts, cur = charts.find(function (c) { return c.id === q.id; }) || charts[0];
    v.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Как выбрать размер</span><h1>Таблица размеров</h1></div><div style="padding-bottom:96px;max-width:980px">' +
      (charts.length ? '<div class="tabs" style="margin-bottom:28px;overflow-x:auto">' + charts.map(function (c) { return '<button data-id="' + esc(c.id) + '"' + (c === cur ? ' class="on"' : '') + '>' + esc(c.name) + '</button>'; }).join('') + '</div><div id="chartBox"></div>' + measureHtml() : '<p class="muted">Таблицы размеров пока не добавлены.</p>') + '</div></div>';
    function draw() { $('#chartBox').innerHTML = chartTable(cur) + (cur.note ? '<p class="muted" style="margin-top:16px;font-size:14px">' + esc(cur.note) + '</p>' : ''); }
    if (cur) { draw(); $$('.tabs button').forEach(function (b) { b.addEventListener('click', function () { cur = charts.find(function (c) { return c.id === b.getAttribute('data-id'); }); $$('.tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }); }); }
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
    return q;
  }
  function earnRow(q) { return q.bonusEarn > 0 ? '<div class="sum-row bonus-earn"><span><i class="b-ic" aria-hidden="true">Б</i>' + (API.user ? 'Начислим за заказ' : 'Бонусы за заказ') + (q.bonusOnline > 0 ? ' <small class="muted">· из них +' + bonusNum(q.bonusOnline) + ' за онлайн-оплату</small>' : '') + '</span><span>+' + bonusNum(q.bonusEarn) + ' ' + bonusWord(q.bonusEarn) + '</span></div>' : ''; }
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
    body.innerHTML = bracketHint(q) + q.lines.map(lineHtml).join('');
    foot.innerHTML = (q.saleDiscount ? '<div class="sum-row disc"><span>Скидка</span><span>−' + fmt(q.saleDiscount) + '</span></div>' : '') +
      '<div class="sum-row total"><span>Итого</span><span>' + fmt(q.subtotal) + '</span></div>' + earnRow(q) + '<p class="muted" style="font-size:13px">' + (API.user && API.user.bonus && q.bonus.enabled ? 'Доставка, промокод и оплата бонусами — на следующем шаге' : 'Доставка и промокод — на следующем шаге') + '</p>' +
      '<a class="btn block" href="#/checkout">Оформить заказ</a><a class="btn ghost block" href="#/cart">Перейти в корзину</a>' + remindHtml();
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
      $('#cpLines').innerHTML = bracketHint(q) + q.lines.map(lineHtml).join('');
      $('#cpSum').innerHTML = '<div class="sum-row"><span>' + q.count + ' ' + plural(q.count, 'товар', 'товара', 'товаров') + '</span><span>' + fmt(q.baseTotal) + '</span></div>' +
        (q.saleDiscount ? '<div class="sum-row disc"><span>Скидка по акциям</span><span>−' + fmt(q.saleDiscount) + '</span></div>' : '') +
        '<div class="sum-row total"><span>Итого</span><span>' + fmt(q.subtotal) + '</span></div>' + earnRow(q) +
        (API.user && API.user.bonus && q.bonus.enabled ? '<p class="muted" style="font-size:13px">На бонусном счёте ' + bonusNum(API.user.bonus) + ' ' + bonusWord(API.user.bonus) + ' — спишете при оформлении</p>' : '') + '<a class="btn block" href="#/checkout">Оформить заказ</a>' + remindHtml();
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
  function optIc(n) { return '<span class="opt-ic"><img src="img/benefits/' + n + '.webp?v=13.32.1" alt="" width="48" height="48" decoding="async"></span>'; }
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
      $('#coSum').innerHTML = '<div class="mini-lines co-lines">' + q.lines.map(function (l) {
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
      err.textContent = '';
      var btn = $('#coSubmit'); btn.disabled = true; btn.textContent = st.payment === 'online' && !st.free ? 'Переходим к оплате…' : 'Оформляем…';
      try {
        if (!st.idem) st.idem = Array.from(crypto.getRandomValues(new Uint8Array(16)), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
        var r = await API.placeOrder({ gift: st.gift && st.q && st.q.gift && st.q.gift.ok ? st.gift : '', idem: st.idem, lines: coSrc().get(), code: st.code, deliveryId: st.deliveryId, payment: st.payment, useBonus: st.useBonus, customer: f, city: needAddr ? $('#co-city').value.trim() : '', address: needAddr ? $('#co-addr').value.trim() : doorMode() ? (st.addr || '').trim() : '', pvz: pvzMode() && st.pvz ? st.pvz.code : '', cityCode: cdekMode() && st.city ? st.city.code : '', pvzType: st.pvz ? st.pvz.type : '', comment: $('#co-comment').value.trim(), consent: true });
        if (window.Metrika && !r.repeated) { Metrika.ec('purchase', r.order.items.map(function (i) { var pp = D.products.find(function (x) { return x.id === i.productId; }); return pp ? ecItem(pp, i.color, i.size, i.qty, i.price) : { id: i.productId, name: i.name, price: i.price, quantity: i.qty }; }), { id: r.order.number, revenue: r.order.total }); Metrika.goal('order', { order_price: r.order.total, currency: 'RUB' }); }
        if (buy) BuyNow.clear(); else Cart.clear();
        if (r.payUrl) { location.href = r.payUrl; return; }
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
    try {
      var o = await API.getOrder(parts[1]);
      var payLabel = o.payment.method === 'exchange' ? 'Обмен по заказу № ' + (o.exchangeOf ? o.exchangeOf.number : '') : o.payment.method === 'gift' ? 'Оплачен подарочным сертификатом' : o.payment.method === 'bonus' ? 'Оплачен бонусами' : o.payment.method === 'online' ? PAY[o.payment.status] : 'Оплата при получении';
      v.innerHTML = '<div class="wrap"><div class="success"><span class="eyebrow">Заказ № ' + esc(o.number) + '</span><h1>' + (o.status === 'returned' ? 'Возврат оформлен' : 'Спасибо за заказ') + '</h1>' +
        '<p class="muted" style="max-width:46ch">' + (D.mailReady ? 'Подтверждение придёт на ' + esc(o.customer.email) + (o.payment.method === 'online' && o.payment.status !== 'paid' ? ' после оплаты' : '') + '. ' : '') + orderNext(o) + '</p>' +
        '<div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center"><span class="status ' + esc(o.status) + '">' + esc(STATUS[o.status] || o.status) + '</span><span class="status ' + esc(o.payment.status) + '">' + esc(payLabel) + '</span></div>' +
        trackHtml(o) + returnsHtml(o) + (API.user || o.requestState ? requestsHtml(o) : '') +
        '<div class="order-card" style="width:100%;text-align:left">' + o.items.map(function (i) { return '<div class="mini-line"><img src="' + esc(i.image || Art.make(i.art)) + '" alt=""><div><div>' + esc(i.name) + '</div><div class="sub">' + (i.color ? esc(i.color) + ' · ' : '') + esc(i.size) + ' · ' + i.qty + ' шт.</div>' + (i.preorder ? preTag(i) : '') + '</div><span class="num">' + fmt(i.price * i.qty) + '</span></div>'; }).join('') +
          (o.promoDiscount ? '<div class="sum-row disc"><span>Промокод ' + esc(o.promoCode) + '</span><span>−' + fmt(o.promoDiscount) + '</span></div>' : '') +
          '<div class="sum-row"><span>' + esc(o.delivery && o.delivery.name || 'Доставка') + '</span><span>' + (o.delivery && o.delivery.price ? fmt(o.delivery.price) : 'Бесплатно') + '</span></div>' +
          (o.bonusUsed ? '<div class="sum-row disc"><span>Оплачено бонусами</span><span>−' + fmt(o.bonusUsed) + '</span></div>' : '') +
          '<div class="sum-row total"><span>Итого</span><span>' + fmt(o.total) + '</span></div>' +
          (o.refunds || []).map(function (r) { return '<div class="sum-row refund-row"><span>Возврат ' + esc(new Date(r.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })) + '</span><span>−' + fmt(r.amount) + '</span></div>'; }).join('') +
          (o.bonusEarn > 0 && o.status !== 'canceled' && o.status !== 'returned' ? '<div class="sum-row bonus-earn"><span><i class="b-ic" aria-hidden="true">Б</i>' + (o.bonusCredited ? 'Начислено бонусов' : 'Начислим ' + (bonusCfg().creditOn === 'done' ? 'после получения' : 'после оплаты')) + '</span><span>+' + bonusNum(o.bonusEarn) + '</span></div>' : '') + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' + (o.payUrl && o.payment.status === 'pending' ? '<a class="btn" href="' + esc(o.payUrl) + '">Оплатить заказ</a>' : '') + '<a class="btn ghost" href="#/catalog">Продолжить покупки</a>' + (API.user ? '<a class="btn ghost" href="#/account">Мои заказы</a><a class="btn ghost" href="#/account?tab=support&new=1&order=' + esc(o.id) + '">Вопрос по заказу</a>' : '') + '</div></div></div>';
      var ro = $('#reqOpen'); if (ro) ro.addEventListener('click', function () { openRequest(o, function () { orderPage(v, parts); }); });
      if (API.user) refreshBonus(); // после оплаты бонусы могли прийти — обновим счёт и покажем уведомление
    } catch (e) { v.innerHTML = '<div class="wrap"><div class="empty"><h3>Заказ не найден</h3><p>' + esc(errMsg(e)) + '</p><a class="btn ghost" href="#/">На главную</a></div></div>'; }
  }

  /* ---------- Личный кабинет ---------- */
  /* ---------- Личный кабинет ----------
     Сверху — приветствие и бонусная карта, ниже — вкладки: заказы, бонусы, поддержка, профиль.
     Заказы показываются со шкалой: принят → собирается → в пути → получен. */
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
    var tabs = [['orders', 'Заказы'], ['favorites', 'Избранное'], bOn ? ['bonus', 'Бонусы'] : null, ['support', 'Поддержка'], ['profile', 'Профиль']].filter(Boolean);
    var focus = tab === 'support' && (q.id || q.new === '1');
    v.innerHTML = '<div class="wrap acc' + (focus ? ' acc-focus' : '') + '">' +
      '<section class="acc-hero">' +
        '<div class="acc-hi"><span class="eyebrow">Личный кабинет</span><h1>' + glue('Здравствуйте, ' + (u.firstName || '')) + '</h1>' +
          (since ? '<p class="acc-since">С нами с ' + esc(since) + '</p>' : '') +
          '<div class="acc-facts" id="accFacts"></div></div>' +
        (bOn ? '<div class="acc-card">' + loyalCardHtml(u, u.bonus || 0) + '</div>' : '') +
      '</section>' +
      '<nav class="acc-tabs" aria-label="Разделы кабинета">' + tabs.map(function (t) {
        return '<a href="#/account?tab=' + t[0] + '"' + (t[0] === tab ? ' class="on" aria-current="page"' : '') + '>' + t[1] + (t[0] === 'support' && u.supportUnread ? '<i class="acc-dot" aria-label="Есть ответ"></i>' : '') + '</a>';
      }).join('') + '<button class="acc-out" type="button" id="accOut">Выйти</button></nav>' +
      '<div class="acc-body" id="accBody"><div class="loader" style="min-height:240px">…</div></div>' +
    '</div>';
    bindCardTilt($('.acc-card .loyal-card', v));
    $('#accOut').addEventListener('click', async function () { await API.logout(); toast('Вы вышли из аккаунта'); go('#/'); });
    var body = $('#accBody');
    // Факты под приветствием: заказы и баланс, обновляются после загрузки
    API.myOrders().then(function (list) {
      var f = $('#accFacts'); if (!f || !document.body.contains(f)) return;
      var active = list.filter(function (o) { return o.status !== 'done' && o.status !== 'canceled' && o.status !== 'returned'; }).length;
      f.innerHTML = '<a href="#/account?tab=orders"><b class="num">' + list.length + '</b><span>' + plural(list.length, 'заказ', 'заказа', 'заказов') + '</span></a>' +
        (active ? '<a href="#/account?tab=orders"><b class="num">' + active + '</b><span>в пути и в работе</span></a>' : '') +
        (bOn ? '<a href="#/account?tab=bonus"><b class="num">' + bonusNum(API.user.bonus || 0) + '</b><span>' + bonusWord(API.user.bonus || 0) + ' на счёте</span></a>' : '') +
        (Fav.count() ? '<a href="#/account?tab=favorites"><b class="num">' + Fav.count() + '</b><span>в избранном</span></a>' : '');
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
    var onTab = $('.acc-tabs a.on', v); if (onTab && onTab.scrollIntoView) { var nav = onTab.parentNode; nav.scrollLeft = onTab.offsetLeft - (nav.clientWidth - onTab.offsetWidth) / 2; }
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
  function ordersHtml(list) {
    if (!list.length) return '<div class="acc-empty"><h3>Заказов пока нет</h3><p>Здесь появятся ваши покупки и статус доставки каждой из них.</p><a class="btn" href="#/catalog">Перейти в каталог</a></div>';
    return '<div class="acc-orders">' + list.map(function (o) {
      var n = o.items.reduce(function (s, i) { return s + (i.qty || 1); }, 0);
      var pay = o.payment && o.payment.status === 'pending' && o.payment.method === 'online' && o.status !== 'canceled' ? '<span class="ao-pay">Ожидает оплаты</span>' : '';
      var thumbs = o.items.slice(0, 3).map(function (i) { return '<img src="' + esc(i.image || Art.make(i.art)) + '" alt="" loading="lazy">'; }).join('') + (o.items.length > 3 ? '<em>+' + (o.items.length - 3) + '</em>' : '');
      return '<a class="acc-order" href="#/order/' + esc(o.id) + '">' +
        '<div class="ao-thumbs">' + thumbs + '</div>' +
        '<div class="ao-main"><div class="ao-top"><b>Заказ № ' + esc(o.number) + '</b><span>' + esc(fmtDate(o.createdAt).replace(/ \d{4} г\.$/, '')) + '</span>' + pay + '</div>' + orderTrack(o) + (o.tracking && o.status !== 'canceled' && o.status !== 'returned' ? '<span class="ao-trk">СДЭК: <b>' + esc(o.tracking.number) + '</b> · отследить на странице заказа</span>' : '') + '</div>' +
        '<div class="ao-sum"><b class="num">' + fmt(o.total) + '</b><span>' + n + ' ' + plural(n, 'вещь', 'вещи', 'вещей') + '</span></div>' +
      '</a>';
    }).join('') + '</div>';
  }

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
      '<fieldset><legend>Письма</legend><p>Только по делу — никаких рассылок.</p><label class="check"><input type="checkbox" data-remind' + (u.cartRemind ? ' checked' : '') + '> <span>Напоминать о товарах в корзине, если я не оформил заказ<br><small class="muted">Одно письмо на корзину, через несколько часов</small></span></label></fieldset>' +
      '<p class="form-error" id="pfErr"></p><div class="acc-profile-act"><button class="btn">Сохранить изменения</button><button class="btn ghost" type="button" id="pfOut">Выйти из аккаунта</button></div></form>';
    phoneMask($('#pf-phone'));
    // Поле «Текущий пароль» появляется, когда меняют пароль или почту
    var curNeed = function () { var need = !!$('#pf-pass').value || $('#pf-email').value.trim().toLowerCase() !== String(u.email || '').toLowerCase(); $('#pfCurRow').hidden = !need; };
    ['#pf-pass', '#pf-email'].forEach(function (q) { $(q).addEventListener('input', curNeed); });
    $('#pfOut').addEventListener('click', async function () { await API.logout(); toast('Вы вышли из аккаунта'); go('#/'); });
    $('#profForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var f = { firstName: $('#pf-first').value, lastName: $('#pf-last').value, phone: $('#pf-phone').value, email: $('#pf-email').value, newPassword: $('#pf-pass').value, currentPassword: $('#pf-cur').value };
      var er = !f.firstName.trim() || !f.lastName.trim() ? 'Укажите имя и фамилию' : !validPhone(f.phone) ? 'Проверьте номер телефона' : !validEmail(f.email) ? 'Проверьте электронную почту' : f.newPassword && f.newPassword.length < 6 ? 'Пароль должен быть не короче 6 символов' : '';
      if (er) { $('#pfErr').textContent = er; return; }
      try { await API.updateProfile(f); toast('Изменения сохранены'); go('#/account?tab=profile'); } catch (ex) { $('#pfErr').textContent = errMsg(ex); }
    });
  }

  /* ---------- Поддержка в кабинете: список обращений и переписка ---------- */
  var SUPPORT_STATE = { open: 'Ждёт ответа', answered: 'Есть ответ', closed: 'Закрыто' };
  function msgTime(iso) {
    var d = new Date(iso), now = new Date();
    var t = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === now.toDateString() ? t : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) + ', ' + t;
  }
  function supportHours() { var h = (D.settings.contacts || {}).hours; return h ? 'Отвечаем ' + h.charAt(0).toLowerCase() + h.slice(1) + '. ' : ''; }
  async function supportTab(body, q) {
    var r;
    try { r = await API.support(); } catch (e) { body.innerHTML = '<p class="form-error">' + esc(errMsg(e)) + '</p>'; return; }
    if (!document.body.contains(body)) return;
    var list = r.tickets, topics = r.topics;
    var cur = q.id ? list.find(function (t) { return t.id === q.id; }) : null;
    var isNew = q.new === '1' || (!cur && !list.length);
    var side = '<aside class="sup-list">' +
      '<a class="btn block" href="#/account?tab=support&new=1">Новое обращение</a>' +
      (list.length ? '<ul>' + list.map(function (t) {
        var last = t.messages[t.messages.length - 1];
        return '<li><a class="sup-item' + (cur && cur.id === t.id ? ' on' : '') + (t.unread ? ' unread' : '') + '" href="#/account?tab=support&id=' + esc(t.id) + '">' +
          '<span class="si-top"><b>' + esc(t.topic) + (t.orderNumber ? ' · № ' + esc(t.orderNumber) : '') + '</b><time>' + esc(msgTime(t.updatedAt)) + '</time></span>' +
          '<span class="si-text">' + (last.from === 'shop' ? 'Поддержка: ' : 'Вы: ') + esc(last.text.slice(0, 90)) + '</span>' +
          '<span class="si-state s-' + t.status + '">' + SUPPORT_STATE[t.status] + '</span></a></li>';
      }).join('') + '</ul>' : '') +
    '</aside>';
    var pane = cur ? threadHtml(cur) : isNew ? newTicketHtml(topics, q) : '<div class="sup-pick"><h3>Выберите обращение</h3><p>Или напишите новое — ответим здесь и продублируем ответ на почту.</p></div>';
    body.innerHTML = '<div class="sup' + (cur || isNew ? ' has-pane' : '') + '">' + side + '<section class="sup-pane">' + pane + '</section></div>';
    if (cur) bindThread(body, cur);
    else if (isNew) bindNewTicket(body);
  }
  function threadHtml(t) {
    return '<div class="sup-thread">' +
      '<header class="st-head"><a class="st-back" href="#/account?tab=support" aria-label="Все обращения">←</a><div><b>' + esc(t.topic) + '</b><span>Обращение № ' + esc(t.number) +
        (t.orderNumber ? ' · <a href="#/order/' + esc(t.orderId) + '">заказ № ' + esc(t.orderNumber) + '</a>' : '') + '</span></div><span class="si-state s-' + t.status + '">' + SUPPORT_STATE[t.status] + '</span></header>' +
      '<div class="st-msgs" id="stMsgs">' + msgsHtml(t) + '</div>' +
      '<form class="st-send" id="stSend"><textarea class="textarea" id="stText" rows="2" placeholder="Напишите сообщение" maxlength="2000" aria-label="Сообщение"></textarea>' +
        '<button class="btn" id="stBtn">Отправить</button></form>' +
      '<p class="st-note">' + supportHours() + 'Ответ придёт сюда и на почту.</p>' +
    '</div>';
  }
  function msgsHtml(t) {
    var store = D.settings.storeName || 'Магазин';
    return t.messages.map(function (m) {
      return '<div class="msg ' + (m.from === 'shop' ? 'from-shop' : 'from-me') + '"><div class="msg-b">' + (m.from === 'shop' ? '<span class="msg-who">' + esc(store) + '</span>' : '') +
        '<p>' + esc(m.text) + '</p></div><time>' + esc(msgTime(m.at)) + '</time></div>';
    }).join('');
  }
  function bindThread(body, t) {
    var box = $('#stMsgs', body), ta = $('#stText', body);
    box.scrollTop = box.scrollHeight;
    var count = t.messages.length;
    if (t.unread) API.supportGet(t.id).then(function () { if (API.user) { API.user.supportUnread = Math.max(0, (API.user.supportUnread || 1) - 1); markBonusDot(); } }).catch(function () {});
    var send = async function () {
      var text = ta.value.trim(); if (!text) { ta.focus(); return; }
      var btn = $('#stBtn', body); btn.disabled = true;
      try { var nt = await API.supportSend(t.id, text); ta.value = ''; box.innerHTML = msgsHtml(nt); count = nt.messages.length; box.scrollTop = box.scrollHeight; }
      catch (e) { toast(errMsg(e)); }
      btn.disabled = false; ta.focus();
    };
    $('#stSend', body).addEventListener('submit', function (e) { e.preventDefault(); send(); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
    // новые ответы магазина подгружаются сами, пока переписка открыта
    supportPoll = setInterval(async function () {
      if (!document.body.contains(box)) { clearInterval(supportPoll); return; }
      if (document.hidden) return;
      try { var nt = await API.supportGet(t.id); if (nt.messages.length !== count) { count = nt.messages.length; box.innerHTML = msgsHtml(nt); box.scrollTop = box.scrollHeight; } } catch (e) {}
    }, 20000);
  }
  function newTicketHtml(topics, q) {
    return '<form class="sup-new" id="supNew" novalidate><a class="st-back" href="#/account?tab=support" aria-label="Все обращения">←</a><h3>Новое обращение</h3>' +
      '<p class="muted">' + supportHours() + 'Ответ придёт сюда и на почту.</p>' +
      '<fieldset class="sup-topics"><legend>Тема</legend>' + topics.map(function (t, i) {
        return '<label><input type="radio" name="sup-topic" value="' + esc(t) + '"' + ((q.order ? t === 'Заказ' : i === topics.length - 1) ? ' checked' : '') + '><span>' + esc(t) + '</span></label>';
      }).join('') + '</fieldset>' +
      '<label class="field" id="supOrderWrap"><span>Заказ</span><select class="select" id="supOrder"><option value="">Без заказа</option></select></label>' +
      '<label class="field"><span>Сообщение</span><textarea class="textarea" id="supText" rows="5" maxlength="2000" placeholder="Опишите вопрос: что случилось и чем помочь"></textarea></label>' +
      '<p class="form-error" id="supErr"></p><button class="btn" id="supBtn">Отправить</button></form>';
  }
  function bindNewTicket(body) {
    var q = parseHash().q, sel = $('#supOrder', body);
    API.myOrders().then(function (list) {
      if (!list.length) { $('#supOrderWrap', body).hidden = true; return; }
      sel.insertAdjacentHTML('beforeend', list.map(function (o) { return '<option value="' + esc(o.id) + '"' + (q.order === o.id ? ' selected' : '') + '>№ ' + esc(o.number) + ' от ' + esc(fmtDate(o.createdAt).replace(/ \d{4} г\.$/, '')) + ' — ' + fmt(o.total) + '</option>'; }).join(''));
    }).catch(function () { $('#supOrderWrap', body).hidden = true; });
    $('#supNew', body).addEventListener('submit', async function (e) {
      e.preventDefault();
      var text = $('#supText', body).value.trim(), topic = ($('input[name="sup-topic"]:checked', body) || {}).value;
      if (!text) { $('#supErr', body).textContent = 'Напишите, чем мы можем помочь'; $('#supText', body).focus(); return; }
      var btn = $('#supBtn', body); btn.disabled = true; btn.textContent = 'Отправляем…';
      try { var t = await API.supportCreate({ topic: topic, orderId: sel.value, text: text }); toast('Сообщение отправлено'); go('#/account?tab=support&id=' + t.id); }
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
    var row = function (href, ic, title, sub, ext) { return '<a class="fp-row" href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '><span class="fp-ic">' + FAB_IC[ic] + '</span><span><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span></a>'; };
    var rows = row('#/account?tab=support&new=1', 'chat', 'Написать в чат', 'Ответ придёт в кабинет и на почту') +
      (tg ? row(safeUrl(tg.url), 'tg', 'Telegram', 'Написать в Telegram', true) : '') +
      (wa.length >= 10 ? row('https://wa.me/' + wa, 'wa', 'WhatsApp', fmtPhone(wa), true) : '') +
      (c.phone ? row('tel:' + c.phone.replace(/[^\d+]/g, ''), 'phone', 'Позвонить', c.phone) : '') +
      (c.email ? row('mailto:' + c.email, 'mail', 'Почта', c.email) : '');
    return '<div class="fab" id="fab"><div class="fab-panel" id="fabPanel" role="dialog" aria-label="Связаться с нами" hidden>' +
      '<div class="fp-head"><b>Мы на связи</b>' + (c.hours ? '<span>' + esc(c.hours) + '</span>' : '') + '</div>' + rows + '</div>' +
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
    var t = $('.acc-tabs a[href="#/account?tab=support"]');
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
  function backTo(back) { return back === 'checkout' ? '#/checkout' : back === 'support' ? '#/account?tab=support&new=1' : '#/account'; }
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
    var backQ = back === 'checkout' || back === 'support' ? 'back=' + back : '';
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
          await API.login($('#lg-login').value, $('#lg-pass').value);
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
        go(backTo(back));
      } catch (ex) { err.textContent = errMsg(ex); }
    });
  }

  /* ---------- Подтверждение почты: код из 6 цифр ---------- */
  function codeStep(v, pend, f, back) {
    var cells = ''; for (var i = 0; i < 6; i++) cells += '<input class="code-cell" inputmode="numeric" pattern="[0-9]*" maxlength="6" aria-label="Цифра ' + (i + 1) + ' из 6"' + (i === 0 ? ' autocomplete="one-time-code"' : ' autocomplete="off"') + '>';
    v.innerHTML = '<div class="wrap"><div class="page-head" style="text-align:center;justify-items:center"><span class="eyebrow">Регистрация</span><h1>Подтвердите почту</h1></div>' +
      '<div class="auth code-step">' +
        '<p class="code-lead">Отправили код из 6 цифр на <b>' + esc(pend.email) + '</b>. Код действует ' + pend.minutes + ' минут.</p>' +
        '<form id="codeForm" novalidate><div class="code-cells" role="group" aria-label="Код из письма">' + cells + '</div>' +
          '<p class="form-error" id="codeErr" aria-live="polite"></p><button class="btn block" id="codeBtn">Подтвердить</button></form>' +
        '<div class="code-more"><button class="link" id="codeResend" type="button"></button><button class="link" id="codeBack" type="button">Изменить данные</button></div>' +
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
      try { var r = await API.verify(pend.id, c); clearInterval(timer); afterRegister(back, r.welcome, true); }
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
      try { var r = await API.resendCode(pend.id); toast('Отправили новый код на ' + pend.email); err.textContent = ''; box.forEach(function (c) { c.value = ''; }); box[0].focus(); countdown(r.resendIn || 60); }
      catch (ex) { err.textContent = errMsg(ex); rs.disabled = false; }
    });
    $('#codeBack').addEventListener('click', function () { clearInterval(timer); authPage(v, 'register', back, Object.assign({}, f)); });
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
    var ic = function (n, size) { return '<img src="img/benefits/' + n + '.webp?v=13.32.1" alt="" width="' + size + '" height="' + size + '" loading="lazy" decoding="async">'; };
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
    var ic = function (n, size) { return n ? '<img src="img/benefits/' + n + '.webp?v=13.32.1" alt="" width="' + size + '" height="' + size + '" loading="lazy" decoding="async">' : ''; };
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
    var ic = function (n) { return '<span class="ac-ico"><img src="img/benefits/' + n + '.webp?v=13.32.1" alt="" width="120" height="120" loading="lazy" decoding="async"></span>'; };
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
  function notFound(v) { v.innerHTML = '<div class="wrap"><div class="empty" style="padding:120px 0"><span class="eyebrow">404</span><h3>Страница не найдена</h3><a class="btn ghost" href="#/">На главную</a></div></div>'; }

  /* ---------- Поиск ---------- */
  function openSearch() {
    openModal('<h3 class="serif" style="font-size:34px;margin-bottom:20px">Поиск</h3><form id="sForm"><input class="input" id="sInput" placeholder="Например, пальто или кашемир" autocomplete="off" aria-label="Поиск"></form><div id="sRes" style="display:grid;gap:12px;margin-top:20px"></div>');
    var i = $('#sInput'); setTimeout(function () { i.focus(); }, 50);
    i.addEventListener('input', function () {
      var t = i.value.trim().toLowerCase();
      var res = t.length < 2 ? [] : D.products.filter(onSale).filter(function (p) { var cat = catById(p.categoryId); return (p.name + ' ' + colorNames(p) + ' ' + (cat ? cat.name : '') + ' ' + (p.description || '') + ' ' + (window.Specs ? Specs.list(p).map(function (x) { return x.value; }).join(' ') : '')).toLowerCase().indexOf(t) !== -1; });
      var more = res.length > 6; res = res.slice(0, 6);
      $('#sRes').innerHTML = res.map(function (p) { return '<a class="mini-line" href="#/product/' + esc(p.slug) + '"><img src="' + esc(imgOf(p)) + '" alt=""><div>' + esc(p.name) + '<div class="sub">' + esc(Pricing.colorsOf(p).map(function (c) { return c.name; }).join(', ')) + '</div></div><span class="num">' + fmt(priceOf(p).price) + '</span></a>'; }).join('') + (more ? '<a class="link sh-more" style="margin-top:14px" href="#/catalog?q=' + encodeURIComponent(i.value.trim()) + '"><span>Все результаты</span><i aria-hidden="true">' + ARROW + '</i></a>' : '') || (t.length >= 2 ? '<p class="muted">Ничего не нашлось</p>' : '');
    });
    $('#sForm').addEventListener('submit', function (e) { e.preventDefault(); if (i.value.trim()) go('#/catalog?q=' + encodeURIComponent(i.value.trim())); });
  }

  /* ---------- Экран выбора раздела при первом заходе ---------- */
  function gatewayCfg() { return D.settings.gateway || {}; }
  function showGateway() {
    var g = gatewayCfg(), s = D.settings;
    if ($('.gate')) return;
    // Поисковым роботам экран выбора не показываем: они должны видеть саму витрину, а не окно поверх неё
    if (/bot|crawl|spider|slurp|lighthouse|yandex|google|bing|mail\.ru|headless|preview/i.test(navigator.userAgent || '')) return;
    var panel = function (key, art) {
      var c = g[key] || {}, img = c.image || Art.make(art);
      return '<button class="gate-panel' + (gClosed(key) ? ' is-soon' : '') + '" data-gate="' + key + '"><img src="' + esc(img) + '" alt=""><span class="gate-copy"><span class="gate-title">' + esc(c.title || GENDERS[key]) + '</span>' +
        (c.text ? '<span class="gate-text">' + esc(c.text) + '</span>' : '') + '<span class="gate-go">' + (gClosed(key) ? 'Скоро' : 'Перейти') + '<i aria-hidden="true"></i></span></span></button>';
    };
    var el = document.createElement('div');
    el.className = 'gate'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', g.eyebrow || 'Выберите раздел');
    el.innerHTML = '<div class="gate-head">' + brandHtml(s, 'desktop', 'brand-gate', (s.brand && s.brand.word && s.brand.word.src) ? 'word' : 'text') + (g.eyebrow ? '<span class="eyebrow">' + esc(g.eyebrow) + '</span>' : '') + '</div>' +
      '<div class="gate-panels">' + panel('women', { kind: 'dress', tone: '#4a4a4e' }) + panel('men', { kind: 'coat', tone: '#2e2e31' }) + '</div>' +
      '<div class="gate-foot"><button class="link" data-gate="all">Смотреть всю коллекцию</button></div>';
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    var close = function (choice) {
      setGender(choice);
      el.classList.add('leaving'); document.body.style.overflow = '';
      setTimeout(function () { el.remove(); }, 650);
    };
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-gate]'); if (b) close(b.getAttribute('data-gate')); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Escape') close('all'); });
    setTimeout(function () { var f = $('.gate-panel', el); if (f) f.focus({ preventScroll: true }); }, 50);
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
      err.textContent = ''; var b = $('#gfPay'); b.disabled = true; $('#gfPayT').textContent = 'Переходим к оплате…';
      try {
        var r = await API.buyGift({ amount: a, toName: $('#gf-to').value, toEmail: $('#gf-email').value, message: $('#gf-msg').value, fromName: $('#gf-from').value, sendAt: st.when === 'date' ? $('#gf-date').value : '', customer: f, consent: true });
        if (r.payUrl) { location.href = r.payUrl; return; }
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
    var scroll = window.scrollY; renderShell(); routeKeepScroll = true; route(); restoreScroll(scroll);
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
    window.App = { careIcon: careIcon, API: API, D: D, plural: plural, slideHtml: slideHtml, slidePromo: slidePromo, slideVisible: slideVisible, hashPath: hashPath, brandHtml: brandHtml, brandMode: brandMode, esc: esc, fmt: fmt, md: md, toast: toast, errMsg: errMsg, imgOf: imgOf, refresh: refresh, go: go, openModal: openModal, closePanels: closePanels, fmtPhone: fmtPhone, fmtDate: fmtDate, STATUS: STATUS, PAY: PAY, chartTable: chartTable };
    renderShell();
    initAnalytics();
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]'); if (a) {
        var act = a.getAttribute('data-act');
        if (act === 'menu') openPanel('menuDrawer');
        if (act === 'cart') openCart();
        if (act === 'search') openSearch();
        if (act === 'close') closePanels();
        if (act === 'install' && window.Install) { closePanels(); Install.open(); }
        if (act === 'install-hide' && window.Install) { Install.hideBanner(); syncInstall(); }
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
      var qa = e.target.closest('[data-qa]');
      if (qa) {
        e.preventDefault(); e.stopPropagation();
        var k = qa.getAttribute('data-qa').split('|'), pr = D.products.find(function (x) { return x.id === k[0]; });
        var sz = pr && Pricing.colorOf(pr, k[1]).sizes.find(function (x) { return x.size === k[2]; }), inCart = (Cart.find(k[0], k[1], k[2]) || { qty: 0 }).qty;
        if (!sz || inCart + 1 > sz.stock) { toast('Больше этого размера нет в наличии', true); return; }
        Cart.add(k[0], k[1], k[2], 1); qa.classList.add('added');
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
      var hd = $('.header'); if (hd) { var was = hd.classList.contains('scrolled'); if (!was && y > 48) hd.classList.add('scrolled'); else if (was && y < 8) hd.classList.remove('scrolled'); }
      var tt = $('#toTop'); if (tt) tt.hidden = y < 900;
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
    // Первый заход на главную: предложить выбрать раздел
    if (genderChoice === null && gatewayCfg().enabled !== false && !parseHash().parts[0]) showGateway();
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
    var el = document.getElementById('splash'); if (!el || el.classList.contains('leave')) return;
    try { sessionStorage.setItem('albakov:intro', '1'); } catch (e) {}
    // при обновлении страницы заставка скрыта ещё до отрисовки (js/splash.js) — просто убираем её
    if (document.documentElement.classList.contains('sp-skip')) { el.remove(); return; }
    var first = true;
    var wait = Math.max(0, (first ? 1400 : 250) - performance.now());
    setTimeout(function () {
      el.classList.add('done');
      setTimeout(function () { el.classList.add('leave'); setTimeout(function () { el.remove(); }, 950); }, 280);
    }, wait);
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
