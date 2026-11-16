'use strict';
/* Модуль сервера ALBAKOV — письма о заказе покупателю и магазину.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    Mail, PUBLIC_URL, Pricing, absUrl, db, firstImg, itemsLine, mailReady, money, save, sendMail
  } = S;
  // функции модулей, которые подключаются позже
  const brandLogo = (...a) => S.brandLogo(...a);
  const ownerTo = (...a) => S.ownerTo(...a);
  const pushStaff = (...a) => S.pushStaff(...a);

  /* ---------------- Письма о заказе: покупателю и магазину ---------------- */
  /* Push сотрудникам о заказе (15.11.2026): одно уведомление на заказ, которое обновляется (тот же tag) —
     «Новый заказ» сразу при оформлении (и при онлайн-оплате тоже) → «Оплачен заказ» после оплаты → «не оплачен», если время вышло */
  function pushStaffOrder(order, stage) {
    if (order.test || order.payment.method === 'exchange') return;
    const key = { new: 'staff', paid: 'staffPaid', expired: 'staffExpired' }[stage];
    if (!key || (order.pushed && order.pushed[key])) return;
    if (stage === 'expired' && !(order.pushed && order.pushed.staff)) return;   // о заказе и не сообщали — нечего обновлять
    order.pushed = Object.assign({}, order.pushed, { [key]: new Date().toISOString() });
    if (stage === 'new' && order.payment.status === 'paid') order.pushed.staffPaid = order.pushed.staff;   // оплачен сразу (бонусы, сертификат)
    const c = order.customer || {}, pv = order.delivery && order.delivery.pvz, who = [c.firstName, c.lastName].filter(Boolean).join(' ') + (pv && pv.city ? ', ' + pv.city : '');
    const online = order.payment.method === 'online', paid = order.payment.status === 'paid';
    const m = stage === 'expired'
      ? { kind: 'order', title: 'Заказ № ' + order.number + ' не оплачен', body: 'Время на оплату вышло — заказ отменён, вещи вернулись на склад\n' + who, urgent: false }
      : stage === 'paid' || paid
        ? { kind: 'paid', title: 'Оплачен заказ № ' + order.number + ' · ' + money(order.total), body: who + '\n' + itemsLine(order) + '\nМожно собирать', urgent: true }
        : { kind: 'order', title: 'Новый заказ № ' + order.number + ' · ' + money(order.total), body: who + '\n' + itemsLine(order) + (online ? '\nЖдёт онлайн-оплаты — 10 минут' : '\nОплата при получении'), urgent: true };
    pushStaff(m.kind, { title: m.title, body: m.body, url: '/admin?s=orders&id=' + order.id, tag: 'order-' + order.id, icon: firstImg(order), urgent: m.urgent, actions: [{ action: 'open', title: 'Открыть заказ' }] });
  }
  function sendOrderMails(order) {
    pushStaffOrder(order, order.payment.method === 'online' && order.payment.status === 'paid' ? 'paid' : 'new');
    if (!mailReady()) return;
    const pay = db.settings.payment || {}, cs = db.settings.contacts || {};
    const m = order.payment.method;
    const base = {
      store: db.settings.storeName, logo: brandLogo(), order: Object.assign({}, order, { items: order.items.map((i) => Object.assign({}, i, { image: absUrl(i.image) })) }),
      money: Pricing.format, payLabel: m === 'exchange' ? 'обмен — бесплатно' : m === 'bonus' ? 'оплачено бонусами' : m === 'online' ? (order.payment.status === 'paid' ? 'оплачено онлайн' : 'онлайн') : (pay.codLabel || 'при получении'),
      contacts: [cs.phone, cs.email].filter(Boolean).join(' · ')
    };
    const jobs = [];
    const mc = Mail.renderOrder(Object.assign({ kind: 'customer', url: `${PUBLIC_URL}/order/${order.id}?t=${order.token}` }, base));
    jobs.push(sendMail({ to: order.customer.email, subject: mc.subject, html: mc.html, text: mc.text }).then(() => { order.mailedAt = new Date().toISOString(); save(); }));
    const shopTo = order.test ? '' : ownerTo('order');
    if (shopTo) {
      const ms = Mail.renderOrder(Object.assign({ kind: 'shop', url: `${PUBLIC_URL}/admin?s=orders&id=${order.id}` }, base));
      jobs.push(sendMail({ to: shopTo, subject: ms.subject, html: ms.html, text: ms.text }));
    }
    Promise.allSettled(jobs).then((r) => r.forEach((x) => { if (x.status === 'rejected') console.error('Письмо о заказе не отправлено:', x.reason && x.reason.message); }));
  }

  return {
    pushStaffOrder, sendOrderMails
  };
};
