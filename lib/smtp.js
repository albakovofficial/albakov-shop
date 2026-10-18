/* Минимальный SMTP-клиент без зависимостей: SSL (порт 465), STARTTLS (587) или без шифрования (для локальных ретрансляторов).
   Подходит для Яндекс 360, Mail.ru для бизнеса, Unisender Go, Mailganer, собственного почтового сервера. */
'use strict';
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

function b64(s) { return Buffer.from(String(s), 'utf8').toString('base64'); }
function wrap76(s) { return s.replace(/.{1,76}/g, '$&\r\n').trim(); }
function encWord(s) { return /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?='; }

function buildMessage({ fromName, fromEmail, to, subject, html, text, unsubscribe, inline }) {
  const boundary = 'b' + crypto.randomBytes(12).toString('hex');
  const domain = String(fromEmail).split('@')[1] || 'localhost';
  const headers = [
    `From: ${encWord(fromName || fromEmail)} <${fromEmail}>`,
    `To: <${to}>`,
    `Subject: ${encWord(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(12).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-generated'
  ];
  if (unsubscribe) headers.push(`List-Unsubscribe: <${unsubscribe}>`);
  const alt = `--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(text || ''))}\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(html || ''))}\r\n` +
    `--${boundary}--\r\n`;
  // Картинки внутри письма (логотип, фото товара): почтовики показывают их сразу,
  // а не прячут за кнопкой «Показать изображения», как картинки по ссылке
  const parts = (inline || []).filter((f) => f && f.cid && f.content && /^image\/(png|jpe?g|gif|webp)$/.test(f.type || ''));
  if (!parts.length) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    return headers.join('\r\n') + '\r\n\r\n' + alt;
  }
  const rel = 'r' + crypto.randomBytes(12).toString('hex');
  headers.push(`Content-Type: multipart/related; boundary="${rel}"; type="multipart/alternative"`);
  return headers.join('\r\n') + '\r\n\r\n' +
    `--${rel}\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n${alt}\r\n` +
    parts.map((f) => `--${rel}\r\nContent-Type: ${f.type}; name="${f.filename || f.cid}"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <${f.cid}>\r\nContent-Disposition: inline; filename="${f.filename || f.cid}"\r\n\r\n${wrap76(Buffer.from(f.content).toString('base64'))}\r\n`).join('') +
    `--${rel}--\r\n`;
}

/* cfg: { host, port, security: 'ssl'|'starttls'|'none', user, pass, fromEmail, fromName } */
function send(cfg, msg) {
  return new Promise((resolve, reject) => {
    const port = Number(cfg.port) || (cfg.security === 'ssl' ? 465 : 587);
    let sock, buf = '', waiter = null, done = false;
    const timer = setTimeout(() => finish(new Error('Почтовый сервер не ответил за 20 секунд')), 20000);
    function finish(err, res) {
      if (done) return; done = true; clearTimeout(timer);
      try { sock && sock.end(); } catch (e) {}
      err ? reject(err) : resolve(res);
    }
    function attach(s) {
      sock = s; s.setEncoding('utf8');
      s.on('data', (d) => {
        buf += d;
        const lines = buf.split('\r\n');
        for (let i = 0; i < lines.length - 1; i++) {
          if (/^\d{3} /.test(lines[i])) {
            const resp = lines.slice(0, i + 1).join('\n'); buf = lines.slice(i + 1).join('\r\n');
            const w = waiter; waiter = null; if (w) w(resp);
            return;
          }
        }
      });
      s.on('error', (e) => finish(new Error('Ошибка соединения с почтовым сервером: ' + e.message)));
    }
    const read = () => new Promise((r) => { waiter = r; });
    async function cmd(line, expect) {
      if (line !== null) sock.write(line + '\r\n');
      const resp = await read();
      const code = Number(resp.slice(0, 3));
      if (expect && !expect.includes(code)) throw new Error(explain(code, resp));
      return resp;
    }
    async function run() {
      await cmd(null, [220]);
      const name = 'shop.local';
      let ehlo = await cmd('EHLO ' + name, [250]);
      if (cfg.security === 'starttls') {
        await cmd('STARTTLS', [220]);
        await new Promise((res, rej) => { const t = tls.connect({ socket: sock, servername: cfg.host }, res); t.on('error', rej); attach(t); });
        ehlo = await cmd('EHLO ' + name, [250]);
      }
      if (cfg.user) {
        await cmd('AUTH LOGIN', [334]);
        await cmd(b64(cfg.user), [334]);
        await cmd(b64(cfg.pass || ''), [235]);
      }
      await cmd(`MAIL FROM:<${cfg.fromEmail}>`, [250]);
      await cmd(`RCPT TO:<${msg.to}>`, [250, 251]);
      await cmd('DATA', [354]);
      await cmd(buildMessage(Object.assign({ fromName: cfg.fromName, fromEmail: cfg.fromEmail }, msg)) + '\r\n.', [250]);
      sock.write('QUIT\r\n');
      finish(null, true);
    }
    const onConnect = () => run().catch(finish);
    if (cfg.security === 'ssl') attach(tls.connect({ host: cfg.host, port, servername: cfg.host }, onConnect));
    else attach(net.connect({ host: cfg.host, port }, onConnect));
  });
}
function explain(code, resp) {
  if (code === 535 || code === 534) return 'Почтовый сервер не принял логин или пароль. Для Яндекса и Mail.ru нужен «пароль приложения», а не обычный пароль от почты.';
  if (code === 550 || code === 553) return 'Почтовый сервер отклонил адрес отправителя или получателя: ' + resp.slice(4, 160);
  return 'Почтовый сервер ответил: ' + resp.slice(0, 160);
}

module.exports = { send, buildMessage };
