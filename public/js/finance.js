/* Финансы магазина: доходы, расходы, себестоимость, прибыль (раздел «Финансы» в панели).
   Один модуль для сервера (настройки по умолчанию, проверка) и панели (расчёт отчёта).

   Откуда берутся цифры:
   • доходы — оплаченные заказы (день оплаты) и доходы, внесённые вручную;
   • возвраты — возвраты денег по заказам (день возврата); возврат при получении — день смены статуса на «Возврат»;
   • себестоимость — цена пошива из раздела «Себестоимость» (на момент заказа), вещи из возвратов вычитаются;
   • комиссия ЮKassa — по способу оплаты: СБП или остальные (карты, ЮMoney, SberPay, T-Pay, Alfa Pay);
   • доставка СДЭК — сколько СДЭК берёт с магазина по накладной, и обратная доставка, если её не удержали с покупателя;
   • остальные расходы — внесённые вручную, по категориям;
   • налог — УСН «Доходы»: ставка × (доходы − возвраты). */
(function (root) {
  'use strict';

  // kind: income — доход (входит в выручку и налог); purchase — закупка товара (только деньги: в прибыль идёт себестоимость);
  // variable — продажа и доставка; fixed — работа магазина; tax — уплата налогов и взносов (только деньги)
  var KINDS = [
    ['variable', 'Продажа и доставка', 'Растут вместе с заказами'],
    ['fixed', 'Работа магазина', 'Платите каждый месяц, даже без заказов'],
    ['purchase', 'Закупка товара', 'Пошив, ткани — в прибыль попадает себестоимость проданного'],
    ['tax', 'Налоги и взносы', 'Уплата налога — налог в отчёте считается сам'],
    ['income', 'Доход', 'Продажи вне сайта и другие поступления']
  ];
  var DEFAULT_CATEGORIES = [
    { id: 'sewing', name: 'Пошив и закупка товара', kind: 'purchase' },
    { id: 'fabric', name: 'Ткани и фурнитура', kind: 'purchase' },
    { id: 'ads', name: 'Реклама', kind: 'fixed' },
    { id: 'photo', name: 'Фотосъёмка', kind: 'fixed' },
    { id: 'services', name: 'Сайт, почта, сервисы', kind: 'fixed' },
    { id: 'staff', name: 'Зарплата и подрядчики', kind: 'fixed' },
    { id: 'rent', name: 'Аренда', kind: 'fixed' },
    { id: 'pack', name: 'Упаковка', kind: 'variable' },
    { id: 'ship', name: 'Доставка (вручную)', kind: 'variable' },
    { id: 'bank', name: 'Банк и прочие комиссии', kind: 'variable' },
    { id: 'taxpaid', name: 'Уплата налога и взносов', kind: 'tax' },
    { id: 'offline', name: 'Продажи вне сайта', kind: 'income' },
    { id: 'other', name: 'Прочее', kind: 'fixed' }
  ];
  function defaults() {
    return {
      taxRate: 2,                                                        // УСН «Доходы», %
      rates: { sbp: { yk: 0.4, partner: 1.5 }, other: { yk: 2.8, partner: 1 } }, // комиссия ЮKassa и партнёра, %
      partnerMin: 0.65,                                                  // комиссия партнёра не меньше, ₽ с платежа
      codFee: 0,                                                         // СДЭК за наложенный платёж, %
      costs: {},                                                         // себестоимость 1 шт.: { id товара: ₽ }
      categories: DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); })
    };
  }

  /* ---------- Проверка того, что пришло из панели ---------- */
  var num = function (v, lo, hi) { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo; };
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  var str = function (v, n) { return String(v == null ? '' : v).trim().slice(0, n); };
  function cleanSettings(v, prev) {
    var d = defaults(), p = prev || d, out = {};
    v = v && typeof v === 'object' ? v : {};
    out.taxRate = r2(num(v.taxRate != null ? v.taxRate : p.taxRate, 0, 30));
    var rt = v.rates || p.rates || d.rates;
    out.rates = {
      sbp: { yk: r2(num((rt.sbp || {}).yk, 0, 20)), partner: r2(num((rt.sbp || {}).partner, 0, 20)) },
      other: { yk: r2(num((rt.other || {}).yk, 0, 20)), partner: r2(num((rt.other || {}).partner, 0, 20)) }
    };
    out.partnerMin = r2(num(v.partnerMin != null ? v.partnerMin : p.partnerMin, 0, 1000));
    out.codFee = r2(num(v.codFee != null ? v.codFee : p.codFee, 0, 20));
    out.costs = p.costs || {};
    var kinds = KINDS.map(function (k) { return k[0]; }), seen = {};
    var cats = Array.isArray(v.categories) ? v.categories : (p.categories || d.categories);
    out.categories = cats.slice(0, 60).map(function (c) {
      var id = str(c && c.id, 30).replace(/[^\w-]/g, '') || ('c' + Math.random().toString(36).slice(2, 8));
      if (seen[id]) id += Math.random().toString(36).slice(2, 5);
      seen[id] = 1;
      return { id: id, name: str(c && c.name, 60) || 'Без названия', kind: kinds.indexOf(c && c.kind) !== -1 ? c.kind : 'fixed' };
    });
    if (!out.categories.length) out.categories = d.categories;
    return out;
  }
  function cleanCosts(v, productIds) {
    var out = {};
    Object.keys(v || {}).forEach(function (id) {
      if (productIds && productIds.indexOf(id) === -1) return;
      var c = Number(v[id]);
      if (isFinite(c) && c > 0) out[id] = r2(Math.min(c, 10000000));
    });
    return out;
  }
  // Операция, внесённая вручную: дата, категория, сумма, комментарий, фото чека
  function cleanExpense(v, settings) {
    v = v || {};
    var date = str(v.date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return { error: 'Укажите дату' };
    var amount = r2(Number(v.amount));
    if (!(amount > 0)) return { error: 'Укажите сумму больше нуля' };
    if (amount > 1000000000) return { error: 'Слишком большая сумма' };
    var cat = (settings.categories || []).find(function (c) { return c.id === v.categoryId; });
    if (!cat) return { error: 'Выберите категорию' };
    var receipt = str(v.receipt, 300);
    if (receipt && !/^\/?uploads\/[\w.-]+$/.test(receipt)) receipt = '';
    return { value: { date: date, categoryId: cat.id, amount: amount, note: str(v.note, 300), receipt: receipt } };
  }

  /* ---------- Даты и периоды ---------- */
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  // ISO-время → день по часам компьютера, на котором открыта панель
  function dayOf(iso) { var d = new Date(iso); return isNaN(d) ? '' : ymd(d); }
  function parseDay(s) { var m = String(s || '').split('-'); return new Date(+m[0], +m[1] - 1, +m[2]); }
  var MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var MON3 = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  // kind: week | month | quarter | year | custom; shift — на сколько периодов назад (0 — текущий)
  function period(kind, shift, from, to, now) {
    now = now ? new Date(now) : new Date();
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate()), a, b, label, prev;
    shift = Number(shift) || 0;
    if (kind === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(from || '') && /^\d{4}-\d{2}-\d{2}$/.test(to || '')) {
      if (from > to) { var t = from; from = to; to = t; }
      a = parseDay(from); b = parseDay(to);
      var len = Math.round((b - a) / 864e5) + 1;
      prev = { from: ymd(new Date(a.getFullYear(), a.getMonth(), a.getDate() - len)), to: ymd(new Date(a.getFullYear(), a.getMonth(), a.getDate() - 1)) };
      label = fmtDay(from) + ' — ' + fmtDay(to);
      return { kind: 'custom', from: from, to: to, label: label, prev: prev, prevLabel: 'прошлым ' + len + ' дн.' };
    }
    if (kind === 'week') {
      var wd = (d.getDay() + 6) % 7;
      a = new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd - 7 * shift); b = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 6);
      prev = { from: ymd(new Date(a.getFullYear(), a.getMonth(), a.getDate() - 7)), to: ymd(new Date(a.getFullYear(), a.getMonth(), a.getDate() - 1)) };
      return { kind: kind, shift: shift, from: ymd(a), to: ymd(b), label: fmtDay(ymd(a)) + ' — ' + fmtDay(ymd(b)), prev: prev, prevLabel: 'прошлой неделе' };
    }
    if (kind === 'quarter') {
      var q0 = Math.floor(d.getMonth() / 3) * 3;
      a = new Date(d.getFullYear(), q0 - 3 * shift, 1); b = new Date(a.getFullYear(), a.getMonth() + 3, 0);
      var pa = new Date(a.getFullYear(), a.getMonth() - 3, 1);
      prev = { from: ymd(pa), to: ymd(new Date(a.getFullYear(), a.getMonth(), 0)) };
      return { kind: kind, shift: shift, from: ymd(a), to: ymd(b), label: (Math.floor(a.getMonth() / 3) + 1) + ' квартал ' + a.getFullYear(), prev: prev, prevLabel: 'прошлому кварталу' };
    }
    if (kind === 'year') {
      a = new Date(d.getFullYear() - shift, 0, 1); b = new Date(a.getFullYear(), 11, 31);
      prev = { from: (a.getFullYear() - 1) + '-01-01', to: (a.getFullYear() - 1) + '-12-31' };
      return { kind: kind, shift: shift, from: ymd(a), to: ymd(b), label: a.getFullYear() + ' год', prev: prev, prevLabel: 'прошлому году' };
    }
    a = new Date(d.getFullYear(), d.getMonth() - shift, 1); b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    prev = { from: ymd(new Date(a.getFullYear(), a.getMonth() - 1, 1)), to: ymd(new Date(a.getFullYear(), a.getMonth(), 0)) };
    return { kind: 'month', shift: shift, from: ymd(a), to: ymd(b), label: cap(MONTHS[a.getMonth()]) + ' ' + a.getFullYear(), prev: prev, prevLabel: MONTHS_GEN[(a.getMonth() + 11) % 12].replace(/я$/, 'ю').replace(/а$/, 'у') };
  }
  function fmtDay(s) { var d = parseDay(s); return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); }

  /* ---------- Операции: всё, что сайт считает сам, и внесённое вручную ---------- */
  var SKIP_METHODS = ['exchange'];
  // Отправление СДЭК ещё не передано в доставку (заявка создана, но посылку не сдали) — СДЭК за него не берёт
  var CDEK_WAIT = ['', 'ACCEPTED', 'CREATED', 'INVALID', 'REMOVED'];
  var shipped = function (st) { return CDEK_WAIT.indexOf(String(st || '')) === -1; };
  // Возврат денег учитывается, если его не отменили (как и везде на сайте: «pending» в ЮKassa почти всегда проходит)
  var refundOk = function (r) { return r && r.status !== 'canceled'; };
  function costOf(fin, o, i) {
    var it = o.items[i], snap = o.fin && o.fin.costs ? o.fin.costs[i] : null;
    if (snap != null && snap > 0) return snap;
    var c = it && it.productId && fin.costs ? Number(fin.costs[it.productId]) : 0;
    return c > 0 ? c : null;
  }
  // Возврат денег без выбора товаров (из кабинета ЮKassa) — вещи не известны
  function refundItemIdx(o, x) {
    for (var i = 0; i < o.items.length; i++) { var it = o.items[i]; if (it.name === x.name && (it.size || '') === (x.size || '') && (it.color || '') === (x.color || '')) return i; }
    return -1;
  }
  function payFee(fin, o, money) {
    var r = (fin.rates || {})[o.payment.type === 'sbp' ? 'sbp' : 'other'] || { yk: 0, partner: 0 };
    var partner = money * (r.partner || 0) / 100;
    if (r.partner > 0) partner = Math.max(partner, fin.partnerMin || 0);
    return money * (r.yk || 0) / 100 + partner;
  }
  var PAY_TYPE = { sbp: 'СБП', bank_card: 'карта', yoo_money: 'ЮMoney', sberbank: 'SberPay', tinkoff_bank: 'T-Pay', alfabank: 'Alfa Pay' };

  // Все операции (без ограничения по датам). Каждая: { date, dir: in|out, line, cat, amount, note, order, expense, auto, cogs }
  // line — строка отчёта: sales, refunds, cogs, variable, fixed, purchase, taxpaid
  function operations(input) {
    var fin = input.finance || defaults(), cats = {}, out = [];
    (fin.categories || []).forEach(function (c) { cats[c.id] = c; });
    (input.orders || []).forEach(function (o) {
      if (!o || o.test || !o.payment) return;
      var ref = { id: o.id, number: o.number };
      // Доставка СДЭК — по каждой посылке, которую реально сдали в СДЭК: и у обменов, и у заказов, от которых отказались
      // (сумма одна на заказ: при новой заявке она заменяется, при отмене заявки — пропадает)
      if (o.cdek && shipped(o.cdek.status) && o.fin && o.fin.cdekCost > 0) out.push({ date: dayOf(o.cdek.createdAt || o.createdAt), dir: 'out', line: 'variable', cat: 'Доставка СДЭК', amount: o.fin.cdekCost, note: [o.payment.method === 'exchange' ? 'Обмен' : '', (o.delivery && o.delivery.city) || ''].filter(Boolean).join(' · '), order: ref, auto: true });
      // Обратная доставка: СДЭК берёт с магазина всегда; если её удержали из возврата денег — удержание уже уменьшило сумму возврата
      (o.returns || []).forEach(function (r) {
        if (r.cost > 0 && shipped(r.status)) out.push({ date: dayOf(r.createdAt || o.createdAt), dir: 'out', line: 'variable', cat: 'Обратная доставка СДЭК', amount: r.cost, note: r.deducted ? 'Удержана из возврата денег' : 'За счёт магазина', order: ref, auto: true });
      });
      if (SKIP_METHODS.indexOf(o.payment.method) !== -1) return; // обмен: денег и новых продаж нет
      var paid = o.payment.status === 'paid' || o.payment.status === 'refunded';
      if (!paid) return;
      var pd = dayOf(o.payment.paidAt || o.createdAt), money = Math.max(0, Number(o.total) || 0);
      var gift = o.kind === 'gift';
      var what = gift ? 'Подарочный сертификат' : o.items.map(function (it) { return it.name + (it.size ? ', ' + it.size : '') + (it.qty > 1 ? ' × ' + it.qty : ''); }).join(' · ');
      if (money > 0) {
        out.push({ date: pd, dir: 'in', line: 'sales', cat: gift ? 'Подарочный сертификат' : 'Продажа', amount: money, note: what, order: ref, auto: true, pay: o.payment.method === 'online' ? (PAY_TYPE[o.payment.type] || 'онлайн') : o.payment.method === 'cod' ? 'при получении' : '' });
        if (o.payment.method === 'online') out.push({ date: pd, dir: 'out', line: 'variable', cat: 'Комиссия ЮKassa', amount: payFee(fin, o, money), note: (o.payment.type === 'sbp' ? 'СБП' : 'Карта и другие способы') + ' · ' + money.toLocaleString('ru-RU') + ' ₽', order: ref, auto: true });
        if (o.payment.method === 'cod' && fin.codFee > 0) out.push({ date: pd, dir: 'out', line: 'variable', cat: 'СДЭК: наложенный платёж', amount: money * fin.codFee / 100, note: 'Оплата при получении', order: ref, auto: true });
      }
      // Себестоимость проданного — в день оплаты; отменённый заказ вернулся на склад
      if (!gift && o.status !== 'canceled') {
        var cogs = 0, units = 0, miss = 0;
        o.items.forEach(function (it, i) {
          if (it.gift) return;
          var c = costOf(fin, o, i), q = Number(it.qty) || 0;
          units += q;
          if (c == null) miss += q; else cogs += c * q;
        });
        if (units) out.push({ date: pd, dir: 'out', line: 'cogs', cat: 'Себестоимость', amount: cogs, note: what, order: ref, auto: true, missing: miss, units: units, hidden: true });
      }
      // Возвраты денег и вещи, вернувшиеся на склад
      var refunded = 0;
      (o.refunds || []).forEach(function (r) {
        if (!refundOk(r)) return;
        var amt = Number(r.amount) || 0; refunded += amt;
        var d = dayOf(r.at || o.createdAt), back = 0;
        (r.items || []).forEach(function (x) { var i = refundItemIdx(o, x); if (i !== -1) { var c = costOf(fin, o, i); if (c != null) back += c * (Number(x.qty) || 0); } });
        if (amt > 0) out.push({ date: d, dir: 'out', line: 'refunds', cat: 'Возврат покупателю', amount: amt, note: r.reason || (r.items || []).map(function (x) { return x.name + (x.size ? ', ' + x.size : ''); }).join(' · '), order: ref, auto: true });
        if (back > 0 && o.status !== 'canceled') out.push({ date: d, dir: 'in', line: 'cogs', cat: 'Себестоимость', amount: -back, note: 'Вещи вернулись', order: ref, auto: true, hidden: true });
      });
      // Возврат при получении или вручную: деньги вернули не через ЮKassa
      if (o.status === 'returned' && money > refunded + 0.5 && o.payment.method !== 'online') {
        var h = (o.history || []).filter(function (x) { return /→ Возврат/.test(x.text); }).slice(-1)[0];
        var dd = dayOf((h && h.at) || o.payment.paidAt || o.createdAt), back2 = 0;
        o.items.forEach(function (it, i) { var c = costOf(fin, o, i); if (c != null) back2 += c * Math.max(0, (Number(it.qty) || 0) - (Number(it.refundedQty) || 0)); });
        out.push({ date: dd, dir: 'out', line: 'refunds', cat: 'Возврат покупателю', amount: money - refunded, note: 'Возврат без онлайн-оплаты', order: ref, auto: true });
        if (back2 > 0) out.push({ date: dd, dir: 'in', line: 'cogs', cat: 'Себестоимость', amount: -back2, note: 'Вещи вернулись', order: ref, auto: true, hidden: true });
      }
    });
    (input.expenses || []).forEach(function (e) {
      var c = cats[e.categoryId] || { name: 'Без категории', kind: 'fixed' };
      var line = c.kind === 'income' ? 'sales' : c.kind === 'tax' ? 'taxpaid' : c.kind;
      out.push({ date: e.date, dir: c.kind === 'income' ? 'in' : 'out', line: line, cat: c.name, catId: e.categoryId, kind: c.kind, amount: Number(e.amount) || 0, note: e.note || '', receipt: e.receipt || '', expense: e.id, auto: false });
    });
    out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return out;
  }

  /* ---------- Отчёт о прибыли за период ---------- */
  function pnl(ops, from, to, fin) {
    var s = { sales: 0, salesOrders: 0, otherIncome: 0, refunds: 0, refundOps: 0, cogs: 0, missingUnits: 0, units: 0, variable: 0, fixed: 0, purchase: 0, taxpaid: 0, orders: 0, byCat: {}, ads: 0 };
    ops.forEach(function (x) {
      if (x.date < from || x.date > to) return;
      if (x.line === 'sales') { s.sales += x.amount; if (x.order) { s.salesOrders += x.amount; if (x.cat === 'Продажа') s.orders++; } else s.otherIncome += x.amount; }
      else if (x.line === 'refunds') { s.refunds += x.amount; s.refundOps++; }
      else if (x.line === 'cogs') { s.cogs += x.amount; if (x.amount > 0) { s.missingUnits += x.missing || 0; s.units += x.units || 0; } }
      else s[x.line] += x.amount;
      if (x.line === 'variable' || x.line === 'fixed' || x.line === 'purchase' || x.line === 'taxpaid') {
        var k = x.line + '\u0000' + x.cat;
        s.byCat[k] = (s.byCat[k] || 0) + x.amount;
        if (x.catId === 'ads') s.ads += x.amount;
      }
    });
    s.revenue = s.sales - s.refunds;
    s.gross = s.revenue - s.cogs;
    s.contribution = s.gross - s.variable;
    s.ebt = s.contribution - s.fixed;
    s.tax = Math.max(0, s.revenue) * (fin.taxRate || 0) / 100;
    s.net = s.ebt - s.tax;
    s.expensesAll = s.cogs + s.variable + s.fixed + s.tax;
    s.avg = s.orders ? s.salesOrders / s.orders : 0;
    s.adsPerOrder = s.orders ? s.ads / s.orders : 0;
    // живые деньги
    s.cashIn = s.sales;
    s.cashOut = s.refunds + s.purchase + s.variable + s.fixed + s.taxpaid;
    s.cash = s.cashIn - s.cashOut;
    s.taxLeft = Math.max(0, s.tax - s.taxpaid);
    s.lines = function (line) {
      return Object.keys(s.byCat).filter(function (k) { return k.split('\u0000')[0] === line; }).map(function (k) { return { name: k.split('\u0000')[1], amount: s.byCat[k] }; }).sort(function (a, b) { return b.amount - a.amount; });
    };
    return s;
  }

  /* ---------- Прибыль по моделям ---------- */
  function byProduct(input, from, to) {
    var fin = input.finance || defaults(), m = {};
    (input.orders || []).forEach(function (o) {
      if (!o || o.test || !o.payment || o.kind === 'gift' || SKIP_METHODS.indexOf(o.payment.method) !== -1 || o.status === 'canceled') return;
      if (o.payment.status !== 'paid' && o.payment.status !== 'refunded') return;
      var pd = dayOf(o.payment.paidAt || o.createdAt);
      // скидка по промокоду делится между вещами пропорционально цене
      var k = o.subtotal > 0 ? Math.max(0, o.subtotal - (o.promoDiscount || 0)) / o.subtotal : 1;
      o.items.forEach(function (it, i) {
        if (it.gift || !it.productId) return;
        var row = m[it.productId] || (m[it.productId] = { id: it.productId, name: it.name, units: 0, revenue: 0, cogs: 0, missing: false, price: it.price, lastSale: '' });
        var c = costOf(fin, o, i), q = Number(it.qty) || 0;
        if (pd >= from && pd <= to) { row.units += q; row.revenue += it.price * q * k; if (c == null) row.missing = true; else row.cogs += c * q; }
        if (pd > row.lastSale) row.lastSale = pd;
      });
      (o.refunds || []).concat(o.status === 'returned' && o.payment.method !== 'online' ? [{ at: ((o.history || []).filter(function (x) { return /→ Возврат/.test(x.text); }).slice(-1)[0] || {}).at, items: o.items.map(function (it) { return { name: it.name, size: it.size, color: it.color, qty: Math.max(0, it.qty - (it.refundedQty || 0)) }; }), offline: true }] : []).forEach(function (r) {
        if (!refundOk(r)) return;
        var d = dayOf(r.at || o.createdAt); if (d < from || d > to) return;
        (r.items || []).forEach(function (x) {
          var i = refundItemIdx(o, x); if (i === -1) return;
          var it = o.items[i], row = m[it.productId]; if (!row) return;
          var q = Number(x.qty) || 0, c = costOf(fin, o, i);
          row.units -= q; row.revenue -= it.price * q * k; if (c != null) row.cogs -= c * q;
        });
      });
    });
    var prod = {}; (input.products || []).forEach(function (p) { prod[p.id] = p; });
    return Object.keys(m).map(function (id) {
      var r = m[id], p = prod[id];
      if (p) r.name = p.name;
      r.cost = fin.costs && fin.costs[id] > 0 ? fin.costs[id] : null;
      r.price = p ? p.price : r.price;
      r.profit = r.revenue - r.cogs;
      r.perUnit = r.units > 0 ? r.profit / r.units : 0;
      r.margin = r.revenue > 0 ? r.profit / r.revenue : 0;
      return r;
    }).filter(function (r) { return r.units > 0 || r.revenue > 0; })
      // без себестоимости прибыль не известна — такие модели в конце, по выручке
      .sort(function (a, b) { return (a.missing - b.missing) || (a.missing ? b.revenue - a.revenue : b.profit - a.profit); });
  }

  /* ---------- Склад ---------- */
  function stock(input, salesFrom) {
    var fin = input.finance || defaults(), atCost = 0, atPrice = 0, units = 0, noCost = 0, items = [];
    var sold = {}, last = {};
    (input.orders || []).forEach(function (o) {
      if (!o || o.test || !o.payment || o.kind === 'gift' || o.status === 'canceled' || SKIP_METHODS.indexOf(o.payment.method) !== -1) return;
      if (o.payment.status !== 'paid' && o.payment.status !== 'refunded' && o.payment.method !== 'cod') return;
      var d = dayOf(o.payment.paidAt || o.createdAt);
      o.items.forEach(function (it) {
        if (!it.productId) return;
        if (!last[it.productId] || d > last[it.productId]) last[it.productId] = d;
        if (d >= salesFrom) { var k = it.productId + '|' + (it.colorId || '') + '|' + it.size; sold[k] = (sold[k] || 0) + (Number(it.qty) || 0); sold[it.productId] = (sold[it.productId] || 0) + (Number(it.qty) || 0); }
      });
    });
    (input.products || []).forEach(function (p) {
      var cost = fin.costs && fin.costs[p.id] > 0 ? fin.costs[p.id] : null, left = 0;
      (p.colors || []).forEach(function (c) {
        (c.sizes || []).forEach(function (s) {
          var n = Math.max(0, Number(s.stock) || 0); left += n;
          if (!n && !sold[p.id + '|' + c.id + '|' + s.size]) return;
          items.push({ productId: p.id, name: p.name, color: c.name, size: s.size, stock: n, sold: sold[p.id + '|' + c.id + '|' + s.size] || 0 });
        });
      });
      units += left; atPrice += left * (Number(p.price) || 0);
      if (cost) atCost += left * cost; else if (left) noCost += left;
      p._left = left;
    });
    var prods = (input.products || []).map(function (p) { var l = p._left; delete p._left; return { id: p.id, name: p.name, left: l, sold: sold[p.id] || 0, last: last[p.id] || '' }; });
    return {
      atCost: atCost, atPrice: atPrice, units: units, noCost: noCost,
      fastest: prods.filter(function (x) { return x.sold > 0; }).sort(function (a, b) { return b.sold - a.sold; })[0] || null,
      // «лежит» — не продавался 30 дней или ни разу
      stale: prods.filter(function (x) { return x.left > 0 && (!x.last || x.last < salesFrom); }).sort(function (a, b) { return (a.last || '0') < (b.last || '0') ? -1 : 1; })[0] || null,
      low: items.filter(function (x) { return x.sold > 0 && x.stock <= 1; }).sort(function (a, b) { return a.stock - b.stock || b.sold - a.sold; }).slice(0, 3)
    };
  }

  /* ---------- По месяцам ---------- */
  function months(ops, endDay, n, fin) {
    var e = parseDay(endDay), out = [];
    for (var i = n - 1; i >= 0; i--) {
      var a = new Date(e.getFullYear(), e.getMonth() - i, 1), b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
      var s = pnl(ops, ymd(a), ymd(b), fin);
      out.push({ key: ymd(a).slice(0, 7), label: MON3[a.getMonth()], full: cap(MONTHS[a.getMonth()]), year: a.getFullYear(), p: s });
    }
    return out;
  }

  /* ---------- Полный отчёт ---------- */
  function report(input, per) {
    var fin = input.finance || defaults(), ops = operations(input);
    var cur = pnl(ops, per.from, per.to, fin), prev = pnl(ops, per.prev.from, per.prev.to, fin);
    var products = byProduct(input, per.from, per.to);
    var today = ymd(new Date()), d30 = ymd(new Date(Date.now() - 30 * 864e5));
    var st = stock(input, d30);
    var missingProducts = (input.products || []).filter(function (p) { return !(fin.costs && fin.costs[p.id] > 0); });
    var r = { period: per, ops: ops, cur: cur, prev: prev, products: products, stock: st, months: months(ops, per.to < today ? per.to : today, per.kind === 'year' ? 12 : 6, fin), missingProducts: missingProducts, finance: fin };
    r.tips = tips(r);
    return r;
  }

  var pct = function (a, b) { return b ? Math.round((a - b) / Math.abs(b) * 100) : null; };
  var rub = function (n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; };
  // Что видно из отчёта: до трёх наблюдений простыми словами
  function tips(r) {
    var c = r.cur, p = r.prev, out = [], lbl = r.period.prevLabel;
    if (!c.sales && !c.variable && !c.fixed) return [{ kind: 'n', title: 'Пока пусто', text: 'За этот период нет ни продаж, ни расходов.', hint: 'Выберите другой период или внесите расходы в «Операциях».' }];
    var gN = pct(c.net, p.net), gR = pct(c.revenue, p.revenue);
    if (p.revenue > 0 && gN != null) {
      if (c.net > p.net && gR != null && gN > gR) out.push({ kind: 'g', title: 'Хорошо', text: 'Прибыль выросла на ' + gN + '%, а выручка — на ' + gR + '%.', hint: 'Расходы растут медленнее продаж — магазин становится выгоднее.' });
      else if (c.net > p.net) out.push({ kind: 'g', title: 'Хорошо', text: 'Прибыль выросла на ' + gN + '% к ' + lbl + '.', hint: 'Было ' + rub(p.net) + ', стало ' + rub(c.net) + '.' });
      else if (c.net < p.net) out.push({ kind: 'w', title: 'Обратить внимание', text: 'Прибыль снизилась на ' + Math.abs(gN) + '% к ' + lbl + '.', hint: biggestGrowth(c, p) });
    }
    if (c.orders && p.orders && p.adsPerOrder > 0) {
      var ga = pct(c.adsPerOrder, p.adsPerOrder);
      if (ga >= 10) out.push({ kind: 'w', title: 'Обратить внимание', text: 'Реклама на один заказ подорожала: ' + rub(p.adsPerOrder) + ' → ' + rub(c.adsPerOrder) + '.', hint: 'Проверьте, какие объявления приводят покупателей, — в «Аналитике».' });
      else if (ga <= -10) out.push({ kind: 'g', title: 'Хорошо', text: 'Реклама на один заказ подешевела: ' + rub(p.adsPerOrder) + ' → ' + rub(c.adsPerOrder) + '.', hint: 'Реклама стала работать лучше.' });
    }
    if (c.sales > 0 && c.refunds / c.sales > 0.08) out.push({ kind: 'w', title: 'Обратить внимание', text: 'Возвраты — ' + Math.round(c.refunds / c.sales * 100) + '% продаж.', hint: 'Частая причина — размер. Проверьте таблицы размеров у моделей с возвратами.' });
    var withCost = r.products.filter(function (x) { return !x.missing && x.units > 0; });
    if (withCost.length >= 2) {
      var best = withCost.slice().sort(function (a, b) { return b.perUnit - a.perUnit; }), lo = best[best.length - 1];
      if (best[0].perUnit > 0 && lo.perUnit > 0 && best[0].perUnit / lo.perUnit >= 1.5) out.push({ kind: 'n', title: 'Совет', text: '«' + best[0].name + '» приносит ' + rub(best[0].perUnit) + ' с вещи — в ' + (Math.round(best[0].perUnit / lo.perUnit * 10) / 10).toString().replace('.', ',') + ' раза больше, чем «' + lo.name + '».', hint: 'Эту модель выгоднее всего продвигать в рекламе.' });
      var thin = withCost.filter(function (x) { return x.margin < 0.4; })[0];
      if (thin) out.push({ kind: 'w', title: 'Обратить внимание', text: 'У «' + thin.name + '» остаётся только ' + Math.round(thin.margin * 100) + '% цены после пошива.', hint: 'Подумайте о цене или о скидках на эту модель.' });
    }
    if (out.length < 3 && c.revenue > 0) out.push({ kind: 'n', title: 'Налог', text: 'Отложите ' + rub(c.taxLeft) + ' на налог за этот период.', hint: 'УСН ' + String(r.finance.taxRate).replace('.', ',') + '% с доходов. Уплаченный налог внесите в «Операциях» — сумма уменьшится.' });
    return out.slice(0, 3);
  }
  function biggestGrowth(c, p) {
    var rows = [['себестоимость', c.cogs - p.cogs], ['продажа и доставка', c.variable - p.variable], ['работа магазина', c.fixed - p.fixed], ['возвраты', c.refunds - p.refunds]].sort(function (a, b) { return b[1] - a[1]; });
    if (rows[0][1] > 0) return 'Больше всего выросли расходы на ' + rows[0][0] + ': +' + rub(rows[0][1]) + '.';
    return 'Выручка ниже, чем в прошлом периоде.';
  }

  var API = { KINDS: KINDS, DEFAULT_CATEGORIES: DEFAULT_CATEGORIES, defaults: defaults, cleanSettings: cleanSettings, cleanCosts: cleanCosts, cleanExpense: cleanExpense,
    period: period, dayOf: dayOf, fmtDay: fmtDay, operations: operations, pnl: pnl, byProduct: byProduct, stock: stock, months: months, report: report, payFee: payFee, PAY_TYPE: PAY_TYPE, MONTHS: MONTHS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.Finance = API;
})(typeof window !== 'undefined' ? window : this);
