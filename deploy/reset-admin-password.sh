#!/usr/bin/env bash
# Сброс пароля панели управления, если он забыт. Все входы в панель на других устройствах закрываются.
#   sudo bash /var/www/albakov/deploy/reset-admin-password.sh
set -euo pipefail
# shellcheck source=deploy/common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
need_root
[ -f "$APP_DIR/data/albakov.sqlite" ] || die "Не нашёл базу $APP_DIR/data/albakov.sqlite"
PASS="$(gen_password)"
backup_now
systemctl stop "$SERVICE"
NEWPASS="$PASS" APP="$APP_DIR" node -e '
  const crypto = require("crypto");
  const Store = require(process.env.APP + "/lib/db.js");
  const st = Store.open(process.env.APP + "/data/albakov.sqlite"), db = st.load();
  const salt = crypto.randomBytes(16).toString("hex");
  db.secrets = db.secrets || {};
  db.secrets.adminHash = salt + ":" + crypto.scryptSync(process.env.NEWPASS, salt, 64).toString("hex");
  for (const k in db.sessions || {}) if (db.sessions[k].kind === "admin") delete db.sessions[k];
  st.save(db); st.close();
'
chown "$APP_USER:$APP_USER" "$APP_DIR"/data/albakov.sqlite*
systemctl start "$SERVICE"
wait_app || die "Сайт не запустился, проверьте: journalctl -u $SERVICE -n 50"
printf '\n  Новый пароль панели управления: \033[1m%s\033[0m\n  Смените его в «Настройках» после входа.\n\n' "$PASS"
