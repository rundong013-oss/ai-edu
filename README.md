# 造物课堂（AI 教学一体化平台）

线下 AI 课用的一体化教学平台：学生在同一个页面里完成**画布创作**（文生图 / 图生图 / 图生视频 / 生文字）和 **Vibe Coding**（用自然语言让 Claude 写网页），老师备课、开课、看进度、投屏，机构后台管账号、课包授权和算力。

> 产品名「造物课堂」是占位，改 `src/lib/brand.ts` 一处即可。

## 快速开始

需要 Node.js 22+。

```bash
npm install
cp .env.example .env      # 然后按下面说明填 key
npm run setup             # 建表 + 写入演示账号和示例课程
npm run dev               # 打开 http://localhost:3000
```

演示账号（密码都是 `123456`）：

| 角色 | 账号 |
|---|---|
| 机构后台 | `admin` |
| 老师 | `teacher`、`teacher2` |
| 学生 | `stu1` `stu2` `stu3`（已授权 S1）、`stu4`（未授权，用来演示授权拦截） |

体验路径：老师 → 新建课堂（选 S1 第 1 节、勾选学生）→ 开课 → 学生登录进入课堂 → 画布里生成并提交 → 老师面板实时看进度、投屏 → 作品分享页。

## 配置（.env）

| 变量 | 说明 |
|---|---|
| `IMAGE_PROVIDER` | `openai` 真实生图；`mock` 返回占位图（不花钱，调界面用） |
| `OPENAI_API_KEY` | OpenAI 的 API key |
| `OPENAI_IMAGE_MODEL` | 文生图模型，默认 `gpt-image-2.5-flare`（更快） |
| `OPENAI_IMAGE_EDIT_MODEL` | 图生图模型，默认 `gpt-image-2.5-sunburst`（更擅长多图融合） |
| `OPENAI_IMAGE_QUALITY` | `low` / `medium` / `high` |
| `OPENAI_BASE_URL` | 可选，OpenAI 兼容的中转地址 |
| `CODING_PROVIDER` | `claude` 真实 Vibe Coding；`mock` 模拟流式过程 |
| `ANTHROPIC_API_KEY` | **Claude Console 的 API key**（Max 订阅每月送的 API 额度也走这个 key）。产品给学生用不能用 Pro/Max 的登录态 |
| `CODING_MODEL` | 默认 `claude-sonnet-5-5`；`claude-haiku-5-5` 更快更省，可在后台按课节单独设置 |
| `TEXT_MODEL` | 生文字框体的模型，默认 `claude-haiku-5-5` |

自检生图：`npm run test:image`，成功会在 `data/test-image.png` 生成一张图。

**用代理上网时**：Node 自带的 fetch 默认不走系统代理，启动时加 `NODE_USE_ENV_PROXY=1`，例如

```bash
HTTPS_PROXY=http://127.0.0.1:7890 NODE_USE_ENV_PROXY=1 npm run dev
```

## 核心机制

- **一张画布 = 一节课**：左侧任务步骤，每个任务预设框体（图片 / 视频 / 文字），框体之间按课程连线，上游结果自动作为下游的参考图或参考文字。
- **填空式提示词**：模板句子直接显示，空格是可编辑的字段，点开有候选词；也可以切到「自己写」。
- **提示词积木**：风格、光影、镜头、场景、动作、特效、体裁、语气等类别的片段，学生点选拼进提示词；每个框体只开放与它相关的类别。积木库在机构后台「提示词」页维护。
- **平台层隐藏规则**：每次生成自动追加儿童内容规范，学生看不到也改不掉；屏蔽词命中直接拦下且不扣次数。都在后台可改。
- **按课节限额**：每个框体固定生成次数（原子扣减，连点也不会多扣），失败自动退回；每节课有固定个数的备用框体；Vibe Coding 按对话轮数限额。
- **Vibe Coding**：服务端用 Claude Agent SDK（只开放 Read / Write / Edit / TodoWrite，只能读写学生自己的项目目录），对话流式输出，写 HTML 时内容实时推进预览框。每节课有脚手架和专用 CLAUDE.md；学生在同一课包里提交过的画布作品（图、视频、文字）自动成为素材。
- **作品**：提交时保存创作过程，分享页（手机优先、带二维码）展示「是怎么做出来的」。网页作品提交时打快照。
- **用量**：每次生成都记录模型、耗时、token、估算成本；后台按学生、按课节汇总，并统计 Vibe Coding 的首次预览和完成耗时。

## 目录

```
src/
  app/            页面与接口（admin / teacher / student / share / api）
  components/     画布（canvas/）、Vibe Coding（coding/）、通用组件
  content/        课程内容定义 curriculum.ts（改完执行 npm run db:seed）
  db/             数据模型 schema.ts、种子数据 seed.ts
  server/         生成、额度、提示词、编程运行器、各类查询
content/scaffolds 每节编程课的项目脚手架
data/             数据库、生成的图片、学生项目（不入库）
```

## 已知限制

- 视频生成目前是 mock（带动画的 SVG），真实视频模型待接入：在 `src/server/providers/index.ts` 的 `videoProvider()` 接入即可。
- 课件 PPT 与教案为占位。
- 单机部署：Vibe Coding 的运行状态在进程内存里；多机部署需要换成 Redis 之类。
- 生成的媒体文件和学生项目预览靠不可猜测的 id 访问，未做登录校验。
