'use strict';
/* Модуль сервера ALBAKOV — маршруты API: вход, регистрация, пароль.
   Вынесен из функции api() в server.js 16.11.2026: код маршрутов без изменений, порядок проверки прежний.
   Если ни один маршрут не подошёл, возвращается NEXT — запрос идёт к следующему разделу. */
module.exports = function install(S) {
  const {
    NEXT, ROLES, VERIFY_MIN, VERIFY_RESEND_SEC, VERIFY_SENDS, VERIFY_TRIES, auditAdd, checkPassword, clientIp,
    codeHash, createSession, createUser, crypto, cut, db, deviceName, fail, getSession, hashPassword, mailReady,
    maskEmail, normPhone, pendingLogins, pendingRegs, pendingResets, publicUser, pushStaff, pwOk, safeEqual, save,
    sendCode, setCookie, staffRole, sweepPending, throttle, throttleKey, throttleOk, touchDevice, trustedDevice,
    txt, validEmail, welcomeInfo
  } = S;

  async function authRoutes(req, res, url, body, p, M, user) {
    if (p[0] === 'auth') {
      if (p[1] === 'register' && M === 'POST') {
        throttle(req, 'reg');
        const f = { firstName: cut(txt(body.firstName).trim(), 60), lastName: cut(txt(body.lastName).trim(), 60), phone: normPhone(txt(body.phone)), email: txt(body.email).trim().toLowerCase().slice(0, 120) };
        if (!f.firstName || !f.lastName) fail(400, 'Укажите имя и фамилию');
        if (f.phone.length !== 11) fail(400, 'Укажите номер телефона полностью');
        if (!validEmail(f.email)) fail(400, 'Проверьте электронную почту');
        if (String(body.password || '').length < 6) fail(400, 'Пароль должен быть не короче 6 символов');
        if (!pwOk(body.password)) fail(400, 'Слишком длинный пароль');
        if (!body.consent) fail(400, 'Нужно согласие на обработку персональных данных');
        if (db.users.some((u) => u.email === f.email)) fail(409, 'Пользователь с такой почтой уже зарегистрирован');
        if (db.users.some((u) => u.phone === f.phone)) fail(409, 'Пользователь с таким телефоном уже зарегистрирован');
        // согласие на обработку персональных данных: когда дано и с какого адреса — для подтверждения по закону
        const consent = { consentAt: new Date().toISOString(), consentIp: clientIp(req) };
        if (!mailReady()) { const u = createUser(res, f, hashPassword(body.password), consent); return { user: publicUser(u), welcome: welcomeInfo() }; }
        sweepPending();
        for (const [k, r] of pendingRegs) if (r.f.email === f.email) pendingRegs.delete(k);
        if (pendingRegs.size > 2000) fail(429, 'Слишком много регистраций. Попробуйте через несколько минут');
        const r = { id: crypto.randomBytes(16).toString('hex'), f, hash: hashPassword(body.password), consent };
        await sendCode(r);
        pendingRegs.set(r.id, r);
        return { pending: { id: r.id, email: maskEmail(f.email), minutes: VERIFY_MIN, resendIn: VERIFY_RESEND_SEC } };
      }
      if (p[1] === 'verify' && M === 'POST') {
        throttle(req, 'verify', 40);
        sweepPending();
        const r = pendingRegs.get(String(body.id || ''));
        if (!r) fail(410, 'Код устарел. Зарегистрируйтесь ещё раз — мы пришлём новый');
        const code = String(body.code || '').replace(/\D/g, '');
        if (code.length !== 6) fail(400, 'Введите все 6 цифр кода');
        if (r.tries >= VERIFY_TRIES) fail(429, 'Слишком много неверных попыток. Запросите новый код');
        if (!safeEqual(codeHash(r.id, code), r.code)) {
          r.tries++;
          const left = VERIFY_TRIES - r.tries;
          fail(400, left > 0 ? 'Неверный код. Осталось попыток: ' + left : 'Слишком много неверных попыток. Запросите новый код');
        }
        pendingRegs.delete(r.id);
        const u = createUser(res, r.f, r.hash, Object.assign({ emailVerifiedAt: new Date().toISOString() }, r.consent));
        return { user: publicUser(u), welcome: welcomeInfo() };
      }
      if (p[1] === 'resend' && M === 'POST') {
        throttle(req, 'resend', 20);
        sweepPending();
        const r = pendingRegs.get(String(body.id || ''));
        if (!r) fail(410, 'Код устарел. Зарегистрируйтесь ещё раз — мы пришлём новый');
        const wait = Math.ceil((r.sentAt + VERIFY_RESEND_SEC * 1000 - Date.now()) / 1000);
        if (wait > 0) fail(429, 'Новый код можно запросить через ' + wait + ' с');
        if (r.sends >= VERIFY_SENDS) fail(429, 'Код уже отправлялся несколько раз. Проверьте папку «Спам» или зарегистрируйтесь заново');
        await sendCode(r);
        return { resendIn: VERIFY_RESEND_SEC };
      }
      if (p[1] === 'login' && M === 'POST') {
        const l = String(body.login || '').trim().toLowerCase(), ph = normPhone(l);
        // неверный пароль за 15 минут: 30 с одного адреса, 10 на один логин с одного адреса и 60 на логин со всех адресов.
        // Так посторонний с одного адреса не закроет хозяину вход в его аккаунт (аудит N-3, 16.11), а подбор с разных адресов всё равно упрётся в 60
        const u = db.users.find((x) => x.email === l || (ph.length === 11 && x.phone === ph));
        const acc = u ? u.id : l, tk = throttle(req, 'login', 30), tkAcc = throttleKey('login-acc|' + acc + '|' + clientIp(req), 10), tkAll = throttleKey('login-all|' + acc, 60);
        if (!u || !pwOk(body.password) || !checkPassword(body.password, u.hash)) fail(401, 'Неверный логин или пароль');
        throttleOk(tk); throttleOk(tkAcc); throttleOk(tkAll);
        // Владелец и сотрудники с нового устройства входят только по коду из письма (13.60)
        if (staffRole(u) && mailReady() && u.email && !trustedDevice(req, u)) {
          sweepPending();
          for (const [k, r] of pendingLogins) if (r.userId === u.id) pendingLogins.delete(k);
          const r = { id: crypto.randomBytes(16).toString('hex'), userId: u.id, f: { email: u.email, firstName: u.firstName }, device: deviceName(req) };
          await sendCode(r, 'login'); pendingLogins.set(r.id, r);
          return { confirm: { id: r.id, email: maskEmail(u.email), minutes: VERIFY_MIN, resendIn: VERIFY_RESEND_SEC } };
        }
        createSession(res, 'user', u.id);
        if (staffRole(u)) { touchDevice(req, res, u); auditAdd(req, { area: 'security', text: 'Вход в панель · ' + deviceName(req) }, u); }
        return { user: publicUser(u), isAdmin: !!staffRole(u) };
      }
      if (p[1] === 'login-confirm' && M === 'POST') {
        throttle(req, 'verify', 40);
        sweepPending();
        const r = pendingLogins.get(String(body.id || ''));
        if (!r) fail(410, 'Код устарел. Войдите ещё раз — пришлём новый');
        const code = String(body.code || '').replace(/\D/g, '');
        if (code.length !== 6) fail(400, 'Введите все 6 цифр кода');
        if (r.tries >= VERIFY_TRIES) { pendingLogins.delete(r.id); fail(429, 'Слишком много неверных попыток. Войдите ещё раз'); }
        if (!safeEqual(codeHash(r.id, code), r.code)) { r.tries++; const left = VERIFY_TRIES - r.tries; fail(400, left > 0 ? 'Неверный код. Осталось попыток: ' + left : 'Слишком много неверных попыток. Войдите ещё раз'); }
        pendingLogins.delete(r.id);
        const u = db.users.find((x) => x.id === r.userId); if (!u) fail(400, 'Аккаунт не найден');
        createSession(res, 'user', u.id); touchDevice(req, res, u, true);
        auditAdd(req, { area: 'security', text: 'Вход в панель с нового устройства · ' + r.device }, u);
        pushStaff('security', { title: 'Вход в панель с нового устройства', body: [u.firstName, u.lastName].filter(Boolean).join(' ') + (staffRole(u) ? ' (' + ROLES[staffRole(u)].name + ')' : '') + ' · ' + r.device + '. Если это не ваш сотрудник — заберите доступ в «Сотрудниках».', url: '/admin?s=audit', tag: 'sec-' + u.id, urgent: true });
        return { user: publicUser(u), isAdmin: !!staffRole(u) };
      }
      if (p[1] === 'login-resend' && M === 'POST') {
        throttle(req, 'resend', 20);
        sweepPending();
        const r = pendingLogins.get(String(body.id || ''));
        if (!r) fail(410, 'Код устарел. Войдите ещё раз — пришлём новый');
        const wait = Math.ceil((r.sentAt + VERIFY_RESEND_SEC * 1000 - Date.now()) / 1000);
        if (wait > 0) fail(429, 'Новый код можно запросить через ' + wait + ' с');
        if (r.sends >= VERIFY_SENDS) fail(429, 'Код уже отправлялся несколько раз. Проверьте папку «Спам»');
        await sendCode(r, 'login');
        return { resendIn: VERIFY_RESEND_SEC };
      }
      // Восстановление пароля: код на почту аккаунта, потом новый пароль. Есть ли такой аккаунт — не сообщаем
      if (p[1] === 'forgot' && M === 'POST') {
        throttle(req, 'forgot', 8);
        if (!mailReady()) fail(503, 'Восстановление пароля временно недоступно. Напишите нам — поможем войти');
        sweepPending();
        const l = String(body.login || '').trim().toLowerCase(), ph = normPhone(l);
        const u = db.users.find((x) => x.email === l || (ph.length === 11 && x.phone === ph));
        const id = crypto.randomBytes(16).toString('hex');
        if (u) {
          for (const [k, r] of pendingResets) if (r.userId === u.id) pendingResets.delete(k);
          const r = { id, userId: u.id, f: { email: u.email, firstName: u.firstName } };
          await sendCode(r, 'reset'); pendingResets.set(id, r);
        }
        // Ввели почту — показываем её же в маске (ничего нового); ввели телефон — почту не показываем: иначе по номеру видно, есть ли аккаунт (аудит N-8, 16.11)
        // Приложение 1.0.2 пишет «Отправили код на <email>» — для телефона подставляем нейтральное «почту из аккаунта»
        return { id, email: validEmail(l) ? maskEmail(l) : 'почту из аккаунта', resendIn: VERIFY_RESEND_SEC };
      }
      if (p[1] === 'reset' && M === 'POST') {
        throttle(req, 'verify', 40);
        sweepPending();
        const r = pendingResets.get(String(body.id || ''));
        const code = String(body.code || '').replace(/\D/g, '');
        if (code.length !== 6) fail(400, 'Введите все 6 цифр кода');
        if (String(body.password || '').length < 6) fail(400, 'Пароль должен быть не короче 6 символов');
        if (!pwOk(body.password)) fail(400, 'Слишком длинный пароль');
        if (!r) fail(400, 'Неверный или устаревший код. Запросите новый');
        if (r.tries >= VERIFY_TRIES) fail(429, 'Слишком много неверных попыток. Запросите новый код');
        if (!safeEqual(codeHash(r.id, code), r.code)) { r.tries++; const left = VERIFY_TRIES - r.tries; fail(400, left > 0 ? 'Неверный код. Осталось попыток: ' + left : 'Слишком много неверных попыток. Запросите новый код'); }
        const u = db.users.find((x) => x.id === r.userId); pendingResets.delete(r.id);
        if (!u) fail(400, 'Аккаунт не найден');
        u.hash = hashPassword(body.password);
        // старые входы на других устройствах закрываем — пароль мог знать посторонний
        for (const k in db.sessions) if (db.sessions[k].kind === 'user' && db.sessions[k].userId === u.id) delete db.sessions[k];
        createSession(res, 'user', u.id); save();
        return { user: publicUser(u) };
      }
      if (p[1] === 'logout' && M === 'POST') { const s = getSession(req, 'user'); if (s) { delete db.sessions[s.token]; save(); } setCookie(res, 'sid', '', 0); return {}; }
    }
    return NEXT;
  }

  return { authRoutes };
};
