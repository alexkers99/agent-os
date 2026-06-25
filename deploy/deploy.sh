#!/usr/bin/env bash
# Idempotent deploy for the Hostinger VPS. Run from the app directory:
#   bash deploy/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Checking Node…"
command -v node >/dev/null 2>&1 || { echo "✗ Node not installed. Install Node 20+ (nvm or nodesource) first."; exit 1; }
node -v

echo "→ Checking PM2…"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "  installing pm2 globally"
  npm install -g pm2
fi

if [ ! -f .env.local ] && [ ! -f .env.production ]; then
  echo "✗ No .env.local found. Run:  cp .env.example .env.local  then set HERMES_BASE_URL."
  exit 1
fi

echo "→ Installing dependencies (npm ci)…"
npm ci

echo "→ Building…"
npm run build

echo "→ Starting / reloading under PM2…"
pm2 startOrReload ecosystem.config.js
pm2 save

echo
echo "✓ Deployed. App listening on 127.0.0.1:3000"
echo "  pm2 status        # process health"
echo "  pm2 logs agent-os # live logs"
echo "  Next: put nginx in front (deploy/nginx.conf) and add TLS."
