// Сервис-воркер ALBAKOV: у тех, кто раньше добавил значок на экран «Домой», — работа как приложение.
// Push-уведомления браузера убраны (13.64.6): уведомления приходят только в приложение ALBAKOV для iPhone.
// Ничего не кэширует — цены, остатки и корзина всегда свежие. Если нет интернета — показывает понятную страницу вместо ошибки браузера.
const OFFLINE = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ffffff"><title>ALBAKOV</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#ffffff;color:#121417;text-align:center;padding:24px;box-sizing:border-box}
.l{font-size:22px;letter-spacing:.32em;padding-left:.32em;margin-bottom:28px}h1{font-size:24px;font-weight:400;margin:0 0 10px}p{margin:0 0 24px;color:#464b52;line-height:1.6}
button{font:inherit;font-size:14px;letter-spacing:.06em;font-weight:500;border:1px solid #141414;padding:16px 30px;background:#141414;color:#ffffff;cursor:pointer}</style></head>
<body><div><div class="l">ALBAKOV</div><h1>Нет подключения к интернету</h1><p>Проверьте связь — магазин откроется сам.</p><button onclick="location.reload()">Обновить</button></div>
<script>addEventListener('online',function(){location.reload()})</script></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  // старая подписка браузера на уведомления больше не нужна — снимаем её
  try { const sub = await self.registration.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (x) { /* нет — и хорошо */ }
  // и уже показанные уведомления веб-приложения убираем из Центра уведомлений
  try { (await self.registration.getNotifications()).forEach((n) => n.close()); } catch (x) { /* не поддерживается */ }
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;   // всё, кроме открытия страниц, идёт как обычно
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
