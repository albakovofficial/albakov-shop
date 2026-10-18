/* Минимальный клиент S3 (Selectel и другие S3-совместимые хранилища) без внешних зависимостей.
   Подпись запросов — AWS Signature V4, адресация path-style: https://s3.ru-1.storage.selcloud.ru/<bucket>/<key> */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const http = require('http');

const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
// Кодирование по правилам S3: всё, кроме A-Z a-z 0-9 - _ . ~
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/* Подпись запроса. headers — объект (имена в любом регистре), payloadHash — sha256 тела (hex).
   Возвращает заголовки, которые нужно отправить. */
function sign({ method, host, path, query = {}, headers = {}, payloadHash, accessKey, secretKey, region, date = new Date() }) {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const h = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  for (const k of Object.keys(headers)) h[k.toLowerCase()] = String(headers[k]).trim();
  const names = Object.keys(h).sort();
  const canonicalHeaders = names.map((k) => k + ':' + h[k] + '\n').join('');
  const signedHeaders = names.join(';');
  const canonicalQuery = Object.keys(query).sort().map((k) => enc(k) + '=' + enc(query[k])).join('&');
  const canonicalPath = path.split('/').map(enc).join('/');
  const canonical = [method, canonicalPath, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n');
  const kSign = hmac(hmac(hmac(hmac('AWS4' + secretKey, day), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSign).update(toSign).digest('hex');
  h.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  delete h.host;
  return { headers: h, canonicalQuery, canonicalPath, canonical };
}

function client(cfg) {
  const u = new URL(cfg.endpoint);
  const lib = u.protocol === 'http:' ? http : https;
  // Регион для подписи: из настроек или из адреса (s3.ru-1.storage.selcloud.ru → ru-1)
  const region = cfg.region || ((u.hostname.match(/^s3\.([a-z0-9-]+)\./) || [])[1]) || 'ru-1';
  const base = (key) => '/' + cfg.bucket + (key ? '/' + key : '');

  function request(method, key, { query, body, bodyFile, size, payloadHash, headers, toFile } = {}) {
    return new Promise((resolve, reject) => {
      const ph = payloadHash || sha256hex(body || '');
      const s = sign({ method, host: u.host, path: base(key), query, headers, payloadHash: ph, accessKey: cfg.accessKey, secretKey: cfg.secretKey, region });
      const len = bodyFile ? size : body ? Buffer.byteLength(body) : 0;
      if (method === 'PUT' || method === 'POST') s.headers['content-length'] = String(len);
      const req = lib.request({ method, hostname: u.hostname, port: u.port || undefined, path: s.canonicalPath + (s.canonicalQuery ? '?' + s.canonicalQuery : ''), headers: s.headers, timeout: 120000 }, (res) => {
        if (toFile && res.statusCode === 200) {
          const out = fs.createWriteStream(toFile);
          res.pipe(out); out.on('finish', () => resolve({ status: 200 })); out.on('error', reject); return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 300) {
            const code = (text.match(/<Code>([^<]+)<\/Code>/) || [])[1] || '';
            const msg = (text.match(/<Message>([^<]+)<\/Message>/) || [])[1] || '';
            const e = new Error(`S3 ответило ${res.statusCode}${code ? ' ' + code : ''}${msg ? ': ' + msg : ''}`); e.status = res.statusCode; e.code = code;
            return reject(e);
          }
          resolve({ status: res.statusCode, text, headers: res.headers });
        });
      });
      req.on('timeout', () => req.destroy(new Error('S3 не отвечает (таймаут)')));
      req.on('error', reject);
      if (bodyFile) fs.createReadStream(bodyFile).on('error', reject).pipe(req);
      else req.end(body || undefined);
    });
  }
  const fileHash = (file) => new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });

  return {
    region,
    async putFile(key, file, contentType) {
      const size = fs.statSync(file).size;
      return request('PUT', key, { bodyFile: file, size, payloadHash: await fileHash(file), headers: { 'content-type': contentType || 'application/octet-stream' } });
    },
    async putText(key, text) { return request('PUT', key, { body: text, headers: { 'content-type': 'text/plain; charset=utf-8' } }); },
    async getFile(key, file) { return request('GET', key, { toFile: file }); },
    async del(key) { return request('DELETE', key); },
    async list(prefix) {
      const out = []; let token = '';
      for (let i = 0; i < 100; i++) {
        const query = { 'list-type': '2', prefix: prefix || '' };
        if (token) query['continuation-token'] = token;
        const r = await request('GET', '', { query });
        const re = /<Contents>([\s\S]*?)<\/Contents>/g; let m;
        while ((m = re.exec(r.text))) {
          const tag = (t) => ((m[1].match(new RegExp('<' + t + '>([^<]*)</' + t + '>')) || [])[1] || '');
          out.push({ key: tag('Key').replace(/&amp;/g, '&'), size: Number(tag('Size')), modified: tag('LastModified') });
        }
        if (!/<IsTruncated>true<\/IsTruncated>/.test(r.text)) break;
        token = (r.text.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/) || [])[1];
        if (!token) break;
      }
      return out;
    }
  };
}

module.exports = { client, sign, sha256hex };
