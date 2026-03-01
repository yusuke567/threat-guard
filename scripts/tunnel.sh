#!/bin/bash
# Quick Tunnel launcher with Slack notification
# Starts cloudflared and posts the new URL to Slack

SLACK_WEBHOOK_URL=$(grep SLACK_WEBHOOK_URL /Users/fpao840tujmkse/Projects/brand-shield/.env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
LOG_FILE="/tmp/cloudflared-tunnel.log"

# Start cloudflared and capture output
cloudflared tunnel --url http://localhost:4983 2>&1 | tee "$LOG_FILE" &
TUNNEL_PID=$!

# Wait for URL to appear in log
for i in $(seq 1 30); do
    TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG_FILE" | head -1)
    if [ -n "$TUNNEL_URL" ]; then
        echo "Tunnel URL: $TUNNEL_URL"
        
        # Post to Slack #pj-dev via webhook if available
        if [ -n "$SLACK_WEBHOOK_URL" ]; then
            curl -s -X POST "$SLACK_WEBHOOK_URL" \
                -H 'Content-type: application/json' \
                -d "{\"text\":\"🔗 BrandShield Tunnel URL updated: ${TUNNEL_URL}\"}" > /dev/null
        fi
        
        # Save URL to file for reference
        echo "$TUNNEL_URL" > /Users/fpao840tujmkse/Projects/brand-shield/.tunnel-url
        break
    fi
    sleep 1
done

# Keep running (wait for cloudflared)
wait $TUNNEL_PID
