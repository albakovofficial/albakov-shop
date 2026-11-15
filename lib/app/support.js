'use strict';
/* Модуль сервера ALBAKOV — поддержка: переписка покупателя с магазином.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    DATA_DIR, Mail, PUBLIC_URL, can, db, fail, fs, mailReady, ownerTo, path, pushStaff, pushUser, save, sendMail,
    throttle, uid
  } = S;
  // функции модулей, которые подключаются позже
  const brandLogo = (...a) => S.brandLogo(...a);

  /* ---------------- Поддержка: переписка покупателя с магазином ----------------
     У обращения свой номер (№ 1001, 1002…), тема, заказ и статус: open — ждёт ответа, answered — есть ответ, closed — решено.
     Сообщения: from user | shop | note (заметка сотрудников — покупатель её не видит). К сообщению — до 5 фото.
     Фото лежат не в public/uploads, а в data/support: отдаются только автору обращения и сотрудникам с правом orders. */
  const SUPPORT_TOPICS = ['Заказ', 'Доставка', 'Размер и посадка', 'Возврат и обмен', 'Другое'];
  const SUPPORT_DIR = path.join(DATA_DIR, 'support');
  const ticketText = (v) => String(v || '').replace(/\r\n?/g, '\n').trim().slice(0, 2000);
  db.supportUploads = db.supportUploads || [];   // загруженные, но ещё не отправленные фото: { name, by, at }
  const SUPPORT_TEMPLATES = [
    { id: 'size', title: 'Подбор размера', text: 'Здравствуйте! Подскажите, пожалуйста, рост и обычный размер — подберём по меркам изделия. Таблица размеров есть в карточке товара.' },
    { id: 'exchange', title: 'Как оформить обмен', text: 'Обменять размер можно в личном кабинете: «Заказы» → нужный заказ → «Обмен и возврат». Новый размер отправим, как только вещь вернётся к нам.' },
    { id: 'delivery', title: 'Сроки доставки', text: 'Заказ передан в СДЭК. Номер для отслеживания есть в карточке заказа, там же видно, где посылка сейчас.' }
  ];
  function supportTemplates() { return Array.isArray(db.settings.supportTemplates) ? db.settings.supportTemplates : SUPPORT_TEMPLATES; }
  // Фото к сообщению: JPEG, PNG или WebP до 8 МБ (сайт и приложение заранее уменьшают до 1600 px)
  function supportSaveFile(dataUrl, by) {
    const m = String(dataUrl || '').match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
    if (!m) fail(400, 'Нужно фото JPEG, PNG или WebP');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) fail(400, 'Фото больше 8 МБ');
    const magic = { jpeg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47], webp: [0x52, 0x49, 0x46, 0x46] }[m[1]];
    if (!magic.every((b, i) => buf[i] === b) || (m[1] === 'webp' && buf.toString('latin1', 8, 12) !== 'WEBP')) fail(400, 'Файл не похож на фото');
    fs.mkdirSync(SUPPORT_DIR, { recursive: true });
    const name = uid('sf') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
    fs.writeFileSync(path.join(SUPPORT_DIR, name), buf);
    const now = Date.now();
    // неотправленные фото старше двух суток удаляем
    db.supportUploads = db.supportUploads.filter((x) => { if (now - Date.parse(x.at) < 2 * 864e5) return true; try { fs.unlinkSync(path.join(SUPPORT_DIR, x.name)); } catch (e) {} return false; });
    db.supportUploads.push({ name, by, at: new Date(now).toISOString() });
    save();
    return { file: name };
  }
  // Фото, приложенные к новому сообщению: только свои и ещё не отправленные
  function supportTakeFiles(list, by) {
    const names = (Array.isArray(list) ? list : []).map(String).slice(0, 6);
    if (names.length > 5) fail(400, 'Не больше 5 фото в одном сообщении');
    const out = [];
    for (const n of names) {
      const i = db.supportUploads.findIndex((x) => x.name === n && x.by === by);
      if (i < 0) fail(400, 'Фото не найдено — прикрепите его ещё раз');
      db.supportUploads.splice(i, 1); out.push(n);
    }
    return out;
  }
  function supportFile(name) {
    if (!/^sf[a-z0-9]+\.(jpg|png|webp)$/.test(name)) fail(404, 'Файл не найден');
    const f = path.join(SUPPORT_DIR, name);
    if (!fs.existsSync(f)) fail(404, 'Файл не найден');
    return { __file: { type: { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[name.split('.').pop()], name, buf: fs.readFileSync(f) } };
  }
  const ticketHasFile = (t, name) => t.messages.some((m) => m.from !== 'note' && (m.files || []).includes(name));
  // Карточка заказа в переписке: номер, статус, первая вещь
  function ticketOrder(t) {
    const o = t.orderId && db.orders.find((x) => x.id === t.orderId); if (!o) return null;
    const it = o.items[0] || {};
    return { id: o.id, number: o.number, status: o.status, total: o.total, items: o.items.reduce((a, x) => a + (x.qty || 1), 0), name: it.name || '', color: it.color || '', size: it.size || '', image: it.image || '' };
  }
  const ticketMsg = (m) => ({ id: m.id, from: m.from, text: m.text, at: m.at, files: m.files || [], by: m.by || '' });
  // Покупателю — без заметок сотрудников и служебных полей
  function ticketForUser(t) {
    return { id: t.id, number: t.number, topic: t.topic, orderId: t.orderId || '', orderNumber: t.orderNumber || '', order: ticketOrder(t), status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt,
      closedAt: t.closedAt || '', shopReadAt: t.shopReadAt || '', unread: !!t.unreadUser, messages: t.messages.filter((m) => m.from !== 'note').map(ticketMsg) };
  }
  function supportMail(t, kind) {
    const cs = db.settings.contacts || {}, last = t.messages.filter((m) => m.from !== 'note').slice(-1)[0];
    const text = String(last.text || '') || ((last.files || []).length ? 'Фото' : '');
    const short = text.replace(/\s+/g, ' ').slice(0, 140);
    const num = 'Обращение № ' + t.number;
    if (kind === 'customer') pushUser(db.users.find((x) => x.id === t.userId), 'support', { title: 'Ответ поддержки ALBAKOV · № ' + t.number, body: short, url: '/account?tab=support&id=' + t.id, tag: 'ticket-' + t.id, actions: [{ action: 'open', title: 'Ответить' }] });
    else if (!(t.request && t.messages.length === 1)) pushStaff('support', { title: num + ' · ' + (t.name || 'покупатель') + (t.orderNumber ? ' · заказ № ' + t.orderNumber : ''), body: t.topic + ': ' + short, url: '/admin?s=support&id=' + t.id, tag: 'ticket-' + t.id, urgent: true, actions: [{ action: 'open', title: 'Ответить' }] });
    if (!mailReady()) return;
    const to = kind === 'customer' ? t.email : ownerTo('support');
    if (!to) return;
    const url = kind === 'customer' ? `${PUBLIC_URL}/account?tab=support&id=${t.id}` : `${PUBLIC_URL}/admin?s=support&id=${t.id}`;
    const m = Mail.renderSupport({ kind, store: db.settings.storeName, logo: brandLogo(), name: t.name, number: t.number, topic: t.topic, orderNumber: t.orderNumber, text: text + ((last.files || []).length && last.text ? ' (+ фото)' : ''), url, contacts: [cs.phone, cs.email].filter(Boolean).join(' · ') });
    sendMail({ to, subject: m.subject, html: m.html, text: m.text }).catch((e) => console.error('Письмо поддержки не отправлено:', e.message));
  }
  function supportApi(req, p, M, body, u) {
    const mine = () => db.tickets.filter((t) => t.userId === u.id);
    if (!p[1] && M === 'GET') return { tickets: mine().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(ticketForUser), topics: SUPPORT_TOPICS };
    if (p[1] === 'upload' && M === 'POST') { throttle(req, 'support-file', 60); return supportSaveFile(body.dataUrl, u.id); }
    if (p[1] === 'file' && p[2] && M === 'GET') {
      if (!(mine().some((t) => ticketHasFile(t, p[2])) || can(req, 'orders'))) fail(404, 'Файл не найден');
      return supportFile(p[2]);
    }
    if (!p[1] && M === 'POST') {
      throttle(req, 'support', 30);
      const text = ticketText(body.text), files = supportTakeFiles(body.files, u.id);
      if (!text && !files.length) fail(400, 'Напишите, чем мы можем помочь');
      if (mine().filter((t) => t.status !== 'closed').length >= 20) fail(429, 'Открыто слишком много обращений. Продолжите одно из них');
      const o = body.orderId ? db.orders.find((x) => x.id === body.orderId && x.userId === u.id) : null;
      const now = new Date().toISOString();
      db.ticketSeq = (db.ticketSeq || 1000) + 1;
      const t = { id: uid('t'), number: String(db.ticketSeq), userId: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' '), email: u.email, phone: u.phone,
        topic: SUPPORT_TOPICS.includes(body.topic) ? body.topic : (o ? 'Заказ' : 'Другое'), orderId: o ? o.id : '', orderNumber: o ? o.number : '',
        status: 'open', createdAt: now, updatedAt: now, unreadUser: false, unreadShop: true, messages: [{ id: uid('m'), from: 'user', text, at: now, files }] };
      db.tickets.push(t); save(); supportMail(t, 'shop');
      return { ticket: ticketForUser(t) };
    }
    const t = p[1] && mine().find((x) => x.id === p[1]);
    if (!t) fail(404, 'Обращение не найдено');
    if (!p[2] && M === 'GET') { t.userReadAt = new Date().toISOString(); if (t.unreadUser) t.unreadUser = false; save(); return { ticket: ticketForUser(t) }; }
    // «Вопрос решён» — покупатель закрывает обращение сам; новое сообщение откроет его снова
    if (p[2] === 'close' && M === 'POST') {
      if (t.status !== 'closed') { t.status = 'closed'; t.closedAt = new Date().toISOString(); t.closedBy = 'user'; t.updatedAt = t.closedAt; t.unreadShop = false; save(); }
      return { ticket: ticketForUser(t) };
    }
    if (!p[2] && M === 'POST') {
      throttle(req, 'support', 30);
      const text = ticketText(body.text), files = supportTakeFiles(body.files, u.id);
      if (!text && !files.length) fail(400, 'Сообщение пустое');
      const now = new Date().toISOString();
      t.messages.push({ id: uid('m'), from: 'user', text, at: now, files }); t.status = 'open'; t.closedAt = ''; t.unreadShop = true; t.unreadUser = false; t.updatedAt = now; t.userReadAt = now;
      save(); supportMail(t, 'shop');
      return { ticket: ticketForUser(t) };
    }
    fail(404, 'Неизвестный запрос');
  }

  return {
    SUPPORT_DIR, supportApi, supportFile, supportMail, supportSaveFile, supportTakeFiles, supportTemplates,
    ticketOrder, ticketText
  };
};
