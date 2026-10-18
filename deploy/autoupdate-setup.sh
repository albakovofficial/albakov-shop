#!/usr/bin/env bash
# One-time setup of ALBAKOV auto-update from a PRIVATE GitHub repository.
# Run on the server as root:
#   bash autoupdate-setup.sh git@github.com:LOGIN/albakov-shop.git [release]
# It creates a read-only deploy key, prints it (add it in GitHub: repo -> Settings -> Deploy keys,
# "Allow write access" OFF), waits until GitHub accepts the key, then installs the update timer
# and installs the newest version from the release branch right away.
# Messages are in English on purpose: Windows terminals often garble Cyrillic over ssh.
set -euo pipefail
REPO="${1:-}"; BRANCH="${2:-release}"
[ "$(id -u)" -eq 0 ] || { echo "Run as root" >&2; exit 1; }
printf '%s' "$REPO" | grep -qE '^git@github\.com:[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\.git$' || { echo "Usage: bash $0 git@github.com:LOGIN/REPO.git" >&2; exit 1; }
printf '%s' "$BRANCH" | grep -qE '^[A-Za-z0-9_./-]+$' || { echo "Bad branch name" >&2; exit 1; }
[ -f /var/www/albakov/server.js ] || { echo "The shop is not installed in /var/www/albakov" >&2; exit 1; }

STATE_DIR=/var/lib/albakov-update
KEY=/root/.ssh/albakov_deploy
SRC_DIR=/opt/albakov-src

command -v git >/dev/null 2>&1 || { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git >/dev/null; }

mkdir -p "$STATE_DIR" /root/.ssh; chmod 700 "$STATE_DIR" /root/.ssh
# GitHub host key (published at docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)
echo 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl' > "$STATE_DIR/known_hosts"
[ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N '' -C "albakov-server-$(hostname)" -f "$KEY"
chmod 600 "$KEY"

umask 077
printf 'REPO=%s\nBRANCH=%s\n' "$REPO" "$BRANCH" > /etc/albakov-update.conf
chmod 600 /etc/albakov-update.conf

export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o UserKnownHostsFile=$STATE_DIR/known_hosts -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=20"
export GIT_TERMINAL_PROMPT=0

echo
echo "=== DEPLOY KEY (add to GitHub: $REPO -> Settings -> Deploy keys -> Add deploy key, write access OFF) ==="
cat "$KEY.pub"
echo "=== END ==="
echo
echo "Waiting for GitHub to accept the key and for branch '$BRANCH' to exist (up to 30 min, Ctrl+C to stop)..."
ok=0
for _ in $(seq 1 180); do
  if out="$(git ls-remote "$REPO" "refs/heads/$BRANCH" 2>/dev/null)" && [ -n "$out" ]; then ok=1; break; fi
  sleep 10
done
[ "$ok" = 1 ] || { echo "GitHub did not accept the key in time. After adding it, run this command again." >&2; exit 1; }
echo "Access OK."

rm -rf "$SRC_DIR"
git clone --quiet --branch "$BRANCH" --single-branch "$REPO" "$SRC_DIR"
chmod 700 "$SRC_DIR"
bash "$SRC_DIR/deploy/autoupdate.sh" --install >/dev/null
echo "Installing the newest version now..."
if /usr/local/sbin/albakov-autoupdate; then echo "DONE: auto-update is on, the site runs the latest version from '$BRANCH'."
else echo "Update failed, previous version kept. Log: /var/log/albakov-update.log"; tail -n 20 /var/log/albakov-update.log; exit 1; fi
rm -f "$0" 2>/dev/null || true
