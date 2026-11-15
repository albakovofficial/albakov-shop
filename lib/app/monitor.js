'use strict';
/* Модуль сервера ALBAKOV — присмотр за сайтом.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    DATA_DIR, Mail, PUBLIC_URL, currentUser, db, fail, fs, mailReady, ownerTo, path, save, sendMail, supportFile,
    supportMail, supportSaveFile, supportTakeFiles, supportTemplates, ticketOrder, ticketText, uid
  } = S;
  // функции модулей, которые подключаются позже
  const brandLogo = (...a) => S.brandLogo(...a);

  /* ---------- Присмотр за сайтом ----------
     Раз в час: резервные копии (файл состояния от tools/backup.js) и место на диске.
     Что-то не так — письмо владельцу, не чаще раза в сутки по каждой проблеме. Если сайт совсем не отвечает,
     написать он не сможет — для этого включён внешний мониторинг Яндекс Метрики. */
  function siteProblems() {
    const out = [];
    try {
      const st = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'backup-status.json'), 'utf8'));
      const age = (Date.now() - new Date(st.at).getTime()) / 36e5;
      if (!st.ok) out.push({ key: 'backup-fail', title: 'Резервная копия не сделалась', text: 'Последняя попытка ' + new Date(st.at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' закончилась ошибкой' + (st.error ? ': ' + st.error : '') + '.' });
      else if (age > 30) out.push({ key: 'backup-old', title: 'Резервные копии не обновлялись ' + Math.round(age / 24 * 10) / 10 + ' дн.', text: 'Копия должна делаться каждую ночь в 03:30. Последняя — ' + new Date(st.at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + '.' });
      else if (st.s3 && st.s3.enabled && st.s3.ok === false) out.push({ key: 'backup-s3', title: 'Копия не ушла в хранилище Selectel', text: 'На сервере копия есть, а в облачное хранилище не загрузилась' + (st.s3.error ? ': ' + st.s3.error : '') + '.' });
    } catch (e) { /* копии ещё не настраивались (например, на тестовой копии) — молчим */ }
    try {
      const st = fs.statfsSync(DATA_DIR), free = st.bavail * st.bsize, total = st.blocks * st.bsize;
      if (free < 1.5e9 || free / total < 0.08) out.push({ key: 'disk', title: 'Заканчивается место на сервере', text: 'Свободно ' + (Math.round(free / 1e8) / 10) + ' ГБ из ' + (Math.round(total / 1e8) / 10) + ' ГБ. Когда место кончится, заказы перестанут сохраняться.' });
    } catch (e) {}
    return out;
  }
  function siteAlertMail(problems, test) {
    const to = ownerTo('system'); if (!to || !mailReady() || !problems.length) return Promise.resolve(false);
    const m = Mail.renderNotice({ store: db.settings.storeName, logo: brandLogo(), test, subject: problems.length === 1 ? problems[0].title : 'Проблемы на сайте: ' + problems.length,
      eyebrow: 'Состояние сайта', title: problems.length === 1 ? problems[0].title : 'На сайте есть проблемы', lead: 'Магазин работает, но это лучше поправить в ближайшее время — подробности в панели, раздел «Обзор» → «Состояние сайта».',
      rows: problems.map((x) => [x.title, x.text, '']), button: 'Открыть панель', url: PUBLIC_URL + '/admin?s=overview' });
    return sendMail({ to, subject: m.subject, html: m.html, text: m.text }).then(() => true, (e) => { console.error('Письмо о состоянии сайта не отправлено:', e.message); return false; });
  }
  function siteWatch() {
    const now = Date.now(), sent = db.alertsSent = db.alertsSent || {};
    const fresh = siteProblems().filter((x) => !(sent[x.key] && now - sent[x.key] < 23 * 36e5));
    if (!fresh.length) return;
    siteAlertMail(fresh).then((ok) => { if (ok) { fresh.forEach((x) => { sent[x.key] = now; }); save(); } });
  }
  setTimeout(siteWatch, 5 * 60e3).unref();   setInterval(siteWatch, 60 * 60e3).unref();

  // Панель: все обращения хранятся всегда (решённые — в архиве), поиск по ним — в панели
  function supportAdminApi(req, p, M, body) {
    const me = currentUser(req), meName = me ? (me.firstName || [me.firstName, me.lastName].filter(Boolean).join(' ') || 'Сотрудник') : 'Сотрудник';
    if (!p[2] && M === 'GET') return { tickets: db.tickets.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), templates: supportTemplates() };
    if (p[2] === 'upload' && M === 'POST') return supportSaveFile(body.dataUrl, 'shop');
    if (p[2] === 'file' && p[3] && M === 'GET') return supportFile(p[3]);
    if (p[2] === 'templates' && M === 'PUT') {
      const list = (Array.isArray(body.templates) ? body.templates : []).slice(0, 30).map((x) => ({ id: String(x.id || uid('tp')).slice(0, 40), title: String(x.title || '').trim().slice(0, 60), text: ticketText(x.text) })).filter((x) => x.title && x.text);
      db.settings.supportTemplates = list; save();
      return { templates: list };
    }
    const t = db.tickets.find((x) => x.id === p[2]); if (!t) fail(404, 'Обращение не найдено');
    // Обращение целиком и карточка покупателя: контакты, бонусы, заказы, прошлые обращения
    if (!p[3] && M === 'GET') {
      const u = t.userId && db.users.find((x) => x.id === t.userId);
      const orders = u ? db.orders.filter((o) => o.userId === u.id && o.kind !== 'gift').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10).map((o) => ({ id: o.id, number: o.number, status: o.status, total: o.total, createdAt: o.createdAt })) : [];
      const other = db.tickets.filter((x) => x.id !== t.id && x.userId && x.userId === t.userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((x) => ({ id: x.id, number: x.number, topic: x.topic, status: x.status, updatedAt: x.updatedAt }));
      return { ticket: Object.assign({}, t, { order: ticketOrder(t) }), customer: u ? { id: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' '), email: u.email, phone: u.phone, createdAt: u.createdAt, bonus: u.bonus || 0, orders, tickets: other } : null };
    }
    if (!p[3] && M === 'POST') {
      const text = ticketText(body.text), files = supportTakeFiles(body.files, 'shop');
      if (!text && !files.length) fail(400, body.note ? 'Напишите заметку' : 'Напишите ответ');
      const now = new Date().toISOString();
      // Заметка видна только сотрудникам: без письма, уведомления и смены статуса
      if (body.note) { t.messages.push({ id: uid('m'), from: 'note', text, at: now, files: [], by: meName }); save(); return { ticket: t }; }
      t.messages.push({ id: uid('m'), from: 'shop', text, at: now, files, by: meName }); t.status = 'answered'; t.closedAt = ''; t.unreadUser = true; t.unreadShop = false; t.updatedAt = now; t.shopReadAt = now;
      if (!t.firstReplyAt) t.firstReplyAt = now;
      if (!t.assignee && me) t.assignee = { id: me.id, name: meName };
      save(); supportMail(t, 'customer');
      return { ticket: t, mailed: mailReady() };
    }
    if (!p[3] && M === 'PATCH') {
      if (body.read) { t.unreadShop = false; t.shopReadAt = new Date().toISOString(); }
      if (body.status === 'closed' && t.status !== 'closed') { t.status = 'closed'; t.closedAt = new Date().toISOString(); t.closedBy = 'shop'; }
      else if (body.status === 'open' && t.status === 'closed') { t.status = t.messages.filter((m) => m.from !== 'note').slice(-1)[0].from === 'shop' ? 'answered' : 'open'; t.closedAt = ''; }
      if (body.assign === true && me) t.assignee = { id: me.id, name: meName };
      if (body.assign === false) t.assignee = null;
      save(); return { ticket: t };
    }
    fail(404, 'Неизвестный запрос');
  }

  return {
    siteAlertMail, siteProblems, supportAdminApi
  };
};
