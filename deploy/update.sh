#!/usr/bin/env bash
# 拉取最新代码并重启（数据在 data/ 目录，不受影响）
set -euo pipefail
cd /opt/ai-edu
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
echo "已更新到 $(git log -1 --format='%h %s')"
