// AI 教学一体化平台 — 数据模型（Drizzle + SQLite/libSQL）
// 层级：course(课包) → lesson(课节) → task(任务) → frameTemplate(框体模板)
// 运行时：classroom(课堂) → workspace(学生在某课堂的工作区) → frame(框体实例) → generation(一次生成)
// 额度以课节为单位：每个框体 maxGenerations 次；每节课 spareFrames 个备用框体；Vibe Coding 按轮数限制。

import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

const id = () => text("id").primaryKey().$defaultFn(() => nanoid(12));
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });

// ---------- 账号 ----------

export const users = sqliteTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["ADMIN", "TEACHER", "STUDENT"] }).notNull(),
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

// ---------- 课程内容 ----------

export const courses = sqliteTable("courses", {
  id: id(),
  code: text("code").notNull().unique(), // S1 / S2 / S3
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  level: integer("level").notNull(),
  createdAt: createdAt(),
});

export const lessons = sqliteTable(
  "lessons",
  {
    id: id(),
    courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    index: integer("idx").notNull(), // 1..16
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    // MIXED：同一节课里先在画布上生成素材，再用 Vibe Coding 做作品（如第 4 节：先画主角再做游戏）
    kind: text("kind", { enum: ["CANVAS", "CODING", "MIXED"] }).notNull(),
    ready: integer("ready", { mode: "boolean" }).notNull().default(false), // 内容是否已设计好
    durationMin: integer("duration_min").notNull().default(90),
    objectives: text("objectives").notNull().default(""), // markdown
    lessonPlan: text("lesson_plan").notNull().default(""), // 教案（占位）
    pptUrl: text("ppt_url"), // 占位
    // 额度配置
    spareFrames: integer("spare_frames").notNull().default(2),
    codingMaxTurns: integer("coding_max_turns").notNull().default(12),
    codingModel: text("coding_model").notNull().default(""),
    codingScaffold: text("coding_scaffold").notNull().default(""),
    codingClaudeMd: text("coding_claude_md").notNull().default(""),
  },
  (t) => [uniqueIndex("lesson_course_idx").on(t.courseId, t.index)],
);

export const tasks = sqliteTable("tasks", {
  id: id(),
  lessonId: text("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  order: integer("ord").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  kind: text("kind", { enum: ["CANVAS", "CODING", "FREE"] }).notNull(),
  codingPrompt: text("coding_prompt").notNull().default(""), // CODING 任务的预设提示词
});

export type Slot = { key: string; label: string; default: string; options?: string[] };

export const frameTemplates = sqliteTable("frame_templates", {
  id: id(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  key: text("key").notNull(), // 课节内唯一，用于连线引用
  order: integer("ord").notNull().default(0),
  type: text("type", { enum: ["IMAGE", "VIDEO", "TEXT"] }).notNull(),
  title: text("title").notNull(),
  promptTemplate: text("prompt_template").notNull(), // 含 {{slot}}
  slots: text("slots", { mode: "json" }).$type<Slot[]>().notNull().default([]),
  aspectRatio: text("aspect_ratio").notNull().default("1:1"),
  maxGenerations: integer("max_generations").notNull().default(3),
  upstreamKeys: text("upstream_keys", { mode: "json" }).$type<string[]>().notNull().default([]),
  // 跨课节引用：取同一学生在某课节某框体的选定输出，如 ["S1-1:fusion"]
  crossLessonRefs: text("cross_lesson_refs", { mode: "json" }).$type<string[]>().notNull().default([]),
  // 这个框体开放哪些类别的提示词积木（空 = 按框体类型用默认类别）
  blockCategories: text("block_categories", { mode: "json" }).$type<string[]>().notNull().default([]),
  // 生成透明背景的图片（游戏角色贴图等）
  transparentBg: integer("transparent_bg", { mode: "boolean" }).notNull().default(false),
  posX: real("pos_x").notNull().default(0),
  posY: real("pos_y").notNull().default(0),
});

// ---------- 授权与课堂 ----------

export const licenses = sqliteTable(
  "licenses",
  {
    id: id(),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    grantedById: text("granted_by_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("license_unique").on(t.studentId, t.courseId)],
);

export const classrooms = sqliteTable("classrooms", {
  id: id(),
  name: text("name").notNull(),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  courseId: text("course_id").notNull().references(() => courses.id),
  lessonId: text("lesson_id").notNull().references(() => lessons.id),
  status: text("status", { enum: ["READY", "LIVE", "ENDED"] }).notNull().default("READY"),
  spotlightSubmissionId: text("spotlight_submission_id"), // 老师投屏展示的作品
  startedAt: ts("started_at"),
  endedAt: ts("ended_at"),
  createdAt: createdAt(),
});

export const classroomStudents = sqliteTable(
  "classroom_students",
  {
    classroomId: text("classroom_id").notNull().references(() => classrooms.id, { onDelete: "cascade" }),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    addedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.classroomId, t.studentId] })],
);

// ---------- 学生工作区（一个学生在一个课堂里的全部状态） ----------

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: id(),
    classroomId: text("classroom_id").notNull().references(() => classrooms.id, { onDelete: "cascade" }),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    currentTaskId: text("current_task_id"),
    spareUsed: integer("spare_used").notNull().default(0),
    // Vibe Coding
    agentSessionId: text("agent_session_id"),
    codingTurnsUsed: integer("coding_turns_used").notNull().default(0),
    codingBusy: integer("coding_busy", { mode: "boolean" }).notNull().default(false),
    lastActiveAt: ts("last_active_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("workspace_unique").on(t.classroomId, t.studentId)],
);

export const frames = sqliteTable(
  "frames",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    templateId: text("template_id"),
    taskId: text("task_id"), // 备用框体为 null
    key: text("key").notNull(),
    type: text("type", { enum: ["IMAGE", "VIDEO", "TEXT"] }).notNull(),
    title: text("title").notNull(),
    isSpare: integer("is_spare", { mode: "boolean" }).notNull().default(false),
    prompt: text("prompt").notNull().default(""),
    slotValues: text("slot_values", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
    aspectRatio: text("aspect_ratio").notNull().default("1:1"),
    upstreamFrameIds: text("upstream_frame_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
    // 学生拼上去的提示词积木（存文本快照，积木库之后改动不影响已用的）
    blocks: text("blocks", { mode: "json" }).$type<PickedBlock[]>().notNull().default([]),
    maxGenerations: integer("max_generations").notNull(),
    usedCount: integer("used_count").notNull().default(0),
    selectedGenerationId: text("selected_generation_id"),
    posX: real("pos_x").notNull().default(0),
    posY: real("pos_y").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("frame_ws").on(t.workspaceId)],
);

export const generations = sqliteTable(
  "generations",
  {
    id: id(),
    frameId: text("frame_id").notNull().references(() => frames.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"] }).notNull().default("QUEUED"),
    prompt: text("prompt").notNull(),
    refPaths: text("ref_paths", { mode: "json" }).$type<string[]>().notNull().default([]),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    outputPath: text("output_path"), // 相对 DATA_DIR
    outputText: text("output_text"), // 生文字框体的结果
    finalPrompt: text("final_prompt"), // 实际发给模型的提示词（含积木、上游文字、平台规则）
    error: text("error"),
    createdAt: createdAt(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    latencyMs: integer("latency_ms"),
  },
  (t) => [index("gen_frame").on(t.frameId)],
);

// ---------- Vibe Coding ----------

export const codingMessages = sqliteTable(
  "coding_messages",
  {
    id: id(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    runId: text("run_id"),
    seq: integer("seq").notNull().default(0),
    role: text("role", { enum: ["user", "assistant", "tool", "system"] }).notNull(),
    content: text("content", { mode: "json" }).$type<unknown>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("msg_ws").on(t.workspaceId)],
);

export const agentRuns = sqliteTable("agent_runs", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  status: text("status", { enum: ["RUNNING", "DONE", "ERROR", "STOPPED"] }).notNull().default("RUNNING"),
  provider: text("provider").notNull(), // claude | mock
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  numTurns: integer("num_turns").notNull().default(0),
  ttftMs: integer("ttft_ms"), // 首个流式输出
  firstPreviewMs: integer("first_preview_ms"), // 首次文件写入（预览可见）
  totalMs: integer("total_ms"),
  error: text("error"),
  createdAt: createdAt(),
});

// ---------- 作品与用量 ----------

export const submissions = sqliteTable("submissions", {
  id: id(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["IMAGE", "VIDEO", "WEB", "TEXT"] }).notNull(),
  title: text("title").notNull(),
  path: text("path").notNull(), // IMAGE/VIDEO：文件；WEB：快照目录（相对 DATA_DIR）
  coverPath: text("cover_path"),
  frameKey: text("frame_key"),
  textContent: text("text_content"), // 文字作品
  // 创作过程：给分享页展示「孩子是怎么做出来的」
  process: text("process", { mode: "json" }).$type<WorkProcess | null>(),
  shareToken: text("share_token").notNull().unique(),
  createdAt: createdAt(),
});

export const usageRecords = sqliteTable(
  "usage_records",
  {
    id: id(),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    classroomId: text("classroom_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    kind: text("kind", { enum: ["IMAGE", "VIDEO", "TEXT", "CODING"] }).notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    units: integer("units").notNull().default(1), // 图片张数 / 视频条数 / 对话轮数
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    latencyMs: integer("latency_ms"),
    refId: text("ref_id"),
    success: integer("success", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("usage_student").on(t.studentId), index("usage_lesson").on(t.lessonId)],
);

// ---------- 提示词：积木库 + 平台规则 ----------

export type PickedBlock = { id: string; category: string; label: string; text: string };

export type WorkProcess = {
  kind: "canvas" | "coding" | "mixed"; // mixed：先在画布上生成素材，再编程
  steps: { title: string; prompt: string; blocks?: string[]; refs?: string[]; attempts?: number; output?: string | null }[];
};

export const BLOCK_CATEGORIES = [
  { key: "subject", label: "主体" },
  { key: "detail", label: "细节" },
  { key: "scene", label: "场景" },
  { key: "style", label: "风格" },
  { key: "light", label: "光影" },
  { key: "camera", label: "镜头" },
  { key: "action", label: "动作" },
  { key: "fx", label: "特效" },
  { key: "tone", label: "语气" },
  { key: "format", label: "体裁" },
] as const;

export const promptBlocks = sqliteTable("prompt_blocks", {
  id: id(),
  category: text("category").notNull(),
  label: text("label").notNull(), // 学生看到的名字，如「宫崎骏童话」
  text: text("text").notNull(), // 拼进提示词的内容
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

/** 平台级配置（键值对），目前存平台层隐藏提示词 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export type PromptBlock = typeof promptBlocks.$inferSelect;
export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type FrameTemplate = typeof frameTemplates.$inferSelect;
export type Classroom = typeof classrooms.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type Frame = typeof frames.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
