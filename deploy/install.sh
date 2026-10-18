#!/usr/bin/env bash
# Установка магазина ALBAKOV на чистый сервер Ubuntu 22.04 / 24.04 (Selectel или любой другой VPS).
#
#   sudo bash deploy/install.sh ваш-домен.ru почта@для-уведомлений.ru
#
# Что делает: ставит Node.js, nginx и certbot; копирует сайт в /var/www/albakov; запускает его как службу
# (сам поднимается после перезагрузки и сбоев); подключает домен и бесплатный сертификат HTTPS;
# включает файрвол и ежедневные резервные копии (база SQLite + фото, на сервере и в Selectel S3). Повторный запуск безопасен: данные магазина не трогаются.
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=deploy/common.sh
. "$SRC/deploy/common.sh"

need_root
[ -f "$SRC/server.js" ] || die "Рядом нет server.js. Запускайте скрипт из распакованной папки сайта."
# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}" in ubuntu|debian) ;; *) die "Нужен Ubuntu 22.04/24.04 или Debian 12, а здесь: ${PRETTY_NAME:-неизвестная система}";; esac
export DEBIAN_FRONTEND=noninteractive

# ---------- Домен и почта ----------
DOMAIN="${1:-}"; EMAIL="${2:-}"
if [ -z "$DOMAIN" ] && [ -f "$CONF" ]; then DOMAIN="$(grep -E '^DOMAIN=' "$CONF" | cut -d= -f2-)"; fi
if [ -z "$EMAIL" ] && [ -f "$CONF" ]; then EMAIL="$(grep -E '^EMAIL=' "$CONF" | cut -d= -f2-)"; fi
[ -n "$DOMAIN" ] || read -rp "Домен сайта (например, albakov.ru): " DOMAIN
[ -n "$EMAIL" ] || read -rp "Ваша почта (для писем о сертификате HTTPS): " EMAIL
DOMAIN="$(printf '%s' "$DOMAIN" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https?://##; s#/.*$##; s#^www\.##')"
# Кириллический домен (.рф) переводим в вид, понятный nginx и certbot
if printf '%s' "$DOMAIN" | grep -qP '[^\x00-\x7F]'; then DOMAIN="$(python3 -c 'import sys; print(sys.argv[1].encode("idna").decode())' "$DOMAIN")"; fi
printf '%s' "$DOMAIN" | grep -qE '^([a-z0-9-]+\.)+[a-z0-9-]{2,}$' || die "Похоже, домен указан с ошибкой: $DOMAIN"
printf '%s' "$EMAIL" | grep -qE '^[^@ ]+@[^@ ]+\.[^@ ]+$' || die "Похоже, почта указана с ошибкой: $EMAIL"
printf 'DOMAIN=%s\nEMAIL=%s\n' "$DOMAIN" "$EMAIL" > "$CONF"; chmod 600 "$CONF"

say "Устанавливаю сайт для $DOMAIN"

# ---------- Программы ----------
say "1/7 Обновляю систему и ставлю nginx, certbot, файрвол"
apt-get update -qq
apt-get install -y -qq curl ca-certificates rsync nginx certbot python3-certbot-nginx ufw cron >/dev/null
ok "Готово"

say "2/7 Node.js"
ensure_node
ok "Node.js $(node -v), база SQLite встроена"

# ---------- Файлы сайта ----------
say "3/7 Копирую сайт в $APP_DIR"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --no-create-home --shell /usr/sbin/nologin "$APP_USER"
if [ -f "$APP_DIR/data/albakov.sqlite" ] || [ -f "$APP_DIR/data/db.json" ]; then backup_now; fi
sync_code "$SRC"
FIRST_PASSWORD=""
if [ ! -f "$APP_DIR/.env" ]; then
  FIRST_PASSWORD="${ALBAKOV_ADMIN_PASSWORD:-$(gen_password)}"
  cat > "$APP_DIR/.env" <<EOF
# Настройки сайта. После правки: sudo systemctl restart $SERVICE
PORT=$PORT
HOST=127.0.0.1
PUBLIC_URL=http://$DOMAIN
# Пароль для ПЕРВОГО входа в панель управления. Потом меняется в «Настройках» панели.
ADMIN_PASSWORD=$FIRST_PASSWORD
# Ключи ЮKassa и почту удобнее указать в панели управления
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=
EOF
  printf 'Сайт: https://%s\nПанель управления: https://%s/#/admin\nПароль первого входа: %s\n' "$DOMAIN" "$DOMAIN" "$FIRST_PASSWORD" > /root/albakov-admin.txt
  chmod 600 /root/albakov-admin.txt
else
  env_set HOST 127.0.0.1
  env_set PORT "$PORT"
  case "$(env_get PUBLIC_URL)" in "https://$DOMAIN") ;; *) env_set PUBLIC_URL "http://$DOMAIN";; esac
fi
chown "root:$APP_USER" "$APP_DIR/.env"; chmod 640 "$APP_DIR/.env"
ok "Файлы на месте. База данных: $APP_DIR/data/albakov.sqlite"

# ---------- Служба ----------
say "4/7 Запускаю сайт как службу"
write_service
systemctl restart "$SERVICE"
wait_app || { journalctl -u "$SERVICE" -n 30 --no-pager; die "Сайт не запустился — выше журнал службы"; }
ok "Сайт работает (служба $SERVICE)"

# ---------- nginx ----------
say "5/7 Подключаю домен через nginx"
LISTEN6=""; [ -f /proc/net/if_inet6 ] && LISTEN6="listen [::]:80;"
cat > /etc/nginx/sites-available/albakov <<EOF
server {
    listen 80;
    $LISTEN6
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 15m;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/albakov /etc/nginx/sites-enabled/albakov
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 || { nginx -t; die "Ошибка в настройке nginx"; }
systemctl enable nginx >/dev/null 2>&1
systemctl reload nginx || systemctl restart nginx
ok "nginx готов"

# ---------- Файрвол ----------
say "6/7 Файрвол: открыты только SSH, HTTP и HTTPS"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ok "Включён"

# ---------- Резервные копии ----------
setup_backups
ok "Резервные копии каждую ночь в 03:30 в $BACKUP_DIR (14 дней)"

# ---------- HTTPS ----------
say "7/7 Сертификат HTTPS"
HTTPS_OK=0
if bash "$APP_DIR/deploy/https.sh" --from-install; then HTTPS_OK=1
else setup_https_retry; warn "HTTPS включится сам в течение 10 минут после того, как домен начнёт указывать на этот сервер"; fi

# ---------- Итог ----------
PROTO=http; [ "$HTTPS_OK" = 1 ] && PROTO=https
printf '\n\033[1m════════════════════════════════════════════════════════════\033[0m\n'
printf '\033[1m  Магазин установлен\033[0m\n\n'
printf '  Сайт:               %s://%s\n' "$PROTO" "$DOMAIN"
printf '  Панель управления:  %s://%s/#/admin\n' "$PROTO" "$DOMAIN"
if [ -n "$FIRST_PASSWORD" ]; then
  printf '  Пароль первого входа: \033[1m%s\033[0m\n' "$FIRST_PASSWORD"
  printf '  (сохранён в /root/albakov-admin.txt — смените его в «Настройках» панели)\n'
else
  printf '  Пароль администратора прежний.\n'
fi
printf '\n  Уведомления ЮKassa (HTTP-уведомления): https://%s/api/payments/yookassa\n' "$DOMAIN"
printf '  База данных: %s/data/albakov.sqlite\n' "$APP_DIR"
if grep -qE '^S3_BUCKET=.+' "$BACKUP_CONF"; then printf '  Резервные копии: каждую ночь, на сервере и в Selectel S3\n'
else printf '  Резервные копии: каждую ночь на сервере. Подключить хранилище Selectel S3:\n    sudo bash %s/deploy/backup-s3.sh\n' "$APP_DIR"; fi
if [ "$HTTPS_OK" != 1 ]; then
  printf '\n  \033[33mHTTPS пока не подключён.\033[0m Он включится сам в течение 10 минут после того,\n  как A-записи домена начнут указывать на этот сервер. Проверить вручную:\n'
  printf '    sudo bash %s/deploy/https.sh\n' "$APP_DIR"
fi
printf '\033[1m════════════════════════════════════════════════════════════\033[0m\n\n'
