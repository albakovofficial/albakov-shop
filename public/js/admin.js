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
    ['overview', 'Обзор'], ['orders', 'Заказы'], ['support', 'Поддержка'], ['products', 'Товары'], ['categories', 'Категории'], ['sizeCharts', 'Размерные сетки'],
    ['promotions', 'Акции'], ['promocodes', 'Промокоды'], ['bonus', 'Бонусы'], ['exchange', 'Обмен и возвраты'], ['customers', 'Покупатели'], ['notify', 'Сообщить о поступлении'], ['mail', 'Письма'], ['alerts', 'Уведомления на почту'], ['analytics', 'Аналитика'], ['gifts', 'Подарочные сертификаты'], ['sections', 'Разделы: женщинам / мужчинам'], ['brand', 'Логотип и название'], ['slider', 'Слайдер на главной'], ['home', 'Главная страница'], ['pages', 'Страницы'],
    ['menu', 'Меню, контакты, соцсети'], ['payment', 'Оплата и доставка'], ['settings', 'Настройки']
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
    var s = q.s || 'overview';
    v.innerHTML = '<div class="adm"><aside class="adm-side"><div class="adm-brand"><span class="eyebrow">Управление</span><b class="serif">' + esc(A().D.settings.storeName) + '</b></div><nav>' +
      SECTIONS.map(function (x) { return '<a href="#/admin?s=' + x[0] + '"' + (x[0] === s ? ' class="on"' : '') + '>' + x[1] + (x[0] === 'orders' ? newOrdersBadge() : '') + (x[0] === 'support' && DATA.supportNew ? ' <span class="adm-badge">' + DATA.supportNew + '</span>' : '') + (x[0] === 'notify' ? waitBadge() : '') + (x[0] === 'exchange' ? reqBadge() : '') + '</a>'; }).join('') +
      '</nav><div class="adm-side-foot"><a href="#/" class="muted">← В магазин</a><button class="muted" id="admOut">Выйти</button></div></aside><section class="adm-main" id="admMain"></section></div>';
    $('#admOut').addEventListener('click', async function () { await API.adminLogout(); DATA = null; window.ALB_NAV.go('#/'); await A().refresh(); });
    var main = $('#admMain');
    var fn = { overview: overview, orders: orders, support: supportSection, products: products, categories: categories, sizeCharts: sizeCharts, promotions: promotions, promocodes: promocodes, bonus: bonusSection, exchange: exchangeSection, customers: customers, notify: notifySection, mail: mailSection, alerts: alertsSection, analytics: analyticsSection, gifts: giftsSection, sections: sectionsSettings, brand: brandSection, slider: sliderSection, home: homeSettings, pages: pages, menu: menuSettings, payment: paymentSettings, settings: generalSettings }[s] || overview;
    fn(main, q);
  }
  function waitBadge() { var n = (DATA.waitlist || []).filter(function (w) { return w.status === 'waiting' || w.status === 'failed'; }).length; return n ? ' <span class="adm-badge muted-badge">' + n + '</span>' : ''; }
  function newOrdersBadge() { var n = DATA.orders.filter(function (o) { return o.status === 'new'; }).length; return n ? ' <span class="adm-badge">' + n + '</span>' : ''; }
  /* ================= Письма: все письма сайта с примером ================= */
  async function mailSection(m) {
    m.innerHTML = head('Письма', '', 'Все письма, которые сайт отправляет сам. Покупателям они приходят с адреса для отправки и с пометкой «отвечать не нужно» — написать вам можно на почту для связи.') + '<div class="loader">…</div>';
    var r; try { r = await A().API.adminMailCatalog(); } catch (e) { m.querySelector('.loader').outerHTML = '<p class="form-error">' + esc(A().errMsg(e)) + '</p>'; return; }
    var mi = r.mail;
    m.innerHTML = head('Письма', '', 'Все письма, которые сайт отправляет сам. Покупателям они приходят с адреса для отправки и с пометкой «отвечать не нужно» — написать вам можно на почту для связи.') +
      '<div class="ml-top">' +
        '<div class="ml-a"><span>Отправитель</span><b>' + esc(mi.fromName || '') + ' &lt;' + esc(mi.from || '—') + '&gt;</b><small class="' + (mi.ready ? 'ok' : 'warn') + '">' + (mi.ready ? 'Почта настроена, письма уходят' : 'Не настроена — письма не отправляются') + '</small></div>' +
        '<div class="ml-a"><span>Пишут вам и получают ответ</span><b>' + esc(mi.support || mi.replyTo || '—') + '</b><small>Указан в письмах; меняется в «Меню, контакты, соцсети»</small></div>' +
        '<div class="ml-a"><span>Если покупатель всё же ответит</span><b>' + esc(mi.replyTo || '—') + '</b><small>Ответ уйдёт сюда (Reply-To). <a class="link" href="#/admin?s=notify&tab=mail">Настройки почты</a></small></div>' +
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

  function loginView(v) {
    v.innerHTML = '<div class="wrap"><div class="auth" style="padding-top:72px"><div class="adm-login-head" style="text-align:center;display:grid;gap:12px;justify-items:center"><span class="eyebrow">Панель управления</span><h1 class="serif" style="font-size:52px">Вход</h1></div>' +
      '<form class="form" id="admLogin" novalidate><label class="field"><span>Пароль администратора</span><input class="input" type="password" id="adm-pass" autocomplete="current-password"></label><p class="form-error" id="admErr"></p><button class="btn block">Войти</button></form>' + '</div></div>';
    $('#admLogin').addEventListener('submit', async function (e) {
      e.preventDefault();
      try { await A().API.adminLogin($('#adm-pass').value); DATA = null; window.ALB_NAV.go('#/admin?s=overview'); await A().refresh(); }
      catch (ex) { $('#admErr').textContent = A().errMsg(ex); }
    });
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
      (legalBad ? '<div class="adm-alert"><b>Укажите реквизиты продавца.</b> Они подставляются в публичную оферту, политику обработки персональных данных и согласие. Сейчас там: «' + esc(legal || 'пусто') + '». <a class="link" href="#/admin?s=settings">Открыть настройки</a></div>' : '') +
      '<div class="adm-stats">' +
        stat('Новые заказы', newN, '#/admin?s=orders&f=new') + stat('Заказов сегодня', todayN, '#/admin?s=orders') + stat('Выручка, всего', fmt(revenue), '#/admin?s=orders') + stat('Покупателей', DATA.users.length, '#/admin?s=customers') +
        stat('Товаров в продаже', DATA.products.filter(function (p) { return p.active !== false; }).length, '#/admin?s=products') + stat('Активных акций', promosActive, '#/admin?s=promotions') + stat('Активных промокодов', codesActive, '#/admin?s=promocodes') +
      '</div>' +
      (function () { var t = sumDays(statDays(7)); return '<a class="adm-card an-mini" href="#/admin?s=analytics"><div><span class="adm-h3">Посетители за 7 дней</span><b class="num">' + t.v.toLocaleString('ru-RU') + '</b></div><div><span class="adm-h3">Конверсия в заказ</span><b>' + pct(t.o, t.v) + '</b></div><div class="an-mini-f">' + funnelHtml(t) + '</div><span class="an-more">Подробнее →</span></a>'; })() +
      '<div class="adm-two"><div class="adm-card"><h3 class="adm-h3">Последние заказы</h3>' + (o.length ? ordersTable(o.slice().reverse().slice(0, 6)) : '<p class="muted">Заказов пока нет.</p>') + '</div>' +
      '<div class="adm-card"><h3 class="adm-h3">Заканчиваются</h3>' + (low.length ? '<div class="adm-list">' + low.slice(0, 10).map(function (x) { return '<a href="#/admin?s=products&id=' + esc(x.p.id) + '" class="adm-li"><span>' + esc(x.p.name) + ' <span class="muted">· ' + esc(x.c.name) + ' · ' + esc(x.s.size) + '</span></span><span class="num ' + (x.s.stock ? 'warn' : 'bad') + '">' + x.s.stock + ' шт.</span></a>'; }).join('') + '</div>' : '<p class="muted">Все размеры в наличии.</p>') + '</div></div>';
  }
  function stat(label, val, href) { return '<a class="adm-stat" href="' + href + '"><span class="eyebrow">' + esc(label) + '</span><b class="num">' + esc(val) + '</b></a>'; }

  /* ================= Заказы ================= */
  function ordersTable(list) {
    return '<div class="table-wrap adm-table"><table class="sizes"><thead><tr><th>№</th><th>Дата</th><th>Покупатель</th><th>Сумма</th><th>Оплата</th><th>Статус</th></tr></thead><tbody>' +
      list.map(function (o) {
        var ret = o.status === 'returned';
        return '<tr data-href="#/admin?s=orders&id=' + esc(o.id) + '"' + (ret ? ' class="row-returned"' : '') + '><td>' + esc(o.number) + (o.refunds && o.refunds.length ? '<span class="rf-tag">' + (ret ? 'Возврат' : 'Частичный возврат') + '</span>' : '') + '</td><td>' + esc(new Date(o.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })) + '</td><td>' + esc(o.customer.firstName + ' ' + o.customer.lastName) + '</td><td class="num">' + (o.refunded ? '<s class="muted">' + fmt(o.total) + '</s><br><span class="rf-back">−' + fmt(o.refunded) + '</span>' : fmt(o.total)) + '</td>' +
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
      if (f === 'refund' ? !(o.refunds && o.refunds.length) : f !== 'all' && o.status !== f) return false;
      if (search) { var t = [o.number, o.customer.firstName, o.customer.lastName, o.customer.email, o.customer.phone, A().fmtPhone(o.customer.phone), o.payment.providerId || ''].join(' ').toLowerCase(); if (t.indexOf(search) === -1) return false; }
      return true;
    });
    // Фильтр по статусу: число заказов крупно, подпись под ним, цветная точка статуса
    var F = [['all', 'Все заказы'], ['new', 'Новые'], ['processing', 'Собираются'], ['shipped', 'В доставке'], ['done', 'Выполнены'], ['canceled', 'Отменены'], ['refund', 'Возвраты']];
    var cnt = function (k) { return k === 'all' ? DATA.orders.length : k === 'refund' ? DATA.orders.filter(function (o) { return o.refunds && o.refunds.length; }).length : DATA.orders.filter(function (o) { return o.status === k; }).length; };
    var tabs = '<nav class="ost" aria-label="Статус заказов">' + F.map(function (x) {
      var n = cnt(x[0]);
      return '<a class="ost-i s-' + x[0] + (f === x[0] ? ' on' : '') + (n ? '' : ' zero') + '" href="#/admin?s=orders&f=' + x[0] + (q.q ? '&q=' + encodeURIComponent(q.q) : '') + '"' + (f === x[0] ? ' aria-current="page"' : '') + '>' +
        '<b class="num">' + n + '</b><span>' + (x[0] === 'all' ? '' : '<i aria-hidden="true"></i>') + x[1] + '</span></a>';
    }).join('') + '</nav>';
    var test = DATA.testOrders ? '<div class="ost-test"><span>Тестовые заказы скрыты и не считаются: ' + DATA.testOrders + '</span><button class="link" type="button" id="delTest">Удалить их</button></div>' : '';
    var emptyTxt = f === 'all' && !search ? ['Заказов пока нет', 'Они появятся здесь сразу после оформления на сайте.'] : ['Ничего не нашлось', search ? 'Проверьте номер заказа, имя, телефон, почту или номер платежа ЮKassa.' : 'В этом статусе заказов нет.'];
    m.innerHTML = head('Заказы', '<input class="input" id="oSearch" type="search" placeholder="Номер, имя, телефон, почта" value="' + esc(q.q || '') + '" style="min-height:42px;width:280px" aria-label="Поиск заказа">') +
      tabs + test +
      (list.length ? ordersTable(list) : '<div class="empty"><h3>' + emptyTxt[0] + '</h3><p>' + emptyTxt[1] + '</p></div>');
    if ($('#delTest')) bindConfirm($('#delTest'), async function () {
      try { var r = await A().API.adminOrderDelete('test'); await afterSave('Удалено тестовых заказов: ' + r.deleted, '#/admin?s=orders'); } catch (e) { toast(A().errMsg(e), true); }
    });
    var si = $('#oSearch'); si.addEventListener('change', function () { window.ALB_NAV.go('#/admin?s=orders&f=' + f + '&q=' + encodeURIComponent(si.value)); });
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
        o.items.map(function (i) { return '<div class="mini-line"><img src="' + esc(i.image || Art.make(i.art)) + '" alt=""><div>' + esc(i.name) + '<div class="sub">' + (i.color ? 'Цвет ' + esc(i.color) + ' · ' : '') + 'Размер ' + esc(i.size) + ' · ' + i.qty + ' шт. × ' + fmt(i.price) + (i.refundedQty ? ' · <span class="rf-back">возвращено ' + i.refundedQty + ' шт.</span>' : '') + '</div></div><span class="num">' + fmt(i.price * i.qty) + '</span></div>'; }).join('') +
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
    m.innerHTML = head(cfg.title, (cfg.searchable ? '<input class="input" id="cSearch" placeholder="Поиск" value="' + esc(q.q || '') + '" style="min-height:40px;width:200px">' : '') + '<a class="btn sm" href="#/admin?s=' + cfg.key + '&id=new">+ ' + esc(cfg.addLabel) + '</a>', cfg.sub) +
      (list.length ? '<div class="table-wrap adm-table"><table class="sizes' + (cfg.bulk ? ' adm-bulk-table' : '') + '"><thead><tr>' +
        (cfg.bulk ? '<th class="adm-pick-cell"><label class="check adm-pick" title="Выбрать все"><input type="checkbox" id="pickAll" aria-label="Выбрать все"></label></th>' : '') +
        cfg.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        list.map(function (x) { return '<tr data-href="#/admin?s=' + cfg.key + '&id=' + esc(x.id) + '">' + (cfg.bulk ? '<td class="adm-pick-cell"><label class="check adm-pick"><input type="checkbox" data-pick="' + esc(x.id) + '" aria-label="Выбрать"></label></td>' : '') + cfg.row(x).map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
        (cfg.bulk ? '<div class="adm-bar adm-bulk-bar" id="bulkBar" hidden><span class="adm-bulk-n" id="bulkN"></span><button class="btn ghost sm" id="bulkAll"></button><button class="btn ghost sm" id="bulkNone">Снять выбор</button><button class="btn sm" id="bulkDel"></button></div>' : '')
        : '<div class="empty"><h3>Пока пусто</h3><a class="btn ghost" href="#/admin?s=' + cfg.key + '&id=new">' + esc(cfg.addLabel) + '</a></div>');
    var cs = $('#cSearch'); if (cs) cs.addEventListener('change', function () { window.ALB_NAV.go('#/admin?s=' + cfg.key + '&q=' + encodeURIComponent(cs.value)); });
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
          { section: 'Доставка' },
          { k: 'weight', label: 'Вес в упаковке, г', type: 'number', hint: 'Для цены доставки СДЭК. Например, футболка 300, пальто 1800. Пусто — возьмётся вес из настроек СДЭК' },
          { k: 'pack', label: 'Упаковка', type: 'select', options: [['', 'По умолчанию из настроек СДЭК']].concat(Pricing.cdekPacks((DATA.settings && DATA.settings.cdek) || {}).map(function (x) { return [x.id, x.name + ' · ' + x.length + '×' + x.width + '×' + x.height + ' см']; })) },
          { section: 'Описание' },
          { k: 'description', label: 'Описание', type: 'textarea' },
          { k: 'composition', label: 'Состав — свой текст', type: 'textarea', rows: 2, hint: 'Нужен, только если состава нет среди вариантов в «Характеристиках» ниже' },
          { k: 'care', label: 'Уход — дополнительно', type: 'textarea', rows: 2, hint: 'Основное отмечается значками в «Характеристиках». Сюда — то, чего там нет' },
          { section: 'Образ и предзаказ' },
          { k: 'look', label: 'С этим носят — отметьте до 4 вещей', type: 'multi', options: DATA.products.map(function (x) { return [x.id, x.name]; }), hint: 'В карточке товара появится блок «Соберите образ»: покупатель выберет размеры и добавит все вещи одной кнопкой' },
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
      duplicate: function (p) { p.id = uid('p'); p.name += ' (копия)'; p.slug = translit(p.name) + '-' + Math.random().toString(36).slice(2, 5); p.active = false; return p; }
    });
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
  function fitEditorHtml(p) {
    var f = p.fit || {};
    return '<div class="adm-fit"><h4 class="adm-sub">Мерки и подбор размера</h4><p class="muted" style="font-size:14px;margin-bottom:14px;max-width:72ch">Мерки готовой вещи в сантиметрах: футболку кладут на стол, ширина — от шва до шва под рукавами, длина — от верхней точки плеча до низа. Рост и вес — на кого рассчитан размер. Когда заполнены рост и вес хотя бы двух размеров, в карточке появляется «Подобрать размер»; ширина и длина — «Сравнить со своей футболкой» и таблица мерок.</p>' +
      '<div class="table-wrap"><table class="adm-fit-t"><thead><tr><th>Размер</th>' + FIT_COLS.map(function (c) { return '<th>' + c[1] + (c[0] === 'kMin' || c[0] === 'kMax' ? ', кг' : ', см') + '</th>'; }).join('') + '</tr></thead><tbody data-fit-body></tbody></table></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button type="button" class="btn ghost sm" data-fit-sync>Обновить размеры из цветов</button><button type="button" class="btn ghost sm" data-fit-typical>Заполнить пустой рост и вес типовыми для оверсайза</button></div>' +
      '<div class="adm-form" style="margin-top:16px"><label class="field"><span>На модели размер</span><input class="input" data-fit-msize value="' + esc(f.modelSize || '') + '" placeholder="например, L"></label><label class="field"><span>Рост модели, см</span><input class="input" type="number" data-fit-mh value="' + esc(f.modelHeight || '') + '" placeholder="например, 182"></label></div></div>';
  }
  function bindFitEditor(el, fit, getColors) {
    var body = $('[data-fit-body]', el), rows = ((fit && fit.rows) || []).slice();
    function sizes() { var out = []; (getColors() || []).forEach(function (c) { (c.sizes || []).forEach(function (s) { if (s.size && out.indexOf(s.size) === -1) out.push(s.size); }); }); return out; }
    function current() { return $$('tr', body).map(function (tr) { var r = { size: tr.getAttribute('data-size') }; FIT_COLS.forEach(function (c) { var v = parseFloat(String($('[data-f="' + c[0] + '"]', tr).value).replace(',', '.')); if (v > 0) r[c[0]] = v; }); return r; }); }
    function draw(list) {
      body.innerHTML = list.map(function (r) { return '<tr data-size="' + esc(r.size) + '"><th>' + esc(r.size) + '</th>' + FIT_COLS.map(function (c) { return '<td><input class="input num" type="number" step="0.5" min="0" data-f="' + c[0] + '" value="' + esc(r[c[0]] || '') + '" aria-label="' + esc(r.size + ': ' + c[1]) + '"></td>'; }).join('') + '</tr>'; }).join('') ||
        '<tr><td colspan="8" class="muted">Сначала добавьте размеры в цвета товара</td></tr>';
    }
    function merge(prev) { return sizes().map(function (sz) { return prev.find(function (r) { return r.size === sz; }) || { size: sz }; }); }
    draw(merge(rows));
    $('[data-fit-sync]', el).addEventListener('click', function () { draw(merge(current())); });
    $('[data-fit-typical]', el).addEventListener('click', function () {
      var list = merge(current()), n = 0;
      list.forEach(function (r) { var t = FIT_TYPICAL[String(r.size).toUpperCase()]; if (!t) return; ['hMin', 'hMax', 'kMin', 'kMax'].forEach(function (k, i) { if (!r[k]) { r[k] = t[i]; n++; } }); });
      draw(list); toast(n ? 'Заполнено — проверьте и поправьте под свои лекала' : 'Нечего заполнять: типовые значения есть для XS–3XL', !n);
    });
    el._fitRows = current;
  }
  function readFitEditor(el) {
    var rows = (el._fitRows ? el._fitRows() : []).filter(function (r) { return Object.keys(r).length > 1; });
    var ms = $('[data-fit-msize]', el).value.trim().slice(0, 10), mh = Math.round(Number($('[data-fit-mh]', el).value) || 0);
    if (!rows.length && !ms && !mh) return null;
    return { rows: rows, modelSize: ms, modelHeight: mh > 0 ? mh : '' };
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
      cols: ['', 'Название', 'Раздел', 'Порядок', 'Товаров'],
      row: function (c) { return ['<img class="adm-thumb" src="' + esc(c.image || Art.make(c.art)) + '" alt="">', esc(c.name), ({ women: 'Женщинам', men: 'Мужчинам', unisex: 'Оба раздела' })[c.gender] || '<span class="muted">по товарам</span>', '<span class="num">' + (c.order || 0) + '</span>', '<span class="num">' + DATA.products.filter(function (p) { return p.categoryId === c.id; }).length + '</span>']; },
      fields: function () { return [{ k: 'name', label: 'Название' }, { k: 'gender', label: 'Раздел', type: 'select', options: [['', 'Определять по товарам'], ['women', 'Женщинам'], ['men', 'Мужчинам'], ['unisex', 'В обоих разделах']], hint: 'В каком разделе показывать категорию в меню, подвале и каталоге. «По товарам» — по тому, для кого товары внутри; пустая категория — по названию (платья и юбки — женские)' }, { k: 'order', label: 'Порядок', type: 'number' }, { k: 'image', label: 'Обложка', type: 'image', hint: 'Вертикальное фото 3:4' }, { k: 'slug', label: 'Адрес', hint: 'Латиницей, заполнится сам' }]; },
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
    for (var i = n - 1; i >= 0; i--) { var d = new Date(Date.now() + 3 * 36e5 - i * 864e5).toISOString().slice(0, 10); out.push(Object.assign({ day: d, v: 0, p: 0, c: 0, k: 0, src: {}, dev: { m: 0, d: 0 } }, st[d] || {})); }
    var ord = DATA.orders.filter(function (o) { return !o.test; });
    out.forEach(function (x) {
      var list = ord.filter(function (o) { return new Date(new Date(o.createdAt).getTime() + 3 * 36e5).toISOString().slice(0, 10) === x.day; });
      x.o = list.length; x.rev = list.filter(function (o) { return o.status !== 'canceled'; }).reduce(function (s, o) { return s + o.total - (o.refunded || 0); }, 0);
    });
    return out;
  }
  function sumDays(days) {
    var t = { v: 0, p: 0, c: 0, k: 0, o: 0, rev: 0, src: {}, m: 0, d: 0 };
    days.forEach(function (x) { ['v', 'p', 'c', 'k', 'o', 'rev'].forEach(function (k) { t[k] += x[k] || 0; }); Object.keys(x.src || {}).forEach(function (k) { t.src[k] = (t.src[k] || 0) + x.src[k]; }); t.m += (x.dev || {}).m || 0; t.d += (x.dev || {}).d || 0; });
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
  function analyticsSection(m, q) {
    var n = Number((q && q.d) || 7) === 30 ? 30 : 7, days = statDays(n), prev = sumDays(statDays(n * 2).slice(0, n)), t = sumDays(days);
    var delta = function (a, b) { if (!b) return ''; var d = Math.round((a - b) / b * 100); return '<span class="an-d ' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d) + '% к прошлым ' + n + ' дн.</span>'; };
    var mk = (DATA.settings.metrika || {}), srcs = Object.keys(t.src).sort(function (a, b) { return t.src[b] - t.src[a]; }), srcTotal = srcs.reduce(function (s, k) { return s + t.src[k]; }, 0);
    var maxV = Math.max(1, Math.max.apply(null, days.map(function (x) { return x.v; })));
    m.innerHTML = head('Аналитика', '<div class="tabs adm-tabs"><a href="#/admin?s=analytics&d=7" class="' + (n === 7 ? 'on' : '') + '">7 дней</a><a href="#/admin?s=analytics&d=30" class="' + (n === 30 ? 'on' : '') + '">30 дней</a></div>',
        'Своя статистика сайта: без cookie и без персональных данных покупателей. Подробные отчёты, карта кликов и записи визитов — в Яндекс Метрике (подключается ниже).') +
      '<div class="adm-stats an-kpi">' +
        '<div class="adm-stat"><span class="eyebrow">Посетители</span><b class="num">' + t.v.toLocaleString('ru-RU') + '</b>' + delta(t.v, prev.v) + '</div>' +
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
      '<div class="adm-card" style="margin-top:16px"><h3 class="adm-h3">Яндекс Метрика</h3>' +
        '<p class="muted" style="font-size:14px;max-width:70ch;margin-bottom:16px">Создайте счётчик на <a class="link" href="https://metrika.yandex.ru/add" target="_blank" rel="noopener">metrika.yandex.ru</a> (адрес сайта — albakovofficial.ru, галочка «Электронная коммерция»), скопируйте номер счётчика и вставьте сюда. Сайт сам отправит в Метрику просмотры товаров, корзину и заказы.</p>' +
        '<div class="adm-form"><label class="field"><span>Номер счётчика</span><input class="input num" id="mkId" inputmode="numeric" placeholder="Например, 98765432" value="' + esc(mk.id || '') + '"></label>' +
        '<label class="check" style="align-self:end;padding-bottom:12px"><input type="checkbox" id="mkWeb"' + (mk.webvisor ? ' checked' : '') + '> <span>Вебвизор — записи визитов<br><small class="muted">Помогает увидеть, где покупателям неудобно. Поля с телефоном, почтой и адресом Метрика скрывает сама</small></span></label></div>' +
        '<div class="adm-actions" style="margin-top:12px"><button class="btn" id="mkSave" type="button">Сохранить</button>' + (mk.id ? '<a class="btn ghost" href="https://metrika.yandex.ru/dashboard?id=' + esc(mk.id) + '" target="_blank" rel="noopener">Открыть Метрику</a>' : '') + '</div><p class="form-error" id="mkErr"></p></div>';
    $('#mkSave').addEventListener('click', async function () {
      var id = $('#mkId').value.replace(/\D/g, '');
      if ($('#mkId').value.trim() && !/^\d{5,12}$/.test(id)) { $('#mkErr').textContent = 'Номер счётчика — это 5–12 цифр'; return; }
      var s = clone(DATA.settings); s.metrika = { id: id, webvisor: $('#mkWeb').checked };
      try { await A().API.adminSave('settings', s); await afterSave(id ? 'Метрика подключена' : 'Метрика отключена'); } catch (e) { $('#mkErr').textContent = A().errMsg(e); }
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

  /* ================= Уведомления на почту ================= */
  // Владельцу на основную почту: новые заказы, вопросы покупателей, заканчивающиеся размеры
  function alertsSection(m) {
    var s = clone(DATA.settings), n = s.ownerNotify = Object.assign({ email: '', events: {} }, s.ownerNotify || {});
    var ev = Object.assign({ order: true, support: true, stock: true }, n.events);
    var main = (s.contacts || {}).email || '', ready = !!A().D.mailReady;
    var KINDS = [['order', 'Новый заказ', 'Состав, покупатель, доставка и оплата. Заказ с онлайн-оплатой приходит, когда деньги поступили'], ['support', 'Вопросы покупателей', 'Новые обращения и сообщения в поддержку'], ['stock', 'Заканчивается размер', 'Когда после заказа осталось 2 штуки или меньше']];
    m.innerHTML = head('Уведомления на почту', '', 'Новые заказы, вопросы покупателей и заканчивающиеся размеры приходят письмом на вашу почту — сразу, как только что-то произошло.') +
      (ready ? '' : '<div class="adm-alert"><b>Почта для отправки не настроена.</b> Без неё письма не уходят — подключите её в разделе <a class="link" href="#/admin?s=notify&tab=mail">«Письма» → «Почта для отправки»</a>.</div>') +
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
      { k: 'address', label: 'Адрес' }, { k: 'hours', label: 'Часы работы' },
      { section: 'Кнопка связи' },
      { k: 'fab', label: 'Показывать кнопку связи на всех страницах', type: 'checkbox', wide: true, hint: 'Круглая кнопка в правом нижнем углу: чат поддержки, Telegram из соцсетей, WhatsApp, телефон и почта' },
      { k: 'whatsapp', label: 'WhatsApp', hint: 'Номер для кнопки связи, например +7 999 000-00-00. Пусто — WhatsApp не показывается' }
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

  /* ================= Оплата, касса, доставка =================
     Карточки вместо голой формы: у способа оплаты — переключатель и превью «как увидит покупатель»,
     у ЮKassa — статус подключения, у доставки — карточка на каждый способ с понятными полями. */
  function payIc(n) { return '<img src="img/benefits/' + n + '.webp?v=13.32.1" alt="" width="52" height="52" decoding="async">'; }
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
    var hasPath = !!DATA.settings.adminPathHash;
    card.innerHTML = '<h4 class="adm-sub" style="margin-top:0;padding-top:0;border-top:0">Адрес входа в панель</h4>' +
      '<p class="muted" style="font-size:14px">Покупатели не видят ссылку «Управление»: она появляется в подвале только после вашего входа. ' + (hasPath ? 'Сейчас задан секретный адрес входа, адрес #/admin для посторонних не открывается.' : 'Сейчас вход работает по адресу <b>#/admin</b>. Задайте свой адрес, чтобы его нельзя было угадать.') + '</p>' +
      '<div class="promo-form"><input class="input" id="admPath" placeholder="Например, vhod-k7m2q" autocomplete="off" aria-label="Секретный адрес входа"><button type="button" class="btn ghost" id="admPathGen">Придумать</button><button type="button" class="btn ghost" id="admPathSave">Сохранить</button></div><div id="admPathOut"></div>' +
      '<h4 class="adm-sub">Нумерация заказов</h4><p class="muted" style="font-size:14px">Номер, который получит следующий заказ. Дальше номера идут по порядку: 1, 2, 3… Уже занятые номера пропускаются.</p><div class="promo-form"><input class="input num" type="number" min="1" step="1" id="orderSeq" placeholder="…" aria-label="Номер следующего заказа"><button type="button" class="btn ghost" id="orderSeqSave">Сохранить</button></div>' +
      '<h4 class="adm-sub">Пароль администратора</h4><div class="promo-form"><input class="input" type="password" id="newPass" placeholder="Новый пароль, от 8 символов" autocomplete="new-password" aria-label="Новый пароль"><button type="button" class="btn ghost" id="passSave">Сменить</button></div>' +
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
    $('#admPathGen').addEventListener('click', function () { var a = 'abcdefghijkmnpqrstuvwxyz23456789', r = 'vhod-'; for (var i = 0; i < 10; i++) r += a[Math.floor(Math.random() * a.length)]; $('#admPath').value = r; });
    $('#admPathSave').addEventListener('click', async function () {
      var slug = $('#admPath').value.trim().toLowerCase();
      var reserved = ['', 'admin', 'catalog', 'product', 'sale', 'sizes', 'cart', 'checkout', 'account', 'order', 'page'];
      if (!/^[a-z0-9-]{6,40}$/.test(slug) || reserved.indexOf(slug) !== -1) { toast('Адрес: от 6 до 40 символов, латинские буквы, цифры и дефис', true); return; }
      var s = clone(DATA.settings); s.adminPathHash = A().hashPath(slug);
      try {
        await A().API.adminSave('settings', s);
        var link = location.origin + '/' + slug;
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

  /* ================= Поддержка: переписка с покупателями ================= */
  var SUP_STATE = { open: 'Ждёт ответа', answered: 'Отвечено', closed: 'Закрыто' };
  function supTime(iso) {
    var d = new Date(iso), t = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? t : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + t;
  }
  var supPoll = null;
  async function supportSection(m, q) {
    clearInterval(supPoll);
    m.innerHTML = head('Поддержка', '', 'Вопросы покупателей из личного кабинета. Ответ сразу появится у покупателя в кабинете, а если настроена почта — придёт ему и письмом.') + '<div class="loader" style="min-height:200px">…</div>';
    var list;
    try { list = await A().API.adminSupport(); } catch (e) { m.lastElementChild.outerHTML = '<p class="form-error">' + esc(A().errMsg(e)) + '</p>'; return; }
    if (!document.body.contains(m)) return;
    var f = q.f || 'active';
    var inF = function (t, k) { return k === 'all' ? true : k === 'closed' ? t.status === 'closed' : t.status !== 'closed'; };
    var shown = list.filter(function (t) { return inF(t, f); });
    var cur = q.id ? list.find(function (t) { return t.id === q.id; }) : null;
    var filters = [['active', 'Открытые'], ['closed', 'Закрытые'], ['all', 'Все']].map(function (x) {
      return '<a class="adm-chip' + (f === x[0] ? ' on' : '') + '" href="#/admin?s=support&f=' + x[0] + '">' + x[1] + ' <span>' + list.filter(function (t) { return inF(t, x[0]); }).length + '</span></a>';
    }).join('');
    var items = shown.length ? shown.map(function (t) {
      var last = t.messages[t.messages.length - 1];
      return '<a class="sup-item' + (cur && cur.id === t.id ? ' on' : '') + (t.unreadShop ? ' unread' : '') + '" href="#/admin?s=support&f=' + f + '&id=' + esc(t.id) + '">' +
        '<span class="si-top"><b>' + esc(t.name || 'Покупатель') + '</b><time>' + esc(supTime(t.updatedAt)) + '</time></span>' +
        '<span class="si-sub">№ ' + esc(t.number) + ' · ' + esc(t.topic) + (t.orderNumber ? ' · заказ ' + esc(t.orderNumber) : '') + '</span>' +
        '<span class="si-text">' + (last.from === 'shop' ? 'Вы: ' : '') + esc(last.text.slice(0, 80)) + '</span>' +
        '<span class="si-state s-' + t.status + '">' + SUP_STATE[t.status] + '</span></a>';
    }).join('') : '<p class="muted" style="padding:18px 4px;font-size:14px">' + (f === 'closed' ? 'Закрытых обращений нет.' : 'Новых вопросов нет. Когда покупатель напишет из кабинета, обращение появится здесь.') + '</p>';
    var pane = cur ? '<div class="sup-thread adm-thread">' +
        '<header class="st-head"><div><b>' + esc(cur.name || 'Покупатель') + ' · ' + esc(cur.topic) + '</b><span>№ ' + esc(cur.number) + (cur.orderNumber ? ' · <a href="#/admin?s=orders&id=' + esc(cur.orderId) + '">заказ № ' + esc(cur.orderNumber) + '</a>' : '') +
          (cur.email ? ' · ' + esc(cur.email) : '') + (cur.phone ? ' · ' + esc(A().fmtPhone(cur.phone)) : '') + '</span></div>' +
          '<button class="btn ghost sm" id="supToggle" type="button">' + (cur.status === 'closed' ? 'Открыть снова' : 'Закрыть обращение') + '</button></header>' +
        '<div class="st-msgs" id="stMsgs">' + supMsgs(cur) + '</div>' +
        '<form class="st-send" id="stSend"><textarea class="textarea" id="stText" rows="3" placeholder="Ответ покупателю" maxlength="2000" aria-label="Ответ покупателю"></textarea><button class="btn" id="stBtn">Ответить</button></form>' +
        '<p class="st-note">Ctrl + Enter — отправить</p></div>'
      : '<div class="sup-pick"><h3>' + (list.length ? 'Выберите обращение' : 'Обращений пока нет') + '</h3><p>Покупатели пишут из личного кабинета, со страницы заказа или через кнопку связи на сайте.</p></div>';
    m.lastElementChild.outerHTML = '<div class="adm-sup"><div class="adm-chips">' + filters + '</div><div class="sup adm-sup-grid' + (cur ? ' has-pane' : '') + '"><aside class="sup-list"><div class="sup-items">' + items + '</div></aside><section class="sup-pane">' + pane + '</section></div></div>';
    if (!cur) return;
    var box = $('#stMsgs', m), ta = $('#stText', m), count = cur.messages.length;
    box.scrollTop = box.scrollHeight;
    if (cur.unreadShop) A().API.adminSupportPatch(cur.id, { read: true }).then(function () {
      DATA.supportNew = Math.max(0, (DATA.supportNew || 1) - 1);
      var it = $('.sup-item.on', m); if (it) it.classList.remove('unread');
      var b = $('.adm-side a[href="#/admin?s=support"] .adm-badge'); if (b) { if (DATA.supportNew) b.textContent = DATA.supportNew; else b.remove(); }
    }).catch(function () {});
    var send = async function () {
      var text = ta.value.trim(); if (!text) { ta.focus(); return; }
      $('#stBtn', m).disabled = true;
      try { var r = await A().API.adminSupportReply(cur.id, text); toast(r.mailed ? 'Ответ отправлен и продублирован на почту' : 'Ответ отправлен'); supportSection(m, q); return; }
      catch (e) { toast(A().errMsg(e), true); }
      $('#stBtn', m).disabled = false;
    };
    $('#stSend', m).addEventListener('submit', function (e) { e.preventDefault(); send(); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
    $('#supToggle', m).addEventListener('click', async function () {
      try { await A().API.adminSupportPatch(cur.id, { status: cur.status === 'closed' ? 'open' : 'closed' }); supportSection(m, q); } catch (e) { toast(A().errMsg(e), true); }
    });
    supPoll = setInterval(async function () {
      if (!document.body.contains(box)) { clearInterval(supPoll); return; }
      if (document.hidden) return;
      try { var all = await A().API.adminSupport(), t = all.find(function (x) { return x.id === cur.id; }); if (t && t.messages.length !== count) { count = t.messages.length; box.innerHTML = supMsgs(t); box.scrollTop = box.scrollHeight; } } catch (e) {}
    }, 20000);
  }
  function supMsgs(t) {
    return t.messages.map(function (x) {
      return '<div class="msg ' + (x.from === 'shop' ? 'from-me' : 'from-shop') + '"><div class="msg-b">' + (x.from === 'shop' ? '' : '<span class="msg-who">' + esc(t.name || 'Покупатель') + '</span>') + '<p>' + esc(x.text) + '</p></div><time>' + esc(supTime(x.at)) + '</time></div>';
    }).join('');
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
      try { await A().API.adminSave('settings', s2); await afterSave('Текст письма сохранён', '#/admin?s=notify&tab=letter'); } catch (e) { $('#ltErr').textContent = A().errMsg(e); }
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
      try { await A().API.adminMailSave(m); toast('Настройки почты сохранены. Проверьте их: «Текст письма» → «Отправить пример».'); window.ALB_NAV.go('#/admin?s=notify&tab=mail&t=' + Date.now()); } catch (e) { $('#mlErr').textContent = A().errMsg(e); }
    });
  }

  /* Клик по строке таблицы */
  document.addEventListener('click', function (e) { if (e.target.closest('.adm-pick')) return; var tr = e.target.closest('tr[data-href]'); if (tr) window.ALB_NAV.go(tr.getAttribute('data-href')); });

  window.Admin = { render: render };
})();
