# Общие настройки и функции для install.sh, update.sh, https.sh, backup-s3.sh, restore.sh
APP_DIR=/var/www/albakov              # где живёт сайт на сервере
APP_USER=albakov                      # системный пользователь, от имени которого работает сайт
SERVICE=albakov                       # имя службы: systemctl status albakov
PORT=3000                             # внутренний порт, снаружи сайт открывается через nginx
CONF=/etc/albakov.conf                # домен и почта для сертификата
BACKUP_DIR=/var/backups/albakov       # ежедневные резервные копии
BACKUP_CONF=/etc/albakov-backup.conf  # срок хранения копий и ключи Selectel S3 (доступен только root)

say()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Случайный пароль из 16 букв и цифр
gen_password() { node -e 'process.stdout.write(require("crypto").randomBytes(12).toString("base64url").replace(/[-_]/g, "x"))'; }

need_root() { [ "$(id -u)" -eq 0 ] || die "Запустите от администратора: sudo bash $0"; }

# Значение из .env сайта
env_get() { grep -E "^$1=" "$APP_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2-; }
# Записать значение в .env (заменить строку или добавить)
env_set() {
  if grep -qE "^$1=" "$APP_DIR/.env"; then sed -i "s|^$1=.*|$1=$2|" "$APP_DIR/.env"; else printf '%s=%s\n' "$1" "$2" >> "$APP_DIR/.env"; fi
}
# Значение из файла настроек резервных копий
conf_set() {
  if grep -qE "^$1=" "$BACKUP_CONF"; then sed -i "s|^$1=.*|$1=$2|" "$BACKUP_CONF"; else printf '%s=%s\n' "$1" "$2" >> "$BACKUP_CONF"; fi
}

# Ждём, пока сайт ответит
wait_app() {
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/state" 2>/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

# Резервная копия прямо сейчас: база, загруженные фото, настройки
backup_now() {
  mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
  [ -d "$APP_DIR/data" ] || return 0
  if [ -f "$APP_DIR/data/albakov.sqlite" ] && [ -f "$APP_DIR/tools/backup.js" ]; then
    if node "$APP_DIR/tools/backup.js" > /tmp/albakov-backup-now.log 2>&1; then ok "Резервная копия сделана ($BACKUP_DIR)"
    else warn "Копия сделана не полностью:"; sed 's/^/    /' /tmp/albakov-backup-now.log | tail -n 4; fi
    return 0
  fi
  # Данные прежнего формата (db.json, до ALBAKOV11) — простой архив папки
  local f
  f="$BACKUP_DIR/albakov-$(date +%F-%H%M).tar.gz"
  tar -czf "$f" -C "$APP_DIR" data public/uploads .env 2>/dev/null || tar -czf "$f" -C "$APP_DIR" data public/uploads
  chmod 600 "$f"
  ok "Резервная копия: $f"
}

# Node.js 22.13 или новее — в нём встроена база SQLite
ensure_node() {
  local v major minor
  v="$(node -v 2>/dev/null || true)"
  major="$(printf '%s' "$v" | sed -E 's/^v([0-9]+).*/\1/')"
  minor="$(printf '%s' "$v" | sed -E 's/^v[0-9]+\.([0-9]+).*/\1/')"
  if [ -z "$v" ] || [ "$major" -lt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -lt 13 ]; }; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
  fi
  node -e "require('node:sqlite')" 2>/dev/null || die "В Node.js $(node -v) нет встроенной SQLite. Нужна версия 22.13 или новее."
}

# Код сайта: копируем всё, кроме данных, фото и настроек — их никогда не трогаем
sync_code() {
  local src="$1"
  mkdir -p "$APP_DIR"
  rsync -a --delete \
    --exclude '/data/' --exclude '/public/uploads/' --exclude '/.env' --exclude '/dist/' --exclude '/node_modules/' --exclude '/.git/' \
    "$src/" "$APP_DIR/"
  mkdir -p "$APP_DIR/data" "$APP_DIR/public/uploads"
  # данные из архива переносим только если на сервере их ещё нет (например, перенос с другого хостинга)
  rsync -a --ignore-existing "$src/data/" "$APP_DIR/data/" 2>/dev/null || true
  rsync -a --ignore-existing "$src/public/uploads/" "$APP_DIR/public/uploads/" 2>/dev/null || true
  chown -R root:root "$APP_DIR"
  # Права на код: всё читаемо для сайта (исходник мог прийти с закрытыми правами, например из git-клона только для root)
  chmod 755 "$APP_DIR"
  find "$APP_DIR" \( -path "$APP_DIR/data" -o -path "$APP_DIR/public/uploads" -o -path "$APP_DIR/.env" \) -prune -o -exec chmod u=rwX,go=rX {} +
  chown -R "$APP_USER:$APP_USER" "$APP_DIR/data" "$APP_DIR/public/uploads"
  if [ -f "$APP_DIR/.env" ]; then chown "root:$APP_USER" "$APP_DIR/.env"; chmod 640 "$APP_DIR/.env"; fi
}

# Служба systemd: сайт поднимается после перезагрузки и сбоев
write_service() {
  cat > "/etc/systemd/system/$SERVICE.service" <<UNIT
[Unit]
Description=Магазин ALBAKOV
After=network-online.target
Wants=network-online.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=$(command -v node) server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$APP_DIR/data $APP_DIR/public/uploads
# Служебный адрес облака (там данные запуска сервера) сайту не нужен — закрываем
IPAddressDeny=169.254.169.254/32

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable "$SERVICE" >/dev/null 2>&1
  harden_nginx
}

# nginx не сообщает свою версию посторонним (заголовок Server и страницы ошибок).
# Вызывается при установке и при каждом обновлении — безопасно повторять.
harden_nginx() {
  command -v nginx >/dev/null 2>&1 || return 0
  local f=/etc/nginx/conf.d/albakov-hardening.conf
  printf '# Магазин ALBAKOV: не показывать версию nginx\nserver_tokens off;\n' > "$f.new"
  if [ -f "$f" ] && cmp -s "$f" "$f.new"; then rm -f "$f.new"; return 0; fi
  mv -f "$f.new" "$f"
  if nginx -t >/dev/null 2>&1; then systemctl reload nginx >/dev/null 2>&1 || true
  else rm -f "$f"; nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1 || true; fi
}

# Пока домен не указывает на сервер, каждые 10 минут пробуем получить сертификат HTTPS; получили — проверка выключается сама
setup_https_retry() {
  cat > /etc/systemd/system/albakov-https.service <<UNIT
[Unit]
Description=Сертификат HTTPS для магазина ALBAKOV
After=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash $APP_DIR/deploy/https.sh --auto
UNIT
  cat > /etc/systemd/system/albakov-https.timer <<UNIT
[Unit]
Description=Повторять попытку HTTPS, пока домен не начнёт указывать на сервер

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now albakov-https.timer >/dev/null 2>&1
}

# Ночная резервная копия в 03:30: база + фото + настройки. На сервере — 14 дней, в Selectel S3 — 30 дней
setup_backups() {
  mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
  if [ ! -f "$BACKUP_CONF" ]; then
    cat > "$BACKUP_CONF" <<CONFIG
# Резервные копии магазина ALBAKOV. После правки ничего перезапускать не нужно.
BACKUP_DIR=$BACKUP_DIR
BACKUP_KEEP_DAYS=14
# Хранилище Selectel S3 — заполняется командой: sudo bash $APP_DIR/deploy/backup-s3.sh
S3_ENDPOINT=https://s3.ru-1.storage.selcloud.ru
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_KEEP_DAYS=30
CONFIG
  fi
  chown root:root "$BACKUP_CONF"; chmod 600 "$BACKUP_CONF"
  rm -f /etc/cron.daily/albakov-backup   # прежний вариант (до ALBAKOV11)
  cat > /etc/cron.d/albakov-backup <<CRON
# Резервная копия магазина каждую ночь в 03:30 (журнал: /var/log/albakov-backup.log)
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 3 * * * root node $APP_DIR/tools/backup.js >> /var/log/albakov-backup.log 2>&1
CRON
  chmod 644 /etc/cron.d/albakov-backup
}
