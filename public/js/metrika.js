/* Яндекс Метрика: подключается, только если в панели указан номер счётчика.
   Отдельный файл, потому что встроенные скрипты на сайте запрещены (защита от подмены кода).
   Электронная коммерция: просмотр товара, добавление и удаление из корзины, покупка — через dataLayer. */
(function (root) {
  'use strict';
  var id = 0;
  window.dataLayer = window.dataLayer || [];
  function ym() { (window.ym.a = window.ym.a || []).push(arguments); }
  root.Metrika = {
    init: function (counter, opts) {
      id = Number(counter); if (!id || window.ym) return;
      window.ym = window.ym || ym; window.ym.l = Date.now();
      var s = document.createElement('script'); s.async = true; s.src = 'https://mc.yandex.ru/metrika/tag.js'; document.head.appendChild(s);
      window.ym(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: !!(opts && opts.webvisor), ecommerce: 'dataLayer', defer: true });
    },
    hit: function (url, title) { if (id && window.ym) window.ym(id, 'hit', url, { title: title || document.title }); },
    goal: function (name, params) { if (id && window.ym) window.ym(id, 'reachGoal', name, params || {}); },
    // type: detail | add | remove | purchase
    ec: function (type, products, action) {
      if (!id) return;
      var e = {}; e[type] = { products: products }; if (action) e[type].actionField = action;
      window.dataLayer.push({ ecommerce: Object.assign({ currencyCode: 'RUB' }, e) });
    }
  };
})(this);
