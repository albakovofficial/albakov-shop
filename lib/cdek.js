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
        fitting: !!p.is_dressing_room
      }))
      .sort((a, b) => (a.type === b.type ? a.address.localeCompare(b.address, 'ru') : a.type === 'pvz' ? -1 : 1));
  }

  async function check() { token = null; await auth(); return true; }

  return { ready, cities, points, check };
}

module.exports = { create };
