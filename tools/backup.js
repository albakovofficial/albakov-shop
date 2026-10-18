#!/usr/bin/env node
/* Резервная копия магазина: снимок базы SQLite + загруженные фото + настройки (.env) в один архив.
   Архив кладётся на сервер (/var/backups/albakov, хранится BACKUP_KEEP_DAYS дней) и, если настроено,
   в объектное хранилище Selectel S3 (хранится S3_KEEP_DAYS дней).

     node tools/backup.js              — сделать копию сейчас (так запускается каждую ночь)
     node tools/backup.js list         — список копий на сервере и в S3
     node tools/backup.js download ИМЯ — скачать копию из S3 в /var/backups/albakov
     node tools/backup.js test-s3      — проверить доступ к S3 (записать и удалить пробный файл)

   Ключи S3 хранятся в /etc/albakov-backup.conf (доступен только root), а не в настройках сайта:
   даже если кто-то получит доступ к сайту, удалить копии он не сможет. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { DatabaseSync } = require('../lib/db.js');
const S3 = require('../lib/s3.js');

const APP_DIR = path.resolve(__dirname, '..');
const CONF_FILE = process.env.BACKUP_CONF || '/etc/albakov-backup.conf';

function readConf(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const conf = Object.assign(readConf(CONF_FILE), process.env);
const BACKUP_DIR = conf.BACKUP_DIR || '/var/backups/albakov';
const KEEP_DAYS = Number(conf.BACKUP_KEEP_DAYS || 14);
const S3_KEEP_DAYS = Number(conf.S3_KEEP_DAYS || 30);
const PREFIX = (conf.S3_PREFIX || 'albakov-backups').replace(/^\/+|\/+$/g, '');
const s3 = conf.S3_BUCKET && conf.S3_ACCESS_KEY && conf.S3_SECRET_KEY
  ? S3.client({ endpoint: conf.S3_ENDPOINT || 'https://s3.ru-1.storage.selcloud.ru', region: conf.S3_REGION, bucket: conf.S3_BUCKET, accessKey: conf.S3_ACCESS_KEY, secretKey: conf.S3_SECRET_KEY })
  : null;

const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
const mb = (n) => (n / 1048576).toFixed(n < 10485760 ? 2 : 1) + ' МБ';
const log = (s) => console.log(new Date().toISOString().replace('T', ' ').slice(0, 19) + '  ' + s);

function writeStatus(st) {
  // Сайт показывает это в панели управления («Настройки» → «Резервные копии»)
  try { fs.writeFileSync(path.join(APP_DIR, 'data', 'backup-status.json'), JSON.stringify(st, null, 2)); fs.chmodSync(path.join(APP_DIR, 'data', 'backup-status.json'), 0o644); } catch (e) {}
}

async function run() {
  const status = { at: new Date().toISOString(), ok: false, file: '', size: 0, s3: s3 ? { enabled: true } : { enabled: false } };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'albakov-backup-'));
  try {
    const dbFile = path.join(APP_DIR, 'data', 'albakov.sqlite');
    if (!fs.existsSync(dbFile)) throw new Error('Нет базы ' + dbFile);
    // 1. Снимок базы: согласованная копия даже во время работы сайта
    fs.mkdirSync(path.join(tmp, 'data'));
    const snap = path.join(tmp, 'data', 'albakov.sqlite');
    const owner = fs.statSync(dbFile);
    const src = new DatabaseSync(dbFile, { readOnly: true });
    try { src.exec(`VACUUM INTO '${snap.replace(/'/g, "''")}'`); } finally { src.close(); }
    // Служебные файлы базы (-wal, -shm), если их создал этот запуск от root, отдаём владельцу базы — иначе сайт не сможет писать
    for (const ext of ['-wal', '-shm']) { try { const f = dbFile + ext, st = fs.statSync(f); if (st.uid !== owner.uid) fs.chownSync(f, owner.uid, owner.gid); } catch (e) {} }
    const check = new DatabaseSync(snap, { readOnly: true });
    const integrity = check.prepare('PRAGMA integrity_check').get();
    const orders = check.prepare("SELECT COUNT(*) AS n FROM records WHERE coll = 'orders'").get().n;
    check.close();
    if (Object.values(integrity)[0] !== 'ok') throw new Error('Проверка целостности копии не прошла');
    // 2. Архив: база + фото + .env
    fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
    const name = `albakov-${stamp()}.tar.gz`, file = path.join(BACKUP_DIR, name);
    const parts = ['public/uploads', '.env'].filter((p) => fs.existsSync(path.join(APP_DIR, p)));
    execFileSync('tar', ['-czf', file, '-C', tmp, 'data/albakov.sqlite', ...(parts.length ? ['-C', APP_DIR, ...parts] : [])]);
    fs.chmodSync(file, 0o600);
    status.file = name; status.size = fs.statSync(file).size; status.orders = orders;
    log(`Копия готова: ${file} (${mb(status.size)}, заказов в базе: ${orders})`);
    // 3. Старые копии на сервере
    const cutoff = Date.now() - KEEP_DAYS * 864e5;
    for (const f of fs.readdirSync(BACKUP_DIR)) {
      if (/^albakov-.*\.tar\.gz$/.test(f) && f !== name && fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs < cutoff) { fs.unlinkSync(path.join(BACKUP_DIR, f)); log('Удалена старая копия ' + f); }
    }
    // 4. Копия в Selectel S3
    if (s3) {
      try {
        await s3.putFile(`${PREFIX}/${name}`, file, 'application/gzip');
        status.s3 = { enabled: true, ok: true, key: `${PREFIX}/${name}`, bucket: conf.S3_BUCKET };
        log(`Отправлено в S3: ${conf.S3_BUCKET}/${PREFIX}/${name}`);
        const old = (await s3.list(PREFIX + '/')).filter((o) => /albakov-.*\.tar\.gz$/.test(o.key) && Date.parse(o.modified) < Date.now() - S3_KEEP_DAYS * 864e5);
        for (const o of old) { await s3.del(o.key); log('Удалена из S3 старая копия ' + o.key); }
      } catch (e) {
        status.s3 = { enabled: true, ok: false, error: e.message };
        log('Не удалось отправить копию в S3: ' + e.message);
        process.exitCode = 2;
      }
    }
    status.ok = true;
  } catch (e) {
    status.error = e.message;
    log('ОШИБКА резервного копирования: ' + e.message);
    process.exitCode = 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    writeStatus(status);
  }
}

async function list() {
  console.log('На сервере (' + BACKUP_DIR + '):');
  const local = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((f) => /^albakov-.*\.tar\.gz$/.test(f)).sort() : [];
  if (!local.length) console.log('  копий нет');
  local.forEach((f) => console.log('  ' + f + '  ' + mb(fs.statSync(path.join(BACKUP_DIR, f)).size)));
  if (!s3) { console.log('\nS3 не настроено (sudo bash deploy/backup-s3.sh)'); return; }
  console.log(`\nВ S3 (${conf.S3_BUCKET}/${PREFIX}):`);
  const remote = (await s3.list(PREFIX + '/')).filter((o) => /\.tar\.gz$/.test(o.key)).sort((a, b) => a.key.localeCompare(b.key));
  if (!remote.length) console.log('  копий нет');
  remote.forEach((o) => console.log('  ' + o.key.slice(PREFIX.length + 1) + '  ' + mb(o.size)));
}

async function download(name) {
  if (!s3) throw new Error('S3 не настроено');
  if (!/^albakov-[\w-]+\.tar\.gz$/.test(name || '')) throw new Error('Укажите имя копии, например albakov-2026-10-18-0330.tar.gz (список: node tools/backup.js list)');
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const file = path.join(BACKUP_DIR, name);
  await s3.getFile(`${PREFIX}/${name}`, file);
  fs.chmodSync(file, 0o600);
  console.log('Скачано: ' + file);
}

async function testS3() {
  if (!s3) throw new Error('S3 не настроено: заполните ' + CONF_FILE);
  const key = `${PREFIX}/.check-${Date.now()}.txt`;
  await s3.putText(key, 'ALBAKOV backup check');
  const found = (await s3.list(PREFIX + '/')).some((o) => o.key === key);
  await s3.del(key);
  if (!found) throw new Error('Файл записан, но не виден в списке — проверьте имя контейнера');
  console.log(`S3 работает: контейнер ${conf.S3_BUCKET}, регион ${s3.region}`);
}

const [cmd, arg] = process.argv.slice(2);
(cmd === 'list' ? list() : cmd === 'download' ? download(arg) : cmd === 'test-s3' ? testS3() : run())
  .catch((e) => { console.error('Ошибка: ' + e.message); process.exitCode = 1; });
