/* Характеристики одежды: в панели их отмечают галочками, в карточке товара они показываются блоком
   «Характеристики», а поисковикам уходят в разметку товара и в товарный фид.
   Один список для панели, витрины и сервера. Значения хранятся в товаре: p.specs = { fabric: 'kulirka', decor: ['embroidery'], … } */
(function (root) {
  'use strict';

  // multi — можно отметить несколько; custom — можно вписать свой вариант, если его нет в списке
  var GROUPS = [
    { title: 'Ткань', items: [
      { k: 'composition', label: 'Состав', custom: 'Свой состав, например 90% хлопок, 10% лён', options: [
        ['c100', '100% хлопок'], ['c100p', '100% хлопок пенье'], ['c95e5', '95% хлопок, 5% эластан'], ['c92e8', '92% хлопок, 8% эластан'],
        ['c80p20', '80% хлопок, 20% полиэстер'], ['c70p30', '70% хлопок, 30% полиэстер'], ['p100', '100% полиэстер'], ['w', 'Шерсть с добавками']] },
      { k: 'fabric', label: 'Полотно', options: [
        ['kulirka', 'Кулирная гладь'], ['futer2', 'Футер двухнитка'], ['futer3', 'Футер трёхнитка с начёсом'], ['loop', 'Футер петля'],
        ['pique', 'Пике'], ['rib', 'Рибана'], ['interlock', 'Интерлок'], ['jersey', 'Джерси'], ['denim', 'Деним'], ['twill', 'Твил']] },
      { k: 'density', label: 'Плотность', options: [
        ['160', '160 г/м²'], ['180', '180 г/м²'], ['200', '200 г/м²'], ['220', '220 г/м²'], ['240', '240 г/м²'], ['260', '260 г/м²'],
        ['280', '280 г/м²'], ['300', '300 г/м²'], ['320', '320 г/м²'], ['350', '350 г/м²'], ['400', '400 г/м²']] }
    ] },
    { title: 'Крой', items: [
      { k: 'fit', label: 'Посадка', options: [['oversize', 'Оверсайз'], ['loose', 'Свободная'], ['regular', 'Прямая'], ['fitted', 'Приталенная'], ['slim', 'Облегающая']] },
      { k: 'shoulder', label: 'Плечо', options: [['dropped', 'Спущенное'], ['classic', 'Классическое'], ['raglan', 'Реглан']] },
      { k: 'sleeve', label: 'Рукав', options: [['short', 'Короткий'], ['short_long', 'Удлинённый короткий'], ['three_q', 'Три четверти'], ['long', 'Длинный'], ['none', 'Без рукава']] },
      { k: 'length', label: 'Длина', options: [['cropped', 'Укороченная'], ['standard', 'Стандартная'], ['long', 'Удлинённая']] },
      { k: 'neck', label: 'Горловина', options: [['round', 'Круглая'], ['v', 'V-образная'], ['polo', 'Поло'], ['stand', 'Стойка'], ['hood', 'Капюшон'], ['boat', 'Лодочка']] }
    ] },
    { title: 'Детали', items: [
      { k: 'decor', label: 'Отделка', multi: true, options: [['embroidery', 'Вышивка'], ['print', 'Принт'], ['silk', 'Шелкография'], ['dtf', 'DTF-печать'], ['patch', 'Нашивка'], ['plain', 'Без декора']] },
      { k: 'decorPlace', label: 'Расположение', multi: true, options: [['chest', 'На груди'], ['center', 'По центру'], ['back', 'На спине'], ['sleeve', 'На рукаве']] },
      { k: 'features', label: 'Особенности', multi: true, options: [
        ['collar', 'Усиленный ворот'], ['double', 'Двойная строчка'], ['preshrunk', 'Ткань с предусадкой'], ['opaque', 'Не просвечивает'],
        ['nopill', 'Не скатывается'], ['seamless', 'Без боковых швов'], ['unisex', 'Унисекс посадка']] }
    ] },
    { title: 'Прочее', items: [
      { k: 'season', label: 'Сезон', multi: true, options: [['summer', 'Лето'], ['demi', 'Демисезон'], ['all', 'Круглый год'], ['winter', 'Зима']] },
      { k: 'country', label: 'Производство', custom: 'Своя страна', options: [['ru', 'Россия'], ['kg', 'Киргизия'], ['uz', 'Узбекистан'], ['tr', 'Турция'], ['cn', 'Китай']] }
    ] }
  ];
  // Уход — значками, как на этикетке
  var CARE = [
    ['w30', 'Стирка при 30 °C'], ['w40', 'Стирка при 40 °C'], ['delicate', 'Деликатная стирка'], ['inside', 'Стирать наизнанку'],
    ['nobleach', 'Не отбеливать'], ['iron2', 'Гладить при средней температуре'], ['noironprint', 'Не гладить по нанесению'],
    ['nodryer', 'Не сушить в машине'], ['flat', 'Сушить в расправленном виде'], ['nodryclean', 'Без химчистки']
  ];
  var ITEMS = {}; GROUPS.forEach(function (g) { g.items.forEach(function (it) { ITEMS[it.k] = it; }); });

  function labelOf(it, v) { var o = it.options.find(function (x) { return x[0] === v; }); return o ? o[1] : ''; }
  // Значение характеристики текстом: «Вышивка, Принт»; свой вариант — как вписан
  function textOf(specs, k) {
    var it = ITEMS[k], v = specs && specs[k]; if (!it || v == null || v === '') return '';
    if (it.multi) return (Array.isArray(v) ? v : [v]).map(function (x) { return labelOf(it, x); }).filter(Boolean).join(', ');
    if (String(v).indexOf('custom:') === 0) return String(v).slice(7).trim();
    return labelOf(it, v);
  }
  // Список для показа: [{ k, label, value, group }], только заполненные. Состав — из списка, иначе из свободного поля «Состав»
  function list(p) {
    var s = (p && p.specs) || {}, out = [];
    GROUPS.forEach(function (g) {
      g.items.forEach(function (it) {
        var v = textOf(s, it.k);
        if (!v && it.k === 'composition' && p && p.composition) v = String(p.composition).split('\n')[0].trim();
        if (v) out.push({ k: it.k, label: it.label, value: v, group: g.title });
      });
    });
    return out;
  }
  function care(p) { var c = ((p && p.specs) || {}).care || []; return CARE.filter(function (x) { return c.indexOf(x[0]) !== -1; }); }
  // Короткая выжимка для заголовка карточки и описаний: «100% хлопок · 240 г/м² · Оверсайз»
  function summary(p) {
    var l = list(p), pick = function (k) { var x = l.find(function (y) { return y.k === k; }); return x ? x.value : ''; };
    return ['composition', 'density', 'fit'].map(pick).filter(Boolean);
  }
  // Убирает пустое и чужое перед сохранением
  function clean(specs) {
    var out = {};
    Object.keys(specs || {}).forEach(function (k) {
      var v = specs[k];
      if (k === 'care') { v = (Array.isArray(v) ? v : []).filter(function (x) { return CARE.some(function (c) { return c[0] === x; }); }); if (v.length) out.care = v; return; }
      var it = ITEMS[k]; if (!it) return;
      if (it.multi) { v = (Array.isArray(v) ? v : [v]).filter(function (x) { return it.options.some(function (o) { return o[0] === x; }); }); if (v.length) out[k] = v; return; }
      v = String(v || '').trim().slice(0, 120);
      if (v.indexOf('custom:') === 0 ? (it.custom && v.slice(7).trim()) : it.options.some(function (o) { return o[0] === v; })) out[k] = v;
    });
    return out;
  }

  var api = { GROUPS: GROUPS, CARE: CARE, ITEMS: ITEMS, textOf: textOf, list: list, care: care, summary: summary, clean: clean };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Specs = api;
})(this);
