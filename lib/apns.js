/* Push-уведомления Apple (APNs) для приложения ALBAKOV на iPhone — без сторонних библиотек.
   HTTP/2 к api.push.apple.com (сборки из TestFlight и App Store) или api.sandbox.push.apple.com (отладка из Xcode),
   вход — по токену JWT ES256 из ключа .p8 (Apple Developer → Keys → Apple Push Notifications service).
   Токен JWT живёт до часа — обновляем раз в 40 минут; соединения держим открытыми и переиспользуем. */
const http2 = require('http2');
const crypto = require('crypto');

const HOSTS = { production: 'https://api.push.apple.com', development: 'https://api.sandbox.push.apple.com' };
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
let jwtCache = { key: '', at: 0, jwt: '' };
const conns = {};

// Проверка ключа при сохранении в панели: .p8 читается и подписывает
function checkKey(cfg) {
  if (!/^[A-Z0-9]{10}$/.test(String(cfg.keyId || ''))) return 'Key ID — 10 латинских букв и цифр';
  if (!/^[A-Z0-9]{10}$/.test(String(cfg.teamId || ''))) return 'Team ID — 10 латинских букв и цифр';
  try { crypto.sign('sha256', Buffer.from('x'), { key: crypto.createPrivateKey(String(cfg.p8 || '')), dsaEncoding: 'ieee-p1363' }); }
  catch (e) { return 'Не получилось прочитать ключ .p8 — скопируйте весь текст файла вместе со строками BEGIN и END'; }
  return '';
}

function jwt(cfg) {
  const id = cfg.keyId + cfg.teamId;
  if (jwtCache.key === id && Date.now() - jwtCache.at < 40 * 60 * 1000) return jwtCache.jwt;
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: cfg.keyId }));
  const claims = b64u(JSON.stringify({ iss: cfg.teamId, iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + claims), { key: crypto.createPrivateKey(cfg.p8), dsaEncoding: 'ieee-p1363' });
  jwtCache = { key: id, at: Date.now(), jwt: head + '.' + claims + '.' + b64u(sig) };
  return jwtCache.jwt;
}

function conn(env) {
  const c = conns[env];
  if (c && !c.closed && !c.destroyed) return c;
  const s = http2.connect(process.env.APNS_HOST || HOSTS[env] || HOSTS.production);   // APNS_HOST — только для проверки на тестовом сервере
  s.on('error', () => { /* переподключимся при следующей отправке */ });
  s.on('goaway', () => s.close());
  s.setTimeout(5 * 60 * 1000, () => s.close());   // долго не отправляли — закрываем, при следующей отправке откроем
  conns[env] = s;
  return s;
}

/* Отправка одного уведомления. data — то же, что для web-push (title, body, url, tag, urgent).
   Ответ: { status } — 200 доставлено; 410 или 400 BadDeviceToken — приложения на телефоне больше нет, адрес надо удалить */
function send(token, data, cfg, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    let req;
    try {
      const body = JSON.stringify({
        aps: { alert: { title: data.title, body: data.body }, sound: 'default', 'thread-id': data.tag || undefined, 'interruption-level': data.urgent ? 'time-sensitive' : 'active' },
        url: data.url || '/', links: data.links || {}
      });
      const head = {
        ':method': 'POST', ':path': '/3/device/' + token,
        authorization: 'bearer ' + jwt(cfg), 'apns-topic': cfg.bundleId, 'apns-push-type': 'alert',
        'apns-priority': data.urgent ? '10' : '5', 'apns-expiration': String(Math.floor(Date.now() / 1000) + (opts.ttl || 172800)),
        'apns-collapse-id': data.tag ? String(data.tag).slice(0, 64) : undefined,
        'content-type': 'application/json'
      };
      if (!head['apns-collapse-id']) delete head['apns-collapse-id'];
      req = conn(opts.env === 'development' ? 'development' : 'production').request(head);
      let status = 0, out = '';
      req.setTimeout(10000, () => req.close(http2.constants.NGHTTP2_CANCEL));
      req.on('response', (h) => { status = h[':status']; });
      req.on('data', (d) => { out += d; });
      req.on('end', () => { let reason = ''; try { reason = JSON.parse(out).reason || ''; } catch (e) { /* пусто при 200 */ } resolve({ status, reason }); });
      req.on('error', (e) => resolve({ status: 0, error: e.message }));
      req.end(body);
    } catch (e) { resolve({ status: 0, error: e.message }); }
  });
}
const gone = (r) => r.status === 410 || (r.status === 400 && ['BadDeviceToken', 'DeviceTokenNotForTopic'].includes(r.reason));

module.exports = { send, checkKey, gone };
