#!/usr/bin/env bash
# 造物课堂 —— 一键部署（Ubuntu 22.04 / 24.04，需要 root 或 sudo）
# 用法：curl -fsSL https://raw.githubusercontent.com/rundong013-oss/ai-edu/main/deploy/install.sh | sudo bash
set -euo pipefail

main() {
REPO="https://github.com/rundong013-oss/ai-edu"
DIR="/opt/ai-edu"
say() { printf "\n\033[1;32m==> %s\033[0m\n" "$*"; }
ask() { # ask 变量名 提示 [默认值]
  local __v; read -r -p "$2" __v </dev/tty || true
  printf -v "$1" '%s' "${__v:-${3:-}}"
}
rand() { head -c 64 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

if [ "$(id -u)" -ne 0 ]; then echo "请用 root 或 sudo 运行"; exit 1; fi

# 内存小于 3.5GB 时加 2GB 交换空间，避免构建镜像时内存不足
if [ "$(awk '/MemTotal/{print $2}' /proc/meminfo)" -lt 3500000 ] && ! swapon --show | grep -q /swapfile; then
  say "内存较小，添加 2GB 交换空间"
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "这个脚本需要 Ubuntu / Debian 系统，请在云服务器控制台把系统重装为 Ubuntu 24.04"; exit 1
fi

say "1/5 安装 Docker（已安装则跳过）"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh </dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true
apt-get install -y git >/dev/null 2>&1 || true

say "2/5 获取代码"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone "$REPO" "$DIR"; fi
cd "$DIR"

say "3/5 配置（已配置过则跳过）"
if [ ! -f .env.production ]; then
  ask OPENAI_KEY  "OpenAI API key（sk-...，生图用；留空则先用模拟图）: "
  ask CLAUDE_KEY  "Anthropic API key（sk-ant-...，Vibe Coding 和生文字用；留空则先用模拟）: "
  ask DOMAIN      "域名（如 class.example.com，需已解析到本机 IP；没有就直接回车，用 IP 访问）: "
  ask DEMO        "是否创建演示老师和学生账号？[Y/n] " "Y"
  ADMIN_PW="$(rand 12)"; DEMO_PW="$(rand 8)"
  {
    echo "SESSION_SECRET=\"$(rand 48)\""
    echo "ADMIN_PASSWORD=\"$ADMIN_PW\""
    if [[ "$DEMO" =~ ^[Nn] ]]; then echo 'SEED_DEMO="false"'; else echo "DEMO_PASSWORD=\"$DEMO_PW\""; fi
    echo "IMAGE_PROVIDER=\"$([ -n "$OPENAI_KEY" ] && echo openai || echo mock)\""
    echo "OPENAI_API_KEY=\"$OPENAI_KEY\""
    echo 'OPENAI_IMAGE_MODEL="gpt-image-2.5-flare"'
    echo 'OPENAI_IMAGE_EDIT_MODEL="gpt-image-2.5-sunburst"'
    echo 'OPENAI_IMAGE_QUALITY="medium"'
    echo 'VIDEO_PROVIDER="mock"'
    echo "CODING_PROVIDER=\"$([ -n "$CLAUDE_KEY" ] && echo claude || echo mock)\""
    echo "ANTHROPIC_API_KEY=\"$CLAUDE_KEY\""
    echo 'CODING_MODEL="claude-sonnet-5-5"'
    echo 'TEXT_MODEL="claude-haiku-5-5"'
  } > .env.production
  chmod 600 .env.production
  echo "SITE_ADDRESS=${DOMAIN:-:80}" > .env   # 只给 docker compose 用
  {
    echo "管理员账号：admin    密码：$ADMIN_PW"
    [[ "$DEMO" =~ ^[Nn] ]] || echo "演示账号：teacher、teacher2、stu1、stu2、stu3、stu4    密码都是：$DEMO_PW"
  } > credentials.txt
  chmod 600 credentials.txt
fi

say "4/5 构建并启动（第一次约 3–6 分钟）"
mkdir -p data && chown -R 1000:1000 data   # 容器里以 node 用户（uid 1000）运行
docker compose up -d --build </dev/null

say "5/5 等待服务就绪"
for i in $(seq 1 90); do
  if docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" </dev/null 2>/dev/null; then OK=1; break; fi
  sleep 2
done
if [ "${OK:-}" != "1" ]; then echo "启动超时，查看日志：cd $DIR && docker compose logs app --tail 100"; exit 1; fi

ADDR="$(grep -oP '(?<=SITE_ADDRESS=).*' .env)"
if [ "$ADDR" = ":80" ]; then URL="http://$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"; else URL="https://$ADDR"; fi
say "部署完成！访问地址：$URL"
cat credentials.txt
echo
echo "账号密码保存在 $DIR/credentials.txt；之后更新代码：sudo bash $DIR/deploy/update.sh"
}

main "$@"
