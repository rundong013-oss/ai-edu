# CLAUDE.md

AI 教学一体化平台（产品名「造物课堂」是占位）：线下少儿 AI 课用，学生在同一页面完成画布创作（生图 / 生视频 / 生文字）和 Vibe Coding，老师开课看进度，机构后台管账号、授权和算力。对标产品是灵动AI学院。

背景文档（改动前先读）：
- `docs/PRD.md`：目标、设计原则、核心机制、当前进展
- `docs/对标调研-灵动AI学院.md`：对标产品的结构、机制、课程体系

## 设计原则（用户定下的，不要违背）
1. 封装只是把各平台的工具放进同一个页面，**体验不能比直接用 Claude Code 差**：流式输出、可见的执行进度、实时预览。
2. **速度是硬指标**：Vibe Coding 首次预览 < 30s、首版 < 2 分钟；改动要保住这个水平，每次生成都记延迟。
3. 一张画布 = 一节课，有明确目的；生成次数按框体限额，不能无限抽卡。
4. 先把标准化产品和机制跑通，不考虑机构销售、招生物料、计费。
5. 面向 8–16 岁学生：界面文案简单直白，平台层内容规则不能被学生绕过。

## 常用命令
```bash
npm run dev          # 开发（用代理上网时加 NODE_USE_ENV_PROXY=1）
npm run setup        # 建表 + 种子数据（演示账号密码都是 123456）
npm run db:seed      # 只更新课程内容（改了 src/content/curriculum.ts 后执行；按序号/key 原地更新，不会破坏已有课堂）
npm run db:reset     # 清空 data/ 重建
npm run test:image   # 用 .env 的 OpenAI key 生成一张测试图
npx tsc --noEmit && npx eslint src --quiet   # 提交前检查
```

## 架构
- Next.js 15 App Router + TypeScript + Tailwind v4；数据库 SQLite（Drizzle + libSQL，`src/db/schema.ts`）；画布用 React Flow（`@xyflow/react`）。
- 三端路由：`/admin`（机构）、`/teacher/(shell)` 带侧栏的页面 + `/teacher/(full)` 全屏页面（查看学生、演示画布、投屏）、`/student`。`src/middleware.ts` 按角色拦截。
- 公开页面：`/share/[token]` 作品分享页、`/s/[token]/...` 网页作品快照、`/preview/[workspaceId]/...` 学生项目实时预览。
- 课程内容在代码里：`src/content/curriculum.ts`（课节 → 任务 → 框体模板，含填空模板、连线、跨课引用）。
- 生成流程：`src/server/generation.ts`（屏蔽词检查 → 原子扣次数 → 拼提示词 → 异步调模型 → 失败退次数 → 记用量）。
- 提示词分层：`src/server/prompts.ts`（平台层规则默认值、屏蔽词、积木库默认值、拼接逻辑）。后台 `/admin/prompts` 可改，存在 `settings` 和 `prompt_blocks` 表。
- 模型适配：`src/server/providers/`（OpenAI 图像 / mock 图像和视频 / Claude 文字）。
- Vibe Coding：`src/server/coding/runner.ts` 用 Claude Agent SDK，只开放 Read/Write/Edit/TodoWrite，`canUseTool` 限制只能读写项目目录；事件经 SSE（`/api/coding/[id]/stream`）推到前端；Write 工具的流式参数被解析成草稿实时推进预览。`project.ts` 负责脚手架、CLAUDE.md、素材清单。运行状态在进程内存里（单机）。
- 前端轮询：画布 `useWorkspace`（生成中 1.2s，否则 5s）；老师面板 3s。

## 约定与坑
- 数据库里只存相对 `DATA_DIR` 的路径，用 `src/lib/paths.ts` 的 `dataPath` / `rel` / `safeJoin`，不要手拼路径。
- 额度扣减必须用带条件的 `UPDATE ... WHERE used < max RETURNING`，不要先查再改。
- Next.js 会去掉 URL 末尾的 `/`：项目预览一律用 `/preview/<id>/index.html`，否则相对路径的 css 加载不到。
- OpenAI 参考图只接受 png/jpeg/webp；mock 产出的 SVG 会被跳过。
- Node 的 fetch 默认不走 `HTTPS_PROXY`，需要 `NODE_USE_ENV_PROXY=1`。
- Claude 产品形态必须用 Console API key（`ANTHROPIC_API_KEY`），不能用 Pro/Max 登录态。
- 视觉风格：深色、电影感，荧光绿 `--spark` 是唯一强调色；粒子动画（`NoiseField`）只用在登录页和「正在生成」上，不要到处加动效。
- 界面文案、注释用中文。
- 不要提交 `.env` 和 `data/`。
