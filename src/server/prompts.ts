// 提示词分层：
//   平台层（隐藏，学生看不到也改不掉）→ 课节/框体模板（填空）→ 学生积木 → 上游素材（参考图 / 上游文字）
// 平台层规则存在 settings 表，机构后台「提示词」页可编辑；这里是默认值。
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { promptBlocks, settings, type PickedBlock } from "@/db/schema";

export const PLATFORM_DEFAULTS = {
  "rules.image":
    "画面适合 8–16 岁儿童观看：不出现血腥暴力、恐怖惊吓、色情暴露、吸烟饮酒、真实存在的人物肖像和品牌商标；除非提示词明确要求写字，画面里不要出现文字、水印和签名。",
  "rules.video":
    "视频内容适合 8–16 岁儿童观看：不出现血腥暴力、恐怖惊吓、色情暴露、危险模仿动作和真实存在的人物；动作流畅、镜头稳定。",
  "rules.text":
    "你是陪 8–16 岁学生创作的 AI 写作伙伴。用简体中文，语言生动、积极、适合儿童；不写暴力、恐怖、色情、歧视内容，不编造真实人物的言论；不索要或输出任何个人信息。直接给出作品本身，不要解释你在做什么。用纯文本分段书写，不要使用 Markdown 符号（如 **、#、-）。",
  "rules.coding":
    "这是给中小学生用的网页创作课。不要在网页里收集真实姓名、电话、住址、学校等个人信息；不要加载任何外部网站的脚本、字体或图片；内容适合儿童。",
  // 学生输入里出现这些词时直接拦下，并提示换一种说法（每行一个）
  "rules.blocklist": ["血腥", "杀人", "自杀", "自残", "裸体", "色情", "毒品", "吸毒", "枪杀", "恐怖袭击", "斩首"].join("\n"),
} as const;
export type SettingKey = keyof typeof PLATFORM_DEFAULTS;

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return row?.value ?? PLATFORM_DEFAULTS[key];
}

export async function getAllSettings() {
  const rows = await db.select().from(settings);
  return Object.fromEntries(
    (Object.keys(PLATFORM_DEFAULTS) as SettingKey[]).map((k) => [k, rows.find((r) => r.key === k)?.value ?? PLATFORM_DEFAULTS[k]]),
  ) as Record<SettingKey, string>;
}

export async function setSetting(key: SettingKey, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** 输入检查：命中屏蔽词返回提示语，否则返回 null */
export async function checkPrompt(text: string): Promise<string | null> {
  const words = (await getSetting("rules.blocklist")).split(/\n+/).map((w) => w.trim()).filter(Boolean);
  const hit = words.find((w) => text.includes(w));
  return hit ? `提示词里有不适合课堂的内容（「${hit}」），换一种说法试试` : null;
}

/** 每种框体默认开放的积木类别（课节模板没指定时使用） */
export const DEFAULT_BLOCK_CATEGORIES: Record<"IMAGE" | "VIDEO" | "TEXT", string[]> = {
  IMAGE: ["style", "light", "camera", "scene", "detail"],
  VIDEO: ["action", "camera", "fx", "style"],
  TEXT: ["format", "tone"],
};

/** 校验学生选的积木：必须存在、启用、属于本框体开放的类别；返回文本快照 */
export async function resolveBlocks(ids: string[], allowed: string[]): Promise<PickedBlock[]> {
  if (!ids.length) return [];
  const rows = await db.query.promptBlocks.findMany({ where: inArray(promptBlocks.id, ids.slice(0, 8)) });
  return ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r && r.enabled && allowed.includes(r.category))
    .map((r) => ({ id: r.id, category: r.category, label: r.label, text: r.text }));
}

/** 拼出最终发给模型的提示词 */
export async function composePrompt(o: {
  type: "IMAGE" | "VIDEO" | "TEXT";
  studentPrompt: string;
  blocks: PickedBlock[];
  upstreamTexts: { title: string; text: string }[];
}) {
  const parts = [o.studentPrompt.trim().replace(/[，。,.\s]+$/, "")];
  if (o.blocks.length) parts.push(o.blocks.map((b) => b.text).join("，"));
  let body = parts.join("，") + "。";
  if (o.upstreamTexts.length) {
    body += "\n\n" + o.upstreamTexts.map((u) => `【${u.title}】\n${u.text.slice(0, 1200)}`).join("\n\n");
  }
  if (o.type === "TEXT") return { prompt: body, system: await getSetting("rules.text") };
  const rule = await getSetting(o.type === "VIDEO" ? "rules.video" : "rules.image");
  return { prompt: `${body}\n\n（要求：${rule}）`, system: null };
}

/** 默认积木库（seed 时写入；之后在机构后台增删改） */
export const DEFAULT_BLOCKS: { category: string; label: string; text: string }[] = [
  // 风格
  { category: "style", label: "3D 卡通", text: "3D 卡通渲染风格，圆润可爱" },
  { category: "style", label: "宫崎骏童话", text: "宫崎骏动画风格，温暖的水彩质感" },
  { category: "style", label: "赛博朋克", text: "赛博朋克风格，霓虹灯光与金属质感" },
  { category: "style", label: "水墨国风", text: "中国水墨画风格，留白与晕染" },
  { category: "style", label: "像素游戏", text: "复古像素游戏风格，8-bit 色块" },
  { category: "style", label: "黏土动画", text: "黏土定格动画风格，手工捏制质感" },
  { category: "style", label: "绘本插画", text: "儿童绘本插画风格，柔和的彩铅笔触" },
  { category: "style", label: "电影写实", text: "电影级写实风格，细节丰富" },
  // 光影
  { category: "light", label: "金色夕阳", text: "金色夕阳逆光，温暖的光晕" },
  { category: "light", label: "霓虹夜景", text: "夜晚霓虹灯照明，蓝紫色调" },
  { category: "light", label: "柔和晨光", text: "清晨柔和的自然光" },
  { category: "light", label: "舞台聚光", text: "舞台聚光灯打在主角身上，背景较暗" },
  { category: "light", label: "梦幻星光", text: "梦幻的星光和发光粒子环绕" },
  // 镜头 / 构图
  { category: "camera", label: "全身像", text: "全身像，主角居中" },
  { category: "camera", label: "特写", text: "面部特写，背景虚化" },
  { category: "camera", label: "仰拍", text: "低角度仰拍，显得高大有气势" },
  { category: "camera", label: "俯瞰全景", text: "高空俯瞰的全景构图" },
  { category: "camera", label: "缓慢推近", text: "镜头缓慢推近" },
  { category: "camera", label: "环绕旋转", text: "镜头围绕主角环绕旋转" },
  // 场景
  { category: "scene", label: "未来城市", text: "背景是未来城市，高楼与飞行器" },
  { category: "scene", label: "神秘森林", text: "背景是神秘的发光森林" },
  { category: "scene", label: "外太空", text: "背景是外太空，星球与星云" },
  { category: "scene", label: "海底世界", text: "背景是海底世界，珊瑚和气泡" },
  { category: "scene", label: "古代宫殿", text: "背景是中国古代宫殿" },
  // 细节
  { category: "detail", label: "超精细", text: "超精细的细节，高清画质" },
  { category: "detail", label: "大眼睛萌系", text: "大眼睛，表情可爱" },
  { category: "detail", label: "发光纹路", text: "身上有发光的能量纹路" },
  // 动作（视频）
  { category: "action", label: "转身挥手", text: "主角转身向镜头挥手" },
  { category: "action", label: "奔跑跳跃", text: "主角向前奔跑然后高高跳起" },
  { category: "action", label: "变身发光", text: "主角全身发光并完成变身" },
  { category: "action", label: "飞上天空", text: "主角腾空而起飞向天空" },
  // 特效（视频）
  { category: "fx", label: "金色粒子", text: "四周飘起金色粒子" },
  { category: "fx", label: "能量冲击波", text: "释放出一圈能量冲击波" },
  { category: "fx", label: "花瓣飘落", text: "花瓣缓缓飘落" },
  { category: "fx", label: "闪电雷光", text: "背景划过闪电" },
  // 体裁（文字）
  { category: "format", label: "角色档案", text: "写成角色档案的格式，分条列出" },
  { category: "format", label: "小故事", text: "写成一个有开头、经过、结尾的小故事" },
  { category: "format", label: "儿童诗", text: "写成一首押韵的儿童诗" },
  { category: "format", label: "出场台词", text: "写成角色出场时的一段台词" },
  // 语气（文字）
  { category: "tone", label: "热血", text: "语气热血、充满力量" },
  { category: "tone", label: "幽默", text: "语气幽默、让人发笑" },
  { category: "tone", label: "温柔", text: "语气温柔、治愈" },
  { category: "tone", label: "神秘", text: "语气神秘、有悬念" },
];
