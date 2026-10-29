/* Заставка при входе показывается только при первом открытии сайта за сессию.
   При обновлении страницы и в панели управления — сразу сайт, без шторки.
   Подключён в <head>, до отрисовки страницы, чтобы заставка даже не мелькнула. */
(function () {
  try {
    if (sessionStorage.getItem('albakov:intro') === '1' || (/^#\/admin/.test(location.hash) || /^\/admin/.test(location.pathname))) document.documentElement.className += ' sp-skip';
  } catch (e) { /* приватный режим без хранилища — показываем заставку как при первом входе */ }
})();
