/* Push-уведомления на телефон и компьютер (13.60).
   Покупатель: «заказ в пути», «ждёт в пункте выдачи», ответ поддержки, обмен и возврат, поступление, бонусы, по желанию — акции.
   Сотрудники: новые заказы, оплаты, вопросы, заявки, возвраты, остатки, входы в панель, итоги дня — по своей роли.
   Одно устройство = одна подписка браузера; на сервере она записана отдельно для покупателя и для панели (scope).
   iPhone и iPad: уведомления работают только в приложении на экране «Домой» (iOS 16.4 и новее). */
(function (root) {
  var ua = navigator.userAgent || '';
  var isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext !== false;
  var installed = function () { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; };
  var LS = 'albakov:push';   // какие области включены на этом устройстве: { customer: true, staff: true }

  function lsGet() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } }
  function lsSet(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) { /* приватный режим */ } }
  async function call(method, url, body) {
    var r = await fetch(url, { method: method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    var j = null; try { j = await r.json(); } catch (e) { /* пусто */ }
    if (!r.ok || !j || j.ok === false) { var er = new Error((j && j.error) || 'Сервер не ответил. Попробуйте ещё раз'); er.status = r.status; throw er; }
    return j;
  }
  function keyBytes(k) {
    var pad = '='.repeat((4 - (k.length % 4)) % 4), raw = atob((k + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  async function registration() {
    var r = await navigator.serviceWorker.getRegistration('/');
    if (!r) r = await navigator.serviceWorker.register('/sw.js');
    return navigator.serviceWorker.ready.then(function (x) { return x || r; });
  }
  async function current() { if (!hasApi) return null; try { return await (await registration()).pushManager.getSubscription(); } catch (e) { return null; } }

  /* Состояние для экрана:
     unsupported — браузер не умеет; ios-install — iPhone, но сайт открыт в Safari, а не в приложении;
     denied — запрещено в настройках; on — эта область включена на устройстве; off — можно включить */
  async function state(scope) {
    scope = scope || 'customer';
    if (!hasApi) return isIOS && !installed() ? 'ios-install' : 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    var s = await current();
    return s && Notification.permission === 'granted' && lsGet()[scope] ? 'on' : 'off';
  }
  // Включить: спросить разрешение (только по нажатию), подписать устройство и сообщить серверу
  async function enable(scope, extra) {
    scope = scope || 'customer';
    if (!hasApi) throw new Error(isIOS && !installed() ? 'На iPhone уведомления работают в приложении ALBAKOV на экране «Домой»' : 'Этот браузер не поддерживает уведомления');
    var perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Уведомления запрещены — разрешите их в настройках браузера для этого сайта' : 'Вы не разрешили уведомления');
    var reg = await registration(), sub = await reg.pushManager.getSubscription();
    if (!sub) { var k = await call('GET', '/api/push/key'); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(k.key) }); }
    await call('POST', '/api/push/subscribe', Object.assign({ sub: sub.toJSON(), scope: scope }, extra || {}));
    var v = lsGet(); v[scope] = true; lsSet(v);
    document.dispatchEvent(new CustomEvent('push:change'));
    return sub;
  }
  // Уже включено — тихо привязать заказ (покупатель без кабинета) или обновить владельца подписки после входа
  async function link(scope, extra) {
    if (!hasApi || Notification.permission !== 'granted' || !lsGet()[scope || 'customer']) return false;
    var sub = await current(); if (!sub) return false;
    try { await call('POST', '/api/push/subscribe', Object.assign({ sub: sub.toJSON(), scope: scope || 'customer' }, extra || {})); return true; } catch (e) { return false; }
  }
  async function disable(scope) {
    scope = scope || 'customer';
    var sub = await current(), v = lsGet(); delete v[scope]; lsSet(v);
    if (sub) {
      try { await call('POST', '/api/push/unsubscribe', { endpoint: sub.endpoint, scope: scope }); } catch (e) { /* сервер сам удалит при следующей отправке */ }
      if (!v.customer && !v.staff) { try { await sub.unsubscribe(); } catch (e) { /* ничего */ } }
    }
    document.dispatchEvent(new CustomEvent('push:change'));
  }
  async function test(scope) {
    var sub = await current(); if (!sub) throw new Error('Сначала включите уведомления');
    return call('POST', '/api/push/test', { endpoint: sub.endpoint, scope: scope || 'customer' });
  }

  // Нажали на уведомление, а магазин уже открыт: переходим на нужную страницу без перезагрузки
  if (hasApi) navigator.serviceWorker.addEventListener('message', function (e) {
    var d = e.data || {}; if (d.type !== 'push-open' || !d.url) return;
    try {
      var u = new URL(d.url, location.origin);
      if (u.origin !== location.origin) { location.href = d.url; return; }
      if (window.ALB_NAV && window.ALB_NAV.go) window.ALB_NAV.go('#' + u.pathname + u.search); else location.href = u.href;
    } catch (x) { /* ничего */ }
  });
  // После входа в кабинет: подписка устройства переходит к аккаунту
  document.addEventListener('auth:change', function () { link('customer'); });

  root.Push = { supported: hasApi, isIOS: isIOS, installed: installed, state: state, enable: enable, disable: disable, link: link, test: test };
})(this);
