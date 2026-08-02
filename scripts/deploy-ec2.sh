#!/usr/bin/env bash
# Deploy CricBid to EC2 from any environment (local or Claude Code cloud).
#
# Requires the private key in the EC2_SSH_KEY environment variable
# (set it as a secret in the environment settings — never commit it).
#
# Usage:
#   ./scripts/deploy-ec2.sh              # backend only (git pull + pm2 restart)
#   ./scripts/deploy-ec2.sh frontend     # + build & upload frontend dist
#   ./scripts/deploy-ec2.sh scoring      # + build & upload scoring dist
#   ./scripts/deploy-ec2.sh cricbook     # + build & upload cricbook dist
#   ./scripts/deploy-ec2.sh all          # backend + frontend + scoring + cricbook

set -euo pipefail

EC2_HOST="${EC2_HOST:-ubuntu@ec2-13-234-118-199.ap-south-1.compute.amazonaws.com}"
REMOTE_DIR="/home/ubuntu/cricBid/cricbid-v0-sql"
BRANCH="${DEPLOY_BRANCH:-sql-migration}"
TARGET="${1:-backend}"

# ── Resolve the SSH key ───────────────────────────────────────────────────────
if [[ -n "${EC2_SSH_KEY:-}" ]]; then
  KEY_FILE="$(mktemp)"
  trap 'rm -f "$KEY_FILE"' EXIT
  printf '%s\n' "$EC2_SSH_KEY" > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
elif [[ -f "$HOME/Keyssss/cricBid.pem" ]]; then
  KEY_FILE="$HOME/Keyssss/cricBid.pem"
else
  echo "ERROR: set EC2_SSH_KEY env var (PEM contents) or place key at ~/Keyssss/cricBid.pem" >&2
  exit 1
fi

SSH=(ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no -o ConnectTimeout=15 "$EC2_HOST")
run() { "${SSH[@]}" "$@"; }

echo "==> Pulling $BRANCH on EC2"
run "cd $REMOTE_DIR && git pull origin $BRANCH"

build_and_push() { # $1 = app dir (frontend|scoring)
  local app="$1"
  echo "==> Building $app"
  (cd "$(dirname "$0")/../$app" && npm ci --silent 2>/dev/null || npm install --silent; npm run build)
  echo "==> Uploading $app/dist"
  local tarball
  tarball="$(mktemp -t "${app}-dist-XXXX").tar.gz"
  tar -czf "$tarball" -C "$(dirname "$0")/../$app" dist
  scp -i "$KEY_FILE" -o StrictHostKeyChecking=no "$tarball" "$EC2_HOST:/tmp/${app}-dist.tar.gz"
  rm -f "$tarball"
  run "rm -rf $REMOTE_DIR/$app/dist && tar -xzf /tmp/${app}-dist.tar.gz -C $REMOTE_DIR/$app && rm /tmp/${app}-dist.tar.gz"
}

case "$TARGET" in
  frontend) build_and_push frontend ;;
  scoring)  build_and_push scoring ;;
  cricbook) build_and_push cricbook ;;
  all)      build_and_push frontend; build_and_push scoring; build_and_push cricbook ;;
  backend)  ;;
  *) echo "Unknown target '$TARGET' (use: backend|frontend|scoring|cricbook|all)" >&2; exit 1 ;;
esac

echo "==> Restarting backend (pm2 server-sql)"
run "pm2 restart server-sql --update-env && pm2 status server-sql | tail -4"

echo "==> Done"
