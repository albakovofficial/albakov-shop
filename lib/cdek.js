'use strict';
/* СДЭК API v2: поиск населённого пункта (с областью) и пункты выдачи в нём.
   Ключи — «Интеграция» в личном кабинете СДЭК (Account и Secure password). Ответы кэшируются,
   чтобы не дёргать СДЭК на каждую букву. */

const PROD = 'https://api.cdek.ru/v2', TEST = 'https://api.edu.cdek.ru/v2';

function create(getCreds) {
  let token = null, tokenUntil = 0, tokenFor = '';
  const cache = new Map();

  function base() { return getCreds().test ? TEST : PROD; }
  function ready() { const c = getCreds(); return !!(c.id && c.secret); }

  async function auth() {
    const c = getCreds(), sig = (c.test ? 't:' : 'p:') + c.id;
    if (token && Date.now() < tokenUntil && tokenFor === sig) return token;
    if (!c.id || !c.secret) throw new Error('СДЭК не подключён');
    const r = await fetch(base() + '/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: c.id, client_secret: c.secret }).toString()
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error('СДЭК не принял ключи' + (j.error_description ? ': ' + j.error_description : ''));
    token = j.access_token; tokenFor = sig; tokenUntil = Date.now() + Math.max(60, (Number(j.expires_in) || 3600) - 120) * 1000;
    return token;
  }
  async function get(path, params, ttlMs) {
    const qs = new URLSearchParams(params).toString(), key = base() + path + '?' + qs, hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.data;
    let r = await fetch(base() + path + '?' + qs, { headers: { Authorization: 'Bearer ' + await auth() } });
    if (r.status === 401) { token = null; r = await fetch(base() + path + '?' + qs, { headers: { Authorization: 'Bearer ' + await auth() } }); }
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error('СДЭК ответил ошибкой ' + r.status);
    if (cache.size > 3000) cache.clear();
    cache.set(key, { data: j, until: Date.now() + ttlMs });
    return j;
  }

  const clean = (s) => String(s || '').trim();
  // «Мурино, Ленинградская обл., Россия» → { city: 'Мурино', region: 'Ленинградская обл.' }
  function splitFull(full) {
    const parts = clean(full).split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.length && /^росси/i.test(parts[parts.length - 1])) parts.pop();
    return { city: parts[0] || '', region: parts.slice(1).join(', ') };
  }

  async function cities(q) {
    q = clean(q).slice(0, 60);
    if (q.length < 2) return [];
    let list = [];
    try {
      const s = await get('/location/suggest/cities', { name: q, country_code: 'RU' }, 864e5);
      list = (Array.isArray(s) ? s : []).map((x) => Object.assign({ code: x.code }, splitFull(x.full_name)));
    } catch (e) { list = []; }
    if (!list.length) {
      // запасной путь: точное название
      const s = await get('/location/cities', { country_codes: 'RU', city: q, size: 20 }, 864e5);
      list = (Array.isArray(s) ? s : []).map((x) => ({ code: x.code, city: clean(x.city), region: [clean(x.sub_region), clean(x.region)].filter(Boolean).join(', ') }));
    }
    const seen = new Set();
    return list.filter((x) => x.code && x.city && !seen.has(x.code) && seen.add(x.code)).slice(0, 12);
  }

  async function points(cityCode) {
    cityCode = Number(cityCode);
    if (!cityCode) return [];
    const s = await get('/deliverypoints', { city_code: cityCode, country_code: 'RU', type: 'ALL' }, 6 * 36e5);
    return (Array.isArray(s) ? s : [])
      .filter((p) => p && p.code && p.location && p.is_handout !== false && p.take_only !== true)
      .map((p) => ({
        code: clean(p.code), type: p.type === 'POSTAMAT' ? 'postamat' : 'pvz', name: clean(p.name),
        address: clean(p.location.address) || clean(p.location.address_full), full: clean(p.location.address_full),
        city: clean(p.location.city), region: clean(p.location.region), cityCode: Number(p.location.city_code) || cityCode,
        lat: Number(p.location.latitude) || null, lon: Number(p.location.longitude) || null,
        hours: clean(p.work_time), metro: clean(p.nearest_metro_station), note: clean(p.address_comment).slice(0, 300),
        fitting: !!p.is_dressing_room,
        // оплата при получении: пункт принимает наложенный платёж (наличными и/или картой)
        cod: p.allowed_cod === true || (p.allowed_cod !== false && p.type !== 'POSTAMAT' && (!!p.have_cash || !!p.have_cashless)),
        cash: !!p.have_cash, card: !!p.have_cashless
      }))
      .sort((a, b) => (a.type === b.type ? a.address.localeCompare(b.address, 'ru') : a.type === 'pvz' ? -1 : 1));
  }

  async function cityByCode(code) {
    const s = await get('/location/cities', { code: Number(code), size: 1 }, 864e5);
    const x = Array.isArray(s) && s[0]; if (!x) return null;
    return { code: Number(x.code), city: clean(x.city), region: [clean(x.sub_region), clean(x.region)].filter(Boolean).join(', ') };
  }
  async function check() { token = null; await auth(); return true; }

  // Стоимость и срок доставки по тарифу: из города отправки в город покупателя
  async function calc(fromCode, toCode, tariff, pkg) {
    const key = ['calc', fromCode, toCode, tariff, pkg.weight, pkg.length, pkg.width, pkg.height].join(':'), hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.data;
    const j = await send('POST', '/calculator/tariff', { tariff_code: tariff, from_location: { code: Number(fromCode) }, to_location: { code: Number(toCode) }, packages: [{ weight: pkg.weight, length: pkg.length, width: pkg.width, height: pkg.height }] });
    if (!(Number(j.delivery_sum) > 0)) throw new Error('СДЭК не рассчитал доставку');
    const data = { sum: Number(j.delivery_sum), total: Number(j.total_sum) || Number(j.delivery_sum), min: Number(j.period_min) || 0, max: Number(j.period_max) || 0 };
    cache.set(key, { data, until: Date.now() + 6 * 36e5 });
    return data;
  }

  /* ---------- Отправления ---------- */
  async function send(method, path, body) {
    const go = async () => fetch(base() + path, { method, headers: Object.assign({ Authorization: 'Bearer ' + await auth() }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    let r = await go();
    if (r.status === 401) { token = null; r = await go(); }
    const j = await r.json().catch(() => ({}));
    const errs = [].concat(j.errors || [], ...((j.requests || []).map((q) => q.errors || [])));
    if (!r.ok) throw new Error(errs.length ? errs.map((e) => e.message).join('; ') : 'СДЭК ответил ошибкой ' + r.status);
    return j;
  }
  // Ошибки заявки приходят не сразу: создание в СДЭК асинхронное
  function requestErrors(e) {
    const bad = (e.requests || []).filter((q) => q.state === 'INVALID');
    return bad.length ? bad.map((q) => (q.errors || []).map((x) => x.message).join('; ')).filter(Boolean).join('; ') || 'СДЭК отклонил заявку' : '';
  }
  async function createOrder(body) {
    const j = await send('POST', '/orders', body);
    const err = requestErrors(j); if (err) throw new Error(err);
    if (!j.entity || !j.entity.uuid) throw new Error('СДЭК не вернул номер заявки');
    return j.entity.uuid;
  }
  async function order(uuid) {
    const j = await send('GET', '/orders/' + encodeURIComponent(uuid));
    const e = j.entity || {};
    const st = (e.statuses || []).slice().sort((a, b) => String(b.date_time).localeCompare(String(a.date_time)));
    // delivery_detail — сколько СДЭК берёт с магазина за доставку (с доп. услугами); нужно для учёта расходов
    const dd = e.delivery_detail || {}, cost = Number(dd.total_sum) || Number(dd.delivery_sum) || 0;
    return { uuid: e.uuid || uuid, number: e.cdek_number ? String(e.cdek_number) : '', status: st[0] ? st[0].code : '', statusName: st[0] ? st[0].name : '', statusAt: st[0] ? st[0].date_time : '', error: requestErrors(j), cost: cost > 0 ? Math.round(cost * 100) / 100 : 0 };
  }
  async function cancel(uuid) { await send('DELETE', '/orders/' + encodeURIComponent(uuid)); return true; }
  // Печать: СДЭК готовит PDF несколько секунд — ждём и забираем файл
  async function print(uuid, kind) {
    const path = kind === 'barcode' ? '/print/barcodes' : '/print/orders';
    const j = await send('POST', path, kind === 'barcode' ? { orders: [{ order_uuid: uuid }], copy_count: 1, format: 'A6' } : { orders: [{ order_uuid: uuid }], copy_count: 2 });
    const id = j.entity && j.entity.uuid; if (!id) throw new Error('СДЭК не начал печать');
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, i ? 1200 : 600));
      const s = await send('GET', path + '/' + id), e = s.entity || {};
      const last = (e.statuses || []).map((x) => x.code);
      if (e.url) {
        const r = await fetch(e.url, { headers: { Authorization: 'Bearer ' + await auth() } });
        if (!r.ok) throw new Error('Не удалось скачать файл из СДЭК');
        return Buffer.from(await r.arrayBuffer());
      }
      if (last.includes('INVALID') || last.includes('REMOVED')) throw new Error('СДЭК не смог сформировать документ');
    }
    throw new Error('СДЭК долго готовит документ — попробуйте ещё раз через минуту');
  }
  async function webhook(url) {
    const list = await send('GET', '/webhooks').catch(() => []);
    if ((Array.isArray(list) ? list : []).some((w) => w.url === url && w.type === 'ORDER_STATUS')) return true;
    await send('POST', '/webhooks', { url, type: 'ORDER_STATUS' });
    return true;
  }

  return { ready, cities, points, cityByCode, check, calc, createOrder, order, cancel, print, webhook };
}

module.exports = { create };
