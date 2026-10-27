/* «Потянуть вниз — обновить» в установленном приложении ALBAKOV (значок на экране «Домой»).
   В обычном браузере телефона у Safari и Chrome есть свой такой жест — там ничего не делаем.
   Жест только наблюдает за пальцем и ничего не отменяет (passive): не мешает нажатиям, прокрутке и клавиатуре.
   Обновление мягкое: магазин заново берёт цены, остатки и настройки с сервера и перерисовывает страницу
   на том же месте, без белого экрана и заставки. */
(function () {
  var START = 16;    // столько пикселей пальцем — и понятно, тянут вниз или листают вбок
  var TRIGGER = 72;  // насколько опустить значок, чтобы при отпускании обновилось
  var MAX = 120;     // ниже значок не опускается
  // Открыто меню, корзина, окно, выбор раздела или ещё идёт заставка — там жест не нужен
  var OVERLAY = '.drawer.open, .modal.open, .gate, #splash, .scrim.open';
  var FIELD = 'input, textarea, select, [contenteditable], label';

  function installed() { return window.Install ? Install.isInstalled() : ((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true); }

  // Покупатель что-то напечатал и не отправил (адрес, комментарий, отзыв) — не стираем это обновлением.
  // Поля, которые заполнил сам магазин (данные из кабинета), черновиком не считаются.
  var typed = [];
  document.addEventListener('input', function (e) { var t = e.target; if (t && t.matches && t.matches('input, textarea, [contenteditable]') && typed.indexOf(t) === -1) typed.push(t); }, true);
  function hasDraft() {
    typed = typed.filter(function (el) { return document.contains(el); });
    return typed.some(function (el) { var v = el.isContentEditable ? el.textContent : el.value; return v && String(v).trim(); });
  }
  // Набирают текст: поле в фокусе или открыта клавиатура
  function typingNow() {
    var a = document.activeElement;
    if (a && a !== document.body && a.matches && a.matches('input, textarea, select, [contenteditable]')) return true;
    var vv = window.visualViewport;
    return !!(vv && (vv.offsetTop > 0 || vv.height < window.innerHeight * 0.8));
  }
  // Палец лёг на блок со своей прокруткой, который не в самом верху (корзина, таблица) — тянут его, а не страницу
  function innerScrolled(node) {
    for (var el = node; el && el !== document.body; el = el.parentElement) {
      if (el.scrollTop > 0) { var oy = getComputedStyle(el).overflowY; if (oy === 'auto' || oy === 'scroll') return true; }
    }
    return false;
  }

  function setup() {
    if (!installed() || !('ontouchstart' in window)) return;
    var ind = document.createElement('div');
    ind.className = 'ptr'; ind.setAttribute('aria-hidden', 'true');
    ind.innerHTML = '<span class="ptr-ic"><svg viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/></svg></span>';
    document.body.appendChild(ind);
    var ic = ind.firstChild;
    var x0 = 0, y0 = 0, dist = 0, state = 'idle';   // idle → maybe → pull → busy

    function show(d) {
      var p = Math.min(1, d / TRIGGER);
      ind.style.transform = 'translate(-50%, ' + (d - 48) + 'px)';
      ind.style.opacity = String(Math.min(1, p * 1.4));
      ic.style.transform = 'rotate(' + (p * 270) + 'deg)';
      ind.classList.toggle('ready', d >= TRIGGER);
    }
    function hide() {
      ind.classList.add('back'); ind.classList.remove('ready', 'busy');
      ind.style.transform = ''; ind.style.opacity = ''; ic.style.transform = '';
      setTimeout(function () { ind.classList.remove('back'); }, 250);
    }

    document.addEventListener('touchstart', function (e) {
      if (state === 'busy' || e.touches.length !== 1) return;
      state = 'idle';
      if (!document.querySelector('#app .header') || typingNow() || (e.target.closest && e.target.closest(FIELD))) return;
      if (window.scrollY > 0 || document.querySelector(OVERLAY) || innerScrolled(e.target)) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dist = 0; state = 'maybe';
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (state !== 'maybe' && state !== 'pull') return;
      if (e.touches.length !== 1) { state = 'idle'; hide(); return; }
      var dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if (state === 'maybe') {
        if (Math.abs(dx) < START && Math.abs(dy) < START) return;
        // вбок, вверх или страница уже уехала — это не обновление
        if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0 || typingNow()) { state = 'idle'; return; }
        state = 'pull'; ind.classList.remove('back');
      }
      dist = Math.min(MAX, Math.max(0, (dy - START) * 0.5));
      show(dist);
    }, { passive: true });

    document.addEventListener('touchend', function () {
      if (state !== 'pull') { if (state === 'maybe') state = 'idle'; return; }
      if (dist < TRIGGER || hasDraft()) { state = 'idle'; hide(); return; }
      state = 'busy';
      ind.classList.add('busy', 'back'); ind.classList.remove('ready');
      ind.style.transform = 'translate(-50%, ' + (TRIGGER - 48) + 'px)'; ic.style.transform = '';
      var t0 = Date.now();
      var run = window.App && window.App.refresh ? Promise.resolve().then(window.App.refresh) : Promise.resolve(location.reload());
      run.catch(function () {}).then(function () {
        // слишком быстрое обновление выглядит как сбой — даём значку покрутиться хотя бы полсекунды
        setTimeout(function () { hide(); state = 'idle'; }, Math.max(0, 500 - (Date.now() - t0)));
      });
    }, { passive: true });
    document.addEventListener('touchcancel', function () { if (state === 'pull' || state === 'maybe') { state = 'idle'; hide(); } }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
