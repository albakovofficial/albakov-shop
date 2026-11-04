#!/usr/bin/env bash
# Назначить владельца магазина: аккаунт на сайте с этим номером получает полный доступ к панели управления.
# Нужен, если владелец сменился или доступ потерян. Аккаунт уже должен быть зарегистрирован на сайте.
#   sudo bash /var/www/albakov/deploy/set-owner.sh +79001234567
set -euo pipefail
# shellcheck source=deploy/common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
need_root
PHONE="$(printf '%s' "${1:-}" | tr -cd '0-9')"
[ "${#PHONE}" -eq 11 ] || [ "${#PHONE}" -eq 10 ] || die "Укажите номер телефона: sudo bash $0 +79001234567"
[ "${#PHONE}" -eq 10 ] && PHONE="7$PHONE"
case "$PHONE" in 8*) PHONE="7${PHONE:1}";; esac
[ -f "$APP_DIR/data/albakov.sqlite" ] || die "Не нашёл базу $APP_DIR/data/albakov.sqlite"
backup_now
systemctl stop "$SERVICE"
if ! PHONE="$PHONE" APP="$APP_DIR" node -e '
  const Store = require(process.env.APP + "/lib/db.js");
  const st = Store.open(process.env.APP + "/data/albakov.sqlite"), db = st.load();
  const u = (db.users || []).find((x) => String(x.phone || "") === process.env.PHONE);
  if (!u) { console.error("Аккаунта с номером +" + process.env.PHONE + " нет — сначала зарегистрируйтесь на сайте"); process.exit(2); }
  db.secrets = db.secrets || {};
  db.secrets.ownerId = u.id;
  db.secrets.staff = (db.secrets.staff || []).filter((x) => x.userId !== u.id); // владелец — не сотрудник
  st.save(db); st.close();
  console.log("Владелец: " + [u.firstName, u.lastName].filter(Boolean).join(" ") + " (+" + u.phone + ")");
'; then
  systemctl start "$SERVICE"; die "Владелец не изменён"
fi
grep -q '^OWNER_PHONE=' "$APP_DIR/.env" 2>/dev/null && env_set OWNER_PHONE "$PHONE"
chown "$APP_USER:$APP_USER" "$APP_DIR"/data/albakov.sqlite*
systemctl start "$SERVICE"
wait_app || die "Сайт не запустился, проверьте: journalctl -u $SERVICE -n 50"
ok "Готово. Войдите на сайте в личный кабинет этим аккаунтом — в меню появится «Панель управления»."
