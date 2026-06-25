#!/bin/bash
# Wait for ngrok to start then send URL to Telegram
sleep 6
URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])" 2>/dev/null)
if [ -n "$URL" ]; then
  BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN /data/.env | cut -d= -f2)
  curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=339384105" \
    -d "text=🔗 Agent OS חי: ${URL}" > /dev/null
  echo "Sent: $URL"
fi
