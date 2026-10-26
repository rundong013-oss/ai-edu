// 课程内容定义。改这里 → `npm run db:seed` 重新写入数据库（服务器重启时也会自动执行）。
// 本期填好了 S1 的前 4 节（文生图 / 图生视频 / Vibe Coding 网页 / 画主角 + 做游戏），其余为占位。

import type { Slot } from "@/db/schema";

export type FrameDef = {
  key: string;
  type: "IMAGE" | "VIDEO" | "TEXT";
  title: string;
  promptTemplate: string;
  slots: Slot[];
  aspectRatio?: string;
  maxGenerations?: number;
  upstreamKeys?: string[];
  crossLessonRefs?: string[];
  blockCategories?: string[]; // 开放哪些积木类别；不填按框体类型默认
  transparent?: boolean; // 生成透明背景（游戏角色贴图）
  pos: [number, number];
};

export type TaskDef = {
  title: string;
  description: string;
  kind: "CANVAS" | "CODING" | "FREE";
  codingPrompt?: string;
  frames?: FrameDef[];
};

export type LessonDef = {
  index: number;
  title: string;
  subtitle?: string;
  kind: "CANVAS" | "CODING" | "MIXED";
  ready: boolean;
  objectives?: string;
  lessonPlan?: string; // 教案（markdown）；不填用占位
  spareFrames?: number;
  codingMaxTurns?: number;
  codingScaffold?: string;
  codingClaudeMd?: string;
  tasks?: TaskDef[];
};

export type CourseDef = { code: string; title: string; description: string; level: number; lessons: LessonDef[] };

const PLAN_PLACEHOLDER = `> 教案占位：本节的逐字讲稿、板书和课堂节奏待设计。\n\n1. 导入（10 分钟）\n2. 讲解与示范（20 分钟）\n3. 学生创作（45 分钟）\n4. 展示与点评（15 分钟）`;
export { PLAN_PLACEHOLDER };

// ---------------- S1 第 1 节：文生图 / 图生图 ----------------
const lesson1: LessonDef = {
  index: 1,
  title: "机甲召唤师",
  subtitle: "文生图与图生图",
  kind: "CANVAS",
  ready: true,
  spareFrames: 2,
  objectives: [
    "**知识目标**：认识文生图（用文字描述生成图片）和图生图（用参考图控制生成）；掌握「主体 + 细节 + 场景 + 风格」的提示词结构。",
    "**能力目标**：能独立写出一段完整的提示词，并通过修改关键词控制画面。",
    "**情感目标**：体验把脑海里的想象变成画面的成就感。",
  ].join("\n\n"),
  tasks: [
    {
      title: "任务一：召唤机甲英雄",
      description: "先在脑海里想象你的机甲：它叫什么？什么颜色？拿着什么武器？再把这些写进提示词。",
      kind: "CANVAS",
      frames: [
        {
          key: "mech",
          type: "IMAGE",
          title: "机甲英雄召唤框",
          promptTemplate:
            "一台名叫「{{name}}」的机甲英雄，主色调是{{color}}，手持{{weapon}}，站在{{scene}}，全身像，电影级光影，超精细 3D 渲染",
          slots: [
            { key: "name", label: "机甲名字", default: "烈焰战龙号" },
            { key: "color", label: "主颜色", default: "红金色", options: ["红金色", "冰蓝色", "暗夜紫", "荧光绿"] },
            { key: "weapon", label: "武器", default: "火焰巨剑" },
            { key: "scene", label: "战场", default: "未来城市的废墟" },
          ],
          aspectRatio: "3:4",
          pos: [0, 0],
        },
      ],
    },
    {
      title: "任务二：召唤萌宠伙伴",
      description: "每个机甲英雄都有一个萌宠伙伴。它是什么动物？带着什么道具？",
      kind: "CANVAS",
      frames: [
        {
          key: "pet",
          type: "IMAGE",
          title: "萌宠伙伴召唤框",
          promptTemplate:
            "一只{{animal}}，毛色是{{color}}，带着{{item}}，背景是{{scene}}，可爱的 3D 卡通风格，柔和光影，大眼睛",
          slots: [
            { key: "animal", label: "动物", default: "小狐狸", options: ["小狐狸", "小狼", "小龙", "小猫"] },
            { key: "color", label: "颜色", default: "粉白色" },
            { key: "item", label: "道具", default: "星光蝴蝶结" },
            { key: "scene", label: "场景", default: "梦幻星空" },
          ],
          aspectRatio: "3:4",
          pos: [0, 520],
        },
      ],
    },
    {
      title: "任务三：合体变身",
      description: "把任务一和任务二的结果连到合体框里，用图生图让它们合体成一台战甲兽！",
      kind: "CANVAS",
      frames: [
        {
          key: "fusion",
          type: "IMAGE",
          title: "合体召唤框",
          promptTemplate:
            "把参考图中的机甲英雄和萌宠合体，变成一台{{form}}形态的战甲兽，名字叫「{{name}}」，必杀技是{{skill}}，背景是{{scene}}，史诗感构图",
          slots: [
            { key: "form", label: "形态", default: "狼形" },
            { key: "name", label: "名字", default: "星光战甲兽" },
            { key: "skill", label: "必杀技", default: "星辰爆裂爪" },
            { key: "scene", label: "背景", default: "破碎的天空" },
          ],
          aspectRatio: "3:4",
          upstreamKeys: ["mech", "pet"],
          pos: [440, 260],
        },
      ],
    },
    {
      title: "任务四：写角色档案",
      description: "让 AI 看着你的战甲兽，帮它写一份角色档案。下节课做图鉴网页时会用到！",
      kind: "CANVAS",
      frames: [
        {
          key: "profile",
          type: "TEXT",
          title: "角色档案框",
          promptTemplate: "看着参考图里的战甲兽，给它写一份角色档案：它叫「{{name}}」，性格{{personality}}，最厉害的本领是{{power}}。写出它的来历和一个小故事，150 字左右",
          slots: [
            { key: "name", label: "名字", default: "星光战甲兽" },
            { key: "personality", label: "性格", default: "勇敢又有点调皮", options: ["勇敢又有点调皮", "沉稳可靠", "热情冲动", "聪明爱思考"] },
            { key: "power", label: "本领", default: "星辰爆裂爪" },
          ],
          maxGenerations: 3,
          upstreamKeys: ["fusion"],
          pos: [880, 260],
        },
      ],
    },
    {
      title: "自由创作",
      description: "用备用框体自由发挥：给你的战甲兽画一张海报，或者召唤一个新伙伴。",
      kind: "FREE",
    },
  ],
};

// ---------------- S1 第 2 节：图生视频 ----------------
const lesson2: LessonDef = {
  index: 2,
  title: "变身动画",
  subtitle: "让角色动起来",
  kind: "CANVAS",
  ready: true,
  spareFrames: 1,
  objectives: [
    "**知识目标**：了解图生视频的原理——以图片为第一帧，用文字描述动作和镜头。",
    "**能力目标**：能用「主体 + 动作 + 镜头 + 特效」描述一段动画。",
    "**情感目标**：体验让静态角色「活过来」的惊喜。",
  ].join("\n\n"),
  tasks: [
    {
      title: "任务一：角色定妆照",
      description: "给上节课的战甲兽拍一张定妆照（会自动参考你上节课的合体作品）。",
      kind: "CANVAS",
      frames: [
        {
          key: "hero",
          type: "IMAGE",
          title: "定妆照框",
          promptTemplate: "{{subject}}，{{pose}}，站在{{scene}}，全身像，干净的背景，电影级光影，3D 渲染",
          slots: [
            { key: "subject", label: "角色", default: "参考图中的战甲兽" },
            { key: "pose", label: "姿势", default: "摆出战斗准备姿势" },
            { key: "scene", label: "场景", default: "发光的召唤阵中央" },
          ],
          aspectRatio: "16:9",
          crossLessonRefs: ["S1-1:fusion"],
          pos: [0, 0],
        },
      ],
    },
    {
      title: "任务二：变身动画",
      description: "把定妆照连到视频框，描述它怎么变身。",
      kind: "CANVAS",
      frames: [
        {
          key: "transform",
          type: "VIDEO",
          title: "变身动画框",
          promptTemplate: "{{subject}}{{action}}，镜头{{camera}}，{{fx}}，流畅的动画",
          slots: [
            { key: "subject", label: "主体", default: "参考图中的角色" },
            { key: "action", label: "动作", default: "身体发出光芒，装甲一片片展开完成变身" },
            { key: "camera", label: "镜头", default: "缓慢环绕并推近" },
            { key: "fx", label: "特效", default: "四周飘起金色粒子" },
          ],
          aspectRatio: "16:9",
          maxGenerations: 2,
          upstreamKeys: ["hero"],
          pos: [520, -120],
        },
      ],
    },
    {
      title: "任务三：必杀技动画",
      description: "再做一段放必杀技的动画。",
      kind: "CANVAS",
      frames: [
        {
          key: "ultimate",
          type: "VIDEO",
          title: "必杀技动画框",
          promptTemplate: "{{subject}}释放必杀技「{{skill}}」，{{fx}}，镜头{{camera}}",
          slots: [
            { key: "subject", label: "主体", default: "参考图中的角色" },
            { key: "skill", label: "必杀技", default: "星辰爆裂爪" },
            { key: "fx", label: "特效", default: "爪痕划过天空留下星光" },
            { key: "camera", label: "镜头", default: "从低角度仰拍" },
          ],
          aspectRatio: "16:9",
          maxGenerations: 2,
          upstreamKeys: ["hero"],
          pos: [520, 260],
        },
      ],
    },
    { title: "自由创作", description: "用备用框体自由创作。", kind: "FREE" },
  ],
};

// ---------------- S1 第 3 节：Vibe Coding ----------------
const lesson3: LessonDef = {
  index: 3,
  title: "角色图鉴",
  subtitle: "我的第一个网页",
  kind: "CODING",
  ready: true,
  codingMaxTurns: 10,
  codingScaffold: "bestiary",
  objectives: [
    "**知识目标**：知道网页由 HTML（结构）、CSS（样式）、JavaScript（互动）组成；理解「描述需求 → AI 编写 → 预览 → 修改」的开发循环。",
    "**能力目标**：能用清楚的语言描述想要的页面，并通过多轮对话迭代。",
    "**情感目标**：完成一个能分享给家人的作品，建立「我也能做产品」的信心。",
  ].join("\n\n"),
  codingClaudeMd: [
    "## 本节课：角色图鉴网页",
    "- 学生是 9–12 岁的小学生，回复要简短、口语化、有鼓励性，每次回复不超过 3 句话。",
    "- 只修改项目里已有的 index.html / style.css / app.js，不要新建框架、不要安装依赖。",
    "- 角色图片和视频在 assets/ 目录，清单见 assets/assets.json。用相对路径引用（如 assets/xxx.png）。",
    "- 页面必须在手机上好看（移动端优先）。",
  ].join("\n"),
  tasks: [
    {
      title: "任务一：做出图鉴页",
      description: "点击下面的提示词，让 AI 帮你做出角色图鉴的第一版。",
      kind: "CODING",
      codingPrompt:
        "帮我做一个「我的战甲兽图鉴」网页：顶部是角色名字和一句酷炫的口号；中间大图展示 assets 里我的角色图片；下面用卡片展示三个属性（力量、速度、智慧），用彩色进度条表示；最后写一小段角色故事。整体风格要酷炫，适合手机看。",
    },
    {
      title: "任务二：加入互动",
      description: "让图鉴动起来！",
      kind: "CODING",
      codingPrompt:
        "给图鉴加上互动：页面打开时属性进度条从 0 慢慢涨上去；点击角色图片时，图片发光并轻轻弹一下；再加一个「召唤」按钮，点一下屏幕会震动，并弹出必杀技的名字。",
    },
    {
      title: "自由迭代",
      description: "你还想加什么？换颜色、加音效、加更多角色……用你自己的话告诉 AI。",
      kind: "FREE",
      codingPrompt: "我想把",
    },
  ],
};

// ---------------- S1 第 4 节：画主角 + 做游戏（画布与 Vibe Coding 混合） ----------------
const lesson4Plan = `### 课前准备

- 用「打开演示画布」把画主角的框体和提示词先走一遍。
- 准备一个做好的示范游戏（可以是往期学生作品），上课时投屏用。
- 提醒学生：玩游戏前先用鼠标点一下游戏画面，键盘才能控制。

### 1. 导入：一个游戏由什么组成？（10 分钟）

- 投屏示范游戏，请两位同学上台各玩 20 秒，比一比谁坚持得久。
- 提问："这个游戏里有哪些东西？"引导出三个要素：**主角**（我控制的）、**障碍**（要躲开的）、**规则**（怎么赢、怎么输）。
- 告诉大家：今天从一张白纸开始，一节课做出属于自己的游戏。

### 2. 提示词工程：让 AI 画出你脑子里的样子（15 分钟）

- 板书提示词公式：**主体 + 外观 + 动作 + 画风 + 用途**。
- 现场对比：只写"一只猫"，和把五个部分写完整，AI 画出来差别有多大？结论：写得越具体，AI 越懂你。
- 重点讲**用途**：这张图要放进游戏，所以必须全身、居中、正面，而且不要背景。用途决定了很多要求，也是写提示词时最容易忘的部分。

### 3. 画出游戏主角（15 分钟）

每人只有 3 次生成机会，引导学生按"一次比一次具体"来用：

1. 第 1 次：只改「角色是谁」，其他保持默认，看看 AI 自由发挥的结果。
2. 第 2 次：把「长什么样」「在做什么」改成自己想要的样子。
3. 第 3 次：换一个画风，或者加一块细节积木，对比三张图的区别。

最后从三张里选一张当主角。提醒：要选放进游戏里**最显眼、最好认**的那张，不一定是最好看的那张。

### 4. 示范 Vibe Coding（5 分钟）

- 老师点右上角「下一步：编程实现」，在下方任务里点「主角登场」，把填好的提示词发给 AI。边等边讲：AI 先读懂我们的要求，再写代码，右边马上出预览。
- 强调：**一次只提一个要求**，说得越清楚，AI 做得越准。

### 5. 一步步做出游戏（30 分钟）

三步分别对应游戏的三个要素，每步 8–10 分钟；每完成一步，全班一起试玩 30 秒再进入下一步：

1. 主角登场：角色出现在画面底部，能用方向键左右移动。（玩家与操控）
2. 陨石来袭：陨石随机落下，被砸到扣一颗心，角色闪一下。（障碍、碰撞与反馈）
3. 一局 60 秒：开始按钮、倒计时、计分、越来越难、结算画面。（规则与胜负）

巡堂时重点看两件事：学生是不是一次塞了太多要求；AI 改坏了时，引导学生用一句话说清"哪里不对"，而不是把整段提示词重发一遍。

### 6. 自由改造 + 互相试玩（10 分钟）

- 同桌交换电脑，玩一局对方的游戏，说出一个"可以更好玩"的地方。
- 回到自己的电脑，用自己的话让 AI 改。可选方向：掉下来的爱心可以回血、护盾道具、被砸到的音效、调整难度。
- 这一步练的是「试玩 → 说出问题 → 让 AI 修改」，这就是程序员每天在做的调试。

### 7. 展示与总结（5 分钟）

- 投屏 2–3 个作品，现场挑战，比谁坚持得最久。
- 总结：今天用了**提示词工程**画主角，用 **Vibe Coding** 做游戏；一个游戏 = 主角 + 障碍 + 规则。
- 提醒学生点「提交作品」。分享页可以发给家长，在手机上也能玩。

### 常见问题

- 按键没反应：先用鼠标点一下游戏画面，再按方向键。
- AI 一下子把计时、计分都做好了：没关系，让学生对照后面的任务检查一遍，看看还缺什么。
- 角色太大或太小：直接告诉 AI"角色再小一点"。
- 画面全黑、角色不见了：把看到的情况告诉 AI，比如"现在画面全黑了，角色不见了"，让它修。`;

const lesson4: LessonDef = {
  index: 4,
  title: "陨石大逃亡",
  subtitle: "画主角，做游戏",
  kind: "MIXED",
  ready: true,
  spareFrames: 0,
  codingMaxTurns: 12,
  codingScaffold: "dodge",
  objectives: [
    "**知识目标**：掌握提示词的五个部分（主体、外观、动作、画风、用途），理解「用途」会决定画面要求；知道一个游戏由主角、障碍、规则三部分组成。",
    "**能力目标**：能写出一段适合做游戏角色的提示词；能把一个游戏拆成几步，一步步描述给 AI，并在试玩中发现问题、提出修改。",
    "**情感目标**：一节课从零做出能玩、能分享的游戏，体验当「游戏设计师」的成就感。",
  ].join("\n\n"),
  lessonPlan: lesson4Plan,
  codingClaudeMd: [
    "## 本节课：躲避陨石小游戏",
    "- 学生是 9–12 岁的小学生，正在分几步做一个「躲避陨石」的小游戏。回复要简短、口语化、有鼓励性，不超过 3 句话：做好了什么、怎么玩、下一步可以试什么。不要说「我还没试玩/测试过」这类话。",
    "- 只做学生这一次要求的内容。学生没提到的功能（开始按钮、计分、倒计时、道具、音效等）先不要加，留给后面的步骤。",
    "- 游戏画在 index.html 里一个铺满窗口的 <canvas> 上，逻辑写在 app.js，页面样式写在 style.css。",
    "- 用 requestAnimationFrame 做游戏循环，按两帧之间的时间差计算移动，保证不同电脑上速度一样。",
    "- 画面要适配窗口大小：手机竖屏和电脑横屏都能玩，窗口变化时重新计算尺寸；用 devicePixelRatio 保持清晰。顶部的爱心、得分、倒计时在窄屏上要跟着缩小，不能互相重叠。",
    "- 主角图片是 assets/hero.png（透明背景），按原比例绘制，高度约为画面高度的 1/6（最小 64px，最大 160px）。碰撞判定用比图片小一圈的范围，让游戏不那么憋屈。如果 assets/hero.png 不存在，先用一个简单的图形代替主角。",
    "- 操控同时支持键盘（← → 和 A / D）和触屏（按住屏幕左半边往左、右半边往右）。在画面底部用一行小字提示：「先点一下画面，再用 ← → 移动」（触屏设备上提示「按住左右两边移动」）。",
    "- 不加载任何外部资源；陨石、星星、爱心等用 canvas 自己画；需要声音时用 Web Audio 现场生成。",
    "- 每次改完，游戏都要能直接运行、不报错。已有代码时用 Edit 只改需要改的部分，比整个重写更快。",
  ].join("\n"),
  tasks: [
    {
      title: "任务一：画出游戏主角",
      description: "先想好你的主角：它是谁？长什么样？在做什么？你有 3 次机会，每次多写具体一点，最后选一张最满意的当主角。",
      kind: "CANVAS",
      frames: [
        {
          key: "hero",
          type: "IMAGE",
          title: "游戏主角框",
          promptTemplate:
            "一个游戏主角：{{character}}，{{look}}，{{pose}}，{{style}}。全身、居中、正面，画面里只有这一个角色，不要背景、文字和地面阴影",
          slots: [
            { key: "character", label: "角色是谁", default: "一只小橘猫", options: ["一只小橘猫", "一个小机器人", "一只小恐龙", "一个小宇航员"] },
            { key: "look", label: "长什么样", default: "戴着圆圆的宇航员头盔，背着小火箭背包" },
            { key: "pose", label: "在做什么", default: "张开双手向前奔跑", options: ["张开双手向前奔跑", "侧身做出闪避的动作", "举起拳头加油", "开心地跳起来"] },
            { key: "style", label: "画风", default: "可爱的 3D 卡通风格", options: ["可爱的 3D 卡通风格", "复古像素游戏风格", "日系动漫风格", "手绘水彩风格"] },
          ],
          aspectRatio: "1:1",
          maxGenerations: 3,
          blockCategories: ["detail"],
          transparent: true,
          pos: [0, 0],
        },
      ],
    },
    {
      title: "任务二：主角登场",
      description: "让你的主角出现在游戏里，能左右移动。",
      kind: "CODING",
      codingPrompt:
        "帮我做一个躲避游戏的第一步：深色的星空背景，我的主角（assets/hero.png）站在画面底部中间。按键盘 ← → 键可以左右移动，手机上按住屏幕左半边往左、按住右半边往右。主角不能跑出屏幕。",
    },
    {
      title: "任务三：陨石来袭",
      description: "加入会掉下来的陨石，被砸到要扣血。",
      kind: "CODING",
      codingPrompt:
        "加入陨石：陨石不停地从屏幕上方随机位置掉下来，大小和速度各不相同，还会慢慢旋转。主角被陨石砸到就扣一颗心，一共 3 颗心，显示在左上角；被砸到时主角闪一下，屏幕轻轻震动。",
    },
    {
      title: "任务四：一局 60 秒",
      description: "加上规则，变成一局完整的游戏。",
      kind: "CODING",
      codingPrompt:
        "加上游戏规则：打开时先显示游戏名字和「开始游戏」按钮；一局 60 秒，右上角显示倒计时；每躲过一颗陨石加 1 分，显示在顶部中间；越往后陨石越多、越快。坚持到 60 秒就是挑战成功，3 颗心扣光就是挑战失败，结束时显示坚持了几秒、得了多少分，还有「再来一局」按钮。",
    },
    {
      title: "自由改造",
      description: "先玩一局，再想想哪里还能更好玩：掉下来的爱心可以回血、加护盾、被砸到有音效、调难度……用你自己的话告诉 AI。",
      kind: "FREE",
      codingPrompt: "我玩了一局，想让游戏更好玩：",
    },
  ],
};

const S1_PLACEHOLDERS: [number, string, string, "CANVAS" | "CODING"][] = [
  [5, "魔法画室", "一张图，三种画风", "CANVAS"],
  [6, "涂鸦变大片", "用参考图控制构图", "CANVAS"],
  [7, "绘本主角", "保持角色一致性", "CANVAS"],
  [8, "四格漫画", "分镜与叙事", "CANVAS"],
  [9, "名画动起来", "古画与图生视频", "CANVAS"],
  [10, "我的短片", "多镜头剪辑", "CANVAS"],
  [11, "AI 伙伴", "第一个智能体", "CODING"],
  [12, "诗词画卷", "古诗变插画", "CANVAS"],
  [13, "班级小助手", "知识库问答", "CODING"],
  [14, "对话网站", "网页里的聊天机器人", "CODING"],
  [15, "电子宠物", "整合图像、视频与代码", "CODING"],
  [16, "AI 思辨课", "作品归属与使用边界", "CANVAS"],
];

export const curriculum: CourseDef[] = [
  {
    code: "S1",
    title: "S1 · AI 创造力启蒙",
    description: "从文生图到第一个网页、第一个游戏：用 AI 把想象变成作品。16 节 × 90 分钟，适合 8–12 岁。",
    level: 1,
    lessons: [
      lesson1,
      lesson2,
      lesson3,
      lesson4,
      ...S1_PLACEHOLDERS.map(([index, title, subtitle, kind]) => ({ index, title, subtitle, kind, ready: false })),
    ],
  },
  {
    code: "S2",
    title: "S2 · AI 项目进阶",
    description: "多工具协作的项目式创作。（内容待设计）",
    level: 2,
    lessons: Array.from({ length: 16 }, (_, i) => ({
      index: i + 1,
      title: `第 ${i + 1} 节`,
      subtitle: "待设计",
      kind: "CANVAS" as const,
      ready: false,
    })),
  },
  {
    code: "S3",
    title: "S3 · 智能体与应用开发",
    description: "工作流、智能体与完整应用。（内容待设计）",
    level: 3,
    lessons: Array.from({ length: 16 }, (_, i) => ({
      index: i + 1,
      title: `第 ${i + 1} 节`,
      subtitle: "待设计",
      kind: "CODING" as const,
      ready: false,
    })),
  },
];
