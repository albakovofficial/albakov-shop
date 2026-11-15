'use strict';
/* Модуль сервера ALBAKOV — журнал действий в панели.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    ROLES, clientIp, currentUser, db, save, staffRole, uid
  } = S;

  /* ---------------- Журнал действий (13.60) ----------------
     Все изменения в панели: кто, когда, что. Хранится 5000 последних записей; смотрит владелец (право «сотрудники»). */
  function auditAdd(req, e, who) {
    if (!e || !e.text) return;
    const u = who || currentUser(req), role = u ? staffRole(u) : null;
    db.audit.push({ id: uid('a'), at: new Date().toISOString(), by: u ? u.id : '', name: u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || '+' + u.phone : '', role: role ? ROLES[role].name : '',
      area: e.area || 'other', text: e.text, ref: e.ref || null, ip: clientIp(req) });
    if (db.audit.length > 5000) db.audit.splice(0, db.audit.length - 5000);
    save();
  }

  return {
    auditAdd
  };
};
