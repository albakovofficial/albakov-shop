'use strict';
/* Модуль сервера ALBAKOV — маршруты API панели: товары, остатки, коллекции.
   Вынесен из функции api() в server.js 16.11.2026: код маршрутов без изменений, порядок проверки прежний.
   Если ни один маршрут не подошёл, возвращается NEXT — запрос идёт к следующему разделу. */
module.exports = function install(S) {
  const {
    COLLECTIONS, NEXT, Pricing, Specs, db, fail, fixSkus, processWaitlist, save, seoChanged
  } = S;

  async function adminCatalogRoutes(req, res, url, body, p, M, user) {
    // Массовые изменения товаров (13.60): цена, ±%, скидка, видимость
    if (p[1] === 'products' && p[2] === 'bulk' && M === 'POST') {
      const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string').slice(0, 5000) : [];
      const list = db.products.filter((x) => ids.includes(x.id)); if (!list.length) fail(400, 'Выберите товары');
      const v = Number(body.value) || 0, A = body.action, r10 = (n) => Math.max(1, Math.round(n));
      if (A === 'price' && !(v > 0 && v <= 10000000)) fail(400, 'Укажите цену');
      if (A === 'percent' && !(v !== 0 && v > -95 && v <= 500)) fail(400, 'Процент — от −95 до 500, например 10 или −10');
      if (A === 'discount' && !(v > 0 && v < 95)) fail(400, 'Скидка — от 1 до 94%');
      if (!['price', 'percent', 'discount', 'nodiscount', 'show', 'hide'].includes(A)) fail(400, 'Выберите, что изменить');
      let changed = 0;
      for (const x of list) {
        const was = JSON.stringify([x.price, x.compareAt, x.active]);
        if (A === 'price') x.price = r10(v);
        if (A === 'percent') { x.price = r10(x.price * (1 + v / 100)); if (x.compareAt && x.compareAt <= x.price) x.compareAt = 0; }
        if (A === 'discount') { const base = x.compareAt > x.price ? x.compareAt : x.price; x.compareAt = base; x.price = r10(base * (1 - v / 100)); }
        if (A === 'nodiscount' && x.compareAt > x.price) { x.price = x.compareAt; x.compareAt = 0; }
        if (A === 'show') x.active = true;
        if (A === 'hide') x.active = false;
        if (was !== JSON.stringify([x.price, x.compareAt, x.active])) { changed++; seoChanged('products', x); }
      }
      save();
      return { changed, notify: A === 'show' ? await processWaitlist() : null };
    }
    // Остатки в Excel: выгрузка CSV (разделитель «;», как в русском Excel) и загрузка с предпросмотром
    if (p[1] === 'products' && p[2] === 'stock.csv' && M === 'GET') {
      const q = (v) => { const t = String(v == null ? '' : v); return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
      const rows = [['Товар', 'Цвет', 'Размер', 'Артикул', 'Остаток', 'ID товара', 'ID цвета']];
      for (const x of db.products) for (const c of Pricing.colorsOf(x)) for (const z of c.sizes || []) rows.push([x.name, c.name || '', z.size, x.sku || '', z.stock || 0, x.id, c.id]);
      return { __file: { type: 'text/csv; charset=utf-8', name: 'ostatki.csv', buf: Buffer.from('﻿' + rows.map((r) => r.map(q).join(';')).join('\r\n') + '\r\n') } };
    }
    if (p[1] === 'products' && p[2] === 'stock' && M === 'POST') {
      const text = String(body.csv || '').replace(/^﻿/, ''); if (!text.trim()) fail(400, 'Файл пустой');
      const first = text.split(/\r?\n/)[0], sep = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
      // разбор CSV с кавычками
      const rows = []; let row = [], cur = '', inq = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inq) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inq = false; } else cur += ch; continue; }
        if (ch === '"') inq = true; else if (ch === sep) { row.push(cur); cur = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch;
      }
      if (cur || row.length) { row.push(cur); rows.push(row); }
      if (rows.length > 20001) fail(400, 'Слишком много строк');
      const H = rows.shift().map((h) => h.trim().toLowerCase());
      const col = (names) => H.findIndex((h) => names.includes(h));
      const iP = col(['id товара', 'product id']), iC = col(['id цвета', 'color id']), iS = col(['размер', 'size']), iQ = col(['остаток', 'stock', 'количество']), iN = col(['товар', 'название']), iCol = col(['цвет']), iSku = col(['артикул', 'sku']);
      if (iS < 0 || iQ < 0) fail(400, 'Не нашли колонки «Размер» и «Остаток». Выгрузите файл заново и меняйте только числа');
      const changes = [], errors = [], seen = new Set();
      rows.forEach((r, n) => {
        if (!r.some((x) => String(x).trim())) return;
        const line = 'строка ' + (n + 2), size = String(r[iS] || '').trim(), raw = String(r[iQ] || '').trim().replace(/\s/g, '');
        if (!/^\d{1,6}$/.test(raw)) { errors.push(line + ': остаток «' + raw + '» — нужно целое число'); return; }
        let x = iP >= 0 && db.products.find((y) => y.id === String(r[iP]).trim());
        if (!x && iSku >= 0 && String(r[iSku] || '').trim()) x = db.products.find((y) => y.sku && y.sku === String(r[iSku]).trim());
        if (!x && iN >= 0) x = db.products.find((y) => y.name === String(r[iN]).trim());
        if (!x) { errors.push(line + ': товар не найден'); return; }
        const cs = Pricing.colorsOf(x);
        const c = (iC >= 0 && cs.find((y) => y.id === String(r[iC]).trim())) || (iCol >= 0 && cs.find((y) => (y.name || '') === String(r[iCol]).trim())) || (cs.length === 1 ? cs[0] : null);
        if (!c) { errors.push(line + ': цвет не найден'); return; }
        const z = (c.sizes || []).find((y) => y.size === size); if (!z) { errors.push(line + ': размера ' + size + ' нет'); return; }
        const key = x.id + '|' + c.id + '|' + size; if (seen.has(key)) { errors.push(line + ': повтор'); return; } seen.add(key);
        const to = Number(raw); if (to !== Number(z.stock || 0)) changes.push({ name: x.name, color: c.name || '', size, from: Number(z.stock || 0), to, _z: z, _x: x });
      });
      const view = changes.map((c) => ({ name: c.name, color: c.color, size: c.size, from: c.from, to: c.to }));
      if (body.dry) return { changes: view, errors };
      const touched = new Set(); changes.forEach((c) => { c._z.stock = c.to; touched.add(c._x); });
      touched.forEach((x) => seoChanged('products', x)); save();
      return { changed: changes.length, errors, notify: await processWaitlist() };
    }
    if (COLLECTIONS.includes(p[1])) {
      const arr = db[p[1]];
      // Удаление нескольких записей сразу (в панели — «Удалить выбранные»)
      if (p[2] === 'delete-many' && M === 'POST') {
        const ids = body.ids;
        if (!Array.isArray(ids) || !ids.length || ids.length > 5000 || ids.some((x) => typeof x !== 'string')) fail(400, 'Не выбрано, что удалить');
        const drop = new Set(ids), before = arr.length;
        db[p[1]] = arr.filter((x) => !drop.has(x.id));
        save(); return { deleted: before - db[p[1]].length };
      }
      if (!p[2] && M === 'PUT') { if (!Array.isArray(body.value)) fail(400, 'Нужен список'); if (p[1] === 'products') { body.value.forEach(Pricing.migrateProduct); fixSkus(body.value, body.value, true); } db[p[1]] = body.value; save(); seoChanged(p[1]); return p[1] === 'products' ? { notify: await processWaitlist() } : {}; }
      if (p[2] && M === 'PUT') {
        const item = body.value; if (!item || item.id !== p[2]) fail(400, 'Неверные данные');
        if (p[1] === 'products') fixSkus([item], arr, true);
        if (p[1] === 'products') { const was = arr.find((x) => x.id === item.id); item.preorderSold = was ? (was.preorderSold || 0) : 0; if (Array.isArray(item.look)) item.look = item.look.filter((id) => id !== item.id && db.products.some((x) => x.id === id)).slice(0, 4); Pricing.migrateProduct(item); if (item.specs) { item.specs = Specs.clean(item.specs); if (!Object.keys(item.specs).length) delete item.specs; } }
        const i = arr.findIndex((x) => x.id === item.id);
        if (i === -1) arr.push(item); else arr[i] = item;
        save(); seoChanged(p[1], item); return p[1] === 'products' ? { notify: await processWaitlist() } : {};
      }
      if (p[2] && M === 'DELETE') { const gone = arr.find((x) => x.id === p[2]); db[p[1]] = arr.filter((x) => x.id !== p[2]); save(); if (gone) seoChanged(p[1], gone); return {}; } // удалённую страницу Яндекс перепроверит и уберёт из поиска
    }
    return NEXT;
  }

  return { adminCatalogRoutes };
};
