// 画布生成：额度原子扣减 → 异步调用模型 → 落盘 → 记用量。失败会退回本次次数。
import fs from "node:fs";
import path from "node:path";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { classrooms, courses, frames, generations, lessons, usageRecords, workspaces, type Frame } from "@/db/schema";
import { dataPath, ensureDir, mimeOf, rel } from "@/lib/paths";
import { imageProvider, videoProvider } from "./providers";

export class QuotaError extends Error {}

/** 找到某学生在「课程代码-课节序号:框体key」上的选定输出（跨课节引用） */
async function crossLessonRef(studentId: string, ref: string): Promise<string | null> {
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
      if (g?.outputPath) return g.outputPath;
    }
  }
  return null;
}

/** 收集参考图：上游框体的选定输出 + 跨课节引用 */
export async function collectRefs(frame: Frame, studentId: string, crossRefs: string[]) {
  const out: string[] = [];
  if (frame.upstreamFrameIds.length) {
    const ups = await db.query.frames.findMany({ where: inArray(frames.id, frame.upstreamFrameIds) });
    for (const u of ups) {
      if (!u.selectedGenerationId) continue;
      const g = await db.query.generations.findFirst({ where: eq(generations.id, u.selectedGenerationId) });
      if (g?.outputPath) out.push(g.outputPath);
    }
  }
  for (const r of crossRefs) {
    const p = await crossLessonRef(studentId, r);
    if (p) out.push(p);
  }
  return out;
}

export async function startGeneration(opts: {
  frame: Frame;
  workspaceId: string;
  studentId: string;
  classroomId: string;
  lessonId: string;
  prompt: string;
  crossRefs: string[];
}) {
  const { frame } = opts;
  if (!opts.prompt.trim()) throw new QuotaError("提示词不能为空");

  // 1) 原子扣减：只有 used_count < max 时才 +1，防止连点刷次数
  const res = await db
    .update(frames)
    .set({ usedCount: sql`${frames.usedCount} + 1` })
    .where(and(eq(frames.id, frame.id), lt(frames.usedCount, frames.maxGenerations)))
    .returning({ used: frames.usedCount });
  if (!res.length) throw new QuotaError("这个框体的生成次数用完了，可以用备用框体继续创作");

  const refPaths = await collectRefs(frame, opts.studentId, opts.crossRefs);
  const provider = frame.type === "VIDEO" ? videoProvider() : imageProvider();
  const [gen] = await db
    .insert(generations)
    .values({
      frameId: frame.id,
      workspaceId: opts.workspaceId,
      status: "RUNNING",
      prompt: opts.prompt,
      refPaths,
      provider: provider.name,
      model: provider.model,
      startedAt: new Date(),
    })
    .returning();

  // 2) 异步执行（Node 常驻进程里跑，前端轮询状态）
  void runGeneration(gen.id, { ...opts, refPaths, aspectRatio: frame.aspectRatio, type: frame.type });
  return gen;
}

async function runGeneration(
  genId: string,
  o: { frame: Frame; studentId: string; classroomId: string; lessonId: string; prompt: string; refPaths: string[]; aspectRatio: string; type: "IMAGE" | "VIDEO" },
) {
  const t0 = Date.now();
  const provider = o.type === "VIDEO" ? videoProvider() : imageProvider();
  try {
    const refs = o.refPaths.map((p) => ({ abs: dataPath(p), mime: mimeOf(p) }));
    const r = await provider.generate({ prompt: o.prompt, aspectRatio: o.aspectRatio, refs });
    const dir = ensureDir(dataPath("media", o.studentId));
    const file = path.join(dir, `${nanoid(14)}.${r.ext}`);
    fs.writeFileSync(file, r.bytes);
    const latencyMs = Date.now() - t0;
    await db
      .update(generations)
      .set({ status: "SUCCEEDED", outputPath: rel(file), finishedAt: new Date(), latencyMs, model: r.model })
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
      provider: provider.name,
      model: r.model,
      units: 1,
      costUsd: r.costUsd,
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
      provider: provider.name,
      model: provider.model,
      units: 0,
      latencyMs: Date.now() - t0,
      refId: genId,
      success: false,
    });
  }
}
