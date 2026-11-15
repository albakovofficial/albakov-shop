'use strict';
/* Модуль сервера ALBAKOV — возврат через СДЭК — обратная заявка от покупателя.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    Pricing, applyCdek, can, cdek, cdekCfg, db, fail, firstImg, mailReady, normPhone, save
  } = S;
  // функции модулей, которые подключаются позже
  const cdekCalcAny = (...a) => S.cdekCalcAny(...a);
  const giftCfg = (...a) => S.giftCfg(...a);
  const pushStaff = (...a) => S.pushStaff(...a);
  const sendReturnShipMail = (...a) => S.sendReturnShipMail(...a);
  const yk = (...a) => S.yk(...a);

  /* ---------- Возврат через СДЭК: обратная заявка от покупателя на ваш пункт ---------- */
  const returnedQty = (o, idx) => (o.returns || []).filter((r) => r.status !== 'REMOVED').reduce((s, r) => s + ((r.items.find((x) => x.idx === idx) || {}).qty || 0), 0);
  async function createReturnShip(o, b) {
    const c = cdekCfg(), sp = c.shipmentPoint, rt = c.returnTo || {}, cs = db.settings.contacts || {};
    if (!sp || !sp.code) fail(400, 'Укажите пункт отгрузки в «Отправка заказов в СДЭК» — туда придёт возврат');
    const shopPhone = normPhone(rt.phone || cs.phone || '');
    if (shopPhone.length !== 11) fail(400, 'Укажите телефон для возвратов в «Отправка заказов в СДЭК» — СДЭК позвонит, когда посылка придёт');
    const shopName = String(rt.name || String(db.settings.legal || '').split(/[,\n]/)[0] || db.settings.storeName || 'ALBAKOV').slice(0, 120);
    const pv = o.delivery && o.delivery.pvz, dr = o.delivery && o.delivery.door, fromCity = (pv && pv.cityCode) || (dr && dr.cityCode);
    if (!fromCity) fail(400, 'Город покупателя неизвестен — оформите возврат в личном кабинете СДЭК');
    const sel = [];
    for (const x of Array.isArray(b.lines) ? b.lines : []) {
      const idx = Number(x.idx), it = o.items[idx], q = Math.floor(Number(x.qty) || 0); if (!it || q <= 0) continue;
      const can = it.qty - (it.refundedQty || 0) - returnedQty(o, idx);
      if (q > can) fail(400, `«${it.name}»: можно вернуть не больше ${can} шт.`);
      sel.push({ idx, qty: q });
    }
    if (!sel.length) fail(400, 'Отметьте вещи, которые покупатель возвращает');
    const pkg = Pricing.parcelFor(sel.map((x) => ({ productId: o.items[x.idx].productId, qty: x.qty })), db.products, c);
    // откуда: пункт, где покупатель забирал заказ, или любой пункт в его городе (сдать можно в любой)
    let from = pv && pv.code;
    if (!from) { const pts = await cdek.points(fromCity).catch(() => []); const p0 = pts.find((p) => p.type === 'pvz'); if (!p0) fail(400, 'В городе покупателя нет пунктов СДЭК'); from = p0.code; }
    let cost = 0, tariff = Number(c.tariff) || 136;
    try { const r = await cdekCalcAny(fromCity, sp.cityCode, 'pvz', pkg); cost = Math.ceil(r.sum); tariff = r.tariff; } catch (e) { /* стоимость не узнали — заявку всё равно создаём */ }
    const n = (o.returns || []).length + 1;
    const body = {
      type: 1, is_client_return: true, number: 'ALB-' + o.number + '-R' + n + (o.returnTry ? '-' + o.returnTry : ''), tariff_code: tariff,
      shipment_point: from, delivery_point: sp.code,
      sender: { name: `${o.customer.lastName} ${o.customer.firstName}`.trim(), phones: [{ number: '+' + o.customer.phone }] },
      recipient: { name: shopName, phones: [{ number: '+' + shopPhone }] },
      packages: [{ number: '1', weight: pkg.weight, length: pkg.length, width: pkg.width, height: pkg.height, comment: 'Возврат одежды',
        items: sel.map((x) => { const it = o.items[x.idx]; return { name: `${it.name}${it.color ? ', ' + it.color : ''}, ${it.size}`.slice(0, 255), ware_key: `${it.productId}-${it.size}`.slice(0, 50), payment: { value: 0 }, cost: it.price, weight: Math.max(1, Math.floor(pkg.weight / sel.reduce((s, y) => s + y.qty, 0))), amount: x.qty }; }) }],
      comment: 'Возврат по заказу № ' + o.number
    };
    let uuid;
    try { uuid = await cdek.createOrder(body); } catch (e) { o.returnTry = (o.returnTry || 0) + 1; save(); fail(502, 'СДЭК: ' + e.message); }
    const ret = { uuid, number: '', status: 'ACCEPTED', statusName: 'Заявка принята', createdAt: new Date().toISOString(), cost, from, items: sel.map((x) => ({ idx: x.idx, name: o.items[x.idx].name, color: o.items[x.idx].color || '', size: o.items[x.idx].size, qty: x.qty })) };
    o.returns = o.returns || []; o.returns.push(ret); save();
    for (let i = 0; i < 4 && !ret.number; i++) { await new Promise((r) => setTimeout(r, 1500)); try { await syncReturns(o); } catch (e) { /* дождёмся уведомления */ } }
    if (ret.error) { o.returns = o.returns.filter((x) => x !== ret); save(); fail(400, 'СДЭК отклонил заявку: ' + ret.error); }
    return ret;
  }
  async function syncReturns(o) {
    for (const r of o.returns || []) {
      if (!r.uuid || r.status === 'DELIVERED' || r.status === 'REMOVED') continue;
      const info = await cdek.order(r.uuid);
      const was = r.status;
      Object.assign(r, { number: info.number || r.number, status: info.status || r.status, statusName: info.statusName || r.statusName, statusAt: info.statusAt || r.statusAt, error: info.error || '' }, info.cost > 0 ? { cost: info.cost } : {});
      if (r.status === 'DELIVERED' && was !== 'DELIVERED') pushStaff('returnIn', { title: 'Возврат пришёл на склад', body: 'Заказ № ' + o.number + ': ' + r.items.map((x) => x.name + ' ' + x.size + (x.qty > 1 ? ' ×' + x.qty : '')).join(', ') + '. Проверьте вещи и завершите возврат.', url: '/admin', tag: 'ret-' + o.id, icon: firstImg(o) });
      if (r.number && !r.mailedAt && mailReady()) { try { await sendReturnShipMail(o, r); r.mailedAt = new Date().toISOString(); } catch (e) { console.error('Письмо о возврате не отправлено:', e.message); } }
    }
    save();
  }
  async function syncCdek(o) {
    if (!o.cdek || !o.cdek.uuid || !cdek.ready()) return;
    await applyCdek(o, await cdek.order(o.cdek.uuid));
  }
  function payReady() { const p = db.settings.payment || {}, k = yk(); return p.provider === 'yookassa' && !!(k.shopId && k.secret); }
  // Хиты продаж: товары, которых больше всего купили за 90 дней (без отменённых и неоплаченных онлайн-заказов).
  // Наружу уходит только порядок товаров — без количества продаж. Выключается в «Главной странице» панели.
  const HITS_DAYS = 90;
  function hitIds() {
    const home = (db.settings && db.settings.home) || {};
    if (home.hitsAuto === false) return [];
    const since = Date.now() - HITS_DAYS * 864e5, sold = new Map();
    for (const o of db.orders) {
      if (o.test || o.status === 'canceled' || o.status === 'returned' || (o.payment && o.payment.method === 'exchange') || Date.parse(o.createdAt) < since) continue;
      if (o.payment && o.payment.method === 'online' && o.payment.status !== 'paid') continue;
      for (const i of o.items || []) sold.set(i.productId, (sold.get(i.productId) || 0) + (Number(i.qty) || 0));
    }
    const live = new Set(db.products.filter((p) => p.active !== false).map((p) => p.id));
    return [...sold].filter(([id, n]) => n > 0 && live.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([id]) => id);
  }
  // Настройки витрины: всё, кроме служебного (15.11.2026). Почта и события уведомлений владельца, ключи СДЭК и пункт отгрузки наружу не отдаются
  const PRIVATE_SETTINGS = ['ownerNotify', 'seo'];
  function publicSettings() {
    const out = Object.assign({}, db.settings, { cdek: { services: (cdekCfg().services) || {} } });
    for (const k of PRIVATE_SETTINGS) delete out[k];
    if (out.payment) out.payment = Object.assign({}, out.payment, { yookassa: undefined });
    return out;
  }
  function publicState() {
    return {
      hits: hitIds(),
      payReady: payReady(),
      giftCfg: (({ enabled, nominals, min, max, months }) => ({ enabled, nominals, min, max, months }))(giftCfg()),
      mailReady: mailReady(),
      cdekReady: cdek.ready(),
      // ключ СДЭК и пункт отгрузки покупателям не нужны — наружу только услуги
      settings: publicSettings(),
      categories: db.categories,
      sizeCharts: db.sizeCharts,
      products: db.products.filter((p) => p.active !== false),
      promotions: db.promotions,
      pages: db.pages
    };
  }

  return {
    createReturnShip, payReady, publicState, returnedQty, syncCdek, syncReturns
  };
};
