#!/bin/bash
set -Eeuo pipefail
PRODUCT_DIR="$1"
STATUS_FILE="$2"
if [ -f "$PRODUCT_DIR/.env" ]; then set -a; source "$PRODUCT_DIR/.env"; set +a; fi
CONFIG_DIR="${READIFY_CONFIG_DIR:-$HOME/.config/prota}"
RUNTIME_DIR="$CONFIG_DIR/runtime"
mkdir -p "$RUNTIME_DIR"
export PATH="$RUNTIME_DIR/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# Finder may not inherit shell proxy configuration. Prefer macOS system proxies.
PROXY_STATE="$(/usr/sbin/scutil --proxy)"
for scheme in HTTP HTTPS; do
    enabled="$(echo "$PROXY_STATE" | /usr/bin/awk -v key="${scheme}Enable" '$1==key {print $3}')"
    if [ "$enabled" = 1 ]; then
        proxy_host="$(echo "$PROXY_STATE" | /usr/bin/awk -v key="${scheme}Proxy" '$1==key {print $3}')"
        proxy_port="$(echo "$PROXY_STATE" | /usr/bin/awk -v key="${scheme}Port" '$1==key {print $3}')"
        if [ "$scheme" = HTTP ]; then export HTTP_PROXY="http://$proxy_host:$proxy_port" http_proxy="http://$proxy_host:$proxy_port"; else export HTTPS_PROXY="http://$proxy_host:$proxy_port" https_proxy="http://$proxy_host:$proxy_port"; fi
    fi
done
NODE_STAGE_DIR=""
cleanup() { if [ -n "$NODE_STAGE_DIR" ] && [[ "$NODE_STAGE_DIR" == "$RUNTIME_DIR"/node-download.* ]]; then rm -rf "$NODE_STAGE_DIR"; fi; }
trap cleanup EXIT
status() { printf '%s\n' "$1" > "$STATUS_FILE.next"; mv "$STATUS_FILE.next" "$STATUS_FILE"; }
failed() { status '{"state":"error","show":true,"title":"准备未完成","detail":"请检查网络连接，然后点击重试。已有项目与配置已保留。"}'; }
trap failed ERR
if ! command -v node >/dev/null || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);const npm=require("path").resolve(require("path").dirname(process.execPath),"../lib/node_modules/npm/bin/npm-cli.js");process.exit((a>22||a===22&&b>=19)&&require("fs").existsSync(npm)?0:1)' >/dev/null 2>&1; then
    status '{"state":"preparing","show":true,"step":1,"title":"准备运行环境","detail":"正在下载 Node.js，首次启动需要一些时间。"}'
    NODE_STAGE_DIR="$(mktemp -d "$RUNTIME_DIR/node-download.XXXXXX")"
    /usr/bin/curl -fLsS --retry 2 --connect-timeout 20 --max-time 90 https://nodejs.org/dist/index.json -o "$NODE_STAGE_DIR/index.json"
    NODE_VERSION="$(/usr/bin/osascript -l JavaScript -e 'ObjC.import("Foundation");function run(a){var s=$.NSString.stringWithContentsOfFileEncodingError(a[0],$.NSUTF8StringEncoding,null).js;return JSON.parse(s).find(x=>x.lts&&Number(x.version.slice(1).split(".")[0])>=24).version;}' "$NODE_STAGE_DIR/index.json")"
    case "$(uname -m)" in arm64) ARCH=arm64;; x86_64) ARCH=x64;; *) exit 1;; esac
    ARCHIVE="node-$NODE_VERSION-darwin-$ARCH.tar.gz"
    /usr/bin/curl -fLsS --retry 2 --connect-timeout 20 --max-time 600 "https://nodejs.org/dist/$NODE_VERSION/$ARCHIVE" -o "$NODE_STAGE_DIR/$ARCHIVE"
    /usr/bin/curl -fLsS --retry 2 --max-time 90 "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$NODE_STAGE_DIR/checksums"
    (cd "$NODE_STAGE_DIR"; /usr/bin/awk -v name="$ARCHIVE" '$2==name' checksums > selected; test -s selected; LC_ALL=C LANG=C /usr/bin/shasum -a 256 -c selected)
    LC_ALL=C LANG=C /usr/bin/tar -xzf "$NODE_STAGE_DIR/$ARCHIVE" -C "$NODE_STAGE_DIR"
    if [ -d "$RUNTIME_DIR/node" ]; then mv "$RUNTIME_DIR/node" "$NODE_STAGE_DIR/previous-node"; fi
    mv "$NODE_STAGE_DIR/node-$NODE_VERSION-darwin-$ARCH" "$RUNTIME_DIR/node"
    rm -rf "$NODE_STAGE_DIR"
fi
exec node "$PRODUCT_DIR/scripts/desktop-launcher.mjs" "$STATUS_FILE"
