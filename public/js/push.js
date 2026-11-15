/* Уведомления (13.64.6): push-уведомления браузера и веб-приложения убраны.
   Покупателям и сотрудникам уведомления приходят только в приложение ALBAKOV для iPhone (через Apple).
   Здесь — заглушка с тем же интерфейсом, чтобы страницы показывали «Уведомления — в приложении ALBAKOV»,
   и регистрация сервис-воркера (страница «Нет интернета»). Старые подписки браузера снимаются. */
(function (root) {
  var webApi = 'serviceWorker' in navigator && window.isSecureContext !== false;
  if (webApi) window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (r) {
      return r && r.pushManager ? r.pushManager.getSubscription().then(function (s) { return s && s.unsubscribe(); }) : null;
    }).catch(function () { /* без него сайт работает */ });
  });
  try { localStorage.removeItem('albakov:push'); localStorage.removeItem('albakov:push-ask'); } catch (e) { /* приватный режим */ }
  var no = function () { return Promise.reject(new Error('Уведомления приходят в приложении ALBAKOV для iPhone')); };
  root.Push = { supported: false, native: false, isIOS: false, installed: function () { return false; },
    state: function () { return Promise.resolve('ios-app'); }, enable: no, disable: function () { return Promise.resolve(); }, link: function () { return Promise.resolve(); }, test: no };
})(window);
