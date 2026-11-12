/* Заставка при входе показывается только при первом открытии сайта за сессию.
   При обновлении страницы и в панели управления — сразу сайт, без шторки.
   Подключён в <head>, до отрисовки страницы, чтобы заставка даже не мелькнула. */
(function () {
  // Текст страницы с сервера нужен поисковикам; людям с включённым JS его не показываем — иначе при обновлении он мелькает до загрузки магазина
  document.documentElement.className += ' js';
  // Данные магазина начинаем загружать сразу, параллельно со скриптами: на медленном интернете страница появляется заметно раньше
  try { if (window.fetch) window.__albState = fetch('api/state', { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' }); } catch (e) {}
  try {
    // В приложении из App Store своя заставка (знак и ALBAKOV) — заставку сайта не показываем
    if (window.AlbakovApp || sessionStorage.getItem('albakov:intro') === '1' || (/^#\/admin/.test(location.hash) || /^\/admin/.test(location.pathname))) document.documentElement.className += ' sp-skip';
  } catch (e) { /* приватный режим без хранилища — показываем заставку как при первом входе */ }
})();
