# Deploying Agent OS to the Hostinger VPS

Assumes an Ubuntu/Debian VPS with SSH access. ~10 minutes.

---

## 0. One-time: prerequisites on the VPS

SSH in (`ssh user@YOUR_VPS_IP`) and ensure Node 20+ is present:

```bash
node -v   # need v20+
# if missing:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
```

## 1. Get the code onto the VPS

**Option A — rsync from your Windows machine** (Git Bash; excludes the heavy/build dirs):

```bash
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  "/c/Users/losti/Agent os/" user@YOUR_VPS_IP:/var/www/agent-os/
```

**Option B — scp:** zip the folder (minus `node_modules`/`.next`), `scp` it over, unzip into `/var/www/agent-os`.

**Option C — git:** push to a private GitHub repo, then `git clone` on the VPS. (Say the word and I'll set up the repo + first commit locally.)

## 2. Configure secrets on the VPS

```bash
cd /var/www/agent-os
cp .env.example .env.local
nano .env.local
```

Set:
```ini
HERMES_BASE_URL=https://your-vps-domain.com/v1   # your Hermes endpoint
HERMES_API_KEY=                                  # blank if unauthenticated
HERMES_MODEL=hermes
TELEGRAM_BRIDGE_SECRET=<paste output of: openssl rand -hex 24>
ALLOW_SHELL=false
```

> The app boots without a real Hermes URL, but chat/goals will error until it's set. If Hermes runs on the **same** VPS, `http://127.0.0.1:PORT/v1` is fine and faster.

## 3. Build + start

```bash
bash deploy/deploy.sh
```

This installs deps, builds, and starts under PM2. Verify:

```bash
pm2 status
curl -s localhost:3000/api/state | head -c 200   # should return JSON with agents
```

Make PM2 survive reboots:

```bash
pm2 startup     # run the command it prints
pm2 save
```

## 4. nginx + TLS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/agent-os
# edit server_name to your domain:
sudo nano /etc/nginx/sites-available/agent-os
sudo ln -s /etc/nginx/sites-available/agent-os /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# TLS (free, auto-renewing):
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Open the firewall:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## 5. Point your Telegram bot at it

In your existing bot, on each inbound message add one HTTP call:

```
POST  https://your-domain.com/api/telegram
headers:  x-bridge-secret: <the TELEGRAM_BRIDGE_SECRET from step 2>
          content-type: application/json
body:     { "from": "<username>", "text": "<message>", "chatId": "<id>" }
```

Send a message → it appears live in the console. `/goal <target> :: <done>` starts a loop.

## Updating later

```bash
# re-sync code (step 1), then:
cd /var/www/agent-os && bash deploy/deploy.sh   # zero-downtime reload
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npm ci` fails | Commit/transfer `package-lock.json`; ensure Node 20+ |
| 502 from nginx | App not running — `pm2 logs agent-os` |
| Chat hangs / SSE dead | nginx must have `proxy_buffering off` (it's in the conf) |
| Chat errors instantly | `HERMES_BASE_URL` wrong/unreachable — `npm run probe` on the VPS |
| Port 3000 in use | Change `-p 3000` in `ecosystem.config.js` + nginx `proxy_pass` |
