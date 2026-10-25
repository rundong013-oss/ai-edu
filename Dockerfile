# 造物课堂 —— 生产镜像
# 注意：Vibe Coding 会在容器里运行 Claude Code 引擎（Agent SDK 自带的二进制），所以用 glibc 的 Debian 镜像，不用 alpine。
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data && chown node:node /data
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATA_DIR=/data \
    HOME=/data/home \
    PORT=3000
# 保留 devDependencies：启动时要用 drizzle-kit 建表、tsx 执行种子数据
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
# 每次启动：补齐表结构 → 更新课程内容（不动已有课堂和作品）→ 启动服务
CMD ["sh", "-c", "mkdir -p /data/home && npx drizzle-kit push --force && npx tsx src/db/seed.ts && npx next start -H 0.0.0.0 -p 3000"]
