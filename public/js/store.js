/* Слой данных: всё хранится на сервере (server.js), в браузере — только корзина. */
(function (root) {
  'use strict';
  var LS_CART = 'vanta:cart';

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function uid(p) { return (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function err(msg) { var e = new Error(msg); e.userMessage = msg; return e; }

  function normPhone(p) { var d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && (d[0] === '8' || d[0] === '7')) d = '7' + d.slice(1); if (d.length === 10) d = '7' + d; return d; }

  /* ---------- Утилиты для изображений ---------- */
  function readImage(file, maxSide, quality) {
    maxSide = maxSide || 1600; quality = quality || 0.85;
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(err('Не удалось прочитать файл')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(err('Файл не похож на изображение')); };
        img.onload = function () {
          var k = Math.min(1, maxSide / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          var ctx = c.getContext('2d'); ctx.fillStyle = '#111'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* ================= SERVER ================= */
  async function call(method, url, body) {
    var r = await fetch(url, { method: method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    var j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j || j.ok === false) { var e = err((j && j.error) || 'Сервер не ответил. Попробуйте ещё раз.'); e.status = r.status; throw e; }
    return j;
  }
  var Server = {
    async init(state) { this.user = state.user || null; this.isAdmin = !!state.isAdmin; return state.data; },
    // Ответ: { user, welcome } — аккаунт создан сразу; { pending } — на почту ушёл код, ждём его
    async register(f) { var r = await call('POST', 'api/auth/register', f); if (r.user) this.user = r.user; return r; },
    async verify(id, code) { var r = await call('POST', 'api/auth/verify', { id: id, code: code }); this.user = r.user; return r; },
    async resendCode(id) { return await call('POST', 'api/auth/resend', { id: id }); },
    async login(l, p) { this.user = (await call('POST', 'api/auth/login', { login: l, password: p })).user; return this.user; },
    async logout() { await call('POST', 'api/auth/logout'); this.user = null; },
    async updateProfile(f) { this.user = (await call('PUT', 'api/me', f)).user; return this.user; },
    async myBonus() { var r = await call('GET', 'api/me'); this.user = r.user; return r; },
    async bonusSeen() { this.user = (await call('POST', 'api/me/bonus-seen')).user; return this.user; },
    async adminBonus(userId, amount, note) { return (await call('POST', 'api/admin/users/' + encodeURIComponent(userId) + '/bonus', { amount: amount, note: note })).user; },
    async support() { var r = await call('GET', 'api/support'); return r; },
    async supportGet(id) { return (await call('GET', 'api/support/' + encodeURIComponent(id))).ticket; },
    async supportCreate(f) { return (await call('POST', 'api/support', f)).ticket; },
    async supportSend(id, text) { return (await call('POST', 'api/support/' + encodeURIComponent(id), { text: text })).ticket; },
    async adminSupport() { return (await call('GET', 'api/admin/support')).tickets; },
    async adminSupportReply(id, text) { return await call('POST', 'api/admin/support/' + encodeURIComponent(id), { text: text }); },
    async adminSupportPatch(id, patch) { return (await call('PATCH', 'api/admin/support/' + encodeURIComponent(id), patch)).ticket; },
    async myOrders() { return (await call('GET', 'api/orders')).orders; },
    async getOrder(id) { var t = (lsGet('vanta:otok') || {})[id] || ''; return (await call('GET', 'api/orders/' + encodeURIComponent(id) + '?t=' + encodeURIComponent(t))).order; },
    async quote(lines, code, deliveryId, contact, useBonus) { return (await call('POST', 'api/quote', { lines: lines, code: code, deliveryId: deliveryId, contact: contact, useBonus: !!useBonus })).quote; },
    async placeOrder(p) {
      var r = await call('POST', 'api/orders', p);
      var t = lsGet('vanta:otok') || {}; t[r.order.id] = r.token; lsSet('vanta:otok', t);
      if (r.user) this.user = r.user;
      return { order: r.order, payUrl: r.payUrl || null };
    },
    async adminLogin(pw) { await call('POST', 'api/admin/login', { password: pw }); this.isAdmin = true; },
    async adminLogout() { await call('POST', 'api/admin/logout'); this.isAdmin = false; },
    async adminData() { return (await call('GET', 'api/admin/data')).data; },
    async adminHealth() { return (await call('GET', 'api/admin/health')).health; },
    async adminSave(name, value) { await call('PUT', 'api/admin/' + name, { value: value }); return true; },
    async adminUpsert(name, item) { return await call('PUT', 'api/admin/' + name + '/' + encodeURIComponent(item.id), { value: item }); },
    async subscribe(b) { return await call('POST', 'api/notify', b); },
    async adminWaitlistDelete(id) { await call('DELETE', 'api/admin/waitlist/' + encodeURIComponent(id)); },
    async adminWaitlistSend() { return await call('POST', 'api/admin/waitlist/send'); },
    async adminMail() { return await call('GET', 'api/admin/mail'); },
    async adminMailSave(m) { await call('POST', 'api/admin/mail', { mail: m }); },
    async adminMailTest(to) { await call('POST', 'api/admin/mail/test', { to: to }); },
    async adminMailTestAccount(to) { await call('POST', 'api/admin/mail/test-account', { to: to }); },
    async adminDelete(name, id) { await call('DELETE', 'api/admin/' + name + '/' + encodeURIComponent(id)); return true; },
    async adminDeleteMany(name, ids) { return (await call('POST', 'api/admin/' + name + '/delete-many', { ids: ids })).deleted; },
    async adminOrder(id, patch) { var r = await call('PATCH', 'api/admin/orders/' + encodeURIComponent(id), patch); r.order.notify = r.notify; r.order.trackMailed = !!r.trackMailed; return r.order; },
    async adminOrderSeq(next) { return (await call(next === undefined ? 'GET' : 'POST', 'api/admin/order-seq', next === undefined ? undefined : { next: next })).next; },
    async adminRefund(id, body) { return await call('POST', 'api/admin/orders/' + encodeURIComponent(id) + '/refund', body); },
    async adminOrderDelete(id) { return await call('DELETE', 'api/admin/orders/' + encodeURIComponent(id)); },
    async adminPassword(pw) { await call('POST', 'api/admin/password', { password: pw }); },
    async adminSecret(secret) { return (await call('POST', 'api/admin/payment-secret', secret === undefined ? {} : { secret: secret })); },
    async uploadImage(file) { var data = await readImage(file, 2000, 0.86); return (await call('POST', 'api/admin/upload', { dataUrl: data })).url; },
    async uploadDataUrl(dataUrl) { return (await call('POST', 'api/admin/upload', { dataUrl: dataUrl })).url; }
  };

  /* ================= Корзина (всегда в браузере) ================= */
  var Cart = {
    get() { var c = lsGet(LS_CART); return Array.isArray(c) ? c : []; },
    set(c) { lsSet(LS_CART, c); document.dispatchEvent(new CustomEvent('cart:change')); },
    same(x, productId, colorId, size) { return x.productId === productId && (!x.colorId || (x.colorId || '') === (colorId || '')) && x.size === size; }, // строки корзины до появления цветов
    find(productId, colorId, size) { var self = this; return this.get().find(function (x) { return self.same(x, productId, colorId, size); }); },
    add(productId, colorId, size, qty) {
      var self = this, c = this.get(), l = c.find(function (x) { return self.same(x, productId, colorId, size); });
      if (l) l.qty += qty || 1; else c.push({ productId: productId, colorId: colorId, size: size, qty: qty || 1 });
      this.set(c);
    },
    update(productId, colorId, size, qty) { var self = this; var c = this.get().map(function (x) { if (self.same(x, productId, colorId, size)) x.qty = qty; return x; }).filter(function (x) { return x.qty > 0; }); this.set(c); },
    clear() { this.set([]); },
    count() { return this.get().reduce(function (s, x) { return s + x.qty; }, 0); }
  };

  /* Загрузка данных с сервера: при сбое связи несколько раз повторяем запрос */
  async function connect() {
    var wait = [0, 600, 1500, 3000], last = null;
    for (var i = 0; i < wait.length; i++) {
      if (wait[i]) await new Promise(function (r) { setTimeout(r, wait[i]); });
      try {
        var r = await fetch('api/state', { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (r.ok && (r.headers.get('content-type') || '').indexOf('json') !== -1) {
          var j = await r.json();
          if (j && j.ok && j.data) { var data = await Server.init(j); return { api: Server, data: data }; }
        }
        last = new Error('HTTP ' + r.status);
      } catch (e) { last = e; }
    }
    var err = new Error('offline'); err.cause = last; throw err;
  }

  root.Store = { connect: connect, Cart: Cart, normPhone: normPhone, uid: uid, readImage: readImage };
})(this);
