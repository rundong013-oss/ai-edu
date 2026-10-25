// 课程内容定义。改这里 → `npm run db:seed` 重新写入数据库。
// 本期只填 S1 的前 3 节作为示例（文生图 / 图生视频 / Vibe Coding），其余为占位。

import type { Slot } from "@/db/schema";

export type FrameDef = {
  key: string;
  type: "IMAGE" | "VIDEO";
  title: string;
  promptTemplate: string;
  slots: Slot[];
  aspectRatio?: string;
  maxGenerations?: number;
  upstreamKeys?: string[];
  crossLessonRefs?: string[];
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
  kind: "CANVAS" | "CODING";
  ready: boolean;
  objectives?: string;
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
          pos: [420, 0],
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
          pos: [210, 520],
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

const S1_PLACEHOLDERS: [number, string, string, "CANVAS" | "CODING"][] = [
  [4, "魔法画室", "一张图，三种画风", "CANVAS"],
  [5, "涂鸦变大片", "用参考图控制构图", "CANVAS"],
  [6, "绘本主角", "保持角色一致性", "CANVAS"],
  [7, "四格漫画", "分镜与叙事", "CANVAS"],
  [8, "名画动起来", "古画与图生视频", "CANVAS"],
  [9, "我的短片", "多镜头剪辑", "CANVAS"],
  [10, "AI 伙伴", "第一个智能体", "CODING"],
  [11, "诗词画卷", "古诗变插画", "CANVAS"],
  [12, "班级小助手", "知识库问答", "CODING"],
  [13, "对话网站", "网页里的聊天机器人", "CODING"],
  [14, "互动小游戏", "规则与反馈", "CODING"],
  [15, "电子宠物", "整合图像、视频与代码", "CODING"],
  [16, "AI 思辨课", "作品归属与使用边界", "CANVAS"],
];

export const curriculum: CourseDef[] = [
  {
    code: "S1",
    title: "S1 · AI 创造力启蒙",
    description: "从文生图到第一个网页：用 AI 把想象变成作品。16 节 × 90 分钟，适合 8–12 岁。",
    level: 1,
    lessons: [
      lesson1,
      lesson2,
      lesson3,
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
