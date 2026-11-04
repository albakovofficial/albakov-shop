/* Web Push без сторонних библиотек: подпись VAPID (ES256) и шифрование aes128gcm (RFC 8291, RFC 8188).
   Уведомление приходит в браузер или в приложение на экране «Домой» (iPhone — iOS 16.4 и новее, Android — Chrome и др.). */
const crypto = require('crypto');
const https = require('https');

const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// Пара ключей сервера (VAPID): открытый — 65 байт P-256 без сжатия, закрытый — в формате JWK
function generateKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const pub = Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)]);
  return { publicKey: b64u(pub), privateJwk: jwk };
}

function vapidHeader(endpoint, keys, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject || 'mailto:info@example.com' }));
  const key = crypto.createPrivateKey({ key: keys.privateJwk, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + claims), { key, dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + head + '.' + claims + '.' + b64u(sig) + ', k=' + keys.publicKey;
}

// Шифрование тела для одного получателя (одна запись, разделитель 0x02)
function encrypt(payload, p256dh, auth) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error('Неверные ключи подписки');
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, authSecret, keyInfo, 32));
  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

// Отправка: { status } — 201 доставлено в сервис браузера; 404/410 — подписки больше нет, её надо удалить
function send(sub, data, keys, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    let body;
    try { body = encrypt(JSON.stringify(data), sub.p256dh, sub.auth); } catch (e) { resolve({ status: 0, error: e.message }); return; }
    let u; try { u = new URL(sub.endpoint); } catch (e) { resolve({ status: 0, error: 'bad endpoint' }); return; }
    if (u.protocol !== 'https:') { resolve({ status: 0, error: 'endpoint is not https' }); return; }
    const req = https.request({ method: 'POST', hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, timeout: 10000, headers: {
      'Content-Type': 'application/octet-stream', 'Content-Encoding': 'aes128gcm', 'Content-Length': body.length,
      TTL: String(opts.ttl || 86400), Urgency: opts.urgency || 'normal', Authorization: vapidHeader(sub.endpoint, keys, opts.subject)
    } }, (res) => { res.resume(); res.on('end', () => resolve({ status: res.statusCode })); });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.end(body);
  });
}

module.exports = { generateKeys, encrypt, send, vapidHeader, b64u, unb64u };
