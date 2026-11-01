#!/usr/bin/env bash
# Подключение бесплатного сертификата HTTPS (Let's Encrypt) для домена магазина.
# Запускается сам из install.sh; вручную — когда домен уже указывает на сервер:
#   sudo bash /var/www/albakov/deploy/https.sh
set -uo pipefail
# shellcheck source=deploy/common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
need_root
[ -f "$CONF" ] || die "Сначала выполните установку: sudo bash deploy/install.sh ваш-домен.ru почта@..."
DOMAIN="$(grep -E '^DOMAIN=' "$CONF" | cut -d= -f2-)"
EMAIL="$(grep -E '^EMAIL=' "$CONF" | cut -d= -f2-)"

# Внешний адрес этого сервера (в Selectel у сервера внутренний адрес, а снаружи — публичный)
MY_IP="$(curl -4 -fsS --max-time 8 https://ipv4.icanhazip.com 2>/dev/null || curl -4 -fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)"
MY_IP="$(printf '%s' "$MY_IP" | tr -d '[:space:]')"
ip_of() { getent ahostsv4 "$1" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' | sed 's/ $//'; }
D_IP="$(ip_of "$DOMAIN")"; W_IP="$(ip_of "www.$DOMAIN")"

if [ -z "$D_IP" ]; then
  warn "Домен $DOMAIN пока никуда не указывает. Добавьте у регистратора A-запись: $DOMAIN → ${MY_IP:-IP сервера}"
  warn "Изменения расходятся до нескольких часов. Потом запустите: sudo bash $APP_DIR/deploy/https.sh"
  exit 1
fi
if [ -n "$MY_IP" ] && ! printf ' %s ' "$D_IP" | grep -q " $MY_IP "; then
  warn "Домен $DOMAIN указывает на $D_IP, а у этого сервера адрес $MY_IP."
  warn "Исправьте A-запись у регистратора, подождите и запустите: sudo bash $APP_DIR/deploy/https.sh"
  exit 1
fi

NAMES=(-d "$DOMAIN")
if [ -n "$W_IP" ] && { [ -z "$MY_IP" ] || printf ' %s ' "$W_IP" | grep -q " $MY_IP "; }; then NAMES+=(-d "www.$DOMAIN")
else warn "www.$DOMAIN не указывает на сервер — сертификат будет только для $DOMAIN (добавьте A-запись для www и запустите скрипт ещё раз)"; fi

if certbot --nginx --non-interactive --agree-tos --redirect --expand -m "$EMAIL" "${NAMES[@]}" >/tmp/albakov-certbot.log 2>&1; then
  env_set PUBLIC_URL "https://$DOMAIN"
  systemctl restart "$SERVICE"
  wait_app || true
  ok "HTTPS подключён: https://$DOMAIN (сертификат продлевается автоматически)"
  systemctl disable --now albakov-https.timer >/dev/null 2>&1 || true
  exit 0
fi
warn "Не удалось получить сертификат. Подробности: /tmp/albakov-certbot.log"
tail -n 8 /tmp/albakov-certbot.log | sed 's/^/    /'
exit 1
