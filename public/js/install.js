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
    phone: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/></svg>',
    page: '<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
    hdots: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/></svg>',
    toggle: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="5"/><circle cx="16" cy="12" r="3"/></svg>'
  };
  /* Версия Safari на iPhone: в iOS 26 «Поделиться» — в меню «•••» справа от адреса, в iOS 27 — в меню страницы «≡» слева от адреса.
     Номер версии берём из Version/… — номер iOS в строке браузера с iOS 26 «заморожен» и не меняется */
  var safariVer = (function () { var m = /Version\/(\d+)/.exec(ua); return m ? Number(m[1]) : 0; })();
  var iosChrome = /CriOS|EdgiOS|FxiOS|YaBrowser/.test(ua);
  // Пошаговая подсказка для браузеров без окна установки
  function howTo() {
    var A = app(); if (!A.openModal) return;
    var step = function (ic, html) { return '<li><span class="inst-ic" aria-hidden="true">' + IC[ic] + '</span><span>' + html + '</span></li>'; };
    // Шаги для iPhone по версии iOS: свою версию покупатель может переключить, если угадали не ту
    var iosSteps = function (v) {
      var share = v === 'chrome' ? step('share', 'Нажмите <b>«Поделиться»</b> — значок в адресной строке справа вверху')
        : v === '27' ? step('page', 'Нажмите <b>≡</b> слева от адреса сайта (или подержите палец на адресной строке) и выберите <b>«Поделиться»</b>')
        : v === '26' ? step('hdots', 'Нажмите <b>•••</b> справа от адреса сайта и выберите <b>«Поделиться»</b>')
        : step('share', 'Нажмите <b>«Поделиться»</b> — квадрат со стрелкой вверх внизу экрана');
      return [share,
        step('add', 'Выберите <b>«На экран „Домой“»</b>' + (v === '26' || v === '27' ? ' — если не видно, нажмите <b>«Ещё»</b>' : ', пролистав список вниз')),
        v === '26' || v === '27'
          ? step('toggle', 'Оставьте включённым <b>«Открыть как веб-приложение»</b> и нажмите <b>«Добавить»</b>')
          : step('ok', 'Нажмите <b>«Добавить»</b> справа вверху — значок ALBAKOV появится рядом с другими приложениями')].join('');
    };
    var IOS_VERS = [['27', 'iOS 27'], ['26', 'iOS 26'], ['old', 'iOS 18 и ниже'], ['chrome', 'Chrome']];
    var iosCur = iosChrome ? 'chrome' : safariVer >= 27 ? '27' : safariVer === 26 ? '26' : 'old';
    var steps = isIOS
      ? [iosSteps(iosCur)]
      : isAndroid
      ? [step('dots', 'Откройте меню браузера <b>⋮</b> справа вверху (в Яндекс Браузере — <b>≡</b> внизу)'),
         step('phone', 'Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>'),
         step('ok', 'Подтвердите — ALBAKOV появится на экране с приложениями')]
      : [step('add', 'В Chrome, Edge или Яндекс Браузере нажмите значок установки в адресной строке справа'),
         step('ok', 'Нажмите <b>«Установить»</b> — магазин откроется в своём окне, как программа'),
         step('phone', 'На телефоне откройте ' + A.esc(location.host) + ' и добавьте на экран «Домой» так же')];
    A.openModal('<div class="inst">' +
      '<span class="inst-logo-wrap"><img class="inst-logo" src="img/icon-192.png" alt="" width="76" height="76"></span>' +
      '<span class="inst-eyebrow">Приложение</span>' +
      '<h3>ALBAKOV на экране «Домой»<i aria-hidden="true">.</i></h3>' +
      '<p class="muted">Магазин открывается одним нажатием и на весь экран — как обычное приложение. Скачивать из магазина приложений ничего не нужно.</p>' +
      (isIOS ? '<div class="inst-vers" role="tablist" aria-label="Версия iPhone">' + IOS_VERS.map(function (x) { return '<button type="button" role="tab" data-iv="' + x[0] + '" aria-selected="' + (x[0] === iosCur) + '"' + (x[0] === iosCur ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>' : '') +
      '<ol class="inst-steps" id="instSteps">' + steps.join('') + '</ol>' +
      (isIOS ? '<p class="inst-note">Версия iOS — в «Настройки» → «Основные» → «Об этом устройстве»</p>' : '') +
      '<div class="inst-btns"><button class="btn" data-act="close">Понятно</button></div>' +
      '</div>');
    // переключение версии iOS: шаги меняются на месте
    var box = document.querySelector('.inst');
    if (isIOS && box) box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-iv]'); if (!b) return;
      Array.prototype.forEach.call(box.querySelectorAll('[data-iv]'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
      box.querySelector('#instSteps').innerHTML = iosSteps(b.getAttribute('data-iv'));
    });
  }

  root.Install = { isMobile: isMobile, isInstalled: isInstalled, canOffer: canOffer, showBanner: showBanner, hideBanner: hideBanner, open: open };
})(this);
