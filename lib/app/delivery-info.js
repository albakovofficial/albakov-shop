'use strict';
/* Модуль сервера ALBAKOV — подсказки адреса и трек-номер.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    Mail, PUBLIC_URL, cdekCfg, db, sendMail
  } = S;
  // функции модулей, которые подключаются позже
  const brandLogo = (...a) => S.brandLogo(...a);

  /* ---------------- Подсказки адреса ---------------- */
  const geoCache = new Map();
  const geoNorm = (v) => String(v || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
  async function streetSuggest(q, city, region) {
    q = String(q || '').replace(/\s+/g, ' ').trim().slice(0, 80); city = String(city || '').trim().slice(0, 80); region = String(region || '').trim().slice(0, 80);
    if (q.length < 3 || !city) return [];
    const key = geoNorm(city + '|' + q);
    const hit = geoCache.get(key); if (hit && hit.until > Date.now()) return hit.items;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 4000);
    let j;
    try {
      const qs = new URLSearchParams({ q: q + ', ' + city + (region ? ', ' + region : ''), limit: '15' }).toString() + '&layer=house&layer=street';
      const r = await fetch('https://photon.komoot.io/api/?' + qs, { headers: { 'User-Agent': 'ALBAKOV shop (' + PUBLIC_URL + ')' }, signal: ctrl.signal });
      j = await r.json();
    } catch (e) { return []; } finally { clearTimeout(timer); }
    const want = geoNorm(city), seen = new Set(), items = [];
    for (const f of (j && j.features) || []) {
      const pr = f.properties || {};
      if (pr.countrycode && pr.countrycode !== 'RU') continue;
      // только этот населённый пункт: улица с таким же названием в соседнем городе не подойдёт
      if (![pr.city, pr.town, pr.village, pr.district, pr.locality, pr.county, pr.state].some((v) => geoNorm(v) === want)) continue;
      const street = String(pr.street || (pr.type === 'street' ? pr.name : '') || '').trim(); if (!street) continue;
      const house = String(pr.housenumber || '').trim();
      const label = street + (house ? ', ' + house : '');
      if (seen.has(label)) continue; seen.add(label);
      items.push({ street, house, label, postcode: String(pr.postcode || '') });
      if (items.length >= 7) break;
    }
    if (geoCache.size > 2000) geoCache.clear();
    geoCache.set(key, { items, until: Date.now() + 864e5 });
    return items;
  }

  /* ---------------- Трек-номер ---------------- */
  const CDEK_TRACK = 'https://www.cdek.ru/ru/tracking/?order_id=';
  function sendReturnShipMail(o, r) {
    const cs = db.settings.contacts || {}, sp = cdekCfg().shipmentPoint || {};
    const m = Mail.renderReturnShip({ store: db.settings.storeName, logo: brandLogo(), name: o.customer.firstName, number: o.number, track: r.number, items: r.items,
      to: [sp.address, sp.city].filter(Boolean).join(', '), cost: r.cost, url: `${PUBLIC_URL}/order/${o.id}?t=${o.token}`, contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
    return sendMail({ to: o.customer.email, subject: m.subject, html: m.html, text: m.text });
  }
  function sendRefundMail(o, r) {
    const cs = db.settings.contacts || {};
    const m = Mail.renderRefund({ store: db.settings.storeName, logo: brandLogo(), name: o.customer.firstName, number: o.number, amount: r.amount, items: r.items, delivery: r.delivery,
      full: o.payment.status === 'refunded', url: `${PUBLIC_URL}/order/${o.id}?t=${o.token}`, contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
    return sendMail({ to: o.customer.email, subject: m.subject, html: m.html, text: m.text });
  }
  function sendTrackingMail(o) {
    const cs = db.settings.contacts || {};
    const m = Mail.renderTracking({ store: db.settings.storeName, logo: brandLogo(), name: o.customer.firstName, number: o.number, carrier: o.tracking.carrier, track: o.tracking.number,
      trackUrl: o.tracking.url, url: `${PUBLIC_URL}/order/${o.id}?t=${o.token}`, contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
    return sendMail({ to: o.customer.email, subject: m.subject, html: m.html, text: m.text });
  }

  return {
    CDEK_TRACK, sendRefundMail, sendReturnShipMail, sendTrackingMail, streetSuggest
  };
};
