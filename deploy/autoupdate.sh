#!/usr/bin/env bash
# Автообновление магазина из закрытого репозитория GitHub (ветка release).
# Служба albakov-update.timer запускает проверку каждую минуту. Вручную:
#   sudo albakov-autoupdate            — проверить и установить новую версию сейчас
#   sudo albakov-autoupdate --status   — какая версия работает, журнал последних обновлений
#   sudo albakov-autoupdate --install  — установить службу (это делает autoupdate-setup.sh)
#
# Что происходит при новой версии:
#   1) резервная копия базы и фото;  2) копия текущего кода для отката;
#   3) установка нового кода (данные, фото и .env не трогаются);  4) перезапуск и проверка, что сайт отвечает;
#   5) если сайт не поднялся — автоматический возврат прежней версии, а неудачная версия больше не ставится,
#      пока в release не появится следующая.
set -euo pipefail

UPD_CONF=/etc/albakov-update.conf     # REPO=git@github.com:логин/репозиторий.git, BRANCH=release (только root)
SRC_DIR=/opt/albakov-src              # рабочая копия репозитория (только root)
STATE_DIR=/var/lib/albakov-update     # какая версия стоит, копия для отката, ключ хоста GitHub
DEPLOY_KEY=/root/.ssh/albakov_deploy  # ключ только на чтение этого репозитория
SELF=/usr/local/sbin/albakov-autoupdate
LOG=/var/log/albakov-update.log
APP_DIR=/var/www/albakov

[ "$(id -u)" -eq 0 ] || { echo "Запустите от root: sudo $0" >&2; exit 1; }
[ -f "$UPD_CONF" ] || { echo "Нет $UPD_CONF — сначала autoupdate-setup.sh" >&2; exit 1; }
# shellcheck disable=SC1090
. "$UPD_CONF"
BRANCH="${BRANCH:-release}"
printf '%s' "${REPO:-}" | grep -qE '^git@github\.com:[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\.git$' || { echo "REPO в $UPD_CONF указан с ошибкой" >&2; exit 1; }
printf '%s' "$BRANCH" | grep -qE '^[A-Za-z0-9_./-]+$' || { echo "BRANCH указан с ошибкой" >&2; exit 1; }
mkdir -p "$STATE_DIR"; chmod 700 "$STATE_DIR"
export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o UserKnownHostsFile=$STATE_DIR/known_hosts -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=20"
export GIT_TERMINAL_PROMPT=0
umask 022

ts()  { date '+%F %T'; }
log() { printf '%s  %s\n' "$(ts)" "$*"; }

# Состояние для панели управления сайта («Настройки» → «Версия сайта»)
write_status() { # ok|failed|checked|error, сообщение
  local file="$APP_DIR/data/update-status.json"
  [ -d "$APP_DIR/data" ] || return 0
  STATUS="$1" MSG="${2:-}" BRANCH="$BRANCH" STATE_DIR="$STATE_DIR" APP_DIR="$APP_DIR" SRC_DIR="$SRC_DIR" node -e '
    const fs = require("fs"), cp = require("child_process"), e = process.env, f = e.APP_DIR + "/data/update-status.json";
    let prev = {}; try { prev = JSON.parse(fs.readFileSync(f, "utf8")); } catch (x) {}
    const rd = (p) => { try { return fs.readFileSync(p, "utf8").trim(); } catch (x) { return ""; } };
    const commit = rd(e.STATE_DIR + "/deployed");
    let subject = prev.subject || "", date = prev.date || "";
    if (commit) { try { [subject, date] = cp.execFileSync("git", ["-C", e.SRC_DIR, "show", "-s", "--format=%s%n%cI", commit], { encoding: "utf8" }).trim().split("\n"); } catch (x) {} }
    let version = ""; try { version = JSON.parse(fs.readFileSync(e.APP_DIR + "/package.json", "utf8")).version || ""; } catch (x) {}
    const now = new Date().toISOString(), st = e.STATUS;
    const out = Object.assign(prev, { enabled: true, branch: e.BRANCH, version, commit: commit.slice(0, 7), subject: subject.slice(0, 200), date, checkedAt: now });
    if (st === "ok") Object.assign(out, { updatedAt: now, lastError: "", failedCommit: "" });
    if (st === "failed") Object.assign(out, { lastError: e.MSG.slice(0, 300), failedCommit: rd(e.STATE_DIR + "/failed").slice(0, 7), failedAt: now });
    if (st === "error") out.checkError = e.MSG.slice(0, 300); else if (st !== "failed") out.checkError = "";
    fs.writeFileSync(f + ".tmp", JSON.stringify(out, null, 2)); fs.renameSync(f + ".tmp", f);
  ' 2>/dev/null || return 0
  chmod 644 "$file" 2>/dev/null || true
  chown "$(stat -c %U:%G "$APP_DIR/data")" "$file" 2>/dev/null || true
}

install_self() {
  local from="$1"
  install -m 700 -o root -g root "$from" "$SELF.new" && mv -f "$SELF.new" "$SELF"
  cat > /etc/systemd/system/albakov-update.service <<UNIT
[Unit]
Description=Автообновление магазина ALBAKOV из GitHub
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$SELF
Nice=10
UNIT
  cat > /etc/systemd/system/albakov-update.timer <<UNIT
[Unit]
Description=Проверка новой версии магазина ALBAKOV каждую минуту

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
AccuracySec=1s
RandomizedDelaySec=5
Persistent=true

[Install]
WantedBy=timers.target
UNIT
  cat > /etc/logrotate.d/albakov-update <<ROT
$LOG {
  monthly
  rotate 6
  compress
  missingok
  notifempty
}
ROT
  systemctl daemon-reload
  systemctl enable --now albakov-update.timer >/dev/null 2>&1
}

case "${1:-}" in
  --install)
    install_self "$(readlink -f "${BASH_SOURCE[0]}")"
    echo "Служба автообновления установлена: проверка каждую минуту (systemctl list-timers albakov-update.timer)"
    exit 0 ;;
  --status)
    printf 'Репозиторий: %s (ветка %s)\n' "$REPO" "$BRANCH"
    if [ -s "$STATE_DIR/deployed" ]; then git -C "$SRC_DIR" show -s --format='Работает версия: %h — %s (%cd)' --date=format:'%d.%m.%Y %H:%M' "$(cat "$STATE_DIR/deployed")" 2>/dev/null || cat "$STATE_DIR/deployed"; else echo "Работает версия: ещё не обновлялась из GitHub"; fi
    [ -s "$STATE_DIR/failed" ] && echo "Не встала и пропущена: $(cut -c1-7 "$STATE_DIR/failed")"
    systemctl list-timers albakov-update.timer --no-pager 2>/dev/null | sed -n 1,2p
    echo; echo "Журнал ($LOG):"; tail -n 15 "$LOG" 2>/dev/null || echo "  пусто"
    exit 0 ;;
esac

# Журнал — в файл, когда запущено службой
[ -t 1 ] || exec >>"$LOG" 2>&1
# Одна проверка за раз
exec 9>/run/albakov-update.lock
flock -n 9 || exit 0

# Серверы, где проверка ещё раз в 5 минут, сами переходят на проверку каждую минуту
if [ -x "$SELF" ] && ! grep -q '^OnUnitActiveSec=1min$' /etc/systemd/system/albakov-update.timer 2>/dev/null; then
  install_self "$SELF" && log "Проверка обновлений теперь каждую минуту"
fi
# Сбой связи с GitHub пишем в журнал один раз, а не каждую минуту, пока он длится
FETCH_FAIL="$STATE_DIR/fetch-failed"

if [ ! -d "$SRC_DIR/.git" ]; then
  rm -rf "$SRC_DIR"
  if ! git clone --quiet --branch "$BRANCH" --single-branch "$REPO" "$SRC_DIR" 2>"$STATE_DIR/git.err"; then
    log "Нет доступа к репозиторию: $(tail -n1 "$STATE_DIR/git.err")"; write_status error "Нет доступа к репозиторию GitHub"; exit 1
  fi
  chmod 700 "$SRC_DIR"
fi
if ! git -C "$SRC_DIR" fetch --quiet --prune origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" 2>"$STATE_DIR/git.err"; then
  [ -f "$FETCH_FAIL" ] || log "Не удалось проверить обновления: $(tail -n1 "$STATE_DIR/git.err")"
  touch "$FETCH_FAIL"; write_status error "Не удалось связаться с GitHub"; exit 1
fi
[ -f "$FETCH_FAIL" ] && { rm -f "$FETCH_FAIL"; log "Связь с GitHub восстановлена"; }
NEW="$(git -C "$SRC_DIR" rev-parse "refs/remotes/origin/$BRANCH")"
CUR="$(cat "$STATE_DIR/deployed" 2>/dev/null || true)"
FAILED="$(cat "$STATE_DIR/failed" 2>/dev/null || true)"
if [ "$NEW" = "$CUR" ] || [ "$NEW" = "$FAILED" ]; then write_status checked; exit 0; fi

SHORT="${NEW:0:7}"
log "Новая версия $SHORT: $(git -C "$SRC_DIR" show -s --format=%s "$NEW")"
git -C "$SRC_DIR" checkout --quiet --force "$NEW"
git -C "$SRC_DIR" clean -fdxq
for f in server.js package.json deploy/common.sh deploy/autoupdate.sh; do
  [ -f "$SRC_DIR/$f" ] || { log "В версии $SHORT нет $f — не устанавливаю"; echo "$NEW" > "$STATE_DIR/failed"; write_status failed "В версии нет файла $f"; exit 1; }
done
node --check "$SRC_DIR/server.js" 2>"$STATE_DIR/check.err" || { log "Ошибка в коде версии $SHORT: $(head -n3 "$STATE_DIR/check.err" | tr '\n' ' ')"; echo "$NEW" > "$STATE_DIR/failed"; write_status failed "Ошибка в коде новой версии, установка отменена"; exit 1; }

# Куда откатываться, если новая версия не поднимется: последняя версия, которая точно работала.
# Берём её из git (а не из текущей папки сайта) — так откат верный, даже если прошлое обновление прервали на середине.
ROLLBACK="$STATE_DIR/rollback"
rm -rf "$ROLLBACK"; mkdir -p "$ROLLBACK"
if [ -n "$CUR" ] && git -C "$SRC_DIR" cat-file -e "$CUR^{commit}" 2>/dev/null; then
  git -C "$SRC_DIR" archive "$CUR" | tar -x -C "$ROLLBACK"
else
  # Первое обновление из GitHub: сохраняем код, который стоял до него (один раз)
  [ -d "$STATE_DIR/baseline" ] || rsync -a --exclude '/data/' --exclude '/public/uploads/' --exclude '/.env' --exclude '/node_modules/' "$APP_DIR/" "$STATE_DIR/baseline/"
  rsync -a "$STATE_DIR/baseline/" "$ROLLBACK/"
fi

# shellcheck source=deploy/common.sh
. "$SRC_DIR/deploy/common.sh"
backup_now
ensure_node
sync_code "$SRC_DIR"
write_service
setup_backups
systemctl restart "$SERVICE" 9>&-
if wait_app; then
  echo "$NEW" > "$STATE_DIR/deployed"; rm -f "$STATE_DIR/failed"
  install_self "$SRC_DIR/deploy/autoupdate.sh"
  write_status ok
  log "Готово: работает версия $SHORT"
  exit 0
fi

log "Версия $SHORT не запустилась — возвращаю прежнюю"
journalctl -u "$SERVICE" -n 20 --no-pager 2>/dev/null | sed 's/^/    /' || true
sync_code "$ROLLBACK"
write_service
systemctl restart "$SERVICE" 9>&-
if wait_app; then log "Прежняя версия снова работает"; else log "ВНИМАНИЕ: сайт не отвечает и после отката — нужна ручная проверка"; fi
echo "$NEW" > "$STATE_DIR/failed"
write_status failed "Версия $SHORT не запустилась, вернули прежнюю"
exit 1
