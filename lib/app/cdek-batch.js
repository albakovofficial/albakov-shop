'use strict';
/* Модуль сервера ALBAKOV — СДЭК пачкой: печать и вызов курьера.
   Вынесен из server.js 16.11.2026 без изменения логики. Общие данные и функции приходят через S (server.js, раздел «Модули»). */
module.exports = function install(S) {
  const {
    HttpError, cdek, cdekCfg, db, fail, hist, normPhone, save, uid
  } = S;

  /* ---------- СДЭК пачкой: одна печать на несколько заказов, вызов курьера ---------- */
  async function cdekBatchApi(p, M, body, url) {
    if (!cdek.ready()) fail(400, 'СДЭК не подключён — введите ключи в «Оплата и доставка»');
    // Наклейки или накладные сразу для нескольких заказов — один PDF
    if (p[1] === 'cdek-print' && M === 'GET') {
      const ids = String(url.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 100);
      const os = ids.map((id) => db.orders.find((x) => x.id === id)).filter((o) => o && o.cdek && o.cdek.uuid);
      if (!os.length) fail(400, 'У выбранных заказов нет отправлений СДЭК');
      const kind = url.searchParams.get('kind') === 'barcode' ? 'barcode' : 'waybill';
      let buf; try { buf = await cdek.print(os.map((o) => o.cdek.uuid), kind); } catch (e) { fail(502, 'СДЭК: ' + e.message); }
      return { __file: { buf, type: 'application/pdf', name: (kind === 'barcode' ? 'naklejki-' : 'nakladnye-') + os.length + '-zakaz.pdf' } };
    }
    // Вызов курьера: забрать посылки выбранных заказов по адресу магазина
    if (p[1] === 'cdek-intake' && !p[2] && M === 'POST') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 100);
      const os = ids.map((id) => db.orders.find((x) => x.id === id)).filter((o) => o && o.cdek && o.cdek.uuid && !['canceled', 'returned'].includes(o.status));
      if (!os.length) fail(400, 'Выберите заказы с созданными отправлениями');
      const date = String(body.date || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, 'Выберите день');
      const today = new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10); if (date < today) fail(400, 'День уже прошёл');
      const tm = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : '';
      const from = tm(body.from) || '10:00', to = tm(body.to) || '18:00';
      const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
      if (mins(to) - mins(from) < 180) fail(400, 'СДЭК просит окно не короче 3 часов');
      const pk = { cityCode: Number(body.cityCode) || Number((cdekCfg().shipmentPoint || {}).cityCode) || 0, address: String(body.address || '').trim().slice(0, 255), name: String(body.name || '').trim().slice(0, 100), phone: normPhone(body.phone) };
      if (!pk.cityCode) fail(400, 'Укажите город');
      if (pk.address.length < 5) fail(400, 'Укажите адрес, откуда забрать посылки');
      if (!pk.name) fail(400, 'Укажите, кто передаст посылки');
      if (pk.phone.length !== 11) fail(400, 'Проверьте телефон');
      // запоминаем адрес забора для следующего раза
      db.settings.cdek = Object.assign({}, db.settings.cdek, { pickup: pk });
      const weight = os.reduce((s, o) => s + ((o.cdek.pkg && o.cdek.pkg.weight) || 500), 0);
      const req = {
        intake_date: date, intake_time_from: from, intake_time_to: to,
        name: 'Одежда, ' + os.length + ' ' + (os.length === 1 ? 'посылка' : os.length < 5 ? 'посылки' : 'посылок'),
        weight, length: 40, width: 30, height: Math.min(150, 10 * os.length),
        comment: ('Заказы: ' + os.map((o) => o.cdek.number || ('ALB-' + o.number)).join(', ') + (body.comment ? '. ' + String(body.comment) : '')).slice(0, 255),
        need_call: !!body.needCall,
        sender: { company: db.settings.storeName || 'ALBAKOV', name: pk.name, phones: [{ number: '+' + pk.phone }] },
        from_location: { code: pk.cityCode, address: pk.address }
      };
      if (os.length === 1 && os[0].cdek.number) req.cdek_number = Number(os[0].cdek.number) || undefined;
      let uuid; try { uuid = await cdek.intake(req); } catch (e) { fail(502, 'СДЭК: ' + e.message); }
      const it = { id: uid('k'), uuid, number: '', status: 'ACCEPTED', statusName: 'Заявка принята', createdAt: new Date().toISOString(), date, from, to, orders: os.map((o) => ({ id: o.id, number: o.number, cdek: o.cdek.number || '' })), address: pk.address, weight };
      db.intakes.push(it); save();
      try { await new Promise((r) => setTimeout(r, 1500)); const info = await cdek.intakeInfo(uuid); if (info.error) { db.intakes = db.intakes.filter((x) => x !== it); save(); fail(400, 'СДЭК отклонил заявку: ' + info.error); } Object.assign(it, { number: info.number, status: info.status || it.status, statusName: info.statusName || it.statusName }); save(); } catch (e) { if (e instanceof HttpError) throw e; }
      os.forEach((o) => hist(o, 'Вызван курьер СДЭК на ' + date + ', ' + from + '–' + to, 'admin'));
      save(); return { intake: it, intakes: db.intakes };
    }
    if (p[1] === 'cdek-intake' && p[2]) {
      const it = db.intakes.find((x) => x.id === p[2]); if (!it) fail(404, 'Заявка не найдена');
      if (M === 'POST' && p[3] === 'sync') { try { const info = await cdek.intakeInfo(it.uuid); Object.assign(it, { number: info.number || it.number, status: info.status || it.status, statusName: info.statusName || it.statusName }); save(); } catch (e) { fail(502, 'СДЭК: ' + e.message); } return { intake: it };
      }
      if (M === 'DELETE') { try { await cdek.intakeCancel(it.uuid); } catch (e) { fail(502, 'СДЭК: ' + e.message); } it.status = 'REMOVED'; it.statusName = 'Отменена'; save(); return { intake: it }; }
    }
    fail(404, 'Не найдено');
  }

  return {
    cdekBatchApi
  };
};
