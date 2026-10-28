/* Письма магазина: «Товар снова в наличии» (шаблон редактируется в панели) и подтверждение заказа.
   Используется и в панели управления (предпросмотр), и на сервере (отправка). */
(function (root) {
  'use strict';

  var DEFAULT_NOTIFY = {
    enabled: true,
    subject: '{товар} снова в наличии',
    heading: 'Он вернулся',
    text: 'Вы просили сообщить, когда появится {товар} в цвете «{цвет}», размер {размер}. Он снова в наличии.\n\nТаких вещей у нас немного, поэтому советуем не откладывать.',
    button: 'Перейти к товару',
    footer: 'Вы получили это письмо, потому что оставили заявку на сайте {магазин}. Это разовое уведомление, рассылки не будет.'
  };

  var PLACEHOLDERS = [
    ['{товар}', 'название товара'],
    ['{цвет}', 'цвет'],
    ['{размер}', 'размер (или «любой»)'],
    ['{цена}', 'текущая цена'],
    ['{магазин}', 'название магазина']
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fill(str, v) {
    return String(str || '').replace(/\{(товар|цвет|размер|цена|магазин)\}/g, function (m, k) {
      return { 'товар': v.product, 'цвет': v.color, 'размер': v.size, 'цена': v.price, 'магазин': v.store }[k] || '';
    });
  }
  function tplOf(settings) { var t = {}, n = (settings && settings.notify) || {}; for (var k in DEFAULT_NOTIFY) t[k] = (n[k] !== undefined && n[k] !== '') ? n[k] : DEFAULT_NOTIFY[k]; return t; }

  /* Заявки, по которым товар уже снова в наличии */
  function readyRequests(waitlist, products) {
    return (waitlist || []).filter(function (w) {
      if (w.status !== 'waiting' && w.status !== 'failed') return false;
      var p = (products || []).find(function (x) { return x.id === w.productId; });
      if (!p || p.active === false || !p.colors) return false;
      var c = p.colors.find(function (x) { return x.id === w.colorId; });
      if (!c) return false;
      return (c.sizes || []).some(function (s) { return s.stock > 0 && (!w.size || s.size === w.size); });
    });
  }

  /* ctx: { tpl, store, product, color, colorHex, size, price, oldPrice, url, image, unsubscribe, contacts } */
  function render(ctx) {
    var v = { product: ctx.product, color: ctx.color, size: ctx.size || 'любой', price: ctx.price, store: ctx.store };
    var t = ctx.tpl, subject = fill(t.subject, v), heading = fill(t.heading, v), button = fill(t.button, v);
    var paras = fill(t.text, v).split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    var footer = fill(t.footer, v);
    var serif = "Montserrat,'Helvetica Neue',Arial,sans-serif", sans = "Montserrat,'Helvetica Neue',Arial,sans-serif";
    var html =
      '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>' + esc(subject) + '</title></head>' +
      '<body style="margin:0;padding:0;background:#F3F4F6;">' +
      '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(v.product + ' — ' + v.color + ', ' + v.size) + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;"><tr><td align="center" style="padding:40px 16px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">' +
        '<tr><td align="center" style="padding:0 0 36px;font-family:' + serif + ';font-size:28px;letter-spacing:9px;color:#141414;">' +
          (ctx.logo ? '<img src="' + esc(ctx.logo.src) + '" alt="' + esc(ctx.store) + '" height="' + (ctx.logo.w / ctx.logo.h > 4 ? 18 : 44) + '" width="' + Math.round((ctx.logo.w / ctx.logo.h > 4 ? 18 : 44) * ctx.logo.w / ctx.logo.h) + '" style="display:block;border:0;">' : esc(String(ctx.store || '').toUpperCase())) + '</td></tr>' +
        '<tr><td style="background:#FFFFFF;border:1px solid #E3E6EA;">' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
          (ctx.image ? '<tr><td style="padding:0;"><img src="' + esc(ctx.image) + '" width="560" alt="' + esc(v.product) + '" style="display:block;width:100%;max-width:560px;height:auto;border:0;"></td></tr>' : '') +
          '<tr><td style="padding:40px 40px 8px;">' +
            '<div style="font-family:' + sans + ';font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#2A3036;">Снова в наличии</div>' +
            '<h1 style="margin:14px 0 18px;font-family:' + serif + ';font-weight:400;font-size:36px;line-height:1.1;color:#141414;">' + esc(heading) + '</h1>' +
            paras.map(function (p) { return '<p style="margin:0 0 14px;font-family:' + sans + ';font-size:15px;line-height:1.65;color:#2A3036;">' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('') +
          '</td></tr>' +
          '<tr><td style="padding:16px 40px 8px;">' +
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E3E6EA;border-bottom:1px solid #E3E6EA;"><tr>' +
              '<td style="padding:18px 0;font-family:' + sans + ';color:#141414;font-size:15px;">' + esc(v.product) +
                '<div style="margin-top:6px;font-size:14px;color:#4A4A4F;">' +
                  (ctx.colorHex ? '<span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:' + esc(ctx.colorHex) + ';vertical-align:middle;margin-right:6px;border:1px solid #C2C7CD;"></span>' : '') +
                  esc(v.color) + ' · размер ' + esc(v.size) + '</div></td>' +
              '<td align="right" style="padding:18px 0;font-family:' + sans + ';font-size:15px;color:#141414;white-space:nowrap;">' + esc(v.price) +
                (ctx.oldPrice ? '<div style="margin-top:6px;font-size:14px;color:#626267;text-decoration:line-through;">' + esc(ctx.oldPrice) + '</div>' : '') + '</td>' +
            '</tr></table>' +
          '</td></tr>' +
          '<tr><td style="padding:28px 40px 44px;">' +
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#141414;">' +
              '<a href="' + esc(ctx.url) + '" style="display:inline-block;padding:16px 34px;font-family:' + sans + ';font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#F3F4F6;text-decoration:none;">' + esc(button) + '</a>' +
            '</td></tr></table>' +
          '</td></tr>' +
          '</table>' +
        '</td></tr>' +
        '<tr><td style="padding:28px 8px 0;font-family:' + sans + ';font-size:13px;line-height:1.6;color:#626267;">' + esc(footer) +
          (ctx.contacts ? '<br>' + esc(ctx.contacts) : '') +
          (ctx.unsubscribe ? '<br><a href="' + esc(ctx.unsubscribe) + '" style="color:#4A4A4F;">Отменить это уведомление</a>' : '') + '</td></tr>' +
      '</table></td></tr></table></body></html>';
    var text = heading + '\n\n' + paras.join('\n\n') + '\n\n' + v.product + ' — ' + v.color + ', размер ' + v.size + ', ' + v.price + '\n' + button + ': ' + ctx.url + '\n\n' + footer + (ctx.unsubscribe ? '\nОтменить уведомление: ' + ctx.unsubscribe : '');
    return { subject: subject, html: html, text: text };
  }

  /* Письмо о заказе. ctx: { kind: 'customer' | 'shop', store, logo, order, money(n), payLabel, url, contacts } */
  function renderOrder(ctx) {
    var o = ctx.order, c = o.customer, d = o.delivery || {}, money = ctx.money, shop = ctx.kind === 'shop';
    var paid = o.payment && o.payment.status === 'paid';
    var serif = "Montserrat,'Helvetica Neue',Arial,sans-serif", sans = "Montserrat,'Helvetica Neue',Arial,sans-serif";
    var subject = shop ? 'Новый заказ № ' + o.number + ' на ' + money(o.total) : (paid ? 'Заказ № ' + o.number + ' оплачен' : 'Заказ № ' + o.number + ' принят') + ' — ' + ctx.store;
    var eyebrow = shop ? 'Новый заказ' : (paid ? 'Оплата получена' : 'Заказ принят');
    var heading = shop ? 'Заказ № ' + o.number : 'Спасибо, ' + c.firstName + '!';
    var lead = shop
      ? c.firstName + ' ' + c.lastName + ', ' + c.phone + ', ' + c.email + '. ' + ctx.payLabel + '.'
      : 'Ваш заказ № ' + o.number + (paid ? ' оплачен и передан в сборку.' : ' принят.') + ' Мы свяжемся с вами по телефону, чтобы согласовать доставку.';
    var row = function (l, r, strong) { return '<tr><td style="padding:6px 0;font-family:' + sans + ';font-size:' + (strong ? 17 : 15) + 'px;color:' + (strong ? '#141414' : '#4A4A4F') + ';">' + esc(l) + '</td><td align="right" style="padding:6px 0;font-family:' + sans + ';font-size:' + (strong ? 17 : 15) + 'px;color:#141414;white-space:nowrap;">' + esc(r) + '</td></tr>'; };
    var items = o.items.map(function (i) {
      return '<tr>' + (i.image ? '<td style="padding:14px 0;border-bottom:1px solid #E3E6EA;" width="64"><img src="' + esc(i.image) + '" width="52" height="69" alt="" style="display:block;border:0;object-fit:cover;background:#ECE8E1;"></td>' : '') +
        '<td style="padding:14px ' + (i.image ? '12px' : '12px 14px 0') + ';border-bottom:1px solid #E3E6EA;font-family:' + sans + ';font-size:15px;color:#141414;">' + esc(i.name) +
          '<div style="margin-top:4px;font-size:13px;color:#4A4A4F;">' + esc([i.color, 'размер ' + i.size, i.qty + ' шт.'].filter(Boolean).join(' · ')) + '</div></td>' +
        '<td align="right" style="padding:14px 0;border-bottom:1px solid #E3E6EA;font-family:' + sans + ';font-size:15px;color:#141414;white-space:nowrap;">' + esc(money(i.price * i.qty)) + '</td></tr>';
    }).join('');
    var sums = row('Товары', money(o.subtotal)) +
      (o.saleDiscount ? row('Скидка по акции', '−' + money(o.saleDiscount)) : '') +
      (o.promoDiscount ? row('Промокод ' + o.promoCode, '−' + money(o.promoDiscount)) : '') +
      row(d.name || 'Доставка', d.price ? money(d.price) : 'бесплатно') +
      (o.bonusUsed ? row('Оплачено бонусами', '−' + money(o.bonusUsed)) : '') + row('Итого', money(o.total), true) +
      (!shop && o.bonusEarn > 0 ? row(o.bonusCredited ? 'Начислено бонусов' : 'Бонусы за заказ', '+' + o.bonusEarn) : '');
    var where = [d.city, d.address].filter(Boolean).join(', ');
    var html =
      '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(subject) + '</title></head>' +
      '<body style="margin:0;padding:0;background:#F3F4F6;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;"><tr><td align="center" style="padding:40px 16px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">' +
        '<tr><td align="center" style="padding:0 0 32px;font-family:' + serif + ';font-size:28px;letter-spacing:9px;color:#141414;">' +
          (ctx.logo ? '<img src="' + esc(ctx.logo.src) + '" alt="' + esc(ctx.store) + '" height="18" style="display:inline-block;height:18px;width:auto;border:0;">' : esc(ctx.store)) + '</td></tr>' +
        '<tr><td style="background:#FFFFFF;border:1px solid #E3E6EA;padding:40px 40px 36px;">' +
          '<div style="font-family:' + sans + ';font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#2A3036;">' + esc(eyebrow) + '</div>' +
          '<h1 style="margin:14px 0 16px;font-family:' + serif + ';font-weight:400;font-size:34px;line-height:1.1;color:#141414;">' + esc(heading) + '</h1>' +
          '<p style="margin:0 0 24px;font-family:' + sans + ';font-size:15px;line-height:1.65;color:#2A3036;">' + esc(lead) + '</p>' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #E3E6EA;">' + items + '</table>' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">' + sums + '</table>' +
          (where ? '<p style="margin:22px 0 0;font-family:' + sans + ';font-size:14px;line-height:1.6;color:#4A4A4F;">Адрес: ' + esc(where) + (o.comment ? '<br>Комментарий: ' + esc(o.comment) : '') + '</p>' : '') +
          (shop ? '' : '<p style="margin:10px 0 0;font-family:' + sans + ';font-size:14px;color:#4A4A4F;">Оплата: ' + esc(ctx.payLabel) + '</p>') +
          '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;"><tr><td style="background:#141414;">' +
            '<a href="' + esc(ctx.url) + '" style="display:inline-block;padding:16px 34px;font-family:' + sans + ';font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">' + (shop ? 'Открыть в панели' : 'Открыть заказ') + '</a>' +
          '</td></tr></table>' +
        '</td></tr>' +
        (shop ? '' : '<tr><td style="padding:28px 8px 0;font-family:' + sans + ';font-size:13px;line-height:1.6;color:#626267;">Вопросы по заказу — ответьте на это письмо' + (ctx.contacts ? ' или свяжитесь с нами: ' + esc(ctx.contacts) : '') + '.</td></tr>') +
      '</table></td></tr></table></body></html>';
    var text = [eyebrow, heading, lead, ''].concat(o.items.map(function (i) { return i.name + ' — ' + [i.color, 'размер ' + i.size, i.qty + ' шт.'].filter(Boolean).join(', ') + ' — ' + money(i.price * i.qty); }))
      .concat(['', 'Итого: ' + money(o.total), where ? 'Адрес: ' + where : '', (shop ? 'Открыть в панели: ' : 'Открыть заказ: ') + ctx.url]).filter(function (x) { return x !== null; }).join('\n');
    return { subject: subject, html: html, text: text };
  }

  /* Общая рамка писем об аккаунте: логотип, белая карточка, подпись снизу */
  function frame(ctx, subject, preheader, inner, footer) {
    var sans = "Montserrat,'Helvetica Neue',Arial,sans-serif";
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>' + esc(subject) + '</title></head>' +
      '<body style="margin:0;padding:0;background:#F3F4F6;">' +
      '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(preheader) + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;"><tr><td align="center" style="padding:40px 16px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">' +
        '<tr><td align="center" style="padding:0 0 32px;font-family:' + sans + ';font-size:26px;letter-spacing:9px;color:#141414;">' +
          (ctx.logo ? '<img src="' + esc(ctx.logo.src) + '" alt="' + esc(ctx.store) + '" height="18" style="display:inline-block;height:18px;width:auto;border:0;">' : esc(String(ctx.store || '').toUpperCase())) + '</td></tr>' +
        '<tr><td style="background:#FFFFFF;border:1px solid #E3E6EA;padding:44px 40px 40px;">' + inner + '</td></tr>' +
        '<tr><td style="padding:26px 8px 0;font-family:' + sans + ';font-size:13px;line-height:1.6;color:#626267;text-align:center;">' + footer + '</td></tr>' +
      '</table></td></tr></table></body></html>';
  }
  var SANS = "Montserrat,'Helvetica Neue',Arial,sans-serif";
  function eyebrow(t) { return '<div style="font-family:' + SANS + ';font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#2A3036;text-align:center;">' + esc(t) + '</div>'; }
  function h1(t) { return '<h1 style="margin:14px 0 14px;font-family:' + SANS + ';font-weight:300;font-size:32px;line-height:1.15;color:#141414;text-align:center;">' + esc(t) + '</h1>'; }
  function para(t, extra) { return '<p style="margin:0 0 14px;font-family:' + SANS + ';font-size:15px;line-height:1.65;color:#2A3036;text-align:center;' + (extra || '') + '">' + t + '</p>'; }
  function button(label, url) {
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 0;"><tr><td style="background:#141414;">' +
      '<a href="' + esc(url) + '" style="display:inline-block;padding:16px 34px;font-family:' + SANS + ';font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">' + esc(label) + '</a></td></tr></table>';
  }

  /* Код подтверждения почты. ctx: { store, logo, code, minutes, name } */
  function renderCode(ctx) {
    var code = String(ctx.code), spaced = code.slice(0, 3) + ' ' + code.slice(3);
    var subject = spaced + ' — код подтверждения ' + ctx.store;
    var cells = code.split('').map(function (d) {
      return '<td align="center" style="width:44px;height:56px;border:1px solid #C2C7CD;background:#F3F4F6;font-family:' + SANS + ';font-size:28px;font-weight:600;color:#141414;">' + esc(d) + '</td>';
    });
    var boxes = '<table role="presentation" cellpadding="0" cellspacing="6" border="0" align="center" style="margin:26px auto 22px;"><tr>' + cells.slice(0, 3).join('') + '<td style="width:10px;"></td>' + cells.slice(3).join('') + '</tr></table>';
    var inner = eyebrow('Подтверждение почты') + h1(ctx.name ? ctx.name + ', ваш код' : 'Ваш код') +
      para('Введите его на сайте, чтобы закончить регистрацию.') + boxes +
      para('Код действует ' + ctx.minutes + ' минут.', 'font-size:14px;color:#4A4A4F;margin:0;');
    var footer = 'Если вы не регистрировались на сайте ' + esc(ctx.store) + ', просто удалите это письмо — без кода аккаунт не создастся.';
    var text = 'Код подтверждения: ' + code + '\nВведите его на сайте, чтобы закончить регистрацию. Код действует ' + ctx.minutes + ' минут.\n\nЕсли вы не регистрировались на сайте ' + ctx.store + ', просто удалите это письмо.';
    return { subject: subject, html: frame(ctx, subject, 'Код: ' + spaced + '. Действует ' + ctx.minutes + ' минут.', inner, footer), text: text };
  }

  /* Письмо после регистрации. ctx: { store, logo, name, url, bonusPercent, promo: { code, text }, contacts } */
  function renderWelcome(ctx) {
    var subject = 'Добро пожаловать в ' + ctx.store;
    var perks = [];
    if (ctx.bonusPercent) perks.push(['Бонусы', 'Возвращаем ' + ctx.bonusPercent + '% с каждой покупки. 1 бонус = 1 ₽.']);
    if (ctx.promo && ctx.promo.code) perks.push(['Первый заказ', ctx.promo.text]);
    perks.push(['Личный кабинет', 'Заказы, бонусный счёт и данные для быстрого оформления.']);
    var list = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;border-top:1px solid #E3E6EA;">' +
      perks.map(function (x) {
        return '<tr><td style="padding:16px 0;border-bottom:1px solid #E3E6EA;font-family:' + SANS + ';">' +
          '<div style="font-size:15px;font-weight:600;color:#141414;">' + esc(x[0]) + '</div>' +
          '<div style="margin-top:4px;font-size:14px;line-height:1.55;color:#4A4A4F;">' + esc(x[1]) + '</div></td></tr>';
      }).join('') + '</table>';
    var promo = ctx.promo && ctx.promo.code
      ? '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto 0;"><tr><td align="center" style="border:1px dashed #141414;padding:14px 26px;font-family:' + SANS + ';">' +
          '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#4A4A4F;">Промокод</div>' +
          '<div style="margin-top:6px;font-size:22px;font-weight:600;letter-spacing:5px;color:#141414;">' + esc(ctx.promo.code) + '</div></td></tr></table>'
      : '';
    var inner = eyebrow('Добро пожаловать') + h1(ctx.name ? 'Здравствуйте, ' + ctx.name + '!' : 'Здравствуйте!') +
      para('Вы зарегистрировались в ' + esc(ctx.store) + '. Рады видеть вас среди наших покупателей.') +
      promo + list + button('Перейти в магазин', ctx.url);
    var footer = 'Вы получили это письмо, потому что зарегистрировались на сайте ' + esc(ctx.store) + '. Рассылок не будет — только письма о ваших заказах.' + (ctx.contacts ? '<br>' + esc(ctx.contacts) : '');
    var text = 'Здравствуйте' + (ctx.name ? ', ' + ctx.name : '') + '!\n\nВы зарегистрировались в ' + ctx.store + '.\n\n' + perks.map(function (x) { return x[0] + ': ' + x[1]; }).join('\n') + (ctx.promo && ctx.promo.code ? '\nПромокод: ' + ctx.promo.code : '') + '\n\nМагазин: ' + ctx.url;
    return { subject: subject, html: frame(ctx, subject, 'Бонусы с каждой покупки и личный кабинет', inner, footer), text: text };
  }

  /* Поддержка. kind: customer — ответ магазина покупателю; shop — новое сообщение покупателя магазину.
     ctx: { kind, store, logo, name, number, topic, orderNumber, text, url, contacts } */
  function renderSupport(ctx) {
    var shop = ctx.kind === 'shop';
    var subject = shop ? 'Обращение № ' + ctx.number + ' — ' + (ctx.name || 'покупатель') : 'Ответ поддержки ' + ctx.store + ' — обращение № ' + ctx.number;
    var about = ctx.topic + (ctx.orderNumber ? ', заказ № ' + ctx.orderNumber : '');
    var quote = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;"><tr><td style="border-left:2px solid #141414;padding:4px 0 4px 18px;font-family:' + SANS + ';font-size:15px;line-height:1.65;color:#141414;white-space:pre-line;">' + esc(ctx.text) + '</td></tr></table>';
    var inner = eyebrow(shop ? 'Новое сообщение' : 'Поддержка') + h1(shop ? (ctx.name || 'Покупатель') + ' пишет' : (ctx.name ? ctx.name + ', мы ответили' : 'Мы ответили')) +
      para('Обращение № ' + esc(ctx.number) + ' · ' + esc(about), 'font-size:14px;color:#4A4A4F;margin:0;') + quote +
      button(shop ? 'Ответить в панели' : 'Открыть переписку', ctx.url);
    var footer = shop ? 'Письмо отправлено с сайта ' + esc(ctx.store) + '.' : 'Ответить можно в личном кабинете, в разделе «Поддержка».' + (ctx.contacts ? '<br>' + esc(ctx.contacts) : '');
    var text = (shop ? (ctx.name || 'Покупатель') + ' пишет' : 'Ответ поддержки ' + ctx.store) + ' — обращение № ' + ctx.number + ' (' + about + ')\n\n' + ctx.text + '\n\n' + ctx.url;
    return { subject: subject, html: frame(ctx, subject, String(ctx.text).slice(0, 90), inner, footer), text: text };
  }

  /* Заказ передан в доставку. ctx: { store, logo, name, number, carrier, track, trackUrl, url, contacts } */
  function renderTracking(ctx) {
    var subject = 'Заказ № ' + ctx.number + ' отправлен — трек-номер ' + ctx.track;
    var box = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 0;"><tr><td align="center" style="border:1px solid #121417;padding:16px 28px;font-family:' + SANS + ';">' +
      '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#464B52;">Трек-номер ' + esc(ctx.carrier) + '</div>' +
      '<div style="margin-top:8px;font-size:24px;font-weight:600;letter-spacing:3px;color:#121417;">' + esc(ctx.track) + '</div></td></tr></table>';
    var inner = eyebrow('Заказ в пути') + h1((ctx.name ? ctx.name + ', ваш заказ' : 'Ваш заказ') + ' отправлен') +
      para('Заказ № ' + esc(ctx.number) + ' передан в ' + esc(ctx.carrier) + '. По трек-номеру можно следить, где посылка, и узнать, когда она прибудет.') +
      box + button('Отследить посылку', ctx.trackUrl) +
      para('<a href="' + esc(ctx.url) + '" style="color:#121417;">Открыть заказ на сайте</a>', 'margin:22px 0 0;font-size:14px;');
    var footer = 'Если появятся вопросы по доставке, ответьте на это письмо или напишите в поддержку в личном кабинете.' + (ctx.contacts ? '<br>' + esc(ctx.contacts) : '');
    var text = 'Заказ № ' + ctx.number + ' отправлен через ' + ctx.carrier + '.\nТрек-номер: ' + ctx.track + '\nОтследить: ' + ctx.trackUrl + '\n\nЗаказ на сайте: ' + ctx.url;
    return { subject: subject, html: frame(ctx, subject, 'Трек-номер ' + ctx.track + ' — отследите посылку', inner, footer), text: text };
  }

  var api = { renderTracking: renderTracking, renderSupport: renderSupport, DEFAULT_NOTIFY: DEFAULT_NOTIFY, PLACEHOLDERS: PLACEHOLDERS, tplOf: tplOf, readyRequests: readyRequests, render: render, renderOrder: renderOrder, renderCode: renderCode, renderWelcome: renderWelcome };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mail = api;
})(this);
