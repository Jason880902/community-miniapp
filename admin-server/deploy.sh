#!/bin/bash
# 邻里管理后台 — 一键部署脚本
# 在服务器上运行: bash deploy.sh

set -e

echo "===== 1. 安装 Node.js ====="
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js $(node --version)"
echo "npm $(npm --version)"

echo ""
echo "===== 2. 安装依赖 ====="
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
npm install

echo ""
echo "===== 3. 配置环境变量 ====="
# 提示用户输入密钥
read -p "请输入 TCB SecretId: " SECRET_ID
read -p "请输入 TCB SecretKey: " SECRET_KEY
read -p "请设置管理密码 (默认 admin888): " ADMIN_PW
ADMIN_PW=${ADMIN_PW:-admin888}

cat > .env <<EOF
TCB_SECRET_ID=$SECRET_ID
TCB_SECRET_KEY=$SECRET_KEY
ADMIN_PASSWORD=$ADMIN_PW
PORT=3000
EOF

echo ""
echo "===== 4. 安装 pm2 守护进程 ====="
npm install -g pm2 2>/dev/null || true

echo ""
echo "===== 5. 启动服务 ====="
# 使用环境变量文件启动
export $(cat .env | xargs)
pm2 delete neighbor-admin 2>/dev/null || true
TCB_SECRET_ID=$SECRET_ID \
TCB_SECRET_KEY=$SECRET_KEY \
ADMIN_PASSWORD=$ADMIN_PW \
PORT=3000 \
pm2 start server.js --name neighbor-admin

pm2 save

echo ""
echo "✅ 部署完成！"
echo "   访问地址: http://$(curl -s ifconfig.me):3000"
echo "   管理密码: $ADMIN_PW"
echo ""
echo "常用命令:"
echo "  pm2 logs neighbor-admin    # 查看日志"
echo "  pm2 restart neighbor-admin # 重启"
echo "  pm2 stop neighbor-admin    # 停止"
