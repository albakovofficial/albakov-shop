#!/usr/bin/env bash
# Восстановление магазина из резервной копии.
#   sudo bash /var/www/albakov/deploy/restore.sh                      — показать список копий
#   sudo bash /var/www/albakov/deploy/restore.sh latest               — последняя копия на сервере
#   sudo bash /var/www/albakov/deploy/restore.sh albakov-2026-10-18-0330.tar.gz
#                                       (если её нет на сервере — скачается из Selectel S3)
#   добавьте --with-env, чтобы вернуть и файл настроек .env
# Перед восстановлением текущие данные сохраняются отдельной копией — шаг можно отменить.
set -euo pipefail
# shellcheck source=deploy/common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
need_root
NAME="${1:-}"; WITH_ENV=0; [ "${2:-}" = "--with-env" ] || [ "${1:-}" = "--with-env" ] && WITH_ENV=1
[ "$NAME" = "--with-env" ] && NAME="${2:-}"
if [ -z "$NAME" ]; then node "$APP_DIR/tools/backup.js" list; printf '\nУкажите имя копии или latest.\n'; exit 0; fi

if [ "$NAME" = latest ]; then
  NAME="$(find "$BACKUP_DIR" -maxdepth 1 -name 'albakov-*.tar.gz' -printf '%f\n' 2>/dev/null | sort | tail -n1)"
  [ -n "$NAME" ] || die "На сервере нет копий. Посмотрите список: sudo bash $0"
fi
NAME="$(basename "$NAME")"
FILE="$BACKUP_DIR/$NAME"
[ -f "$FILE" ] || { say "Скачиваю $NAME из Selectel S3"; node "$APP_DIR/tools/backup.js" download "$NAME"; }
[ -f "$FILE" ] || die "Копия $NAME не найдена"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
tar -xzf "$FILE" -C "$TMP"
[ -f "$TMP/data/albakov.sqlite" ] || [ -f "$TMP/data/db.json" ] || die "В архиве нет базы данных"

say "Восстанавливаю из $NAME"
# Текущее состояние — отдельной копией, чтобы можно было вернуться
systemctl stop "$SERVICE"   # сайт при остановке дописывает всё в базу — копия будет целой
SAFE="$BACKUP_DIR/before-restore-$(date +%F-%H%M%S).tar.gz"
tar -czf "$SAFE" -C "$APP_DIR" data public/uploads .env 2>/dev/null || tar -czf "$SAFE" -C "$APP_DIR" data public/uploads
chmod 600 "$SAFE"
ok "Текущие данные сохранены: $SAFE"
rm -f "$APP_DIR"/data/albakov.sqlite "$APP_DIR"/data/albakov.sqlite-wal "$APP_DIR"/data/albakov.sqlite-shm
if [ -f "$TMP/data/albakov.sqlite" ]; then cp "$TMP/data/albakov.sqlite" "$APP_DIR/data/"
else cp "$TMP/data/db.json" "$APP_DIR/data/db.json"; fi   # копия старого формата — сайт перенесёт её в базу сам
if [ -d "$TMP/public/uploads" ]; then rsync -a "$TMP/public/uploads/" "$APP_DIR/public/uploads/"; fi
if [ "$WITH_ENV" = 1 ] && [ -f "$TMP/.env" ]; then cp "$TMP/.env" "$APP_DIR/.env"; chown "root:$APP_USER" "$APP_DIR/.env"; chmod 640 "$APP_DIR/.env"; ok "Файл .env восстановлен"; fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR/data" "$APP_DIR/public/uploads"
systemctl start "$SERVICE"
wait_app || die "Сайт не запустился. Вернуть прежние данные: sudo bash $0 $(basename "$SAFE")"
ok "Готово: магазин восстановлен из $NAME"
printf '  Передумали? Вернуть данные, что были до восстановления:\n    sudo bash %s %s\n' "$0" "$(basename "$SAFE")"
