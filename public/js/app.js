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
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

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
  function sortedCats() { return D.categories.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  var STATUS = { new: 'Новый', processing: 'Собирается', shipped: 'Передан в доставку', done: 'Выполнен', canceled: 'Отменён' };
  var PAY = { pending: 'Ожидает оплаты', paid: 'Оплачен', canceled: 'Оплата отменена', refunded: 'Возврат' };

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
    document.title = s.storeName + (s.tagline ? ' — ' + s.tagline : '');
    root.innerHTML =
      (s.announcement ? '<div class="topbar"><div class="wrap">' + esc(s.announcement) + '</div></div>' : '') +
      '<header class="header"><div class="wrap">' +
        '<nav class="nav" aria-label="Основное меню">' + navLinks() + '</nav>' +
        '<button class="icon-btn burger" data-act="menu" aria-label="Меню">' + ICON.menu + '</button>' +
        '<a class="logo" href="#/" aria-label="' + esc(s.storeName) + ' — на главную">' + brandHtml(s, 'desktop', 'brand-desk') + brandHtml(s, 'mobile', 'brand-mob') + '</a>' +
        '<div class="tools">' + genderTabs('gtabs-head') +
          '<button class="icon-btn" data-act="search" aria-label="Поиск">' + ICON.search + '</button>' +
          '<a class="icon-btn hide-m acc-link" id="accLink" href="#/account" aria-label="Личный кабинет">' + ICON.user + '</a>' +
          '<button class="icon-btn" data-act="cart" aria-label="Корзина">' + ICON.bag + '<span class="badge-count" id="cartCount" hidden></span></button>' +
        '</div></div><div class="gbar">' + genderTabs('gtabs-bar') + '</div><span class="hdr-progress" id="hdrProgress" aria-hidden="true"></span></header>' +
      '<main id="view"></main>' +
      footerHtml() +
      '<div class="scrim" id="scrim"></div>' +
      '<aside class="drawer left" id="menuDrawer" aria-label="Меню"><div class="drawer-head"><a class="logo" href="#/" aria-label="' + esc(s.storeName) + '">' + brandHtml(s, 'mobile', 'brand-drawer') + '</a><button class="icon-btn" data-act="close">' + ICON.close + '</button></div>' +
        '<div class="drawer-body">' + genderTabs('gtabs-drawer') + '<nav class="mnav">' + navLinks() + '<a href="#/account">Личный кабинет</a></nav>' +
        '<div class="mnav-sub">' + sortedCats().map(function (c) { return '<a href="#/catalog?cat=' + esc(c.slug) + '">' + esc(c.name) + '</a>'; }).join('') + '</div>' +
        '<div class="socials">' + socialsHtml() + '</div></div></aside>' +
      '<aside class="drawer right" id="cartDrawer" aria-label="Корзина"><div class="drawer-head"><h3>Корзина</h3><button class="icon-btn" data-act="close">' + ICON.close + '</button></div><div class="drawer-body" id="cartBody"></div><div class="drawer-foot" id="cartFoot"></div></aside>' +
      '<div class="modal" id="modal" role="dialog" aria-modal="true"><div class="modal-box"><button class="icon-btn modal-close" data-act="close">' + ICON.close + '</button><div id="modalBody"></div></div></div>' +
      '<div class="toast-wrap" aria-live="polite"></div>' +
      '<button class="to-top" id="toTop" aria-label="Наверх" hidden><svg viewBox="0 0 24 24"><path d="M6 14l6-6 6 6"/></svg></button>';
    updateCartCount(); markBonusDot();
  }
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
  function socialsHtml() { return (D.settings.socials || []).filter(function (x) { return x.url; }).map(function (x) { return '<a href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener">' + esc(x.name) + '</a>'; }).join(''); }
  function footerHtml() {
    var s = D.settings, c = s.contacts || {};
    var pages = function (g) { return D.pages.filter(function (p) { return p.inFooter && (p.group || 'help') === g; }).map(function (p) { return '<li><a href="#/page/' + esc(p.slug) + '">' + esc(p.title) + '</a></li>'; }).join(''); };
    return '<footer class="footer">' + footerMark() + '<div class="wrap footer-top">' +
      '<div><a class="logo logo-foot" href="#/" aria-label="' + esc(s.storeName) + '">' + brandHtml(s, 'desktop', 'brand-foot') + '</a><p class="muted" style="margin-top:16px;max-width:34ch">' + esc(s.tagline || '') + '</p><div class="socials">' + socialsHtml() + '</div></div>' +
      '<div><h4>Магазин</h4><ul>' + sortedCats().map(function (x) { return '<li><a href="#/catalog?cat=' + esc(x.slug) + '">' + esc(x.name) + '</a></li>'; }).join('') + '<li><a href="#/sale">Акции</a></li></ul></div>' +
      '<div><h4>Покупателям</h4><ul>' + pages('help') + '<li><a href="#/sizes">Таблица размеров</a></li><li><a href="#/account">Личный кабинет</a></li>' + pages('brand') + '</ul></div>' +
      '<div><h4>Контакты</h4><ul>' +
        (c.phone ? '<li><a href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '" class="copyable">' + esc(c.phone) + '</a></li>' : '') +
        (c.email ? '<li><a href="mailto:' + esc(c.email) + '" class="copyable">' + esc(c.email) + '</a></li>' : '') +
        (c.address ? '<li class="muted">' + esc(c.address) + '</li>' : '') +
        (c.hours ? '<li class="muted">' + esc(c.hours) + '</li>' : '') + '</ul></div>' +
      '</div><div class="wrap footer-bottom"><span>© ' + new Date().getFullYear() + ' ' + esc(s.storeName) + (s.legal ? '. ' + esc(s.legal) : '') + '</span>' +
      '<span style="display:flex;gap:18px;flex-wrap:wrap">' + D.pages.filter(function (p) { return p.inFooter && p.group === 'legal'; }).map(function (p) { return '<a href="#/page/' + esc(p.slug) + '">' + esc(p.title) + '</a>'; }).join('') + (API.isAdmin ? '<a href="#/admin">Управление</a>' : '') + '</span></div></footer>';
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

  /* ---------- Карточка товара ---------- */
  // Плашки товара: «Новинка», «Скидка 15%», «Хит продаж» — тексты и цвета из панели управления
  function badgeHtml(p, pr) {
    return Pricing.badgesOf(p, pr, D.settings).map(function (b) { return '<span class="badge badge-' + b.key + '" style="--b:' + esc(b.color) + ';--bi:' + b.ink + '">' + esc(b.text) + '</span>'; });
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
    var tags = stock === 0 ? ['<span class="badge badge-out">Нет в наличии</span>'] : badgeHtml(p, pr);
    var sub = cs.length > 1 ? (cat ? esc(cat.name) : '') : esc([cat && cat.name, c0.name].filter(Boolean).join(' · '));
    var qa = (c0.sizes || []).filter(function (x) { return x.stock > 0; });
    var quick = qa.length ? '<span class="qa"><span class="qa-label">' + (qa.length === 1 && c0.sizes.length === 1 ? '' : 'Быстро добавить') + '</span><span class="qa-sizes">' + qa.map(function (x) { return '<span class="qa-size" role="button" data-qa="' + esc(p.id) + '|' + esc(c0.id) + '|' + esc(x.size) + '">' + (qa.length === 1 && c0.sizes.length === 1 ? 'В корзину' : esc(x.size)) + '</span>'; }).join('') + '</span></span>' : '';
    return '<a class="card" href="#/product/' + esc(p.slug) + (c0 !== cs[0] ? '?color=' + esc(c0.id) : '') + '"><div class="ph"><div class="tags">' + tags.join('') + '</div>' + quick +
      '<img src="' + esc(img0) + '" alt="' + esc(p.name) + '" loading="lazy">' +
      (img1 ? '<img class="alt" src="' + esc(img1) + '" alt="" loading="lazy">' : '') + '</div>' +
      '<div class="meta"><span class="name">' + esc(p.name) + '</span><span class="sub">' + sub + '</span>' +
      (cs.length > 1 ? '<span class="card-swatches" title="' + esc(cs.map(function (c) { return c.name; }).join(', ')) + '">' + cs.slice(0, 5).map(function (c) { return '<i style="' + swatchStyle(c) + '"></i>'; }).join('') + (cs.length > 5 ? '<em>+' + (cs.length - 5) + '</em>' : '') + '<span class="sr">' + cs.length + ' ' + plural(cs.length, 'цвет', 'цвета', 'цветов') + '</span></span>' : '') +
      priceHtml(pr) + bonusLine(pr.price) + '</div></a>';
  }
  function priceHtml(pr) { return '<span class="price">' + (pr.oldPrice ? '<span class="now sale">' + fmt(pr.price) + '</span><s>' + fmt(pr.oldPrice) + '</s>' : '<span class="now">' + fmt(pr.price) + '</span>') + '</span>'; }

  /* ---------- Маршрутизация ---------- */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var qi = h.indexOf('?'), path = qi === -1 ? h : h.slice(0, qi), q = {};
    var dec = function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } };
    if (qi !== -1) h.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[dec(p[0])] = dec((p[1] || '').replace(/\+/g, ' ')); });
    return { parts: path.split('/').filter(Boolean), q: q };
  }
  function route() {
    closePanels();
    if (/^#\/(checkout|admin)/.test(location.hash)) hideBonusNotice();
    var r = parseHash(), v = $('#view'), p = r.parts;
    $$('.nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === location.hash); });
    var name = p[0] || '';
    var map = { '': home, catalog: catalog, product: product, sale: sale, sizes: sizes, cart: cartPage, checkout: checkout, account: account, order: orderPage, page: textPage };
    var fn = map.hasOwnProperty(name) ? map[name] : isAdminRoute(name) ? adminPage : notFound;
    if ((name === '' || name === 'catalog' || name === 'sale') && gClosed(curGender())) fn = soonPage;
    fn(v, p, r.q);
    document.body.classList.toggle('hero-under', !!$('#view > .slider:first-child'));
    syncHeaderH();
    v.classList.remove('view-in'); void v.offsetWidth; v.classList.add('view-in');
    reveal(v);
    if (!routeKeepScroll) window.scrollTo(0, 0);
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

  /* ---------- Плавное появление блоков при прокрутке ---------- */
  var RV_SEL = '.section-head, .card, .cat, .promo-band, .bonus-band, .editorial > *, .benefit, .prose > *, .order-card, .step, .how-measure > div, .table-wrap';
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }) : null;
  function reveal(box) {
    if (!io || !box || box.closest('.adm-main')) return;
    $$(RV_SEL, box).forEach(function (el, i) {
      if (el.classList.contains('rv') || el.closest('.adm, .modal, .drawer')) return;
      el.classList.add('rv');
      if (el.classList.contains('card') || el.classList.contains('cat')) el.style.setProperty('--d', ((Array.prototype.indexOf.call(el.parentNode.children, el) % 4) * 70) + 'ms');
      io.observe(el);
    });
  }
  /* ---------- 3D: наклон за курсором (только мышь) ---------- */
  var TILT_SEL = '.card .ph, .cat, .promo-band, .editorial .media';
  function initTilt() {
    if (!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
    var cur = null;
    function reset(el) { el.style.transition = 'transform .8s cubic-bezier(.2,.7,.2,1)'; el.style.transform = ''; el.classList.remove('tilting'); }
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest ? e.target.closest(TILT_SEL) : null;
      if (el && (el.closest('.adm-main, .modal, .drawer') || (el.classList.contains('rv') && !el.classList.contains('in')))) el = null;
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
  function go(h) { if (location.hash === h) route(); else location.hash = h; }


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
    var title = esc(sl.title || '').replace(/\*(.+?)\*/g, '<em>$1</em>');
    var btn = function (b, cls, arrow) { return b && b.label ? '<a class="sbtn ' + cls + '" href="' + esc(safeUrl(b.link || '#/catalog')) + '">' + esc(b.label) + (arrow ? '<span class="sbtn-arrow" aria-hidden="true"></span>' : '') + '</a>' : ''; };
    return '<article class="slide layout-' + (sl.layout === 'full' ? 'full' : 'split') + (active ? ' is-active' : '') + '" aria-roledescription="слайд" aria-label="' + (i + 1) + ' из ' + total + '"' + (active ? '' : ' aria-hidden="true"') + '>' +
      '<div class="slide-media"><img src="' + esc(sl.image || Art.make({ kind: 'coat', tone: '#3d3d40' })) + '" alt=""' + (i ? ' loading="lazy"' : '') + '></div>' +
      '<div class="slide-body">' +
        (eyebrow ? '<span class="eyebrow">' + esc(eyebrow) + '</span>' : '') +
        (badge ? '<span class="slide-badge">' + esc(badge) + '</span>' : '') +
        '<' + (i === 0 ? 'h1' : 'h2') + ' class="slide-title">' + title + '</' + (i === 0 ? 'h1' : 'h2') + '>' +
        (sl.text ? '<p class="slide-text">' + esc(sl.text) + '</p>' : '') +
        (sl.code ? '<button class="slide-code" data-copy="' + esc(sl.code) + '" title="Скопировать промокод"><span>Промокод</span><b>' + esc(sl.code) + '</b><i>Скопировать</i></button>' : '') +
        ((sl.btn1 && sl.btn1.label) || (sl.btn2 && sl.btn2.label) ? '<div class="slide-actions">' + btn(sl.btn1, 'sbtn-primary', true) + btn(sl.btn2, 'sbtn-line', true) + '</div>' : '') +
      '</div></article>';
  }
  function sliderHtml(list) {
    var c = D.settings.slider || {}, n = list.length;
    return '<section class="slider" id="slider" aria-roledescription="карусель" aria-label="Главное" style="--dur:' + Math.max(3, Number(c.interval) || 7) + 's">' +
      '<div class="sl-track">' + list.map(function (sl, i) { return slideHtml(sl, i, n, i === 0); }).join('') + '</div>' +
      (n > 1 ? '<div class="slider-ui"><span class="sl-count num"><b id="slNum">1</b> / ' + n + '</span>' +
        '<div class="sl-dots">' + list.map(function (sl, i) { return '<button class="sl-dot' + (i === 0 ? ' on' : '') + '" data-sl="' + i + '" aria-label="Слайд ' + (i + 1) + '"><i></i></button>'; }).join('') + '</div>' +
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
    if (h.showCategories !== false && D.categories.length) {
      html += '<section class="section"><div class="wrap"><div class="section-head"><h2>Категории</h2><a class="link" href="#/catalog">Весь каталог</a></div><div class="cats">' +
        sortedCats().map(function (c) { return { c: c, n: gProducts().filter(function (p) { return p.categoryId === c.id; }).length }; }).filter(function (x) { return x.n > 0; }).map(function (x) { var c = x.c; return '<a class="cat" href="#/catalog?cat=' + esc(c.slug) + '"><span class="cat-ph"><img src="' + esc(c.image || Art.make(c.art)) + '" alt="" loading="lazy"></span><span class="cat-cap"><span class="cat-name">' + esc(c.name) + '</span><span class="cat-n">' + x.n + ' ' + plural(x.n, 'модель', 'модели', 'моделей') + '</span><svg class="cat-go" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M14 7l5 5-5 5"/></svg></span></a>'; }).join('') + '</div></div></section>';
    }
    if (h.showNew !== false) {
      var news = gProducts().filter(function (p) { return (p.tags || []).indexOf('new') !== -1; });
      // если новинок мало — дополняем последними поступлениями раздела, чтобы ряд не выглядел пустым
      if (news.length < 4) news = news.concat(gProducts().filter(function (p) { return news.indexOf(p) === -1; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })).slice(0, 4);
      news = news.slice(0, 8);
      if (news.length) html += '<section class="section"><div class="wrap"><div class="section-head"><h2>Новинки' + (curGender() ? ' <em class="h-sub">' + GENDERS[curGender()].toLowerCase() + '</em>' : '') + '</h2><a class="link" href="#/catalog?tag=new">Смотреть все</a></div><div class="grid">' + news.map(card).join('') + '</div></div></section>';
    }
    if (h.showBonus !== false) html += bonusBand(h);
    if (h.showSale !== false) {
      var ap = activePromos()[0];
      if (ap) html += '<section class="section"><div class="wrap"><a class="promo-band" href="#/sale"><div><span class="eyebrow">Акция' + (ap.endsAt ? ' до ' + esc(fmtDate(ap.endsAt)) : '') + '</span><h3 style="margin-top:12px">' + esc(ap.title) + '</h3><p>' + esc(ap.description || '') + '</p></div><div class="pct">' + (ap.type === 'percent' ? '−' + ap.value + '%' : '−' + fmt(ap.value)) + '</div></a></div></section>';
    }
    if (h.showEditorial !== false && h.editorialTitle) {
      html += '<section class="section"><div class="wrap editorial"><div class="media"><img src="' + esc(h.editorialImage || Art.make(h.editorialArt)) + '" alt="" loading="lazy"></div><div><span class="eyebrow">' + esc(h.editorialEyebrow || '') + '</span><h2>' + esc(h.editorialTitle) + '</h2><p>' + esc(h.editorialText || '') + '</p></div></div></section>';
    }
    if (h.showBenefits !== false && (h.benefits || []).length) {
      html += '<section class="section" style="padding-top:0;border-top:0"><div class="wrap"><div class="benefits">' + h.benefits.map(function (b) { return '<div class="benefit"><h4>' + esc(b.title) + '</h4><p>' + esc(b.text) + '</p></div>'; }).join('') + '</div></div></section>';
    }
    v.innerHTML = html;
    initSlider();
  }

  /* Блок «Бонусная программа» на главной: тексты — в «Главной странице», процент — в разделе «Бонусы» */
  function bonusBand(h) {
    var c = bonusCfg(); if (!c.earn) return '';
    var pct = String(c.percent).replace('.', ','), u = API.user;
    var title = esc(String(h.bonusTitle || 'Возвращаем *{n}%*\nбонусами').replace(/\{n\}/g, pct)).replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
    var steps = [
      ['Покупайте', 'Начисляем ' + pct + '% от суммы каждой покупки ' + (c.creditOn === 'done' ? 'после получения заказа' : 'сразу после оплаты') + '.'],
      ['Копите', 'Баланс и история — в личном кабинете. О каждом начислении сообщим.'],
      ['Оплачивайте', '1 бонус = 1 ₽. Списывайте при оформлении — хоть весь заказ.']
    ];
    var acts = u
      ? '<p class="bb-bal">На вашем счёте <b>' + bonusNum(u.bonus) + ' ' + bonusWord(u.bonus || 0) + '</b></p><a class="btn" href="#/account?tab=bonus">Мой бонусный счёт</a>'
      : '<a class="btn" href="#/account?tab=register">Присоединиться</a><a class="link" href="#/account">Уже есть аккаунт — войти</a>';
    return '<section class="section bonus-sec"><div class="wrap"><div class="bonus-band">' +
      '<div class="bb-main"><span class="eyebrow">' + esc(h.bonusEyebrow || 'Бонусная программа') + '</span><h2>' + title + '</h2>' + (h.bonusText ? '<p class="bb-text">' + esc(h.bonusText) + '</p>' : '') + '<div class="bb-acts">' + acts + '</div></div>' +
      '<div class="bb-side"><div class="bb-coin" aria-hidden="true"><span>Б</span></div><ol class="bb-steps">' + steps.map(function (s, i) { return '<li><span class="bb-n">' + (i + 1) + '</span><div><h4>' + s[0] + '</h4><p>' + s[1] + '</p></div></li>'; }).join('') + '</ol></div>' +
      '</div></div></section>';
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
    var title = st.q ? 'Поиск: ' + st.q : cat ? cat.name : st.tag === 'new' ? 'Новинки' : 'Каталог';
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
      try { history.replaceState(null, '', h); } catch (e) {}
      draw();
    }
    function draw() {
      var list = gProducts().filter(function (p) {
        var c = catById(p.categoryId);
        if (st.cat && (!c || c.slug !== st.cat)) return false;
        if (st.tag && (p.tags || []).indexOf(st.tag) === -1) return false;
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
      if (st.sort === 'new') list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      if (st.sort === 'cheap') list.sort(function (a, b) { return priceOf(a).price - priceOf(b).price; });
      if (st.sort === 'expensive') list.sort(function (a, b) { return priceOf(b).price - priceOf(a).price; });
      list.sort(function (a, b) { return (totalStock(a) === 0) - (totalStock(b) === 0); });
      $('#found').textContent = list.length + ' ' + plural(list.length, 'товар', 'товара', 'товаров');
      $('#results').innerHTML = list.length ? list.map(card).join('') : '<div class="empty" style="grid-column:1/-1"><h3>Ничего не нашлось</h3><p>Попробуйте изменить фильтры</p></div>';
      reveal($('#results'));
      // Выбранные фильтры — чипами над товарами, каждый снимается одним нажатием
      var chips = [];
      if (cat) chips.push(['cat', cat.name]);
      if (st.tag === 'new') chips.push(['tag', 'Новинки']);
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
    var colors = Pricing.colorsOf(p), notifyOn = Mail.tplOf(D.settings).enabled;
    var pr = priceOf(p), cat = catById(p.categoryId);
    var chart = D.sizeCharts.find(function (c) { return c.id === p.sizeChartId; });
    // Цвет: из адреса, иначе первый, где что-то есть в наличии
    var col = colors.find(function (c) { return c.id === q.color; }) || colors.find(function (c) { return Pricing.stockOf(c) > 0; }) || colors[0];
    var sel = null, qty = 1;
    var related = gProducts().filter(function (x) { return x.id !== p.id && x.categoryId === p.categoryId; }).concat(gProducts().filter(function (x) { return x.id !== p.id && x.categoryId !== p.categoryId; })).slice(0, 4);
    var delivPage = D.pages.find(function (x) { return x.slug === 'delivery'; });

    v.innerHTML = '<div class="wrap"><div class="page-head" style="padding-bottom:20px"><div class="crumbs"><a href="#/">Главная</a><span>/</span><a href="#/catalog">Каталог</a>' + (cat ? '<span>/</span><a href="#/catalog?cat=' + esc(cat.slug) + '">' + esc(cat.name) + '</a>' : '') + '</div></div>' +
      '<div class="product"><div id="galleryBox"></div>' +
      '<div class="pinfo"><div style="display:grid;gap:14px">' + (function () { var b = badgeHtml(p, pr); return b.length ? '<div class="badges-row">' + b.join('') + '</div>' : ''; })() + '<h1>' + esc(p.name) + '</h1>' + priceHtml(pr) +
        (Pricing.bonusFor(pr.price, D.settings) > 0 ? '<div class="p-bonus">' + bonusLine(pr.price, 'p-bonus-n') + '<span class="muted">за покупку · 1 бонус = 1 ₽. Начислим на бонусный счёт ' + (bonusCfg().creditOn === 'done' ? 'после получения заказа' : 'после оплаты') + ', потратить можно на следующие покупки — хоть все сразу' + (API.user ? '' : '. Нужен <a class="link" href="#/account">личный кабинет</a>') + '</span></div>' : '') +
        (pr.promotion ? '<span class="promo-note">Акция «' + esc(pr.promotion.title) + '»' + (pr.promotion.endsAt ? ' до ' + esc(fmtDate(pr.promotion.endsAt)) : '') + '</span>' : '') + '</div>' +
      '<div><div class="opt-head"><span>Цвет: <b class="color-name" id="colorName"></b></span>' + (colors.length > 1 ? '<span class="muted" style="font-size:13px">' + colors.length + ' ' + plural(colors.length, 'цвет', 'цвета', 'цветов') + '</span>' : '') + '</div>' +
        '<div class="swatch-row" id="colorChips" role="radiogroup" aria-label="Цвет">' + colors.map(function (c) {
          var out = Pricing.stockOf(c) === 0;
          return '<button class="swatch-btn' + (out ? ' out' : '') + '" role="radio" data-color="' + esc(c.id) + '" title="' + esc(c.name) + (out ? ' — нет в наличии' : '') + '" aria-label="' + esc(c.name) + (out ? ', нет в наличии' : '') + '"><span class="sw" style="' + swatchStyle(c) + '"></span></button>';
        }).join('') + '</div></div>' +
      '<div><div class="opt-head"><span>Размер</span>' + (chart ? '<button class="link" style="font-size:14px" id="openChart">Таблица размеров</button>' : '') + '</div>' +
        '<div class="chips" id="sizeChips"></div><p class="stock-note" id="stockNote" style="margin-top:10px"></p></div>' +
      '<div class="sticky-buy"><div class="buy-row"><div class="qty"><button data-q="-1" aria-label="Меньше">−</button><span id="qty">1</span><button data-q="1" aria-label="Больше">+</button></div><button class="btn" id="addBtn">Добавить в корзину</button></div></div>' +
      '<div class="acc">' +
        (p.description ? '<details open><summary>Описание</summary><div class="body">' + esc(p.description) + '</div></details>' : '') +
        (p.composition || p.care ? '<details><summary>Состав и уход</summary><div class="body">' + esc([p.composition, p.care].filter(Boolean).join('\n\n')) + '</div></details>' : '') +
        (delivPage ? '<details><summary>Доставка и возврат</summary><div class="body prose" style="padding:0 0 20px;font-size:14px">' + md(delivPage.body) + '</div></details>' : '') +
      '</div></div></div>' +
      (related.length ? '<section class="section" style="border-top:1px solid var(--line)"><div class="section-head"><h2>Вам может понравиться</h2></div><div class="grid">' + related.map(card).join('') + '</div></section>' : '') + '</div>';

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
      var cur = sizeOf(); if (!cur || (cur.stock <= 0 && !notifyOn)) sel = null;
      if (!sel && sizes.length === 1 && avail.length) sel = sizes[0].size;
      $('#sizeChips').innerHTML = sizes.map(function (s) {
        var out = s.stock <= 0;
        return '<button class="chip' + (out ? ' out' : '') + (sel === s.size ? ' on' : '') + '" data-size="' + esc(s.size) + '"' +
          (out ? (notifyOn ? ' title="Нет в наличии — можно подписаться на поступление" aria-label="' + esc(s.size) + ' — нет в наличии"' : ' disabled title="Нет в наличии" aria-label="' + esc(s.size) + ' — нет в наличии"') : '') + '>' + esc(s.size) + '</button>';
      }).join('');
      note();
    }
    // Кнопка: «Добавить в корзину» или «Сообщить о поступлении», если выбранного размера или всего цвета нет
    function waitMode() { var s = sizeOf(), anyAvail = (col.sizes || []).some(function (x) { return x.stock > 0; }); return notifyOn && ((s && s.stock <= 0) || !anyAvail); }
    function updateBtn() {
      var btn = $('#addBtn'), anyAvail = (col.sizes || []).some(function (x) { return x.stock > 0; }), wait = waitMode();
      btn.disabled = !anyAvail && !notifyOn;
      btn.classList.toggle('ghost', wait);
      btn.textContent = wait ? 'Сообщить о поступлении' : anyAvail ? 'Добавить в корзину' : 'Нет в наличии в этом цвете';
      $('.buy-row .qty').hidden = wait;
    }
    function note() {
      var n = $('#stockNote'), s = sizeOf(), anyAvail = (col.sizes || []).some(function (x) { return x.stock > 0; });
      n.className = 'stock-note'; updateBtn();
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
      try { history.replaceState(null, '', '#/product/' + p.slug + '?color=' + encodeURIComponent(col.id)); } catch (ex) {}
    });
    $('#sizeChips').addEventListener('click', function (e) { var b = e.target.closest('[data-size]'); if (!b || b.disabled) return; sel = b.getAttribute('data-size'); $$('#sizeChips .chip').forEach(function (c) { c.classList.toggle('on', c === b); }); note(); });
    $$('[data-q]').forEach(function (b) { b.addEventListener('click', function () { var s = sizeOf(); var max = s ? s.stock : 99; qty = Math.max(1, Math.min(max, qty + Number(b.getAttribute('data-q')))); $('#qty').textContent = qty; }); });
    $('#addBtn').addEventListener('click', function () {
      if (waitMode()) { openNotify(p, col, sel); return; }
      if (!sel) { var n = $('#stockNote'); n.textContent = 'Сначала выберите размер'; n.className = 'stock-note low'; return; }
      var s = sizeOf(), inCart = (Cart.find(p.id, col.id, sel) || { qty: 0 }).qty;
      if (inCart + qty > s.stock) { toast('В наличии только ' + s.stock + ' шт. этого размера в цвете «' + col.name + '»', true); return; }
      Cart.add(p.id, col.id, sel, qty);
      var ab = $('#addBtn'); ab.classList.add('done'); ab.textContent = 'Добавлено';
      setTimeout(function () { if (document.body.contains(ab)) { ab.classList.remove('done'); ab.textContent = 'Добавить в корзину'; } }, 1600);
      openCart();
    });
    var oc = $('#openChart'); if (oc) oc.addEventListener('click', function () { openModal('<h3 class="serif" style="font-size:34px;margin-bottom:6px">Таблица размеров</h3><p class="muted" style="margin-bottom:22px">' + esc(chart.name) + '</p>' + chartTable(chart) + (chart.note ? '<p class="muted" style="margin-top:16px;font-size:14px">' + esc(chart.note) + '</p>' : '') + measureHtml()); });
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
        '<p class="form-error" id="nfErr"></p><button class="btn block" id="nfBtn">Сообщить мне</button>' +
        '<p class="muted" style="font-size:13px;line-height:1.5">Нажимая кнопку, вы соглашаетесь на обработку адреса почты для этого уведомления согласно политике конфиденциальности.</p></form></div>');
    var f = $('#nfForm'), e = $('#nf-email'); if (!e.value) setTimeout(function () { e.focus(); }, 60);
    e.addEventListener('input', function () { e.classList.remove('invalid'); $('#nfErr').textContent = ''; });
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var chosen = $('#nf-size') ? $('#nf-size').value : pre, email = e.value.trim();
      if (!validEmail(email)) { e.classList.add('invalid'); $('#nfErr').textContent = 'Проверьте электронную почту'; return; }
      var btn = $('#nfBtn'); btn.disabled = true; btn.textContent = 'Отправляем…';
      try {
        var r = await API.subscribe({ productId: p.id, colorId: col.id, size: chosen, email: email });
        $('#modalBody').innerHTML = '<div class="notify notify-done"><span class="notify-check" aria-hidden="true"></span><h3 class="serif">' + (r.already ? 'Вы уже в списке' : 'Готово, ждите письма') + '</h3>' +
          '<p class="muted">' + (r.already ? 'Заявка на этот товар уже оставлена.' : 'Мы сохранили вашу заявку.') + ' Как только «' + esc(p.name) + '» в цвете «' + esc(col.name) + '»' + (chosen ? ', размер ' + esc(chosen) + ',' : '') + ' появится в наличии, придёт письмо на <b>' + esc(email) + '</b>.</p>' +
          '<button class="btn ghost" data-act="close">Хорошо</button></div>';
      } catch (ex) { $('#nfErr').textContent = errMsg(ex); btn.disabled = false; btn.textContent = 'Сообщить мне'; }
    });
  }
  function swatchStyle(c) { return c.hex ? 'background:' + esc(c.hex) : 'background:var(--surface-2)'; }
  function chartTable(c) {
    return '<div class="table-wrap"><table class="sizes"><thead><tr>' + (c.columns || []).map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (c.rows || []).map(function (r) { return '<tr>' + (c.columns || []).map(function (x, i) { return '<td>' + esc(r[i] || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
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
  function lineHtml(l) {
    return '<div class="cart-line"><a class="ph" href="#/product/' + esc(l.slug) + '?color=' + esc(l.colorId) + '"><img src="' + esc(l.image || Art.make(l.art)) + '" alt=""></a>' +
      '<div class="info"><a href="#/product/' + esc(l.slug) + '?color=' + esc(l.colorId) + '">' + esc(l.name) + '</a><span class="sub">' + (l.color ? 'Цвет: ' + esc(l.color) + ' · ' : '') + 'Размер: ' + esc(l.size) + '</span>' + priceHtml(l) + (l.problem ? '<span class="problem">' + esc(l.problem) + '</span>' : '') + '</div>' +
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
  async function cartQuote(code, deliveryId, contact, useBonus) {
    var lines = Cart.get(), q = await API.quote(lines, code, deliveryId, contact, useBonus);
    var keep = lines.filter(function (l) { return q.lines.some(function (x) { return x.productId === l.productId && x.size === l.size && (!l.colorId || x.colorId === l.colorId); }); });
    if (keep.length !== lines.length) { Cart.set(keep); toast('Некоторых товаров больше нет в продаже — мы убрали их из корзины', true); }
    return q;
  }
  function earnRow(q) { return q.bonusEarn > 0 ? '<div class="sum-row bonus-earn"><span><i class="b-ic" aria-hidden="true">Б</i>' + (API.user ? 'Начислим за заказ' : 'Бонусы за заказ') + '</span><span>+' + bonusNum(q.bonusEarn) + ' ' + bonusWord(q.bonusEarn) + '</span></div>' : ''; }
  async function renderCartDrawer() {
    var body = $('#cartBody'), foot = $('#cartFoot'); if (!body) return;
    var q = await cartQuote();
    if (!q.lines.length) { body.innerHTML = '<div class="empty"><h3>Корзина пуста</h3><p>Загляните в каталог — там много спокойных вещей.</p><a class="btn ghost" href="#/catalog">В каталог</a></div>'; foot.hidden = true; return; }
    foot.hidden = false;
    body.innerHTML = q.lines.map(lineHtml).join('');
    foot.innerHTML = (q.saleDiscount ? '<div class="sum-row disc"><span>Скидка</span><span>−' + fmt(q.saleDiscount) + '</span></div>' : '') +
      '<div class="sum-row total"><span>Итого</span><span>' + fmt(q.subtotal) + '</span></div>' + earnRow(q) + '<p class="muted" style="font-size:13px">' + (API.user && API.user.bonus && q.bonus.enabled ? 'Доставка, промокод и оплата бонусами — на следующем шаге' : 'Доставка и промокод — на следующем шаге') + '</p>' +
      '<a class="btn block" href="#/checkout">Оформить заказ</a><a class="btn ghost block" href="#/cart">Перейти в корзину</a>';
  }
  function openCart() { renderCartDrawer(); openPanel('cartDrawer'); }

  function cartPage(v) {
    v.innerHTML = '<div class="wrap"><div class="page-head"><h1>Корзина</h1></div><div class="checkout"><div id="cpLines"></div><aside class="summary" id="cpSum"></aside></div></div>';
    var draw = async function () {
      var q = await cartQuote();
      if (!q.lines.length) { $('#cpLines').innerHTML = '<div class="empty"><h3>Корзина пуста</h3><p>Загляните в каталог — там много спокойных вещей.</p><a class="btn ghost" href="#/catalog">В каталог</a></div>'; $('#cpSum').hidden = true; $('#cpLines').parentNode.classList.add('is-empty'); return; }
      $('#cpSum').hidden = false;
      $('#cpLines').innerHTML = q.lines.map(lineHtml).join('');
      $('#cpSum').innerHTML = '<div class="sum-row"><span>' + q.count + ' ' + plural(q.count, 'товар', 'товара', 'товаров') + '</span><span>' + fmt(q.baseTotal) + '</span></div>' +
        (q.saleDiscount ? '<div class="sum-row disc"><span>Скидка по акциям</span><span>−' + fmt(q.saleDiscount) + '</span></div>' : '') +
        '<div class="sum-row total"><span>Итого</span><span>' + fmt(q.subtotal) + '</span></div>' + earnRow(q) +
        (API.user && API.user.bonus && q.bonus.enabled ? '<p class="muted" style="font-size:13px">На бонусном счёте ' + bonusNum(API.user.bonus) + ' ' + bonusWord(API.user.bonus) + ' — спишете при оформлении</p>' : '') + '<a class="btn block" href="#/checkout">Оформить заказ</a>';
    };
    cartPageDraw = draw; draw();
  }
  var cartPageDraw = null;

  /* ---------- Оформление заказа ---------- */
  function checkout(v) {
    if (!Cart.get().length) { v.innerHTML = '<div class="wrap"><div class="empty"><h3>Корзина пуста</h3><a class="btn ghost" href="#/catalog">В каталог</a></div></div>'; return; }
    var s = D.settings, u = API.user || {}, methods = (s.delivery && s.delivery.methods) || [], pay = Object.assign({}, s.payment || {});
    if (API.mode === 'server' && !D.payReady) pay.online = false; // ЮKassa ещё не подключена — онлайн-оплату не предлагаем
    var st = { deliveryId: methods[0] && methods[0].id, payment: pay.online ? 'online' : 'cod', code: '', useBonus: false };
    v.innerHTML = '<div class="wrap"><div class="page-head"><div class="crumbs"><a href="#/cart">Корзина</a><span>/</span><span>Оформление</span></div><h1>Оформление заказа</h1></div>' +
      '<form class="checkout" id="coForm" novalidate><div>' +
      (!API.user ? '<div class="demo-note" style="margin-bottom:32px"><a class="link" href="#/account?back=checkout">Войдите</a> или зарегистрируйтесь, чтобы копить бонусы, видеть историю заказов и пользоваться промокодами для постоянных покупателей. Можно оформить и без регистрации.</div>' : '') +
      '<div class="step"><h3>Покупатель</h3><div class="row2">' +
        '<label class="field"><span>Имя</span><input class="input" id="co-first" autocomplete="given-name" value="' + esc(u.firstName || '') + '"></label>' +
        '<label class="field"><span>Фамилия</span><input class="input" id="co-last" autocomplete="family-name" value="' + esc(u.lastName || '') + '"></label>' +
        '<label class="field"><span>Телефон</span><input class="input" id="co-phone" type="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" value="' + esc(fmtPhone(u.phone)) + '"></label>' +
        '<label class="field"><span>Электронная почта</span><input class="input" id="co-email" type="email" autocomplete="email" value="' + esc(u.email || '') + '"></label></div></div>' +
      '<div class="step"><h3>Доставка</h3><div class="options" id="delivOpts"></div><div class="row2" id="addrBox">' +
        '<label class="field"><span>Город</span><input class="input" id="co-city" autocomplete="address-level2"></label>' +
        '<label class="field"><span>Адрес или пункт выдачи</span><input class="input" id="co-addr" autocomplete="street-address"></label></div>' +
        '<label class="field"><span>Комментарий к заказу</span><textarea class="textarea" id="co-comment" rows="2"></textarea></label></div>' +
      '<div class="step" style="border:0"><h3>Оплата</h3><div class="options" id="payOpts">' +
        (pay.online ? '<label class="option"><input type="radio" name="pay" value="online"><span><b>' + esc(pay.onlineLabel || 'Онлайн') + '</b><small>Чек придёт на электронную почту</small></span><span></span></label>' : '') +
        (!pay.online && !pay.cod ? '<p class="demo-note">Оформление заказов временно недоступно — свяжитесь с нами по телефону из раздела «Контакты».</p>' : '') +
        (pay.cod ? '<label class="option"><input type="radio" name="pay" value="cod"><span><b>' + esc(pay.codLabel || 'При получении') + '</b><small>Картой или наличными курьеру и в пункте выдачи</small></span><span></span></label>' : '') + '</div>' +
        '<p class="demo-note bonus-paid" id="bonusPaid" hidden>Заказ полностью оплачен бонусами — платить ничего не нужно.</p>' +
        (API.mode === 'local' ? '<p class="demo-note" style="margin-top:16px">Демо-режим: деньги не списываются. Онлайн-оплата через ЮKassa и чеки онлайн-кассы работают, когда сайт запущен на сервере.</p>' : '') + '</div>' +
      '</div><aside class="summary"><h3 class="serif" style="font-size:28px">Ваш заказ</h3><div id="coSum"></div>' +
        '<div class="promo-form"><input class="input" id="co-code" placeholder="Промокод" autocomplete="off" aria-label="Промокод"><button type="button" class="btn ghost" id="applyCode">Применить</button></div><div class="promo-msg" id="promoMsg"></div>' +
        '<div id="coBonus"></div><div id="coTotals" style="display:grid;gap:10px"></div>' +
        '<label class="check"><input type="checkbox" id="co-agree"> <span>Согласен с <a href="#/page/offer" data-page-modal="offer">офертой</a> и даю согласие на обработку персональных данных по <a href="#/page/privacy" data-page-modal="privacy">политике конфиденциальности</a></span></label>' +
        '<p class="form-error" id="coErr"></p><button class="btn block" id="coSubmit" type="submit">Подтвердить заказ</button></aside></form></div>';
    phoneMask($('#co-phone'));

    function drawOpts() {
      $('#delivOpts').innerHTML = methods.map(function (m) { return '<label class="option' + (st.deliveryId === m.id ? ' on' : '') + '"><input type="radio" name="deliv" value="' + esc(m.id) + '"' + (st.deliveryId === m.id ? ' checked' : '') + '><span><b>' + esc(m.name) + '</b><small>' + esc(m.desc || '') + (m.freeFrom ? ' · бесплатно от ' + fmt(m.freeFrom) : '') + '</small></span><span class="num" data-dp="' + esc(m.id) + '"></span></label>'; }).join('');
      $$('#payOpts .option').forEach(function (o) { var i = $('input', o); i.checked = i.value === st.payment; o.classList.toggle('on', i.checked); });
      var m = methods.find(function (x) { return x.id === st.deliveryId; });
      $('#addrBox').hidden = !(m && m.needsAddress !== false);
    }
    async function drawSum() {
      var contact = { email: $('#co-email').value, phone: $('#co-phone').value };
      var q = await cartQuote(st.code, st.deliveryId, contact, st.useBonus);
      $('#coSum').innerHTML = '<div class="mini-lines">' + q.lines.map(function (l) { return '<div class="mini-line"><img src="' + esc(l.image || Art.make(l.art)) + '" alt=""><div><div>' + esc(l.name) + '</div><div class="sub">' + (l.color ? esc(l.color) + ' · ' : '') + esc(l.size) + ' · ' + l.qty + ' шт.' + (l.problem ? ' · <span style="color:var(--danger)">' + esc(l.problem) + '</span>' : '') + '</div></div><span class="num">' + fmt(l.total) + '</span></div>'; }).join('') + '</div>';
      methods.forEach(function (m) {
        var el = $('[data-dp="' + m.id + '"]'); if (!el) return;
        var after = q.subtotal - q.promoDiscount, free = (m.freeFrom && after >= m.freeFrom) || (q.promo && q.promo.ok && q.promo.type === 'shipping');
        el.textContent = free || !m.price ? 'Бесплатно' : fmt(m.price);
      });
      var msg = $('#promoMsg');
      if (q.promo && PROMO_REASONS[q.promo.reason]) { msg.className = 'promo-msg'; msg.innerHTML = promoPlaque(q.promo); }
      else if (q.promo) { msg.textContent = q.promo.message; msg.className = 'promo-msg ' + (q.promo.ok ? 'ok' : 'bad'); } else { msg.textContent = ''; msg.className = 'promo-msg'; }
      $('#coTotals').innerHTML = '<div class="sum-row"><span>Товары</span><span>' + fmt(q.baseTotal) + '</span></div>' +
        (q.saleDiscount ? '<div class="sum-row disc"><span>Скидка по акциям</span><span>−' + fmt(q.saleDiscount) + '</span></div>' : '') +
        (q.promoDiscount ? '<div class="sum-row disc"><span>Промокод ' + esc(q.promo.code) + '</span><span>−' + fmt(q.promoDiscount) + '</span></div>' : '') +
        '<div class="sum-row"><span>Доставка</span><span>' + (q.delivery ? (q.deliveryPrice ? fmt(q.deliveryPrice) : 'Бесплатно') : '—') + '</span></div>' +
        (q.bonusUsed ? '<div class="sum-row disc"><span>Оплата бонусами</span><span>−' + fmt(q.bonusUsed) + '</span></div>' : '') +
        '<div class="sum-row total"><span>К оплате</span><span>' + fmt(q.total) + '</span></div>' + earnRow(q);
      // Бонусный счёт: переключатель «списать», либо подсказка гостю
      var bal = q.bonus.balance, box = $('#coBonus');
      if (q.bonus.enabled && API.user && bal > 0) {
        box.innerHTML = '<label class="bonus-use' + (st.useBonus ? ' on' : '') + '"><input type="checkbox" id="co-bonus"' + (st.useBonus ? ' checked' : '') + '><span class="bu-switch" aria-hidden="true"></span>' +
          '<span class="bu-text"><b>Списать бонусы</b><small>' + (st.useBonus ? 'Спишем ' + bonusNum(q.bonusUsed) + ' ' + bonusWord(q.bonusUsed) + (bal > q.bonusUsed ? ', останется ' + bonusNum(bal - q.bonusUsed) : '') : 'На счёте ' + bonusNum(bal) + ' ' + bonusWord(bal) + ' · 1 бонус = 1 ₽') + '</small></span><span class="bu-sum num">' + (st.useBonus ? '−' + fmt(q.bonusUsed) : '') + '</span></label>';
      } else if (q.bonus.enabled && !API.user && q.bonusEarn > 0) {
        box.innerHTML = '<p class="bonus-guest"><i class="b-ic" aria-hidden="true">Б</i><span><a class="link" href="#/account?back=checkout">Войдите</a> — и получите +' + bonusNum(q.bonusEarn) + ' ' + bonusWord(q.bonusEarn) + ' за этот заказ</span></p>';
      } else box.innerHTML = '';
      var free = q.lines.length && q.total === 0;
      $('#bonusPaid').hidden = !free; $('#payOpts').hidden = free;
      return q;
    }
    drawOpts(); drawSum();
    $('#delivOpts').addEventListener('change', function (e) { st.deliveryId = e.target.value; drawOpts(); drawSum(); });
    $('#coBonus').addEventListener('change', function (e) { if (e.target.id === 'co-bonus') { st.useBonus = e.target.checked; drawSum(); } });
    $('#payOpts').addEventListener('change', function (e) { st.payment = e.target.value; drawOpts(); });
    $('#applyCode').addEventListener('click', function () { st.code = $('#co-code').value.trim(); drawSum(); });
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
      if (needAddr) [['co-city'], ['co-addr']].forEach(function (x) { var el = $('#' + x[0]); el.classList.toggle('invalid', !el.value.trim()); if (!el.value.trim()) bad.push(1); });
      var err = $('#coErr');
      if (bad.length) { err.textContent = 'Заполните выделенные поля'; return; }
      if (!$('#co-agree').checked) { err.textContent = 'Подтвердите согласие с офертой и обработкой данных'; return; }
      err.textContent = '';
      var btn = $('#coSubmit'); btn.disabled = true; btn.textContent = 'Оформляем…';
      try {
        var r = await API.placeOrder({ lines: Cart.get(), code: st.code, deliveryId: st.deliveryId, payment: st.payment, useBonus: st.useBonus, customer: f, city: needAddr ? $('#co-city').value.trim() : '', address: needAddr ? $('#co-addr').value.trim() : '', comment: $('#co-comment').value.trim() });
        Cart.clear();
        if (r.payUrl) { location.href = r.payUrl; return; }
        go('#/order/' + r.order.id);
      } catch (ex) { err.textContent = errMsg(ex); btn.disabled = false; btn.textContent = 'Подтвердить заказ'; drawSum(); }
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
  async function orderPage(v, parts) {
    v.innerHTML = '<div class="loader">…</div>';
    try {
      var o = await API.getOrder(parts[1]);
      var payLabel = o.payment.method === 'bonus' ? 'Оплачен бонусами' : o.payment.method === 'online' ? PAY[o.payment.status] : 'Оплата при получении';
      v.innerHTML = '<div class="wrap"><div class="success"><span class="eyebrow">Заказ № ' + esc(o.number) + '</span><h1>Спасибо за заказ</h1>' +
        '<p class="muted" style="max-width:46ch">' + (API.mode === 'server' && D.mailReady ? 'Подтверждение придёт на ' + esc(o.customer.email) + (o.payment.method === 'online' && o.payment.status !== 'paid' ? ' после оплаты' : '') + '. ' : '') + 'Мы свяжемся по телефону ' + esc(fmtPhone(o.customer.phone)) + ', чтобы согласовать доставку.</p>' +
        '<div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center"><span class="status ' + esc(o.status) + '">' + esc(STATUS[o.status] || o.status) + '</span><span class="status ' + esc(o.payment.status) + '">' + esc(payLabel) + '</span></div>' +
        '<div class="order-card" style="width:100%;text-align:left">' + o.items.map(function (i) { return '<div class="mini-line"><img src="' + esc(i.image || Art.make(i.art)) + '" alt=""><div><div>' + esc(i.name) + '</div><div class="sub">' + (i.color ? esc(i.color) + ' · ' : '') + esc(i.size) + ' · ' + i.qty + ' шт.</div></div><span class="num">' + fmt(i.price * i.qty) + '</span></div>'; }).join('') +
          (o.promoDiscount ? '<div class="sum-row disc"><span>Промокод ' + esc(o.promoCode) + '</span><span>−' + fmt(o.promoDiscount) + '</span></div>' : '') +
          '<div class="sum-row"><span>' + esc(o.delivery && o.delivery.name || 'Доставка') + '</span><span>' + (o.delivery && o.delivery.price ? fmt(o.delivery.price) : 'Бесплатно') + '</span></div>' +
          (o.bonusUsed ? '<div class="sum-row disc"><span>Оплачено бонусами</span><span>−' + fmt(o.bonusUsed) + '</span></div>' : '') +
          '<div class="sum-row total"><span>Итого</span><span>' + fmt(o.total) + '</span></div>' +
          (o.bonusEarn > 0 && o.status !== 'canceled' ? '<div class="sum-row bonus-earn"><span><i class="b-ic" aria-hidden="true">Б</i>' + (o.bonusCredited ? 'Начислено бонусов' : 'Начислим ' + (bonusCfg().creditOn === 'done' ? 'после получения' : 'после оплаты')) + '</span><span>+' + bonusNum(o.bonusEarn) + '</span></div>' : '') + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' + (o.payUrl && o.payment.status === 'pending' ? '<a class="btn" href="' + esc(o.payUrl) + '">Оплатить заказ</a>' : '') + '<a class="btn ghost" href="#/catalog">Продолжить покупки</a>' + (API.user ? '<a class="btn ghost" href="#/account">Мои заказы</a>' : '') + '</div></div></div>';
      if (API.user) refreshBonus(); // после оплаты бонусы могли прийти — обновим счёт и покажем уведомление
    } catch (e) { v.innerHTML = '<div class="wrap"><div class="empty"><h3>Заказ не найден</h3><p>' + esc(errMsg(e)) + '</p><a class="btn ghost" href="#/">На главную</a></div></div>'; }
  }

  /* ---------- Личный кабинет ---------- */
  function account(v, parts, q) {
    if (!API.user) return authPage(v, q.tab === 'register' ? 'register' : 'login', q.back);
    var tab = q.tab || 'orders', u = API.user, bOn = bonusCfg().enabled || (u.bonus || 0) > 0;
    if (tab === 'bonus' && !bOn) tab = 'orders';
    var tabBtn = function (k, label) { return '<button data-tab="' + k + '"' + (tab === k ? ' class="on"' : '') + '>' + label + '</button>'; };
    v.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Личный кабинет</span><h1>' + esc(u.firstName) + ' ' + esc(u.lastName) + '</h1></div>' +
      (bOn ? '<div id="bonusCard">' + bonusCardHtml(u) + '</div>' : '') + '<div class="account"><nav>' +
      tabBtn('orders', 'Мои заказы') + (bOn ? tabBtn('bonus', 'Бонусы') : '') + tabBtn('profile', 'Личные данные') + '<button data-tab="logout">Выйти</button></nav><div id="accBody"></div></div></div>';
    if (bOn) API.myBonus().then(function (r) {
      if (!document.body.contains(v) || !$('#bonusCard')) return;
      $('#bonusCard').innerHTML = bonusCardHtml(r.user); markBonusDot();
      if (tab === 'bonus') { $('#accBody').innerHTML = bonusHistoryHtml(r.bonusLog); if (r.user.bonusNews.length) seenBonus(); }
      else showBonusNews();
    }).catch(function () {});
    $$('.account nav button').forEach(function (b) { b.addEventListener('click', async function () {
      var t = b.getAttribute('data-tab');
      if (t === 'logout') { await API.logout(); toast('Вы вышли из аккаунта'); go('#/'); return; }
      go('#/account?tab=' + t);
    }); });
    var body = $('#accBody');
    if (tab === 'bonus') body.innerHTML = '<div class="loader" style="min-height:200px;font-size:22px">…</div>';
    else if (tab === 'profile') {
      body.innerHTML = '<form class="form" id="profForm" style="max-width:560px" novalidate><div class="row2">' +
        '<label class="field"><span>Имя</span><input class="input" id="pf-first" value="' + esc(u.firstName) + '"></label>' +
        '<label class="field"><span>Фамилия</span><input class="input" id="pf-last" value="' + esc(u.lastName) + '"></label></div>' +
        '<label class="field"><span>Телефон</span><input class="input" id="pf-phone" type="tel" value="' + esc(fmtPhone(u.phone)) + '"></label>' +
        '<label class="field"><span>Электронная почта</span><input class="input" id="pf-email" type="email" value="' + esc(u.email) + '"></label>' +
        '<label class="field"><span>Новый пароль (если хотите сменить)</span><input class="input" id="pf-pass" type="password" autocomplete="new-password"></label>' +
        '<p class="form-error" id="pfErr"></p><div><button class="btn">Сохранить</button></div></form>';
      phoneMask($('#pf-phone'));
      $('#profForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        var f = { firstName: $('#pf-first').value, lastName: $('#pf-last').value, phone: $('#pf-phone').value, email: $('#pf-email').value, newPassword: $('#pf-pass').value };
        var er = !f.firstName.trim() || !f.lastName.trim() ? 'Укажите имя и фамилию' : !validPhone(f.phone) ? 'Проверьте номер телефона' : !validEmail(f.email) ? 'Проверьте электронную почту' : f.newPassword && f.newPassword.length < 6 ? 'Пароль должен быть не короче 6 символов' : '';
        if (er) { $('#pfErr').textContent = er; return; }
        try { await API.updateProfile(f); toast('Данные сохранены'); go('#/account?tab=profile'); } catch (ex) { $('#pfErr').textContent = errMsg(ex); }
      });
    } else {
      body.innerHTML = '<div class="loader" style="min-height:200px;font-size:22px">…</div>';
      API.myOrders().then(function (list) {
        body.innerHTML = list.length ? list.map(function (o) {
          return '<a class="order-card" href="#/order/' + esc(o.id) + '" style="display:grid"><div class="order-top"><b>№ ' + esc(o.number) + '</b><span class="muted" style="font-size:14px">' + esc(fmtDate(o.createdAt)) + '</span></div>' +
            '<div class="thumbs-row">' + o.items.map(function (i) { return '<img src="' + esc(i.image || Art.make(i.art)) + '" alt="">'; }).join('') + '</div>' +
            '<div class="order-top"><span class="status ' + esc(o.status) + '">' + esc(STATUS[o.status] || o.status) + '</span><span class="num">' + fmt(o.total) + '</span></div></a>';
        }).join('') : '<div class="empty" style="text-align:left;justify-items:start;padding-top:0"><h3>Заказов пока нет</h3><p>Здесь появится история покупок и статусы доставки.</p><a class="btn ghost" href="#/catalog">В каталог</a></div>';
      }).catch(function (e) { body.innerHTML = '<p class="form-error">' + esc(errMsg(e)) + '</p>'; });
    }
  }
  /* Бонусный счёт в кабинете: остаток крупно, правила одной строкой */
  function bonusCardHtml(u) {
    var c = bonusCfg(), n = u.bonus || 0;
    return '<section class="bonus-card"><div class="bc-main"><span class="eyebrow">Бонусный счёт</span><div class="bc-sum"><b class="num">' + bonusNum(n) + '</b><span>' + bonusWord(n) + '</span></div><span class="bc-rub">= ' + fmt(n) + ' на следующие покупки</span></div>' +
      '<div class="bc-side"><p>' + (c.earn ? 'Начисляем <b>' + c.percent + '%</b> от суммы покупки ' + (c.creditOn === 'done' ? 'после получения заказа' : 'после оплаты') + '.' : 'Начисление бонусов сейчас приостановлено.') + (c.enabled ? ' Оплачивайте бонусами до 100% заказа: 1 бонус = 1 ₽.' : '') + '</p>' +
      '<div class="bc-acts">' + (c.enabled && n > 0 ? '<a class="btn sm" href="#/catalog">Потратить</a>' : '<a class="btn sm" href="#/catalog">В каталог</a>') + '<a class="btn ghost sm" href="#/account?tab=bonus">История</a></div></div></section>';
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
  function markBonusDot() { var a = $('#accLink'); if (a) a.classList.toggle('has-dot', !!(API.user && API.user.bonusNews && API.user.bonusNews.length)); }
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
  function authPage(v, mode, back) {
    var backQ = back === 'checkout' ? 'back=checkout' : '';
    v.innerHTML = '<div class="wrap"><div class="page-head" style="text-align:center;justify-items:center"><span class="eyebrow">Личный кабинет</span><h1>' + (mode === 'login' ? 'Вход' : 'Регистрация') + '</h1>' + (backQ ? '<p class="muted" style="max-width:40ch">После входа вы вернётесь к оформлению заказа, а промокод подставится сам.</p>' : '') + '</div><div class="auth">' +
      '<div class="tabs"><button data-m="login"' + (mode === 'login' ? ' class="on"' : '') + '>Вход</button><button data-m="register"' + (mode === 'register' ? ' class="on"' : '') + '>Регистрация</button></div>' +
      (mode === 'login' ?
        '<form class="form" id="authForm" novalidate><label class="field"><span>Телефон или электронная почта</span><input class="input" id="lg-login" autocomplete="username"></label>' +
        '<label class="field"><span>Пароль</span><input class="input" id="lg-pass" type="password" autocomplete="current-password"></label><p class="form-error" id="authErr"></p><button class="btn block">Войти</button></form>'
      :
        '<form class="form" id="authForm" novalidate><div class="row2"><label class="field"><span>Имя</span><input class="input" id="rg-first" autocomplete="given-name"></label>' +
        '<label class="field"><span>Фамилия</span><input class="input" id="rg-last" autocomplete="family-name"></label></div>' +
        '<label class="field"><span>Номер телефона</span><input class="input" id="rg-phone" type="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__"></label>' +
        '<label class="field"><span>Электронная почта</span><input class="input" id="rg-email" type="email" autocomplete="email"></label>' +
        '<label class="field"><span>Пароль</span><input class="input" id="rg-pass" type="password" autocomplete="new-password" placeholder="Не короче 6 символов"></label>' +
        '<label class="check"><input type="checkbox" id="rg-agree"> <span>Даю согласие на обработку персональных данных в соответствии с <a href="#/page/privacy" data-page-modal="privacy">политикой конфиденциальности</a></span></label>' +
        '<p class="form-error" id="authErr"></p><button class="btn block">Зарегистрироваться</button></form>') +
      '<p class="muted" style="font-size:14px;text-align:center">' + (mode === 'login' ? 'Нет аккаунта? <button class="link" data-m="register">Зарегистрируйтесь</button>' : 'Уже есть аккаунт? <button class="link" data-m="login">Войдите</button>') + '</p></div></div>';
    $$('[data-m]', v).forEach(function (b) { b.addEventListener('click', function () { go('#/account' + (b.getAttribute('data-m') === 'register' ? '?tab=register' + (backQ ? '&' + backQ : '') : (backQ ? '?' + backQ : ''))); }); });
    if (mode === 'register') phoneMask($('#rg-phone'));
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
          await API.register(f);
          toast('Добро пожаловать, ' + API.user.firstName);
        }
        go(back === 'checkout' ? '#/checkout' : '#/account');
      } catch (ex) { err.textContent = errMsg(ex); }
    });
  }

  /* ---------- Текстовые страницы ---------- */
  function textPage(v, parts) {
    var p = D.pages.find(function (x) { return x.slug === parts[1]; });
    if (!p) return notFound(v);
    v.innerHTML = '<div class="wrap"><div class="page-head"><div class="crumbs"><a href="#/">Главная</a><span>/</span><span>' + esc(p.title) + '</span></div><h1>' + esc(p.title) + '</h1></div><article class="prose">' + md(p.body) +
      (p.slug === 'about' || p.slug === 'contacts' ? contactsBlock() : '') + '</article></div>';
  }
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
      var res = t.length < 2 ? [] : D.products.filter(onSale).filter(function (p) { return (p.name + ' ' + colorNames(p) + ' ' + (p.description || '')).toLowerCase().indexOf(t) !== -1; }).slice(0, 6);
      $('#sRes').innerHTML = res.map(function (p) { return '<a class="mini-line" href="#/product/' + esc(p.slug) + '"><img src="' + esc(imgOf(p)) + '" alt=""><div>' + esc(p.name) + '<div class="sub">' + esc(Pricing.colorsOf(p).map(function (c) { return c.name; }).join(', ')) + '</div></div><span class="num">' + fmt(priceOf(p).price) + '</span></a>'; }).join('') || (t.length >= 2 ? '<p class="muted">Ничего не нашлось</p>' : '');
    });
    $('#sForm').addEventListener('submit', function (e) { e.preventDefault(); if (i.value.trim()) go('#/catalog?q=' + encodeURIComponent(i.value.trim())); });
  }

  /* ---------- Экран выбора раздела при первом заходе ---------- */
  function gatewayCfg() { return D.settings.gateway || {}; }
  function showGateway() {
    var g = gatewayCfg(), s = D.settings;
    if ($('.gate')) return;
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
  function adminPage(v, parts, q) {
    if (window.Admin) window.Admin.render(v, parts, q);
    else v.innerHTML = '<div class="wrap"><div class="empty"><h3>Модуль администратора не загружен</h3></div></div>';
  }

  /* ---------- Обновление данных после правок в админке ---------- */
  async function refresh() {
    if (API.mode === 'local') D = API.publicState();
    else { try { var r = await fetch('api/state', { credentials: 'same-origin' }); var j = await r.json(); if (j.ok) D = j.data; } catch (e) {} }
    window.App.D = D;
    var scroll = window.scrollY; renderShell(); routeKeepScroll = true; route(); window.scrollTo(0, scroll);
  }

  /* ---------- Запуск ---------- */
  async function boot() {
    root = document.getElementById('app');
    var c;
    try { c = await Store.connect(); }
    catch (e) {
      root.innerHTML = '<div class="offline"><img src="img/logo-wordmark.png" alt="' + 'ALBAKOV' + '"><h1>Магазин временно недоступен</h1><p>Не удалось связаться с сервером. Проверьте интернет и обновите страницу — обычно это занимает минуту.</p><button class="btn" id="reloadBtn">Обновить страницу</button></div>';
      document.getElementById('reloadBtn').addEventListener('click', function () { location.reload(); });
      return;
    }
    API = c.api; D = c.data;
    intro();
    window.App = { API: API, D: D, plural: plural, slideHtml: slideHtml, slidePromo: slidePromo, slideVisible: slideVisible, hashPath: hashPath, brandHtml: brandHtml, brandMode: brandMode, esc: esc, fmt: fmt, md: md, toast: toast, errMsg: errMsg, imgOf: imgOf, refresh: refresh, go: go, openModal: openModal, closePanels: closePanels, fmtPhone: fmtPhone, fmtDate: fmtDate, STATUS: STATUS, PAY: PAY, chartTable: chartTable };
    renderShell();
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]'); if (a) {
        var act = a.getAttribute('data-act');
        if (act === 'menu') openPanel('menuDrawer');
        if (act === 'cart') openCart();
        if (act === 'search') openSearch();
        if (act === 'close') closePanels();
      }
      if (e.target.id === 'scrim' || e.target.id === 'modal') closePanels();
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
      if (pm) { var pg = D.pages.find(function (x) { return x.slug === pm.getAttribute('data-page-modal'); }); if (pg) { e.preventDefault(); openModal('<h3 class="serif" style="font-size:34px;margin-bottom:18px">' + esc(pg.title) + '</h3><div class="prose" style="padding:0;font-size:15px">' + md(pg.body) + '</div>'); return; } }
      var link = e.target.closest('a[href^="#/"]'); if (link && link.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanels(); });
    document.addEventListener('cart:change', function () { updateCartCount(); if ($('#cartDrawer.open')) renderCartDrawer(); if (cartPageDraw && parseHash().parts[0] === 'cart') cartPageDraw(); });
    bindLines(document);
    // Шапка сжимается при прокрутке, полоска показывает, сколько страницы прочитано
    var ticking = false;
    function onScroll() {
      ticking = false;
      var y = window.scrollY, h = document.documentElement.scrollHeight - innerHeight;
      var hd = $('.header'); if (hd) hd.classList.toggle('scrolled', y > 24);
      var pg = $('#hdrProgress'); if (pg) pg.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
      var tt = $('#toTop'); if (tt) tt.hidden = y < 900;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    document.addEventListener('click', function (e) { if (e.target.closest('#toTop')) window.scrollTo({ top: 0, behavior: 'smooth' }); });
    initTilt();
    window.addEventListener('hashchange', route);
    route();
    setTimeout(showBonusNews, 2300); // после заставки
    // Первый заход на главную: предложить выбрать раздел
    if (genderChoice === null && gatewayCfg().enabled !== false && !parseHash().parts[0]) showGateway();
  }
  /* Заставка при первом заходе за сеанс: логотип проявляется, линия прорисовывается, затем открывается сайт */
  function intro() {
    var seen = false; try { seen = sessionStorage.getItem('albakov:intro') === '1'; sessionStorage.setItem('albakov:intro', '1'); } catch (e) {}
    if (seen) return;
    var el = document.createElement('div'); el.className = 'intro'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = brandHtml(D.settings, 'desktop', 'brand-intro', (D.settings.brand && D.settings.brand.word && D.settings.brand.word.src) ? 'word' : 'text') + '<span class="intro-line"></span>';
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 1300);
    setTimeout(function () { el.remove(); }, 2100);
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
