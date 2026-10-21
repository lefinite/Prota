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

lsof -ti :8080 | xargs kill -9 2>/dev/null || true
lsof -ti :8081 | xargs kill -9 2>/dev/null || true

echo "🚀 Starting Readify Portal..."
mkdir -p logs

if [ ! -d "node_modules/@codeany/open-agent-sdk" ]; then
    echo "📦 Installing Node dependencies..."
    npm install
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
