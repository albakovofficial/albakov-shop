#!/usr/bin/env bash
# Обновление сайта на новую версию (ALBAKOV12, ALBAKOV13 …) без потери заказов, товаров и фото.
# Загрузите и распакуйте архив новой версии на сервер, затем из её папки:
#   sudo bash deploy/update.sh
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=deploy/common.sh
. "$SRC/deploy/common.sh"
need_root
[ -f "$SRC/server.js" ] || die "Рядом нет server.js. Запускайте из распакованной папки новой версии."
[ -f "$APP_DIR/.env" ] || die "Сайт ещё не установлен. Сначала: sudo bash deploy/install.sh ваш-домен.ru почта@..."
[ "$SRC" != "$APP_DIR" ] || die "Запускайте update.sh из папки НОВОЙ версии, а не из $APP_DIR"

say "Обновляю сайт из $SRC"
backup_now
ensure_node
sync_code "$SRC"
write_service
setup_backups
systemctl restart "$SERVICE"
if wait_app; then
  [ -f "$APP_DIR/data/albakov.sqlite" ] && ok "База данных: $APP_DIR/data/albakov.sqlite"
  ok "Готово: сайт работает на новой версии. Данные, фото и настройки сохранены."
else
  journalctl -u "$SERVICE" -n 30 --no-pager
  die "Сайт не запустился после обновления. Последняя копия данных — в $BACKUP_DIR"
fi
