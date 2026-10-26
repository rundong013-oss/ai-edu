// 画布生成：输入检查 → 额度原子扣减 → 拼提示词（平台层 + 模板 + 积木 + 上游素材）→ 异步调用模型 → 落盘 → 记用量。
// 失败会退回本次次数。
import fs from "node:fs";
import path from "node:path";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { classrooms, courses, frames, frameTemplates, generations, lessons, usageRecords, workspaces, type Frame, type PickedBlock } from "@/db/schema";
import { dataPath, ensureDir, mimeOf, rel } from "@/lib/paths";
import { imageProvider, videoProvider } from "./providers";
import { generateText } from "./providers/text";
import { checkPrompt, composePrompt } from "./prompts";

export class QuotaError extends Error {}

/** 找到某学生在「课程代码-课节序号:框体key」上的选定输出（跨课节引用） */
async function crossLessonRef(studentId: string, ref: string) {
  const m = ref.match(/^(\w+)-(\d+):(\w+)$/);
  if (!m) return null;
  const [, code, idx, key] = m;
  const course = await db.query.courses.findFirst({ where: eq(courses.code, code) });
  if (!course) return null;
  const lesson = await db.query.lessons.findFirst({ where: and(eq(lessons.courseId, course.id), eq(lessons.index, Number(idx))) });
  if (!lesson) return null;
  const rooms = await db.query.classrooms.findMany({ where: eq(classrooms.lessonId, lesson.id) });
  if (!rooms.length) return null;
  const wss = await db.query.workspaces.findMany({
    where: and(eq(workspaces.studentId, studentId), inArray(workspaces.classroomId, rooms.map((r) => r.id))),
    orderBy: desc(workspaces.createdAt),
  });
  for (const w of wss) {
    const f = await db.query.frames.findFirst({ where: and(eq(frames.workspaceId, w.id), eq(frames.key, key)) });
    if (f?.selectedGenerationId) {
      const g = await db.query.generations.findFirst({ where: eq(generations.id, f.selectedGenerationId) });
      if (g?.outputPath) return { frame: f, gen: g };
    }
  }
  return null;
}

/** 收集上游素材：图片/视频作为参考图，文字框的结果作为参考文字 */
export async function collectInputs(frame: Frame, studentId: string, crossRefs: string[]) {
  const refPaths: string[] = [];
  const texts: { title: string; text: string }[] = [];
  const take = (f: Frame, g: typeof generations.$inferSelect) => {
    if (f.type === "TEXT") {
      if (g.outputText) texts.push({ title: f.title, text: g.outputText });
    } else if (g.outputPath) refPaths.push(g.outputPath);
  };
  if (frame.upstreamFrameIds.length) {
    const ups = await db.query.frames.findMany({ where: inArray(frames.id, frame.upstreamFrameIds) });
    for (const u of ups) {
      if (!u.selectedGenerationId) continue;
      const g = await db.query.generations.findFirst({ where: eq(generations.id, u.selectedGenerationId) });
      if (g) take(u, g);
    }
  }
  for (const r of crossRefs) {
    const x = await crossLessonRef(studentId, r);
    if (x) take(x.frame, x.gen);
  }
  return { refPaths, texts };
}

export async function startGeneration(opts: {
  frame: Frame;
  workspaceId: string;
  studentId: string;
  classroomId: string;
  lessonId: string;
  prompt: string;
  blocks: PickedBlock[];
  crossRefs: string[];
}) {
  const { frame } = opts;
  if (!opts.prompt.trim()) throw new QuotaError("提示词不能为空");
  const bad = await checkPrompt(opts.prompt + opts.blocks.map((b) => b.text).join(""));
  if (bad) throw new QuotaError(bad);

  // 1) 原子扣减：只有 used_count < max 时才 +1，防止连点刷次数
  const res = await db
    .update(frames)
    .set({ usedCount: sql`${frames.usedCount} + 1` })
    .where(and(eq(frames.id, frame.id), lt(frames.usedCount, frames.maxGenerations)))
    .returning({ used: frames.usedCount });
  if (!res.length) throw new QuotaError("这个框体的生成次数用完了，可以用备用框体继续创作");

  const { refPaths, texts } = await collectInputs(frame, opts.studentId, opts.crossRefs);
  const composed = await composePrompt({ type: frame.type, studentPrompt: opts.prompt, blocks: opts.blocks, upstreamTexts: texts });
  const provider = frame.type === "VIDEO" ? videoProvider() : frame.type === "IMAGE" ? imageProvider() : null;
  const [gen] = await db
    .insert(generations)
    .values({
      frameId: frame.id,
      workspaceId: opts.workspaceId,
      status: "RUNNING",
      prompt: opts.prompt,
      finalPrompt: composed.prompt,
      refPaths,
      provider: provider?.name ?? "claude",
      model: provider?.model ?? (process.env.TEXT_MODEL || "claude-haiku-5-5"),
      startedAt: new Date(),
    })
    .returning();

  // 2) 异步执行（Node 常驻进程里跑，前端轮询状态）
  const tpl = frame.templateId ? await db.query.frameTemplates.findFirst({ where: eq(frameTemplates.id, frame.templateId) }) : null;
  void runGeneration(gen.id, { ...opts, refPaths, composed, aspectRatio: frame.aspectRatio, type: frame.type, transparent: !!tpl?.transparentBg });
  return gen;
}

async function runGeneration(
  genId: string,
  o: {
    frame: Frame;
    studentId: string;
    classroomId: string;
    lessonId: string;
    refPaths: string[];
    composed: { prompt: string; system: string | null };
    aspectRatio: string;
    type: "IMAGE" | "VIDEO" | "TEXT";
    transparent: boolean;
  },
) {
  const t0 = Date.now();
  const usage = { provider: "", model: "", costUsd: 0, inputTokens: 0, outputTokens: 0 };
  try {
    const refs = o.refPaths.map((p) => ({ abs: dataPath(p), mime: mimeOf(p) }));
    const dir = ensureDir(dataPath("media", o.studentId));
    let outputPath: string, outputText: string | null = null;
    if (o.type === "TEXT") {
      const r = await generateText({ system: o.composed.system ?? "", prompt: o.composed.prompt, images: refs });
      const file = path.join(dir, `${nanoid(14)}.txt`);
      fs.writeFileSync(file, r.text);
      outputPath = rel(file);
      outputText = r.text;
      Object.assign(usage, { provider: r.model === "mock-text" ? "mock" : "claude", model: r.model, costUsd: r.costUsd, inputTokens: r.inputTokens, outputTokens: r.outputTokens });
    } else {
      const provider = o.type === "VIDEO" ? videoProvider() : imageProvider();
      const r = await provider.generate({ prompt: o.composed.prompt, aspectRatio: o.aspectRatio, refs, transparent: o.transparent && o.type === "IMAGE" });
      const file = path.join(dir, `${nanoid(14)}.${r.ext}`);
      fs.writeFileSync(file, r.bytes);
      outputPath = rel(file);
      Object.assign(usage, { provider: provider.name, model: r.model, costUsd: r.costUsd });
    }
    const latencyMs = Date.now() - t0;
    await db
      .update(generations)
      .set({ status: "SUCCEEDED", outputPath, outputText, finishedAt: new Date(), latencyMs, model: usage.model })
      .where(eq(generations.id, genId));
    // 还没有选定输出的框体，自动选中第一张成功的结果
    await db
      .update(frames)
      .set({ selectedGenerationId: genId })
      .where(and(eq(frames.id, o.frame.id), sql`${frames.selectedGenerationId} IS NULL`));
    await db.insert(usageRecords).values({
      studentId: o.studentId,
      classroomId: o.classroomId,
      lessonId: o.lessonId,
      kind: o.type,
      provider: usage.provider,
      model: usage.model,
      units: 1,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: usage.costUsd,
      latencyMs,
      refId: genId,
      success: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[generation] failed", genId, msg);
    await db
      .update(generations)
      .set({ status: "FAILED", error: msg.slice(0, 500), finishedAt: new Date(), latencyMs: Date.now() - t0 })
      .where(eq(generations.id, genId));
    // 失败不扣次数
    await db.update(frames).set({ usedCount: sql`max(${frames.usedCount} - 1, 0)` }).where(eq(frames.id, o.frame.id));
    await db.insert(usageRecords).values({
      studentId: o.studentId,
      classroomId: o.classroomId,
      lessonId: o.lessonId,
      kind: o.type,
      provider: usage.provider || "unknown",
      model: usage.model || "unknown",
      units: 0,
      latencyMs: Date.now() - t0,
      refId: genId,
      success: false,
    });
  }
}
