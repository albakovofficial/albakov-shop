/* Магазин как приложение: значок на экране «Домой», открывается на весь экран.
   Android и компьютер (Chrome, Edge, Яндекс Браузер): браузер сам умеет ставить — ловим его окно и открываем по кнопке.
   iPhone и iPad: окна установки нет — показываем, где в Safari «Поделиться» → «На экран „Домой“».
   Окна и уведомления — через App.openModal / App.toast из app.js. */
(function (root) {
  var deferred = null;                      // событие beforeinstallprompt — «можно установить»
  var HIDE_KEY = 'albakov:install-hidden';  // покупатель скрыл плашку на этом устройстве
  var ua = navigator.userAgent || '';
  var isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isMobile = isIOS || isAndroid;

  function isInstalled() {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function app() { return root.App || {}; }
  function toast(msg) { if (app().toast) app().toast(msg); }
  function sync() { document.dispatchEvent(new CustomEvent('install:change')); }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; sync(); });
  window.addEventListener('appinstalled', function () { deferred = null; sync(); toast('Готово — значок ALBAKOV на экране «Домой»'); });

  // Предлагать ли установку: ещё не установлено и на этом устройстве это вообще возможно
  function canOffer() { return !isInstalled() && (!!deferred || isMobile); }
  function bannerHidden() { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch (e) { return false; } }
  function hideBanner() { try { localStorage.setItem(HIDE_KEY, '1'); } catch (e) { /* приватный режим */ } }
  // Плашка на телефоне: только если ещё не установлено и покупатель её не закрывал
  function showBanner() { return isMobile && canOffer() && !bannerHidden(); }

  function open() {
    if (isInstalled()) { toast('Вы уже в приложении ALBAKOV'); return; }
    if (deferred) {
      var e = deferred; deferred = null;
      e.prompt();
      e.userChoice.then(function (r) { if (!r || r.outcome !== 'accepted') deferred = e; sync(); }, function () { deferred = e; sync(); });
      return;
    }
    howTo();
  }

  var IC = {
    share: '<svg viewBox="0 0 24 24"><path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M8.5 10.5H6v10h12v-10h-2.5"/></svg>',
    add: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg>'
  };
  // Пошаговая подсказка для браузеров без окна установки
  function howTo() {
    var A = app(); if (!A.openModal) return;
    var step = function (ic, html) { return '<li><span class="inst-ic" aria-hidden="true">' + IC[ic] + '</span><span>' + html + '</span></li>'; };
    var steps = isIOS
      ? [step('share', 'Нажмите <b>«Поделиться»</b> — в Safari внизу экрана, в Chrome — справа вверху'),
         step('add', 'Пролистайте вниз и выберите <b>«На экран „Домой“»</b>'),
         step('ok', 'Нажмите <b>«Добавить»</b> — значок ALBAKOV появится рядом с другими приложениями')]
      : isAndroid
      ? [step('dots', 'Откройте меню браузера <b>⋮</b> справа вверху (в Яндекс Браузере — <b>≡</b> внизу)'),
         step('phone', 'Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>'),
         step('ok', 'Подтвердите — ALBAKOV появится на экране с приложениями')]
      : [step('add', 'В Chrome, Edge или Яндекс Браузере нажмите значок установки в адресной строке справа'),
         step('ok', 'Нажмите <b>«Установить»</b> — магазин откроется в своём окне, как программа'),
         step('phone', 'На телефоне откройте ' + A.esc(location.host) + ' и добавьте на экран «Домой» так же')];
    A.openModal('<div class="inst">' +
      '<img class="inst-logo" src="img/icon-192.png" alt="" width="72" height="72">' +
      '<h3>ALBAKOV на экране «Домой»</h3>' +
      '<p class="muted">Магазин открывается одним нажатием и на весь экран — как обычное приложение. Скачивать из магазина приложений ничего не нужно.</p>' +
      '<ol class="inst-steps">' + steps.join('') + '</ol>' +
      '<div class="inst-btns"><button class="btn ghost" data-act="share-shop">' + IC.share + 'Поделиться магазином</button><button class="btn" data-act="close">Понятно</button></div>' +
      '</div>');
  }

  // Отправить ссылку на магазин: системное окно «Поделиться», а если его нет — скопировать ссылку
  function share() {
    var s = (app().D && app().D.settings) || {};
    var url = location.origin + '/';
    var title = s.storeName || 'ALBAKOV';
    if (navigator.share) {
      navigator.share({ title: title, text: title + (s.tagline ? ' — ' + s.tagline : ''), url: url }).catch(function (e) { if (e && e.name !== 'AbortError') copy(url); });
      return;
    }
    copy(url);
  }
  function copy(url) {
    try { navigator.clipboard.writeText(url).then(function () { toast('Ссылка на магазин скопирована'); }, function () { toast(url); }); }
    catch (e) { toast(url); }
  }

  root.Install = { isIOS: isIOS, isMobile: isMobile, isInstalled: isInstalled, canOffer: canOffer, showBanner: showBanner, hideBanner: hideBanner, open: open, share: share, IC: IC };
})(this);
