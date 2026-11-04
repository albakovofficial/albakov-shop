/* Журнал действий в панели (13.60): кто, когда и что поменял — человеческим языком.
   before(p, M, body, db) — снимок того, что сейчас изменится; describe(...) — запись после успешного запроса.
   Пустой текст — запрос не пишем (загрузка фото, проверки, личные настройки). */
const NAMES = { categories: 'Категория', sizeCharts: 'Размерная сетка', products: 'Товар', promotions: 'Акция', promocodes: 'Промокод', pages: 'Страница' };
const SETTINGS_RU = {
  storeName: 'название магазина', logo: 'логотип', contacts: 'контакты', menu: 'меню', social: 'соцсети', delivery: 'доставка', payment: 'оплата', bonus: 'бонусная программа',
  exchange: 'обмен и возврат', cdek: 'СДЭК', slider: 'слайдер', home: 'главная страница', announcement: 'объявление над шапкой', ownerNotify: 'уведомления на почту',
  badges: 'плашки товаров', metrika: 'Яндекс Метрика', seo: 'поиск', gifts: 'подарочные сертификаты', legal: 'реквизиты', notifyTpl: 'письмо о поступлении', mailTpl: 'письма', sections: 'разделы женщинам / мужчинам', benefits: 'преимущества'
};
const ST = { new: 'Новый', processing: 'Собирается', shipped: 'Передан в доставку', done: 'Выполнен', canceled: 'Отменён', returned: 'Возврат' };
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const rub = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';

function before(p, M, body, db) {
  if (p[0] !== 'admin' || M === 'GET') return null;
  const c = p[1];
  if (c === 'orders' && p[2]) { const o = db.orders.find((x) => x.id === p[2]); return o ? { number: o.number, hist: (o.history || []).length } : null; }
  if (NAMES[c] && p[2] && !['delete-many', 'bulk', 'stock'].includes(p[2])) return { item: clone((db[c] || []).find((x) => x.id === p[2])) };
  if (NAMES[c] && p[2] === 'delete-many') return { items: (db[c] || []).filter((x) => (body.ids || []).includes(x.id)).map((x) => x.name || x.title || x.code || x.id) };
  if (c === 'products' && p[2] === 'bulk') return { items: clone(db.products.filter((x) => (body.ids || []).includes(x.id))) };
  if (c === 'settings') return { settings: clone(db.settings) };
  if (c === 'support' && p[2]) { const t = db.tickets.find((x) => x.id === p[2]); return t ? { number: t.number, name: t.name } : null; }
  if (c === 'users' && p[2]) { const u = db.users.find((x) => x.id === p[2]); return u ? { name: [u.firstName, u.lastName].filter(Boolean).join(' ') || ('+' + u.phone) } : null; }
  if (c === 'staff' && p[2]) { const u = db.users.find((x) => x.id === p[2]); return u ? { name: [u.firstName, u.lastName].filter(Boolean).join(' ') } : null; }
  return {};
}

// Что поменялось в товаре: цена, скидка, видимость, остатки по размерам, название
function productDiff(a, b) {
  if (!a) return 'добавлен';
  if (!b) return 'удалён';
  const out = [];
  if (a.name !== b.name) out.push('название «' + a.name + '» → «' + b.name + '»');
  if (Number(a.price) !== Number(b.price)) out.push('цена ' + rub(a.price) + ' → ' + rub(b.price));
  if (Number(a.compareAt || 0) !== Number(b.compareAt || 0)) out.push(b.compareAt ? 'старая цена ' + rub(b.compareAt) : 'старая цена убрана');
  if ((a.active !== false) !== (b.active !== false)) out.push(b.active === false ? 'скрыт с сайта' : 'показан на сайте');
  const st = [];
  for (const cb of b.colors || []) {
    const ca = (a.colors || []).find((x) => x.id === cb.id);
    for (const sb of cb.sizes || []) {
      const sa = ca && (ca.sizes || []).find((x) => x.size === sb.size);
      if (!sa || Number(sa.stock) !== Number(sb.stock)) st.push((cb.name ? cb.name + ' ' : '') + sb.size + ': ' + (sa ? sa.stock : 0) + ' → ' + sb.stock);
    }
  }
  if (st.length) out.push('остатки ' + st.slice(0, 6).join(', ') + (st.length > 6 ? ' и ещё ' + (st.length - 6) : ''));
  if (JSON.stringify(a.colors && a.colors.map((x) => x.images)) !== JSON.stringify(b.colors && b.colors.map((x) => x.images))) out.push('фото');
  if (a.description !== b.description) out.push('описание');
  return out.length ? out.join('; ') : 'сохранён без изменений';
}

function describe(p, M, body, pre, out, db) {
  if (!pre) return null;
  const c = p[1], it = (body && body.value) || {};
  const R = (area, text, ref) => ({ area, text: String(text).slice(0, 600), ref: ref || null });
  if (c === 'orders' && p[2]) {
    const o = db.orders.find((x) => x.id === p[2]), n = pre.number || (o && o.number) || '';
    if (M === 'DELETE') return R('orders', 'Удалён заказ № ' + n);
    const added = o ? (o.history || []).slice(pre.hist).map((h) => h.text.charAt(0).toLowerCase() + h.text.slice(1)) : [];
    if (p[3] === 'refund') return R('orders', 'Заказ № ' + n + ': возврат денег ' + rub((out && out.refund && out.refund.amount) || 0) + (body.reason ? ' — ' + body.reason : ''), { order: p[2] });
    if (p[3] === 'request') return R('orders', 'Заказ № ' + n + ': заявка — ' + ({ exchange: 'отправлен обмен', approve: 'одобрена', decline: 'отклонена', reply: 'ответ покупателю', done: 'закрыта' }[body.action] || body.action || 'изменена'), { order: p[2] });
    if (p[3] && /^cdek|^return/.test(p[3])) return R('orders', 'Заказ № ' + n + ': ' + (p[3].startsWith('return') ? 'возврат через СДЭК' : 'отправка СДЭК') + (added.length ? ' — ' + added.join('; ') : ''), { order: p[2] });
    if (M === 'PATCH') {
      const parts = added.length ? added : [body.status ? 'статус «' + (ST[body.status] || body.status) + '»' : '', body.track ? 'трек ' + body.track : ''].filter(Boolean);
      return parts.length ? R('orders', 'Заказ № ' + n + ': ' + parts.join('; '), { order: p[2] }) : null;
    }
    return R('orders', 'Заказ № ' + n + ': ' + (added.join('; ') || 'изменён'), { order: p[2] });
  }
  if (NAMES[c]) {
    if (p[2] === 'delete-many') return R('content', NAMES[c] + ': удалено ' + pre.items.length + ' — ' + pre.items.slice(0, 5).join(', ') + (pre.items.length > 5 ? '…' : ''));
    if (p[2] === 'bulk') {
      const ids = body.ids || [];
      const act = { price: 'цена ' + rub(body.value), percent: 'цена ' + (body.value > 0 ? '+' : '') + body.value + '%', discount: 'скидка ' + body.value + '%', nodiscount: 'скидка убрана', show: 'показаны на сайте', hide: 'скрыты с сайта' }[body.action] || body.action;
      return R('content', 'Товары (' + ids.length + '): ' + act + ' — ' + pre.items.slice(0, 4).map((x) => x.name).join(', ') + (pre.items.length > 4 ? '…' : ''));
    }
    if (c === 'products' && p[2] === 'stock') return body.dry ? null : R('content', 'Остатки загружены из файла: изменено размеров — ' + ((out && out.changed) || 0));
    if (!p[2]) return R('content', NAMES[c] + ': сохранён весь список');
    const name = (it.name || it.title || it.code || (pre.item && (pre.item.name || pre.item.title || pre.item.code)) || p[2]);
    if (M === 'DELETE') return R('content', NAMES[c] + ' «' + name + '» удалён' + (c === 'promotions' || c === 'pages' ? 'а' : ''));
    if (c === 'products') return R('content', 'Товар «' + name + '»: ' + productDiff(pre.item, it), { product: p[2] });
    return R('content', NAMES[c] + ' «' + name + '»: ' + (pre.item ? 'изменено' : 'добавлено'));
  }
  if (c === 'settings') {
    const a = pre.settings || {}, b = db.settings || {}, keys = [];
    for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) keys.push(SETTINGS_RU[k] || k);
    return keys.length ? R('settings', 'Настройки: ' + keys.join(', ')) : null;
  }
  if (c === 'staff') {
    const ROLE = { manager: 'Управляющий', orders: 'Менеджер заказов', content: 'Контент-менеджер', finance: 'Финансы' };
    if (!p[2] && M === 'POST') return R('staff', 'Выдан доступ: +' + String(body.phone || '').replace(/\D/g, '') + ' — ' + (ROLE[body.role] || body.role));
    if (M === 'PUT') return R('staff', 'Сотрудник ' + ((pre && pre.name) || '') + ': роль «' + (ROLE[body.role] || body.role) + '»');
    if (M === 'DELETE') return R('staff', 'Забран доступ у сотрудника ' + ((pre && pre.name) || ''));
  }
  if (c === 'users' && p[3] === 'bonus') return R('customers', 'Бонусы — ' + pre.name + ': ' + (body.amount > 0 ? '+' : '') + body.amount + (body.note ? ' (' + String(body.note).slice(0, 80) + ')' : ''));
  if (c === 'support' && p[2] && M === 'POST') return R('support', 'Ответ в обращении № ' + pre.number + (pre.name ? ' (' + pre.name + ')' : ''));
  if (c === 'support' && p[2] && M === 'PATCH' && body.status) return R('support', 'Обращение № ' + pre.number + ': ' + (body.status === 'closed' ? 'закрыто' : 'открыто снова'));
  if (c === 'push' && p[2] === 'broadcast' && !body.test) return R('marketing', 'Push-рассылка «' + body.title + '»: доставлено ' + ((out && out.sent) || 0) + ' из ' + ((out && out.to) || 0));
  if (c === 'payment-secret') return R('settings', 'Изменён секретный ключ оплаты');
  if (c === 'mail' && !p[2] && M === 'POST') return R('settings', 'Изменены настройки отправки почты');
  if (c === 'cdek' && M === 'POST') return R('settings', 'Изменено подключение СДЭК');
  if (c === 'order-seq' && M === 'POST') return R('settings', 'Следующий номер заказа: ' + body.next);
  if (c === 'gifts' && M === 'POST') return R('orders', p[2] ? 'Подарочный сертификат: ' + (body.action || 'изменён') : 'Выпущен подарочный сертификат на ' + rub(body.amount));
  if (c === 'finance' && M !== 'GET') return R('finance', 'Финансы: ' + ({ settings: 'ставки и категории', costs: 'себестоимость', expenses: M === 'DELETE' ? 'удалена операция' : 'операция ' + (body.title || body.note || '') }[p[2]] || 'изменено'));
  if (c === 'waitlist' && M === 'DELETE') return R('content', 'Удалена заявка «Сообщить о поступлении»');
  if (c === 'waitlist' && p[2] === 'send') return R('content', 'Разосланы письма о поступлении');
  return null;
}

module.exports = { before, describe, productDiff };
