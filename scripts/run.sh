#!/bin/bash
# Readify Demo Portal Launcher

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd )"
cd "$ROOT_DIR"

if [ -f ".env" ]; then
    set -a
    # shellcheck disable=SC1091
    source ".env"
    set +a
fi

# Initialize the shared workspace before starting Python and Node concurrently.
python3 -c 'from server.workspace import workspace_root; workspace_root()'

echo "🚀 Starting Readify Portal..."
mkdir -p logs

if [ ! -d "node_modules/playwright" ] || ! node scripts/vercel-cli.mjs --prota-check >/dev/null 2>&1; then
    echo "📦 Installing product dependencies and the latest Vercel CLI..."
    npm ci
fi
node scripts/vercel-cli.mjs --prota-check
node scripts/verify-pi.mjs

if lsof -tiTCP:8080 -sTCP:LISTEN >/dev/null 2>&1 || lsof -tiTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Ports 8080/8081 are already in use. Stop the existing services before starting the foreground development launcher."
    exit 1
fi

python3 server/bridge.py > logs/bridge.log 2>&1 &
BRIDGE_PID=$!

node --env-file-if-exists=.env server/agent-server.mjs > logs/agent-server.log 2>&1 &
AGENT_PID=$!

cleanup() {
    kill "$BRIDGE_PID" "$AGENT_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

sleep 1
open "http://localhost:8080/portal/index.html"

echo "✅ Readify Portal is now open at http://localhost:8080"
echo "🤖 Agent Gateway is running at http://localhost:8081"
echo "⚠️  Keep this terminal window open while using bridge and agent features."

wait "$BRIDGE_PID" "$AGENT_PID"
