#!/bin/bash

# Readify 公网分享一键启动脚本
# 自动处理隧道创建、DNS 绑定和服务器启动

PORT=8080
DOMAIN="prota.example.com"
TUNNEL_NAME="readify-prota"

echo "🚀 正在启动 Readify 公网分享助手..."

# 1. 检查 cloudflared 是否安装
if ! command -v cloudflared &> /dev/null; then
    echo "❌ 错误: 未安装 cloudflared。请运行: brew install cloudflared"
    exit 1
fi

# 2. 检查是否登录
if [ ! -f ~/.cloudflared/cert.pem ]; then
    echo "🔑 请先执行以下命令登录 Cloudflare (会弹窗确认):"
    echo "    cloudflared login"
    echo "登录完成后，请重新运行此脚本。"
    exit 1
fi

# 3. 检查并创建隧道
if ! cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo "📦 正在创建新隧道: $TUNNEL_NAME..."
    cloudflared tunnel create "$TUNNEL_NAME"
fi

# 4. 配置 DNS 路由 (将域名绑定到隧道)
echo "🌐 正在配置 DNS 路由: $DOMAIN -> $TUNNEL_NAME..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" || echo "⚠️ DNS 可能已配置，继续..."

# 5. 杀掉旧进程
echo "🧹 清理旧进程..."
pkill -f "bridge.py" || true
pkill -f "cloudflared tunnel" || true

# 6. 启动 Python 后端
echo "🐍 启动后端服务 (localhost:$PORT)..."
mkdir -p logs
nohup python3 server/bridge.py > logs/bridge.log 2>&1 &

# 7. 启动隧道
echo "🌉 启动公网隧道 ($DOMAIN)..."
echo "------------------------------------------------"
echo "🎉 全部就绪！"
echo "你的同事现在可以通过以下地址访问了："
echo "https://$DOMAIN"
echo "------------------------------------------------"

# 持续运行隧道
cloudflared tunnel --url http://localhost:$PORT run "$TUNNEL_NAME"
