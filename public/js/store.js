/* Слой данных. Два режима:
   - server: сайт запущен на собственном сервере (server.js) — всё хранится на сервере, оплата через ЮKassa;
   - local: демо-режим без сервера (превью) — данные хранятся в браузере. */
(function (root) {
  'use strict';
  var LS_DATA = 'vanta:data:v1', LS_SESSION = 'vanta:session', LS_CART = 'vanta:cart', LS_ADMIN = 'vanta:admin';

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function uid(p) { return (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function err(msg) { var e = new Error(msg); e.userMessage = msg; return e; }

  async function sha(str) {
    try {
      var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (e) {
      var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return 'x' + (h >>> 0).toString(16);
    }
  }
  function normPhone(p) { var d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && (d[0] === '8' || d[0] === '7')) d = '7' + d.slice(1); if (d.length === 10) d = '7' + d; return d; }
  function publicUser(u) {
    return u && { id: u.id, firstName: u.firstName, lastName: u.lastName, phone: u.phone, email: u.email, createdAt: u.createdAt, bonus: u.bonus || 0,
      bonusNews: (u.bonusLog || []).filter(function (e) { return !e.seen; }).slice(0, 5).map(function (e) { return { id: e.id, amount: e.amount, type: e.type, orderNumber: e.orderNumber || '', note: e.note || '' }; }) };
  }
  function adminUser(u) { var x = publicUser(u); x.bonusLog = (u.bonusLog || []).slice(0, 100); return x; }

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

  /* ================= LOCAL (демо) ================= */
  var Local = {
    mode: 'local',
    async init() {
      var d = lsGet(LS_DATA);
      if (!d) { d = clone(root.SEED); d.settings.adminHash = await sha('vanta|admin'); lsSet(LS_DATA, d); }
      else if (d.version !== root.SEED.version) { root.Pricing.migrateData(d, root.SEED); d.version = root.SEED.version; lsSet(LS_DATA, d); }
      this.db = d; d.waitlist = d.waitlist || [];
      var s = lsGet(LS_SESSION);
      this.user = s ? publicUser(d.users.find(function (u) { return u.id === s; })) : null;
      this.isAdmin = lsGet(LS_ADMIN) === true;
      return this.publicState();
    },
    save() { if (!lsSet(LS_DATA, this.db)) throw err('Браузеру не хватило места для сохранения. Уменьшите количество или размер фото.'); },
    publicState() {
      var d = this.db, s = clone(d.settings); delete s.adminHash;
      return { payReady: true, mailReady: false, settings: s, categories: d.categories, sizeCharts: d.sizeCharts, products: d.products.filter(function (p) { return p.active !== false; }), promotions: d.promotions, pages: d.pages };
    },
    async register(f) {
      var email = String(f.email || '').trim().toLowerCase(), phone = normPhone(f.phone);
      if (this.db.users.some(function (u) { return u.email === email; })) throw err('Пользователь с такой почтой уже зарегистрирован');
      if (this.db.users.some(function (u) { return u.phone === phone; })) throw err('Пользователь с таким телефоном уже зарегистрирован');
      var salt = uid();
      var u = { id: uid('u'), firstName: f.firstName.trim(), lastName: f.lastName.trim(), phone: phone, email: email, salt: salt, hash: await sha(salt + f.password), createdAt: new Date().toISOString() };
      this.db.users.push(u); this.save(); lsSet(LS_SESSION, u.id); this.user = publicUser(u); return this.user;
    },
    async login(login, password) {
      var l = String(login || '').trim().toLowerCase(), ph = normPhone(l);
      var u = this.db.users.find(function (x) { return x.email === l || (ph.length === 11 && x.phone === ph); });
      if (!u || u.hash !== await sha(u.salt + password)) throw err('Неверный логин или пароль');
      lsSet(LS_SESSION, u.id); this.user = publicUser(u); return this.user;
    },
    async logout() { lsDel(LS_SESSION); this.user = null; },
    async updateProfile(f) {
      var me = this.user, u = this.db.users.find(function (x) { return x.id === me.id; });
      var email = String(f.email).trim().toLowerCase(), phone = normPhone(f.phone);
      if (this.db.users.some(function (x) { return x.id !== u.id && x.email === email; })) throw err('Эта почта уже используется');
      if (this.db.users.some(function (x) { return x.id !== u.id && x.phone === phone; })) throw err('Этот телефон уже используется');
      Object.assign(u, { firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: email, phone: phone });
      if (f.newPassword) { u.salt = uid(); u.hash = await sha(u.salt + f.newPassword); }
      this.save(); this.user = publicUser(u); return this.user;
    },
    me() { var id = this.user && this.user.id; return this.db.users.find(function (x) { return x.id === id; }) || null; },
    syncBonus(o) { return root.Pricing.syncOrderBonus(o, o.userId ? this.db.users.find(function (u) { return u.id === o.userId; }) : null, this.db.settings, uid); },
    async myBonus() {
      var u = this.me(); if (!u) throw err('Войдите в личный кабинет');
      this.user = publicUser(u); return { user: this.user, bonusLog: (u.bonusLog || []).slice(0, 100) };
    },
    async bonusSeen() { var u = this.me(); if (!u) return; (u.bonusLog || []).forEach(function (e) { e.seen = true; }); this.save(); this.user = publicUser(u); return this.user; },
    async myOrders() { var id = this.user && this.user.id; return this.db.orders.filter(function (o) { return o.userId === id; }).slice().reverse(); },
    async getOrder(id) { var o = this.db.orders.find(function (x) { return x.id === id; }); if (!o) throw err('Заказ не найден'); return o; },
    usedByCustomer(code, email, phone) {
      var me = this.user;
      return this.db.orders.some(function (o) { return o.promoCode && o.promoCode.toUpperCase() === code.toUpperCase() && o.status !== 'canceled' && ((me && o.userId === me.id) || (email && o.customer.email === email) || (phone && o.customer.phone === phone)); });
    },
    async quote(lines, code, deliveryId, contact, useBonus) {
      contact = contact || {};
      var me = this.user, u = this.me();
      return root.Pricing.calcCart(lines, this.db, { code: code, deliveryId: deliveryId, registered: !!me, hasOrders: !!me && this.db.orders.some(function (o) { return o.userId === me.id && o.status !== 'canceled'; }), usedByCustomer: code ? this.usedByCustomer(code, (contact.email || '').toLowerCase(), normPhone(contact.phone)) : false, bonusBalance: u ? u.bonus || 0 : 0, useBonus: !!(u && useBonus) });
    },
    async placeOrder(p) {
      var q = await this.quote(p.lines, p.code, p.deliveryId, p.customer, p.useBonus), me = this.me();
      if (!q.lines.length) throw err('Корзина пуста');
      if (!q.delivery) throw err('Выберите способ доставки');
      var bad = q.lines.find(function (l) { return l.problem; }); if (bad) throw err(bad.name + ': ' + bad.problem.toLowerCase());
      if (p.code && !(q.promo && q.promo.ok)) throw err(q.promo ? q.promo.message : 'Промокод не применён');
      var db = this.db;
      q.lines.forEach(function (l) { var pr = db.products.find(function (x) { return x.id === l.productId; }); var s = root.Pricing.colorOf(pr, l.colorId).sizes.find(function (x) { return x.size === l.size; }); s.stock -= l.qty; });
      if (q.promo && q.promo.ok) { var c = db.promocodes.find(function (x) { return x.code === q.promo.code; }); if (c) c.used = (c.used || 0) + 1; }
      var o = {
        id: uid('o'), number: String(100000 + db.orders.length + 1), createdAt: new Date().toISOString(), userId: this.user ? this.user.id : null,
        customer: { firstName: p.customer.firstName, lastName: p.customer.lastName, phone: normPhone(p.customer.phone), email: String(p.customer.email).toLowerCase() },
        items: q.lines.map(function (l) { return { productId: l.productId, slug: l.slug, name: l.name, colorId: l.colorId, color: l.color, size: l.size, qty: l.qty, price: l.price, oldPrice: l.oldPrice, image: l.image, art: l.art }; }),
        subtotal: q.subtotal, saleDiscount: q.saleDiscount, promoCode: q.promo && q.promo.ok ? q.promo.code : '', promoDiscount: q.promoDiscount,
        delivery: Object.assign({}, q.delivery, { city: p.city || '', address: p.address || '' }), comment: p.comment || '', total: q.total,
        payment: { method: p.payment, status: p.payment === 'online' ? 'paid' : 'pending', demo: true }, status: 'new',
        bonusUsed: q.bonusUsed, bonusEarn: me ? q.bonusEarn : 0
      };
      if (o.total === 0) o.payment = { method: 'bonus', status: 'paid', demo: true };
      db.orders.push(o);
      if (q.bonusUsed) root.Pricing.bonusMove(me, -q.bonusUsed, 'spend', o, uid);
      this.syncBonus(o); this.save();
      if (me) this.user = publicUser(me);
      return { order: o, payUrl: null };
    },

    async subscribe(b) {
      var tpl = root.Mail.tplOf(this.db.settings); if (!tpl.enabled) throw err('Уведомления о поступлении сейчас отключены');
      var email = String(b.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw err('Проверьте электронную почту');
      var dup = this.db.waitlist.find(function (w) { return w.email === email && w.productId === b.productId && w.colorId === b.colorId && w.size === (b.size || '') && (w.status === 'waiting' || w.status === 'failed'); });
      if (!dup) { this.db.waitlist.push({ id: uid('w'), productId: b.productId, colorId: b.colorId, size: b.size || '', email: email, userId: this.user ? this.user.id : null, createdAt: new Date().toISOString(), status: 'waiting' }); this.save(); }
      return { already: !!dup };
    },
    processWaitlist() {
      var ready = root.Mail.readyRequests(this.db.waitlist, this.db.products);
      ready.forEach(function (w) { w.status = 'demo'; w.sentAt = new Date().toISOString(); });
      if (ready.length) this.save();
      return { ready: ready.length, sent: 0, failed: 0, demo: ready.length };
    },

    /* --- админ --- */
    async adminLogin(pw) { if (await sha('vanta|' + pw) !== this.db.settings.adminHash) throw err('Неверный пароль'); lsSet(LS_ADMIN, true); this.isAdmin = true; },
    async adminLogout() { lsDel(LS_ADMIN); this.isAdmin = false; },
    async adminData() { var d = clone(this.db); delete d.settings.adminHash; d.users = d.users.map(adminUser); return d; },
    async adminBonus(userId, amount, note) {
      var u = this.db.users.find(function (x) { return x.id === userId; }); if (!u) throw err('Покупатель не найден');
      amount = Math.round(Number(amount) || 0); if (!amount) throw err('Укажите количество бонусов');
      if (amount < 0) amount = -Math.min(u.bonus || 0, -amount);
      if (!amount) throw err('На счёте покупателя нет бонусов');
      root.Pricing.bonusMove(u, amount, 'manual', null, uid, String(note || '').trim()); this.save();
      if (this.user && this.user.id === u.id) this.user = publicUser(u);
      return adminUser(u);
    },
    async adminSave(name, value) {
      if (name === 'settings') { var h = this.db.settings.adminHash; this.db.settings = clone(value); this.db.settings.adminHash = h; }
      else { this.db[name] = clone(value); if (name === 'products') this.db.products.forEach(root.Pricing.migrateProduct); }
      this.save(); return true;
    },
    async adminUpsert(name, item) {
      var arr = this.db[name], i = arr.findIndex(function (x) { return x.id === item.id; });
      if (i === -1) arr.push(clone(item)); else arr[i] = clone(item);
      this.save(); return name === 'products' ? { notify: this.processWaitlist() } : {};
    },
    async adminDelete(name, id) { this.db[name] = this.db[name].filter(function (x) { return x.id !== id; }); this.save(); return true; },
    async adminWaitlistDelete(id) { this.db.waitlist = this.db.waitlist.filter(function (w) { return w.id !== id; }); this.save(); },
    async adminWaitlistSend() { return { notify: this.processWaitlist() }; },
    async adminMail() { return { mail: Object.assign({ host: '', port: 465, security: 'ssl', user: '', fromEmail: '', fromName: '' }, this.db.mail || {}, { hasPass: false, ready: false, demo: true }) }; },
    async adminMailSave(m) { var c = clone(m); delete c.pass; this.db.mail = c; this.save(); },
    async adminMailTest() { throw err('В демо-режиме письма не отправляются. Отправка заработает после запуска сайта на сервере.'); },
    async adminOrder(id, patch) {
      var o = this.db.orders.find(function (x) { return x.id === id; }); if (!o) throw err('Заказ не найден');
      var db = this.db, move = function (sign) { o.items.forEach(function (i) { var pr = db.products.find(function (x) { return x.id === i.productId; }); if (!pr) return; var sz = root.Pricing.colorOf(pr, i.colorId).sizes.find(function (x) { return x.size === i.size; }); if (sz) sz.stock = Math.max(0, sz.stock + sign * i.qty); }); };
      var pc = o.promoCode && db.promocodes.find(function (x) { return x.code === o.promoCode; });
      if (patch.status === 'canceled' && o.status !== 'canceled') { move(1); if (pc) pc.used = Math.max(0, (pc.used || 0) - 1); }
      if (patch.status && patch.status !== 'canceled' && o.status === 'canceled') { move(-1); if (pc) pc.used = (pc.used || 0) + 1; }
      if (patch.status) o.status = patch.status;
      if (patch.paymentStatus) o.payment.status = patch.paymentStatus;
      if (patch.note !== undefined) o.adminNote = patch.note;
      this.syncBonus(o); this.save();
      var me = this.me(); if (me) this.user = publicUser(me); var r = clone(o); r.notify = this.processWaitlist(); return r;
    },
    async adminPassword(pw) { this.db.settings.adminHash = await sha('vanta|' + pw); this.save(); },
    async adminSecret() { return { hasSecret: false }; },
    async uploadImage(file) { return readImage(file, 1400, 0.82); },
    async uploadDataUrl(dataUrl) { return dataUrl; },
    async resetDemo() { lsDel(LS_DATA); lsDel(LS_SESSION); lsDel(LS_ADMIN); }
  };

  /* ================= SERVER ================= */
  async function call(method, url, body) {
    var r = await fetch(url, { method: method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    var j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j || j.ok === false) { var e = err((j && j.error) || 'Сервер не ответил. Попробуйте ещё раз.'); e.status = r.status; throw e; }
    return j;
  }
  var Server = {
    mode: 'server',
    async init(state) { this.user = state.user || null; this.isAdmin = !!state.isAdmin; return state.data; },
    async register(f) { this.user = (await call('POST', 'api/auth/register', f)).user; return this.user; },
    async login(l, p) { this.user = (await call('POST', 'api/auth/login', { login: l, password: p })).user; return this.user; },
    async logout() { await call('POST', 'api/auth/logout'); this.user = null; },
    async updateProfile(f) { this.user = (await call('PUT', 'api/me', f)).user; return this.user; },
    async myBonus() { var r = await call('GET', 'api/me'); this.user = r.user; return r; },
    async bonusSeen() { this.user = (await call('POST', 'api/me/bonus-seen')).user; return this.user; },
    async adminBonus(userId, amount, note) { return (await call('POST', 'api/admin/users/' + encodeURIComponent(userId) + '/bonus', { amount: amount, note: note })).user; },
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
    async adminSave(name, value) { await call('PUT', 'api/admin/' + name, { value: value }); return true; },
    async adminUpsert(name, item) { return await call('PUT', 'api/admin/' + name + '/' + encodeURIComponent(item.id), { value: item }); },
    async subscribe(b) { return await call('POST', 'api/notify', b); },
    async adminWaitlistDelete(id) { await call('DELETE', 'api/admin/waitlist/' + encodeURIComponent(id)); },
    async adminWaitlistSend() { return await call('POST', 'api/admin/waitlist/send'); },
    async adminMail() { return await call('GET', 'api/admin/mail'); },
    async adminMailSave(m) { await call('POST', 'api/admin/mail', { mail: m }); },
    async adminMailTest(to) { await call('POST', 'api/admin/mail/test', { to: to }); },
    async adminDelete(name, id) { await call('DELETE', 'api/admin/' + name + '/' + encodeURIComponent(id)); return true; },
    async adminOrder(id, patch) { var r = await call('PATCH', 'api/admin/orders/' + encodeURIComponent(id), patch); r.order.notify = r.notify; return r.order; },
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

  /* Режим работы выбирается по тому, откуда открыт сайт, а не по одному удачному или неудачному запросу:
     демо (данные в браузере) — только однофайловое превью и файл, открытый с диска.
     Настоящий сайт всегда работает с сервером: при сбое связи повторяем запрос, а не подменяем магазин демо-версией,
     иначе покупатель увидел бы чужие данные, а его заказ не дошёл бы до магазина. */
  async function connect() {
    if (root.ALBAKOV_DEMO || location.protocol === 'file:') { var d = await Local.init(); return { api: Local, data: d }; }
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
