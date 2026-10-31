/* База данных магазина: SQLite (встроена в Node.js 22, ставить ничего не нужно).
   Файл: data/albakov.sqlite. Режим WAL — запись не мешает чтению, сбой питания не портит базу.

   Таблицы:
     records(coll, id, pos, data) — товары, заказы, покупатели, акции и т. д.: одна строка на запись, data — JSON;
     meta(key, value)             — настройки, секреты, счётчик заказов.
   Для удобного просмотра (например, в DB Browser for SQLite) есть представления orders_view и customers_view.

   Сервер держит данные в памяти, а при сохранении пишет в базу только изменившиеся записи — одной транзакцией. */
'use strict';
const fs = require('fs');
const path = require('path');

// SQLite в Node 22 помечена как экспериментальная — убираем лишнее предупреждение из журнала
const emit = process.emitWarning;
process.emitWarning = function (w, ...rest) {
  if (String(w && w.message || w).includes('SQLite')) return;
  return emit.call(process, w, ...rest);
};
const { DatabaseSync } = require('node:sqlite');
process.emitWarning = emit;

// Списки записей с полем id. Сессии хранятся так же (id — токен).
const COLLS = ['categories', 'sizeCharts', 'products', 'promotions', 'promocodes', 'pages', 'orders', 'users', 'waitlist', 'tickets', 'giftcards'];

function open(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sql = new DatabaseSync(file);
  sql.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS records (
      coll TEXT NOT NULL, id TEXT NOT NULL, pos INTEGER NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY (coll, id)
    );
    CREATE VIEW IF NOT EXISTS orders_view AS
      SELECT json_extract(data, '$.number') AS number, json_extract(data, '$.createdAt') AS created_at,
             json_extract(data, '$.status') AS status, json_extract(data, '$.payment.status') AS payment,
             json_extract(data, '$.total') AS total, json_extract(data, '$.bonusUsed') AS bonus_used,
             json_extract(data, '$.customer.lastName') || ' ' || json_extract(data, '$.customer.firstName') AS customer,
             json_extract(data, '$.customer.phone') AS phone, json_extract(data, '$.customer.email') AS email
      FROM records WHERE coll = 'orders' ORDER BY pos DESC;
    CREATE VIEW IF NOT EXISTS customers_view AS
      SELECT json_extract(data, '$.lastName') || ' ' || json_extract(data, '$.firstName') AS name,
             json_extract(data, '$.phone') AS phone, json_extract(data, '$.email') AS email,
             json_extract(data, '$.bonus') AS bonus, json_extract(data, '$.createdAt') AS created_at
      FROM records WHERE coll = 'users' ORDER BY pos DESC;
  `);
  const q = {
    meta: sql.prepare('SELECT key, value FROM meta'),
    rows: sql.prepare('SELECT coll, id, pos, data FROM records ORDER BY coll, pos'),
    putMeta: sql.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    delMeta: sql.prepare('DELETE FROM meta WHERE key = ?'),
    putRow: sql.prepare('INSERT INTO records (coll, id, pos, data) VALUES (?, ?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET pos = excluded.pos, data = excluded.data'),
    delRow: sql.prepare('DELETE FROM records WHERE coll = ? AND id = ?'),
    count: sql.prepare('SELECT (SELECT COUNT(*) FROM meta) + (SELECT COUNT(*) FROM records) AS n')
  };
  // Что уже лежит в базе: чтобы писать только изменения
  const metaCache = new Map(), rowCache = new Map();
  const rk = (coll, id) => coll + '\u0000' + id;

  function isEmpty() { return q.count.get().n === 0; }

  function load() {
    if (isEmpty()) return null;
    const db = {};
    for (const r of q.meta.all()) { db[r.key] = JSON.parse(r.value); metaCache.set(r.key, r.value); }
    for (const c of COLLS) if (!Array.isArray(db[c])) db[c] = [];
    db.sessions = {};
    for (const r of q.rows.all()) {
      rowCache.set(rk(r.coll, r.id), r.pos + '\u0000' + r.data);
      const item = JSON.parse(r.data);
      if (r.coll === 'sessions') db.sessions[r.id] = item;
      else if (COLLS.includes(r.coll)) db[r.coll].push(item);
    }
    return db;
  }

  function save(db) {
    const seenMeta = new Set(), seenRows = new Set();
    sql.exec('BEGIN IMMEDIATE');
    try {
      for (const key of Object.keys(db)) {
        if (COLLS.includes(key) || key === 'sessions' || db[key] === undefined) continue;
        const v = JSON.stringify(db[key]);
        seenMeta.add(key);
        if (metaCache.get(key) !== v) { q.putMeta.run(key, v); metaCache.set(key, v); }
      }
      const put = (coll, id, pos, item) => {
        const k = rk(coll, id), data = JSON.stringify(item), v = pos + '\u0000' + data;
        seenRows.add(k);
        if (rowCache.get(k) !== v) { q.putRow.run(coll, id, pos, data); rowCache.set(k, v); }
      };
      for (const coll of COLLS) {
        const used = new Set();
        (db[coll] || []).forEach((item, i) => {
          let id = item && item.id != null ? String(item.id) : '#' + i;
          if (used.has(id)) id += '#' + i; // повторяющийся id не должен затереть соседнюю запись
          used.add(id);
          put(coll, id, i, item);
        });
      }
      Object.keys(db.sessions || {}).forEach((token, i) => put('sessions', token, i, db.sessions[token]));
      for (const key of [...metaCache.keys()]) if (!seenMeta.has(key)) { q.delMeta.run(key); metaCache.delete(key); }
      for (const k of [...rowCache.keys()]) if (!seenRows.has(k)) { const [coll, id] = k.split('\u0000'); q.delRow.run(coll, id); rowCache.delete(k); }
      sql.exec('COMMIT');
    } catch (e) {
      sql.exec('ROLLBACK');
      // кэш мог разойтись с базой — перечитаем при следующем сохранении всё заново
      metaCache.clear(); rowCache.clear();
      for (const r of q.meta.all()) metaCache.set(r.key, r.value);
      for (const r of q.rows.all()) rowCache.set(rk(r.coll, r.id), r.pos + '\u0000' + r.data);
      throw e;
    }
  }

  function close() { try { sql.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) {} sql.close(); }

  return { load, save, close, isEmpty, sql };
}

module.exports = { open, COLLS, DatabaseSync };
