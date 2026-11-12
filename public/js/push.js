/* Push-уведомления на телефон и компьютер (13.60, приложение iPhone — 13.61).
   Покупатель: «заказ в пути», «ждёт в пункте выдачи», ответ поддержки, обмен и возврат, поступление, бонусы, по желанию — акции.
   Сотрудники: новые заказы, оплаты, вопросы, заявки, возвраты, остатки, входы в панель, итоги дня — по своей роли.
   Одно устройство = один адрес для уведомлений; на сервере он записан отдельно для покупателя и для панели (scope).
   Два способа доставки — снаружи одинаковые (Push.state / enable / disable / link / test):
   • браузер и значок на экране «Домой» — web-push (iPhone — только со значка, iOS 16.4 и новее);
   • приложение ALBAKOV из App Store (window.AlbakovApp) — уведомления Apple: разрешение и адрес устройства даёт приложение. */
(function (root) {
  var ua = navigator.userAgent || '';
  var native = root.AlbakovApp && typeof root.AlbakovApp.post === 'function' ? root.AlbakovApp : null;
  var isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var webApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext !== false;
  var hasApi = !!native || webApi;
  var installed = function () { return !!native || (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; };
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

  /* ---- Устройство: браузер ---- */
  async function registration() {
    var r = await navigator.serviceWorker.getRegistration('/');
    if (!r) r = await navigator.serviceWorker.register('/sw.js');
    return navigator.serviceWorker.ready.then(function (x) { return x || r; });
  }
  var web = {
    async permission() { return Notification.permission; },
    async current() { try { var s = await (await registration()).pushManager.getSubscription(); return s ? { endpoint: s.endpoint, body: { sub: s.toJSON() }, sub: s } : null; } catch (e) { return null; } },
    async subscribe() {
      var perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (perm !== 'granted') return { perm: perm };
      var reg = await registration(), s = await reg.pushManager.getSubscription();
      if (!s) { var k = await call('GET', '/api/push/key'); s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(k.key) }); }
      return { perm: 'granted', dev: { endpoint: s.endpoint, body: { sub: s.toJSON() }, sub: s } };
    },
    async forget(d) { try { if (d && d.sub) await d.sub.unsubscribe(); } catch (e) { /* ничего */ } }
  };

  /* ---- Устройство: приложение на iPhone (мост window.AlbakovApp ↔ событие 'albakov-native') ---- */
  var apns = null;   // { token, env } — приложение присылает после каждой загрузки страницы, если уведомления разрешены
  function nativeWait(type, ms) {
    return new Promise(function (ok) {
      var done = function (v) { window.removeEventListener('albakov-native', on); clearTimeout(t); ok(v); };
      var on = function (e) { var d = e.detail || {}; if (d.type === type) done(d); };
      var t = setTimeout(function () { done(null); }, ms);
      window.addEventListener('albakov-native', on);
    });
  }
  var app = {
    async permission() { var w = nativeWait('push.status', 2500); native.post({ type: 'push.status' }); var d = await w; return d ? d.status : 'default'; },
    async current() { if (!apns) await nativeWait('push.token', 1500); return apns ? { endpoint: 'apns:' + apns.token, body: { apns: apns } } : null; },
    async subscribe() {
      var w = nativeWait('push.status', 120000); native.post({ type: 'push.request' }); var d = await w;
      var perm = d ? d.status : 'default'; if (perm !== 'granted') return { perm: perm };
      if (!apns) await nativeWait('push.token', 10000);
      if (!apns) throw new Error('Телефон не выдал адрес для уведомлений. Проверьте интернет и попробуйте ещё раз');
      return { perm: 'granted', dev: { endpoint: 'apns:' + apns.token, body: { apns: apns } } };
    },
    async forget() { /* разрешение в приложении отзывается в настройках iPhone */ }
  };
  var dev = native ? app : web;
  if (native) {
    window.addEventListener('albakov-native', function (e) {
      var d = e.detail || {}; if (d.type !== 'push.token' || !d.token) return;
      apns = { token: String(d.token), env: d.env === 'development' ? 'development' : 'production' };
      // Адрес мог смениться или человек вошёл в кабинет — обновляем включённые области
      var v = lsGet(); ['customer', 'staff'].forEach(function (sc) { if (v[sc]) call('POST', '/api/push/subscribe', { apns: apns, scope: sc }).catch(function () { /* в другой раз */ }); });
    });
  }

  /* Состояние для экрана:
     unsupported — браузер не умеет; ios-install — iPhone, но сайт открыт в Safari, а не в приложении;
     denied — запрещено в настройках; on — эта область включена на устройстве; off — можно включить */
  async function state(scope) {
    scope = scope || 'customer';
    if (!hasApi) return isIOS && !installed() ? 'ios-install' : 'unsupported';
    var perm = await dev.permission();
    if (perm === 'denied') return 'denied';
    return perm === 'granted' && lsGet()[scope] && await dev.current() ? 'on' : 'off';
  }
  // Включить: спросить разрешение (только по нажатию), получить адрес устройства и сообщить серверу
  async function enable(scope, extra) {
    scope = scope || 'customer';
    if (!hasApi) throw new Error(isIOS && !installed() ? 'На iPhone уведомления работают в приложении ALBAKOV' : 'Этот браузер не поддерживает уведомления');
    var r = await dev.subscribe();
    if (r.perm !== 'granted') {
      if (r.perm === 'denied' && native) native.post({ type: 'open.settings' });
      throw new Error(r.perm === 'denied' ? (native ? 'Уведомления выключены в настройках iPhone — включите их для ALBAKOV' : 'Уведомления запрещены — разрешите их в настройках браузера для этого сайта') : 'Вы не разрешили уведомления');
    }
    await call('POST', '/api/push/subscribe', Object.assign({ scope: scope }, r.dev.body, extra || {}));
    var v = lsGet(); v[scope] = true; lsSet(v);
    document.dispatchEvent(new CustomEvent('push:change'));
    return r.dev;
  }
  // Уже включено — тихо привязать заказ (покупатель без кабинета) или обновить владельца после входа
  async function link(scope, extra) {
    scope = scope || 'customer';
    if (!hasApi || !lsGet()[scope] || await dev.permission() !== 'granted') return false;
    var d = await dev.current(); if (!d) return false;
    try { await call('POST', '/api/push/subscribe', Object.assign({ scope: scope }, d.body, extra || {})); return true; } catch (e) { return false; }
  }
  async function disable(scope) {
    scope = scope || 'customer';
    var d = hasApi ? await dev.current() : null, v = lsGet(); delete v[scope]; lsSet(v);
    if (d) {
      try { await call('POST', '/api/push/unsubscribe', { endpoint: d.endpoint, scope: scope }); } catch (e) { /* сервер сам удалит при следующей отправке */ }
      if (!v.customer && !v.staff) await dev.forget(d);
    }
    document.dispatchEvent(new CustomEvent('push:change'));
  }
  async function test(scope) {
    var d = hasApi ? await dev.current() : null; if (!d) throw new Error('Сначала включите уведомления');
    return call('POST', '/api/push/test', { endpoint: d.endpoint, scope: scope || 'customer' });
  }

  // Нажали на уведомление, а магазин уже открыт: переходим на нужную страницу без перезагрузки
  if (webApi && !native) navigator.serviceWorker.addEventListener('message', function (e) {
    var d = e.data || {}; if (d.type !== 'push-open' || !d.url) return;
    try {
      var u = new URL(d.url, location.origin);
      if (u.origin !== location.origin) { location.href = d.url; return; }
      if (window.ALB_NAV && window.ALB_NAV.go) window.ALB_NAV.go('#' + u.pathname + u.search); else location.href = u.href;
    } catch (x) { /* ничего */ }
  });
  // После входа в кабинет и выхода: адрес устройства переходит к аккаунту
  document.addEventListener('auth:change', function () { link('customer'); link('staff'); });

  root.Push = { supported: hasApi, native: !!native, isIOS: isIOS, installed: installed, state: state, enable: enable, disable: disable, link: link, test: test };
})(this);
