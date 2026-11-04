// Сервис-воркер ALBAKOV: нужен, чтобы магазин можно было установить как приложение (значок на экране «Домой»).
// Ничего не кэширует — цены, остатки и корзина всегда свежие. Если нет интернета — показывает понятную страницу вместо ошибки браузера.
const OFFLINE = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ffffff"><title>ALBAKOV</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#ffffff;color:#121417;text-align:center;padding:24px;box-sizing:border-box}
.l{font-size:22px;letter-spacing:.32em;padding-left:.32em;margin-bottom:28px}h1{font-size:24px;font-weight:400;margin:0 0 10px}p{margin:0 0 24px;color:#464b52;line-height:1.6}
button{font:inherit;font-size:14px;letter-spacing:.06em;font-weight:500;border:1px solid #141414;padding:16px 30px;background:#141414;color:#ffffff;cursor:pointer}</style></head>
<body><div><div class="l">ALBAKOV</div><h1>Нет подключения к интернету</h1><p>Проверьте связь — магазин откроется сам.</p><button onclick="location.reload()">Обновить</button></div>
<script>addEventListener('online',function(){location.reload()})</script></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;   // всё, кроме открытия страниц, идёт как обычно
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});

/* ---------- Push-уведомления (13.60) ----------
   Сервер присылает зашифрованное сообщение { title, body, url, tag, icon, image, badge, actions, links }.
   Показываем его как обычное уведомление телефона; нажатие открывает нужную страницу магазина (или фокусирует уже открытую). */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  const opts = {
    body: d.body || '', icon: d.icon || '/img/icon-192.png', badge: d.badge || '/img/push-badge.png', lang: 'ru', dir: 'ltr',
    tag: d.tag || undefined, renotify: !!(d.tag && d.renotify), requireInteraction: !!d.urgent, timestamp: Date.now(),
    data: { url: d.url || '/', links: d.links || {} }, actions: (d.actions || []).slice(0, 2)
  };
  if (d.image) opts.image = d.image;
  if (!opts.tag) delete opts.renotify;
  e.waitUntil(self.registration.showNotification(d.title || 'ALBAKOV', opts));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {}, links = data.links || {};
  // «Отследить» и «Как добраться» ведут на СДЭК и карты, остальное — в магазин
  let url = (e.action && links[e.action]) || data.url || '/';
  url = new URL(url, self.location.origin).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = url.indexOf(self.location.origin) === 0;
    for (const c of all) {
      if (same && c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
        await c.focus();
        try { c.postMessage({ type: 'push-open', url }); return; } catch (x) { /* откроем заново */ }
        if ('navigate' in c) { await c.navigate(url); return; }
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
// Браузер сам сменил ключи подписки — сообщаем серверу новую, чтобы уведомления не потерялись
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    try {
      const r = await fetch('/api/push/key'); const j = await r.json(); if (!j.key) return;
      const pad = '='.repeat((4 - (j.key.length % 4)) % 4), raw = atob((j.key + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
      const body = JSON.stringify({ sub: sub.toJSON(), old: e.oldSubscription ? e.oldSubscription.endpoint : '' });
      await fetch('/api/push/subscribe', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body });
    } catch (x) { /* при следующем входе в магазин подписка обновится сама */ }
  })());
});
