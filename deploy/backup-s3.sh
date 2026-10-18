#!/usr/bin/env bash
# Подключение хранилища Selectel S3 для ночных резервных копий.
#   sudo bash /var/www/albakov/deploy/backup-s3.sh
# Понадобятся: имя контейнера (бакета), его пул (например, ru-1) и S3-ключ сервисного пользователя.
set -euo pipefail
# shellcheck source=deploy/common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
need_root
[ -f "$APP_DIR/tools/backup.js" ] || die "Сайт не установлен в $APP_DIR"
[ -f "$BACKUP_CONF" ] || setup_backups

say "Хранилище Selectel S3 для резервных копий"
printf '  Данные берутся из панели Selectel: «Объектное хранилище» (контейнер и пул)\n  и «Управление доступом» → сервисный пользователь → S3-ключ.\n\n'
read -rp "  Пул контейнера (ru-1, ru-3, ru-7, gis-1 …) [ru-1]: " POOL; POOL="${POOL:-ru-1}"
printf '%s' "$POOL" | grep -qE '^[a-z]{2,3}-[0-9]+$' || die "Пул указан с ошибкой: $POOL"
read -rp "  Имя контейнера (бакета): " BUCKET
printf '%s' "$BUCKET" | grep -qE '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' || die "Имя контейнера: латиница в нижнем регистре, цифры, точка и дефис"
read -rp "  Access key: " AK
read -rsp "  Secret key (не отображается): " SK; echo
[ -n "$AK" ] && [ -n "$SK" ] || die "Нужны оба ключа"

ENDPOINT="https://s3.$POOL.storage.selcloud.ru"
conf_set S3_ENDPOINT "$ENDPOINT"
conf_set S3_REGION "$POOL"
conf_set S3_BUCKET "$BUCKET"
conf_set S3_ACCESS_KEY "$AK"
conf_set S3_SECRET_KEY "$SK"
chmod 600 "$BACKUP_CONF"

say "Проверяю доступ"
if ! node "$APP_DIR/tools/backup.js" test-s3; then
  warn "Доступа нет. Проверьте пул, имя контейнера и ключ, у пользователя должна быть роль с доступом к объектному хранилищу."
  warn "Настройки сохранены в $BACKUP_CONF — можно поправить и запустить скрипт ещё раз."
  exit 1
fi
say "Делаю первую копию"
node "$APP_DIR/tools/backup.js"
ok "Готово: каждую ночь копия уходит и на сервер, и в контейнер «$BUCKET» (хранится 30 дней)"
