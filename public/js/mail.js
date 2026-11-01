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

  /* ================= Дизайн писем =================
     Белая карточка с чёрной полосой сверху, логотип, крупный тонкий заголовок, серые плашки для главного
     (номер, код, сумма), шкала статуса заказа, полоса сервиса и подвал. Всё на таблицах и встроенных стилях —
     так письмо одинаково выглядит в Яндексе, Mail.ru, Gmail и Apple Mail. На телефоне — свои отступы и шрифты. */
  var F = "Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif";
  var SANS = F;
  var K = { ink: '#0D0E10', text: '#2A3036', muted: '#5B6169', dim: '#8A8F96', line: '#E8EAED', soft: '#F4F5F6', bg: '#EEEFF1', acc: '#FF5A3C', acc2: '#FF9A5C' };
  var ACC_GRAD = 'linear-gradient(135deg,#FF9A5C,#FF5A3C)';
  // Адрес для писем покупателей (info@) и адрес сайта — подставляет сервер. Письма уходят с no-reply@ — на них отвечать не нужно
  var DEFAULTS = { supportEmail: '', siteUrl: '' };
  function supportOf(ctx) { return (ctx && ctx.supportEmail) || DEFAULTS.supportEmail || ''; }
  function siteOf(ctx) { return String((ctx && ctx.siteUrl) || DEFAULTS.siteUrl || '').replace(/\/$/, ''); }
  function mailto(e) { return '<a href="mailto:' + esc(e) + '" style="color:' + K.ink + ';text-decoration:underline;">' + esc(e) + '</a>'; }
  function noReply(ctx) {
    var e = supportOf(ctx);
    return 'Это письмо отправлено автоматически — отвечать на него не нужно.' + (e ? '<br>Написать нам: ' + mailto(e) : '');
  }
  function writeUs(ctx) { var e = supportOf(ctx); return e ? 'напишите нам на ' + mailto(e) : 'напишите нам'; }
  var tbl = function (extra) { return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"' + (extra ? ' style="' + extra + '"' : '') + '>'; };
  function logoHtml(ctx, h) {
    h = h || 16;
    if (!ctx.logo) return '<span style="font-family:' + F + ';font-size:20px;letter-spacing:8px;color:' + K.ink + ';">' + esc(String(ctx.store || '').toUpperCase()) + '</span>';
    var wide = ctx.logo.w && ctx.logo.h ? ctx.logo.w / ctx.logo.h > 3 : true, hh = wide ? h : h * 2.6;
    var ww = ctx.logo.w && ctx.logo.h ? Math.round(hh * ctx.logo.w / ctx.logo.h) : '';
    return '<img src="' + esc(ctx.logo.src) + '" alt="' + esc(ctx.store) + '" height="' + Math.round(hh) + '"' + (ww ? ' width="' + ww + '"' : '') + ' style="display:block;margin:0 auto;height:' + Math.round(hh) + 'px;width:' + (ww ? ww + 'px' : 'auto') + ';border:0;outline:none;">';
  }
  // Секция карточки с фирменными отступами
  function sec(html, pad) { return '<tr><td class="px" style="padding:' + (pad || '0 48px') + ';">' + html + '</td></tr>'; }
  function hero(eb, title, lead) {
    return sec(
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td style="padding:7px 14px 7px 12px;border-radius:999px;background:' + K.soft + ';border:1px solid ' + K.line + ';font-family:' + F + ';font-size:10px;font-weight:600;line-height:1.3;letter-spacing:2px;text-transform:uppercase;color:' + K.ink + ';">' +
        '<span style="display:inline-block;width:7px;height:7px;border-radius:4px;background:' + K.acc + ';background-image:' + ACC_GRAD + ';vertical-align:1px;margin-right:9px;"></span>' + esc(eb) + '</td></tr></table>' +
      '<h1 class="h1" style="margin:20px 0 0;font-family:' + F + ';font-weight:300;font-size:38px;line-height:1.08;letter-spacing:-1.2px;color:' + K.ink + ';">' + esc(title) + (/[.!?…:]$/.test(String(title).trim()) ? '' : '<span style="color:' + K.acc + ';">.</span>') + '</h1>' +
      (lead ? '<p style="margin:18px 0 0;font-family:' + F + ';font-size:15px;line-height:1.75;color:' + K.muted + ';">' + lead + '</p>' : ''), '44px 48px 0');
  }
  function gap(h) { return '<tr><td style="height:' + h + 'px;line-height:' + h + 'px;font-size:0;">&nbsp;</td></tr>'; }
  function rule() { return sec('<div style="height:1px;line-height:1px;font-size:0;background:' + K.line + ';">&nbsp;</div>'); }
  // Серая плашка для главного: код, номер, сумма
  function plate(label, value, sub, opt) {
    opt = opt || {};
    return tbl('border-collapse:separate;background:' + K.soft + ';border-radius:20px;border:1px solid ' + K.line + ';') + '<tr><td style="padding:24px 26px;">' +
      '<div style="font-family:' + F + ';font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:' + K.dim + ';">' + esc(label) + '</div>' +
      '<div class="plate-v" style="margin-top:10px;font-family:' + F + ';font-size:' + (opt.size || 28) + 'px;font-weight:500;line-height:1.15;letter-spacing:' + (opt.spacing == null ? 3 : opt.spacing) + 'px;color:' + K.ink + ';">' + esc(value) + '</div>' +
      (sub ? '<div style="margin-top:10px;font-family:' + F + ';font-size:13px;line-height:1.6;color:' + K.muted + ';">' + sub + '</div>' : '') +
      '</td></tr></table>';
  }
  function btn(label, url) {
    return '<table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td bgcolor="' + K.ink + '" style="background:' + K.ink + ';border-radius:999px;">' +
      '<a href="' + esc(url) + '" style="display:inline-block;padding:15px 16px 15px 32px;border-radius:999px;font-family:' + F + ';font-size:14px;font-weight:500;letter-spacing:.3px;color:#FFFFFF;text-decoration:none;">' + esc(label) + ' &nbsp; <span style="display:inline-block;width:28px;height:28px;line-height:28px;border-radius:14px;background:#FFFFFF;color:' + K.ink + ';text-align:center;font-size:14px;">&rarr;</span></a></td></tr></table>';
  }
  function textLink(label, url) {
    return '<a href="' + esc(url) + '" style="font-family:' + F + ';font-size:13px;letter-spacing:.5px;color:' + K.ink + ';text-decoration:none;border-bottom:1px solid ' + K.ink + ';padding-bottom:2px;">' + esc(label) + ' &rarr;</a>';
  }
  function p(t, extra) { return '<p style="margin:0;font-family:' + F + ';font-size:15px;line-height:1.75;color:' + K.text + ';' + (extra || '') + '">' + t + '</p>'; }
  // Шкала статуса заказа: 0 — оформлен, 1 — собираем, 2 — в пути, 3 — получен
  function progress(at) {
    var L = ['Оформлен', 'Собираем', 'В пути', 'Получен'];
    return tbl() + '<tr>' + L.map(function (l, i) {
      var on = i <= at;
      return '<td width="25%" valign="top" style="padding:0 ' + (i < 3 ? '6px' : '0') + ' 0 0;">' +
        '<div style="height:4px;line-height:4px;font-size:0;border-radius:4px;background:' + (i === at ? K.acc : on ? K.ink : K.line) + ';' + (i === at ? 'background-image:' + ACC_GRAD + ';' : '') + '">&nbsp;</div>' +
        '<div style="margin-top:10px;font-family:' + F + ';font-size:11px;letter-spacing:.5px;line-height:1.3;color:' + (i === at ? K.ink : on ? K.muted : K.dim) + ';font-weight:' + (i === at ? 600 : 400) + ';">' + l + '</div></td>';
    }).join('') + '</tr></table>';
  }
  // Строка товара: фото, название, цвет и размер, цена
  function itemRow(i, price, first) {
    var bt = first ? '' : 'border-top:1px solid ' + K.line + ';';
    return '<tr>' +
      (i.image !== undefined ? '<td width="72" valign="top" style="padding:18px 0;' + bt + '"><div style="width:64px;background:' + K.soft + ';border-radius:12px;overflow:hidden;">' + (i.image ? '<img src="' + esc(i.image) + '" width="64" alt="" style="display:block;width:64px;height:auto;border:0;">' : '<div style="height:85px;line-height:85px;font-size:0;">&nbsp;</div>') + '</div></td>' : '') +
      '<td valign="top" style="padding:18px 12px 18px ' + (i.image !== undefined ? '14px' : '0') + ';' + bt + 'font-family:' + F + ';">' +
        '<div style="font-size:15px;font-weight:500;line-height:1.4;color:' + K.ink + ';">' + esc(i.name) + '</div>' +
        '<div style="margin-top:6px;font-size:13px;line-height:1.5;color:' + K.dim + ';">' + esc([i.color, i.size ? 'размер ' + i.size : '', i.qty ? i.qty + ' шт.' : '', i.preorder ? 'предзаказ' + (i.shipDate ? ', отправим ' + String(i.shipDate).split('-').reverse().join('.') : '') : ''].filter(Boolean).join(' · ')) + '</div></td>' +
      '<td align="right" valign="top" style="padding:18px 0;' + bt + 'font-family:' + F + ';font-size:15px;color:' + K.ink + ';white-space:nowrap;">' + (price || '') + '</td></tr>';
  }
  function sumRow(l, r, strong) {
    return '<tr><td style="padding:' + (strong ? '16px 0 0' : '5px 0') + ';' + (strong ? 'border-top:1px solid ' + K.ink + ';' : '') + 'font-family:' + F + ';font-size:' + (strong ? 17 : 14) + 'px;font-weight:' + (strong ? 500 : 400) + ';color:' + (strong ? K.ink : K.muted) + ';">' + esc(l) + '</td>' +
      '<td align="right" style="padding:' + (strong ? '16px 0 0' : '5px 0') + ';' + (strong ? 'border-top:1px solid ' + K.ink + ';' : '') + 'font-family:' + F + ';font-size:' + (strong ? 20 : 14) + 'px;font-weight:' + (strong ? 500 : 400) + ';color:' + K.ink + ';white-space:nowrap;">' + esc(r) + '</td></tr>';
  }
  // Две колонки сведений (на телефоне — одна под другой)
  function infoCols(cols) {
    return tbl() + '<tr>' + cols.map(function (c, i) {
      return '<td class="col' + (i === 0 ? ' colpad' : '') + '" width="50%" valign="top" style="padding:0 ' + (i === 0 ? '16px' : '0') + ' 0 0;font-family:' + F + ';">' +
        '<div style="font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:' + K.dim + ';">' + esc(c[0]) + '</div>' +
        '<div style="margin-top:10px;font-size:14px;line-height:1.65;color:' + K.text + ';">' + c[1] + '</div></td>';
    }).join('') + '</tr></table>';
  }
  // Пронумерованные шаги
  function steps(list) {
    return tbl() + list.map(function (t, i) {
      return '<tr><td width="40" valign="top" style="padding:' + (i ? '14px' : '0') + ' 0 0;"><div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:' + (i ? K.ink : K.acc) + ';color:#FFFFFF;text-align:center;font-family:' + F + ';font-size:12px;font-weight:600;">' + (i + 1) + '</div></td>' +
        '<td valign="top" style="padding:' + (i ? '18px' : '4px') + ' 0 0;font-family:' + F + ';font-size:15px;line-height:1.6;color:' + K.text + ';">' + t + '</td></tr>';
    }).join('') + '</table>';
  }
  function listRows(list) {
    return tbl('border-top:1px solid ' + K.line + ';') + list.map(function (x) {
      return '<tr><td style="padding:14px 0;border-bottom:1px solid ' + K.line + ';font-family:' + F + ';font-size:14px;line-height:1.5;color:' + K.ink + ';">' + x[0] + (x[1] ? '<div style="margin-top:3px;font-size:13px;color:' + K.dim + ';">' + x[1] + '</div>' : '') + '</td>' +
        '<td align="right" valign="top" style="padding:14px 0;border-bottom:1px solid ' + K.line + ';font-family:' + F + ';font-size:14px;color:' + K.ink + ';white-space:nowrap;">' + (x[2] || '') + '</td></tr>';
    }).join('') + '</table>';
  }
  // Полоса сервиса внизу карточки
  function services(ctx) {
    var site = siteOf(ctx), S = [['Доставка СДЭК', 'В пункт или курьером', '/page/delivery'], ['Возврат 14 дней', 'Через любой пункт СДЭК', '/page/returns'], ['Бонусы', 'С каждой покупки', '/account?tab=bonus']];
    return '<tr><td class="px" style="padding:0 24px 24px;">' + tbl('border-collapse:separate;background:' + K.soft + ';border-radius:20px;border:1px solid ' + K.line + ';') + '<tr>' + S.map(function (x, i) {
      var inner = '<div style="font-family:' + F + ';font-size:12px;font-weight:600;letter-spacing:.5px;color:' + K.ink + ';">' + x[0] + '</div><div style="margin-top:4px;font-family:' + F + ';font-size:12px;line-height:1.4;color:' + K.dim + ';">' + x[1] + '</div>';
      return '<td class="svc" width="33%" align="center" valign="top" style="padding:22px 10px;' + (i ? 'border-left:1px solid ' + K.line + ';' : '') + '">' + (site ? '<a href="' + esc(site + x[2]) + '" style="text-decoration:none;">' + inner + '</a>' : inner) + '</td>';
    }).join('') + '</tr></table></td></tr>';
  }
  /* Рамка всех писем. o: { subject, preheader, body, footer, shop } */
  function shell(ctx, o) {
    var site = siteOf(ctx), host = site.replace(/^https?:\/\//, ''), year = new Date().getFullYear();
    var foot = o.shop
      ? 'Письмо отправлено сайтом ' + esc(ctx.store) + '.'
      : (o.footer ? o.footer + '<br><br>' : '') + '<span style="color:' + K.dim + ';">' + noReply(ctx) + '</span>' +
        (ctx.contacts ? '<br>' + esc(ctx.contacts) : '');
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>' + esc(o.subject) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">' +
      '<style>body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse}img{-ms-interpolation-mode:bicubic}' +
      '@media (max-width:620px){.px{padding-left:24px!important;padding-right:24px!important}.h1{font-size:28px!important}.plate-v{font-size:22px!important}.col{display:block!important;width:100%!important;padding:0!important}.colpad{padding:0 0 22px!important}.btn,.btn td,.btn a{display:block!important;width:100%!important;text-align:center!important;box-sizing:border-box}.svc{padding:18px 6px!important}.code td{width:38px!important;height:52px!important;font-size:24px!important}}</style></head>' +
      '<body style="margin:0;padding:0;background:' + K.bg + ';">' +
      '<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">' + esc(o.preheader || '') + '&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>' +
      tbl('background:' + K.bg + ';') + '<tr><td align="center" style="padding:32px 12px 44px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;border-collapse:separate;">' +
        '<tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;border-radius:28px;overflow:hidden;border:1px solid ' + K.line + ';">' + tbl() +
          '<tr><td style="height:4px;line-height:4px;font-size:0;background:' + K.acc + ';background-image:linear-gradient(90deg,' + K.ink + ' 0%,' + K.ink + ' 55%,' + K.acc2 + ' 80%,' + K.acc + ' 100%);">&nbsp;</td></tr>' +
          '<tr><td class="px" align="center" style="padding:32px 48px 28px;border-bottom:1px solid ' + K.line + ';">' + (site ? '<a href="' + esc(site + '/') + '" style="text-decoration:none;">' + logoHtml(ctx) + '</a>' : logoHtml(ctx)) + '</td></tr>' +
          o.body + gap(44) + (o.shop ? '' : services(ctx)) +
        '</table></td></tr>' +
        '<tr><td class="px" align="center" style="padding:28px 40px 0;font-family:' + F + ';font-size:12px;line-height:1.7;color:' + K.muted + ';">' + foot +
          '<div style="margin-top:18px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + K.dim + ';">© ' + year + ' ' + esc(String(ctx.store || '').toUpperCase()) + (host ? ' · <a href="' + esc(site + '/') + '" style="color:' + K.dim + ';text-decoration:none;">' + esc(host) + '</a>' : '') + '</div></td></tr>' +
      '</table></td></tr></table></body></html>';
  }
  // Совместимость: старые места вызывают frame(ctx, subject, preheader, inner, footer)
  function frame(ctx, subject, preheader, inner, footer) { return shell(ctx, { subject: subject, preheader: preheader, body: inner, footer: footer, shop: ctx.shop }); }

  /* «Снова в наличии». ctx: { tpl, store, product, color, colorHex, size, price, oldPrice, url, image, unsubscribe, contacts } */
  function render(ctx) {
    var v = { product: ctx.product, color: ctx.color, size: ctx.size || 'любой', price: ctx.price, store: ctx.store };
    var t = ctx.tpl, subject = fill(t.subject, v), heading = fill(t.heading, v), buttonText = fill(t.button, v);
    var paras = fill(t.text, v).split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    var footer = fill(t.footer, v);
    var body = hero('Снова в наличии', heading, paras.map(function (x) { return esc(x).replace(/\n/g, '<br>'); }).join('<br><br>')) +
      (ctx.image ? gap(32) + sec('<img src="' + esc(ctx.image) + '" width="504" alt="' + esc(v.product) + '" style="display:block;width:100%;max-width:504px;height:auto;border:0;background:' + K.soft + ';">') : '') +
      gap(28) + sec(tbl('border-top:1px solid ' + K.ink + ';') + '<tr><td style="padding:18px 0 0;font-family:' + F + ';">' +
        '<div style="font-size:16px;font-weight:500;color:' + K.ink + ';">' + esc(v.product) + '</div>' +
        '<div style="margin-top:6px;font-size:13px;color:' + K.dim + ';">' + (ctx.colorHex ? '<span style="display:inline-block;width:9px;height:9px;border-radius:5px;background:' + esc(ctx.colorHex) + ';vertical-align:middle;margin-right:6px;border:1px solid #C2C7CD;"></span>' : '') + esc(v.color) + ' · размер ' + esc(v.size) + '</div></td>' +
        '<td align="right" valign="top" style="padding:18px 0 0;font-family:' + F + ';font-size:16px;font-weight:500;color:' + K.ink + ';white-space:nowrap;">' + esc(v.price) + (ctx.oldPrice ? '<div style="margin-top:6px;font-size:13px;font-weight:400;color:' + K.dim + ';text-decoration:line-through;">' + esc(ctx.oldPrice) + '</div>' : '') + '</td></tr></table>') +
      gap(30) + sec(btn(buttonText, ctx.url));
    var foot = esc(footer) + (ctx.unsubscribe ? '<br><a href="' + esc(ctx.unsubscribe) + '" style="color:' + K.muted + ';">Отменить это уведомление</a>' : '');
    var html = shell(ctx, { subject: subject, preheader: v.product + ' — ' + v.color + ', ' + v.size, body: body, footer: foot });
    var text = heading + '\n\n' + paras.join('\n\n') + '\n\n' + v.product + ' — ' + v.color + ', размер ' + v.size + ', ' + v.price + '\n' + buttonText + ': ' + ctx.url + '\n\n' + footer + (ctx.unsubscribe ? '\nОтменить уведомление: ' + ctx.unsubscribe : '');
    return { subject: subject, html: html, text: text };
  }

  /* Письмо о заказе. ctx: { kind: 'customer' | 'shop', store, logo, order, money(n), payLabel, url, contacts } */
  function renderOrder(ctx) {
    var o = ctx.order, c = o.customer, d = o.delivery || {}, money = ctx.money, shop = ctx.kind === 'shop';
    var paid = o.payment && o.payment.status === 'paid', pickup = d && !d.address;
    var subject = shop ? 'Новый заказ № ' + o.number + ' на ' + money(o.total) : (paid ? 'Заказ № ' + o.number + ' оплачен' : 'Заказ № ' + o.number + ' принят') + ' — ' + ctx.store;
    var eb = shop ? 'Новый заказ' : (paid ? 'Оплата получена' : 'Заказ принят');
    var title = shop ? 'Заказ № ' + o.number + ' · ' + money(o.total) : 'Спасибо, ' + c.firstName + '!';
    var lead = shop ? esc(ctx.payLabel.charAt(0).toUpperCase() + ctx.payLabel.slice(1)) + '. Проверьте наличие и подготовьте отправку.'
      : 'Заказ № ' + esc(o.number) + (paid ? ' оплачен и уже передан в сборку.' : ' принят.') + (pickup ? ' Напишем на почту, когда его можно будет забрать.' : ' Как только передадим посылку в СДЭК, пришлём трек-номер для отслеживания.');
    var when = o.createdAt ? new Date(o.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
    var items = tbl() + o.items.map(function (i, k) { return itemRow({ name: i.name, color: i.color, size: i.size, qty: i.qty, image: i.image || '' }, esc(money(i.price * i.qty)), k === 0); }).join('') + '</table>';
    var sums = tbl() + sumRow('Товары', money(o.subtotal)) +
      (o.saleDiscount ? sumRow('Скидка по акции', '−' + money(o.saleDiscount)) : '') +
      (o.promoDiscount ? sumRow('Промокод ' + o.promoCode, '−' + money(o.promoDiscount)) : '') +
      sumRow(d.name || 'Доставка', d.price ? money(d.price) : 'бесплатно') +
      (o.bonusUsed ? sumRow('Оплачено бонусами', '−' + money(o.bonusUsed)) : '') +
      gapRow(10) + sumRow('Итого', money(o.total), true) +
      (!shop && o.bonusEarn > 0 ? sumRow(o.bonusCredited ? 'Начислено бонусов' : 'Бонусы за заказ', '+' + o.bonusEarn) : '') + '</table>';
    var where = [d.city, d.address].filter(Boolean).map(esc).join('<br>');
    var cols = shop
      ? [['Покупатель', esc(c.firstName + ' ' + c.lastName) + '<br>' + esc(c.phone) + '<br>' + mailto(c.email)], ['Доставка', '<b style="font-weight:500;color:' + K.ink + ';">' + esc(d.name || '—') + '</b>' + (where ? '<br>' + where : '') + (o.comment ? '<br><span style="color:' + K.dim + ';">«' + esc(o.comment) + '»</span>' : '')]]
      : [['Доставка', '<b style="font-weight:500;color:' + K.ink + ';">' + esc(d.name || '—') + '</b>' + (where ? '<br>' + where : '')], ['Оплата', esc(ctx.payLabel.charAt(0).toUpperCase() + ctx.payLabel.slice(1)) + (o.comment ? '<br><span style="color:' + K.dim + ';">Комментарий: ' + esc(o.comment) + '</span>' : '')]];
    var body = hero(eb, title, lead) +
      gap(30) + sec(tbl() + '<tr><td style="font-family:' + F + ';font-size:12px;letter-spacing:1px;color:' + K.dim + ';">ЗАКАЗ № ' + esc(o.number) + '</td><td align="right" style="font-family:' + F + ';font-size:12px;color:' + K.dim + ';">' + esc(when) + '</td></tr></table>') +
      (shop ? '' : gap(16) + sec(progress(paid || o.payment.method !== 'online' ? 1 : 0))) +
      gap(22) + rule() + sec(items) + rule() + gap(18) + sec(sums) +
      gap(34) + sec(infoCols(cols)) +
      gap(36) + sec(btn(shop ? 'Открыть в панели' : 'Открыть заказ', ctx.url));
    var foot = shop ? '' : 'Вопросы по заказу — ' + writeUs(ctx) + ' или в поддержку в личном кабинете.';
    var html = shell(ctx, { subject: subject, preheader: shop ? c.firstName + ' ' + c.lastName + ' — ' + money(o.total) : lead.replace(/<[^>]+>/g, ''), body: body, footer: foot, shop: shop });
    var text = [eb, title, lead.replace(/<[^>]+>/g, ''), ''].concat(o.items.map(function (i) { return i.name + ' — ' + [i.color, 'размер ' + i.size, i.qty + ' шт.'].filter(Boolean).join(', ') + ' — ' + money(i.price * i.qty); }))
      .concat(['', 'Итого: ' + money(o.total), [d.city, d.address].filter(Boolean).join(', ') ? 'Адрес: ' + [d.city, d.address].filter(Boolean).join(', ') : '', (shop ? 'Открыть в панели: ' : 'Открыть заказ: ') + ctx.url]).join('\n');
    return { subject: subject, html: html, text: text };
  }
  function gapRow(h) { return '<tr><td colspan="2" style="height:' + h + 'px;line-height:' + h + 'px;font-size:0;">&nbsp;</td></tr>'; }

  /* Код подтверждения почты. ctx: { store, logo, code, minutes, name } */
  function renderCode(ctx) {
    var code = String(ctx.code), spaced = code.slice(0, 3) + ' ' + code.slice(3);
    var reset = ctx.purpose === 'reset';
    var subject = spaced + (reset ? ' — код для нового пароля ' : ' — код подтверждения ') + ctx.store;
    var cells = code.split('').map(function (dg) {
      return '<td align="center" style="width:48px;height:62px;background:' + K.soft + ';border:1px solid ' + K.line + ';border-radius:14px;font-family:' + F + ';font-size:30px;font-weight:500;color:' + K.ink + ';">' + esc(dg) + '</td>';
    });
    var boxes = '<table role="presentation" class="code" cellpadding="0" cellspacing="6" border="0" style="margin:0 -6px;border-collapse:separate;"><tr>' + cells.slice(0, 3).join('') + '<td style="width:12px;"></td>' + cells.slice(3).join('') + '</tr></table>';
    var body = hero(reset ? 'Восстановление пароля' : 'Подтверждение почты', ctx.name ? ctx.name + ', ваш код' : 'Ваш код', reset ? 'Введите его на сайте и придумайте новый пароль.' : 'Введите его на сайте, чтобы закончить регистрацию.') +
      gap(30) + sec(boxes) + gap(18) + sec(p('Код действует ' + ctx.minutes + ' минут. Никому его не сообщайте — сотрудники ' + esc(ctx.store) + ' никогда не спрашивают коды.', 'font-size:13px;color:' + K.dim + ';'));
    var footer = reset ? 'Если вы не запрашивали новый пароль, просто удалите это письмо — без кода пароль не изменится.' : 'Если вы не регистрировались на сайте ' + esc(ctx.store) + ', просто удалите это письмо — без кода аккаунт не создастся.';
    var text = reset ? 'Код для нового пароля: ' + code + '\nВведите его на сайте и придумайте новый пароль. Код действует ' + ctx.minutes + ' минут.\n\nЕсли вы не запрашивали новый пароль, просто удалите это письмо.' : 'Код подтверждения: ' + code + '\nВведите его на сайте, чтобы закончить регистрацию. Код действует ' + ctx.minutes + ' минут.\n\nЕсли вы не регистрировались на сайте ' + ctx.store + ', просто удалите это письмо.';
    return { subject: subject, html: shell(ctx, { subject: subject, preheader: 'Код: ' + spaced + '. Действует ' + ctx.minutes + ' минут.', body: body, footer: footer }), text: text };
  }

  /* Письмо после регистрации. ctx: { store, logo, name, url, bonusPercent, promo: { code, text }, contacts } */
  /* Напоминание о корзине (только с согласия покупателя). ctx: { store, logo, name, items: [{ name, color, size, qty, price (строка), image, left }], url, off } */
  function renderCartReminder(ctx) {
    var subject = (ctx.name ? ctx.name + ', в' : 'В') + 'ещи из корзины всё ещё ждут вас';
    var rows = ctx.items.slice(0, 3).map(function (i, k) {
      var bt = k ? 'border-top:1px solid ' + K.line + ';' : '';
      return '<tr><td width="76" valign="top" style="padding:16px 0;' + bt + '"><div style="width:64px;background:' + K.soft + ';border-radius:12px;overflow:hidden;">' + (i.image ? '<img src="' + esc(i.image) + '" width="64" alt="" style="display:block;width:64px;height:auto;border:0;">' : '<div style="height:85px;line-height:85px;font-size:0;">&nbsp;</div>') + '</div></td>' +
        '<td valign="top" style="padding:16px 12px 16px 14px;' + bt + 'font-family:' + F + ';"><div style="font-size:15px;font-weight:500;color:' + K.ink + ';">' + esc(i.name) + '</div><div style="margin-top:6px;font-size:13px;color:' + K.dim + ';">' + esc([i.color, i.size ? 'размер ' + i.size : ''].filter(Boolean).join(' · ')) + (i.left ? ' · <span style="color:#9a5a2c;">осталось ' + i.left + ' шт.</span>' : '') + '</div></td>' +
        '<td align="right" valign="top" style="padding:16px 0;' + bt + 'font-family:' + F + ';font-size:15px;color:' + K.ink + ';white-space:nowrap;">' + esc(i.price) + '</td></tr>';
    }).join('');
    var body = hero('Ваша корзина', 'Вещи всё ещё ждут вас', 'Мы сохранили корзину. Вещей в наличии немного — если что-то нравится, лучше не откладывать.') +
      gap(26) + sec(tbl('border-top:1px solid ' + K.line + ';border-bottom:1px solid ' + K.line + ';') + rows + '</table>' + (ctx.items.length > 3 ? '<p style="margin:10px 0 0;font-family:' + F + ';font-size:13px;color:' + K.dim + ';">И ещё ' + (ctx.items.length - 3) + ' в корзине</p>' : '')) +
      gap(28) + sec(btn('Вернуться к корзине', ctx.url)) +
      gap(18) + sec(p('Это одно напоминание — больше писем об этой корзине не будет.', 'font-size:13px;color:' + K.dim + ';'));
    var text = subject + '\n\n' + ctx.items.map(function (i) { return '— ' + i.name + ' (' + [i.color, i.size].filter(Boolean).join(', ') + ') ' + i.price; }).join('\n') + '\n\nКорзина: ' + ctx.url + '\n\nОтказаться от напоминаний: ' + ctx.off;
    return { subject: subject, html: shell(ctx, { subject: subject, preheader: 'Мы сохранили вашу корзину', body: body, footer: 'Вы получили письмо, потому что включили напоминания о корзине. <a href="' + esc(ctx.off) + '" style="color:' + K.muted + ';text-decoration:underline;">Отключить напоминания</a>' }), text: text };
  }
  /* Подарочный сертификат получателю. ctx: { store, logo, code, amount (строка «10 000 ₽»), toName, fromName, message, expires (строка), url } */
  function renderGift(ctx) {
    var fromShop = ctx.fromName && ctx.fromName === ctx.store;
    var subject = fromShop ? 'Подарок от ' + ctx.store + ': сертификат на ' + ctx.amount : (ctx.fromName ? ctx.fromName + ' дарит вам' : 'Вам подарили') + ' сертификат ' + ctx.store + ' на ' + ctx.amount;
    var card = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td bgcolor="#16181C" style="background:#16181C;background-image:radial-gradient(120% 120% at 10% 0%,#3d424b 0%,#1d2026 45%,#0d0e10 100%);border-radius:22px;padding:26px 28px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:' + F + ';font-size:13px;letter-spacing:6px;color:#FFFFFF;">' + esc(String(ctx.store || '').toUpperCase()) + '</td><td align="right" style="font-family:' + F + ';font-size:11px;color:#9AA0A8;">Подарочный сертификат</td></tr>' +
      '<tr><td colspan="2" style="padding:34px 0 30px;font-family:' + F + ';font-size:52px;font-weight:300;letter-spacing:-1.5px;line-height:1;color:#FFFFFF;">' + esc(ctx.amount) + '</td></tr>' +
      '<tr><td style="font-family:' + F + ';font-size:12px;color:#C9CDD3;">' + esc([ctx.toName ? 'Для ' + ctx.toName : '', ctx.fromName ? 'от ' + ctx.fromName : ''].filter(Boolean).join(' · ')) + '</td><td align="right" style="font-family:' + F + ';font-size:13px;letter-spacing:2px;color:#FFFFFF;">' + esc(ctx.code) + '</td></tr></table></td></tr></table>';
    var body = hero('Подарок для вас', ctx.toName ? ctx.toName + ', это вам' : 'Это вам', 'Сертификат можно потратить на любые вещи ' + esc(ctx.store) + ' — целиком или за несколько покупок.') +
      gap(28) + sec(card) +
      (ctx.message ? gap(22) + sec('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr><td style="padding:18px 22px;border-radius:18px;background:' + K.soft + ';border:1px solid ' + K.line + ';font-family:' + F + ';font-size:15px;line-height:1.65;color:' + K.text + ';font-style:italic;">«' + esc(ctx.message) + '»' + (ctx.fromName ? '<div style="margin-top:8px;font-style:normal;font-size:13px;color:' + K.dim + ';">— ' + esc(ctx.fromName) + '</div>' : '') + '</td></tr></table>') : '') +
      gap(26) + sec(steps(['Выберите вещи на сайте и перейдите к оформлению', 'Введите код <b style="letter-spacing:1px;">' + esc(ctx.code) + '</b> в поле «Подарочный сертификат»', 'Если заказ дороже — доплатите разницу; если дешевле — остаток сохранится'])) +
      gap(28) + sec(btn('Выбрать подарок', ctx.url)) +
      gap(18) + sec(p('Действует до ' + esc(ctx.expires) + '.', 'font-size:13px;color:' + K.dim + ';'));
    var text = subject + '\n\nКод: ' + ctx.code + '\nСумма: ' + ctx.amount + (ctx.message ? '\n\n«' + ctx.message + '»' : '') + '\n\nВведите код при оформлении заказа на ' + ctx.url + '\nДействует до ' + ctx.expires + '.';
    return { subject: subject, html: shell(ctx, { subject: subject, preheader: 'Код ' + ctx.code + ' на ' + ctx.amount, body: body, footer: 'Это письмо отправлено по просьбе покупателя — подарок для вас. Рассылок не будет.' }), text: text };
  }
  function renderWelcome(ctx) {
    var subject = 'Добро пожаловать в ' + ctx.store;
    var perks = [];
    if (ctx.bonusPercent) perks.push(['Бонусы ' + ctx.bonusPercent + '%', 'Возвращаем с каждой покупки. 1 бонус = 1 ₽, можно оплатить ими заказ целиком.']);
    perks.push(['Доставка по России', 'СДЭК в пункт выдачи рядом с домом или курьером до двери.']);
    perks.push(['Личный кабинет', 'Заказы, трек-номера, бонусный счёт и данные для быстрого оформления.']);
    var list = tbl() + perks.map(function (x, i) {
      return '<tr><td width="54" valign="top" style="padding:18px 0;' + (i ? 'border-top:1px solid ' + K.line + ';' : '') + 'font-family:' + F + ';font-size:13px;font-weight:500;letter-spacing:1px;color:' + K.dim + ';">' + (i + 1) + '</td>' +
        '<td valign="top" style="padding:18px 0;' + (i ? 'border-top:1px solid ' + K.line + ';' : '') + 'font-family:' + F + ';"><div style="font-size:15px;font-weight:500;color:' + K.ink + ';">' + esc(x[0]) + '</div><div style="margin-top:5px;font-size:14px;line-height:1.6;color:' + K.muted + ';">' + esc(x[1]) + '</div></td></tr>';
    }).join('') + '</table>';
    var body = hero('Добро пожаловать', ctx.name ? 'Здравствуйте, ' + ctx.name + '!' : 'Здравствуйте!', 'Вы зарегистрировались в ' + esc(ctx.store) + '. Рады видеть вас среди наших покупателей — вот что теперь доступно.') +
      (ctx.promo && ctx.promo.code ? gap(30) + sec(plate('Ваш промокод', ctx.promo.code, esc(ctx.promo.text || ''), { spacing: 5 })) : '') +
      gap(24) + sec(list) + gap(30) + sec(btn('Перейти в магазин', ctx.url));
    var footer = 'Вы получили это письмо, потому что зарегистрировались на сайте ' + esc(ctx.store) + '. Рассылок не будет — только письма о ваших заказах.';
    var text = 'Здравствуйте' + (ctx.name ? ', ' + ctx.name : '') + '!\n\nВы зарегистрировались в ' + ctx.store + '.\n\n' + perks.map(function (x) { return x[0] + ': ' + x[1]; }).join('\n') + (ctx.promo && ctx.promo.code ? '\nПромокод: ' + ctx.promo.code : '') + '\n\nМагазин: ' + ctx.url;
    return { subject: subject, html: shell(ctx, { subject: subject, preheader: 'Бонусы с каждой покупки, доставка по России и личный кабинет', body: body, footer: footer }), text: text };
  }

  /* Поддержка. kind: customer — ответ магазина покупателю; shop — новое сообщение покупателя магазину.
     ctx: { kind, store, logo, name, number, topic, orderNumber, text, url, contacts } */
  function renderSupport(ctx) {
    var shop = ctx.kind === 'shop';
    var subject = shop ? 'Обращение № ' + ctx.number + ' — ' + (ctx.name || 'покупатель') : 'Ответ поддержки ' + ctx.store + ' — обращение № ' + ctx.number;
    var about = ctx.topic + (ctx.orderNumber ? ' · заказ № ' + ctx.orderNumber : '');
    var quote = tbl('background:' + K.soft + ';') + '<tr><td style="border-left:2px solid ' + K.ink + ';padding:22px 24px;font-family:' + F + ';font-size:15px;line-height:1.75;color:' + K.ink + ';white-space:pre-line;">' + esc(ctx.text) + '</td></tr></table>';
    var body = hero(shop ? 'Новое сообщение' : 'Поддержка', shop ? (ctx.name || 'Покупатель') + ' пишет' : (ctx.name ? ctx.name + ', мы ответили' : 'Мы ответили'), 'Обращение № ' + esc(ctx.number) + ' · ' + esc(about)) +
      gap(28) + sec(quote) + gap(30) + sec(btn(shop ? 'Ответить в панели' : 'Открыть переписку', ctx.url));
    var footer = shop ? '' : 'Ответить можно в личном кабинете, в разделе «Поддержка».';
    var text = (shop ? (ctx.name || 'Покупатель') + ' пишет' : 'Ответ поддержки ' + ctx.store) + ' — обращение № ' + ctx.number + ' (' + about + ')\n\n' + ctx.text + '\n\n' + ctx.url;
    return { subject: subject, html: shell(ctx, { subject: subject, preheader: String(ctx.text).slice(0, 90), body: body, footer: footer, shop: shop }), text: text };
  }

  /* Служебное письмо владельцу (остатки и т. п.). ctx: { store, logo, subject, eyebrow, title, lead, rows: [[название, подпись, справа]], button, url, test } */
  function renderNotice(ctx) {
    var subject = (ctx.test ? 'Проверка · ' : '') + ctx.subject;
    var body = hero(ctx.eyebrow, ctx.title, esc(ctx.lead) + (ctx.test ? '<br><br>Это проверочное письмо из панели — так будут выглядеть настоящие уведомления.' : '')) +
      gap(28) + sec(listRows((ctx.rows || []).map(function (r) { return [esc(r[0]), esc(r[1] || ''), esc(r[2] || '')]; }))) +
      (ctx.url ? gap(30) + sec(btn(ctx.button || 'Открыть панель', ctx.url)) : '');
    var text = ctx.title + '\n\n' + (ctx.rows || []).map(function (r) { return '• ' + r.filter(Boolean).join(' · '); }).join('\n') + (ctx.url ? '\n\n' + ctx.url : '');
    return { subject: subject, html: shell(ctx, { subject: subject, preheader: ctx.lead, body: body, footer: '', shop: true }), text: text };
  }

  /* Заказ передан в доставку. ctx: { store, logo, name, number, carrier, track, trackUrl, url, contacts } */
  function renderTracking(ctx) {
    var subject = 'Заказ № ' + ctx.number + ' отправлен — трек-номер ' + ctx.track;
    var body = hero('Заказ в пути', (ctx.name ? ctx.name + ', ваш заказ' : 'Ваш заказ') + ' отправлен', 'Заказ № ' + esc(ctx.number) + ' передан в ' + esc(ctx.carrier) + '. По трек-номеру можно следить, где посылка, и узнать, когда она прибудет. О прибытии в пункт выдачи ' + esc(ctx.carrier) + ' сообщит сам.') +
      gap(28) + sec(progress(2)) + gap(28) + sec(plate('Трек-номер ' + ctx.carrier, ctx.track)) +
      gap(30) + sec(btn('Отследить посылку', ctx.trackUrl)) + gap(22) + sec(textLink('Открыть заказ на сайте', ctx.url));
    var footer = 'Если появятся вопросы по доставке, ' + writeUs(ctx) + ' или в поддержку в личном кабинете.';
    var text = 'Заказ № ' + ctx.number + ' отправлен через ' + ctx.carrier + '.\nТрек-номер: ' + ctx.track + '\nОтследить: ' + ctx.trackUrl + '\n\nЗаказ на сайте: ' + ctx.url;
    return { subject: subject, html: shell(ctx, { subject: subject, preheader: 'Трек-номер ' + ctx.track + ' — отследите посылку', body: body, footer: footer }), text: text };
  }

  /* Деньги возвращены. ctx: { store, logo, name, number, amount, items, delivery, full, url, contacts } */
  function renderRefund(ctx) {
    var sum = Number(ctx.amount || 0).toLocaleString('ru-RU') + ' ₽';
    var subject = 'Возврат ' + sum + ' по заказу № ' + ctx.number;
    var rows = (ctx.items || []).map(function (i) { return [esc(i.name), esc([i.color, 'размер ' + i.size].filter(Boolean).join(' · ')), i.qty + ' шт.']; });
    if (ctx.delivery) rows.push(['Доставка', '', '']);
    var body = hero('Возврат денег', (ctx.name ? ctx.name + ', мы' : 'Мы') + ' вернули деньги', (ctx.full ? 'Оформили полный возврат по заказу № ' : 'Оформили возврат по заказу № ') + esc(ctx.number) + '.') +
      gap(28) + sec(plate('Сумма возврата', sum, 'Придёт туда же, откуда была оплата', { spacing: 0, size: 32 })) +
      (rows.length ? gap(28) + sec('<div style="font-family:' + F + ';font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:' + K.dim + ';padding-bottom:12px;">За что возврат</div>' + listRows(rows)) : '') +
      gap(26) + sec(infoCols([['На карту', 'Обычно 1–3 рабочих дня. Иногда банку нужно до 30 дней.'], ['Через СБП', 'Как правило, быстрее — в течение дня.']])) +
      gap(30) + sec(textLink('Открыть заказ на сайте', ctx.url));
    var footer = 'Если деньги не пришли за 10 рабочих дней, ' + writeUs(ctx) + ' — поможем разобраться.';
    var list = rows.map(function (r) { return r[0] + (r[1] ? ', ' + r[1] : '') + (r[2] ? ' — ' + r[2] : ''); });
    var text = 'Возврат по заказу № ' + ctx.number + ': ' + sum + '.\n' + (list.length ? 'За что: ' + list.join('; ').replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '') + '\n' : '') + 'Деньги придут на карту или счёт, с которого была оплата.\n\nЗаказ на сайте: ' + ctx.url;
    return { subject: subject, html: shell(ctx, { subject: subject, preheader: 'Возврат ' + sum + ' — деньги уже в пути', body: body, footer: footer }), text: text };
  }

  // Возврат через СДЭК: номер заявки и что делать покупателю
  function renderReturnShip(ctx) {
    var subject = 'Возврат по заказу № ' + ctx.number + ' — номер СДЭК ' + ctx.track;
    var rows = (ctx.items || []).map(function (i) { return [esc(i.name), esc([i.color, 'размер ' + i.size].filter(Boolean).join(' · ')), i.qty + ' шт.']; });
    var body = hero('Возврат', (ctx.name ? ctx.name + ', возврат' : 'Возврат') + ' оформлен', 'Мы оформили отправку вещей по заказу № ' + esc(ctx.number) + ' обратно к нам через СДЭК. Осталось отнести посылку в пункт.') +
      gap(28) + sec(plate('Номер для пункта СДЭК', ctx.track, 'Назовите его сотруднику пункта')) +
      gap(30) + sec(steps(['Упакуйте вещи с бирками — лучше в исходную упаковку.', 'Отнесите посылку в <b style="font-weight:600;">любой пункт выдачи СДЭК</b> и назовите номер. Заполнять ничего не нужно — заявка уже оформлена.', 'Когда посылка придёт к нам и мы её проверим, вернём деньги и пришлём письмо.'])) +
      (rows.length ? gap(30) + sec('<div style="font-family:' + F + ';font-size:11px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:' + K.dim + ';padding-bottom:12px;">Что возвращаете</div>' + listRows(rows)) : '') +
      gap(22) + sec(p(ctx.cost ? 'Платить в пункте СДЭК ничего не нужно. Стоимость обратной доставки — ' + esc(Number(ctx.cost).toLocaleString('ru-RU')) + ' ₽, её удержим из суммы возврата, если вещь надлежащего качества.' : 'Платить в пункте СДЭК ничего не нужно.', 'font-size:13px;color:' + K.muted + ';')) +
      gap(28) + sec(textLink('Открыть заказ на сайте', ctx.url));
    var footer = 'Если появятся вопросы, ' + writeUs(ctx) + ' или в поддержку в личном кабинете.';
    var text = 'Возврат по заказу № ' + ctx.number + ' оформлен.\nНомер для пункта СДЭК: ' + ctx.track + '\n1. Упакуйте вещи с бирками.\n2. Отнесите в любой пункт СДЭК и назовите номер — заполнять ничего не нужно.\n3. Когда посылка придёт и мы её проверим, вернём деньги.' + (ctx.cost ? '\nСтоимость обратной доставки ' + ctx.cost + ' ₽ удержим из суммы возврата.' : '') + '\n\nЗаказ: ' + ctx.url;
    return { subject: subject, html: shell(ctx, { subject: subject, preheader: 'Номер СДЭК для возврата: ' + ctx.track, body: body, footer: footer }), text: text };
  }

  var api = { DEFAULTS: DEFAULTS, renderNotice: renderNotice, renderGift: renderGift, renderCartReminder: renderCartReminder, renderReturnShip: renderReturnShip, renderRefund: renderRefund, renderTracking: renderTracking, renderSupport: renderSupport, DEFAULT_NOTIFY: DEFAULT_NOTIFY, PLACEHOLDERS: PLACEHOLDERS, tplOf: tplOf, readyRequests: readyRequests, render: render, renderOrder: renderOrder, renderCode: renderCode, renderWelcome: renderWelcome };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mail = api;
})(this);
