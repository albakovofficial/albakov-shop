'use strict';
/* Модуль сервера ALBAKOV — маршруты API: личный кабинет (/api/me).
   Вынесен из функции api() в server.js 16.11.2026: код маршрутов без изменений, порядок проверки прежний.
   Если ни один маршрут не подошёл, возвращается NEXT — запрос идёт к следующему разделу. */
module.exports = function install(S) {
  const {
    NEXT, OWNER_PHONE, PUSH_CUSTOMER, SUPPORT_DIR, checkPassword, cleanCartLines, cleanFavorites, cut, db, fail,
    fs, getSession, hashPassword, normPhone, path, pendingLogins, pendingResets, publicUser, pushPrefsOf, pwOk,
    save, setCookie, throttle, throttleOk, txt, validEmail
  } = S;

  async function accountRoutes(req, res, url, body, p, M, user) {
    if (p[0] === 'me' && p[1] === 'push') {
      const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
      if (M === 'PUT') { const v = body.prefs || {}; u.pushPrefs = {}; for (const k of Object.keys(PUSH_CUSTOMER)) u.pushPrefs[k] = !!v[k]; if (u.pushPrefs.promo && !u.pushPromoAt) u.pushPromoAt = new Date().toISOString(); save(); }
      return { prefs: pushPrefsOf(u), devices: db.pushsubs.filter((x) => x.scope !== 'staff' && x.userId === u.id).length };
    }
    if (p[0] === 'me' && M === 'GET') {
      const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
      return { user: publicUser(u), bonusLog: (u.bonusLog || []).slice(0, 100) };
    }
    if (p[0] === 'me' && p[1] === 'bonus-seen' && M === 'POST') {
      const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
      (u.bonusLog || []).forEach((e) => { e.seen = true; }); save();
      return { user: publicUser(u) };
    }
    // Корзина вошедшего покупателя хранится и на сервере: видна на всех устройствах, по ней приходит напоминание
    if (p[0] === 'me' && p[1] === 'cart' && M === 'PUT') {
      const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
      const lines = cleanCartLines(body.lines), key = JSON.stringify(lines);
      if (!u.cart || u.cart.key !== key) u.cart = { lines, key, updatedAt: new Date().toISOString(), reminded: false };
      save(); return {};
    }
    if (p[0] === 'me' && p[1] === 'prefs' && M === 'PUT') {
      const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
      if (typeof body.cartRemind === 'boolean') { u.cartRemind = body.cartRemind; u.cartRemindAt = new Date().toISOString(); }
      save(); return { user: publicUser(u) };
    }
    if (p[0] === 'me' && p[1] === 'favorites' && M === 'PUT') {
      const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
      u.favorites = cleanFavorites(body.list); save(); return { user: publicUser(u) };
    }
    if (p[0] === 'me' && !p[1] && M === 'PUT') {
      const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
      const email = txt(body.email).trim().toLowerCase(), phone = normPhone(txt(body.phone)), firstName = txt(body.firstName).trim(), lastName = txt(body.lastName).trim();
      if (!firstName || !lastName) fail(400, 'Укажите имя и фамилию');
      if (phone.length !== 11) fail(400, 'Проверьте номер телефона');
      if (!validEmail(email)) fail(400, 'Проверьте электронную почту');
      if (db.users.some((x) => x.id !== u.id && x.email === email)) fail(409, 'Эта почта уже используется');
      if (db.users.some((x) => x.id !== u.id && x.phone === phone)) fail(409, 'Этот телефон уже используется');
      // Смена пароля или почты (почта — это логин) — только с текущим паролем: иначе чужой человек с открытым кабинетом мог бы забрать аккаунт
      if (body.newPassword || email !== u.email) {
        const tk = throttle(req, 'pwcheck', 15);
        if (!String(body.currentPassword || '')) fail(400, body.newPassword ? 'Введите текущий пароль, чтобы сменить его' : 'Введите текущий пароль, чтобы сменить почту');
        if (!pwOk(body.currentPassword) || !checkPassword(body.currentPassword, u.hash)) fail(400, 'Текущий пароль указан неверно');
        throttleOk(tk);
      }
      Object.assign(u, { firstName: cut(firstName, 60), lastName: cut(lastName, 60), email, phone });
      if (body.newPassword) { if (String(body.newPassword).length < 6) fail(400, 'Пароль должен быть не короче 6 символов'); if (!pwOk(body.newPassword)) fail(400, 'Слишком длинный пароль'); u.hash = hashPassword(body.newPassword);
        // остальные входы в этот аккаунт закрываем — как при сбросе пароля; текущий остаётся (15.11.2026)
        const cur = getSession(req, 'user'); for (const k in db.sessions) if (db.sessions[k].kind === 'user' && db.sessions[k].userId === u.id && (!cur || k !== cur.token)) delete db.sessions[k]; }
      save(); return { user: publicUser(u) };
    }

    // Удаление аккаунта (13.64.0, требование App Store 5.1.1(v)): по паролю. Личные данные, избранное, корзина, бонусы,
    // подписки и вход удаляются; заказы и чеки остаются у магазина (учёт по закону), но больше не привязаны к аккаунту
    if (p[0] === 'me' && p[1] === 'delete' && M === 'POST') {
      const u = user(); if (!u) fail(401, 'Войдите в личный кабинет');
      const tk = throttle(req, 'pwcheck', 15);
      if (!pwOk(body.password) || !checkPassword(body.password, u.hash)) fail(400, 'Пароль указан неверно');
      throttleOk(tk);
      if (String(u.phone || '') === OWNER_PHONE) fail(400, 'Это аккаунт владельца магазина — его нельзя удалить из кабинета');
      db.orders.forEach((o) => { if (o.userId === u.id) o.userId = null; });
      // Обращения в поддержку: без заказа — удаляем, по заказу — оставляем без имени и контактов
      db.tickets.filter((t) => t.userId === u.id && !t.orderId).forEach((t) => t.messages.forEach((m) => (m.files || []).forEach((f) => { try { fs.unlinkSync(path.join(SUPPORT_DIR, f)); } catch (e) {} })));
      db.tickets = db.tickets.filter((t) => t.userId !== u.id || t.orderId);
      db.tickets.forEach((t) => { if (t.userId === u.id) Object.assign(t, { userId: null, name: 'Удалённый покупатель', email: '', phone: '' }); });
      db.waitlist = db.waitlist.filter((w) => w.userId !== u.id && w.email !== u.email);
      db.pushsubs = (db.pushsubs || []).filter((x) => x.userId !== u.id);
      if (db.secrets.staff) db.secrets.staff = db.secrets.staff.filter((x) => x.userId !== u.id);
      for (const k in db.sessions) if (db.sessions[k].userId === u.id) delete db.sessions[k];
      for (const m of [pendingLogins, pendingResets]) for (const [k, r] of m) if (r.userId === u.id) m.delete(k);
      db.users = db.users.filter((x) => x.id !== u.id);
      save(); setCookie(res, 'sid', '', 0);
      return {};
    }
    return NEXT;
  }

  return { accountRoutes };
};
