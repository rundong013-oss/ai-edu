import fs from "node:fs";
import { and, asc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { classrooms, codingMessages, frames, generations, lessons, submissions, workspaces, type Frame, type WorkProcess } from "@/db/schema";
import { dataPath, ensureDir, fileUrl, projectDir, rel } from "@/lib/paths";

/** 画布作品的创作过程：沿着连线往上找，按「先做的在前」列出每一步的提示词、积木、尝试次数和结果 */
async function canvasProcess(frame: Frame): Promise<WorkProcess> {
  const steps: WorkProcess["steps"] = [];
  const seen = new Set<string>();
  const visit = async (f: Frame, depth: number) => {
    if (seen.has(f.id) || depth > 4) return;
    seen.add(f.id);
    if (f.upstreamFrameIds.length) {
      const ups = await db.query.frames.findMany({ where: inArray(frames.id, f.upstreamFrameIds) });
      for (const u of ups) await visit(u, depth + 1);
    }
    const g = f.selectedGenerationId ? await db.query.generations.findFirst({ where: eq(generations.id, f.selectedGenerationId) }) : null;
    if (!g) return;
    steps.push({
      title: f.title.replace(/框$/, ""),
      prompt: g.prompt,
      blocks: f.blocks.map((b) => b.label),
      attempts: f.usedCount,
      output: f.type === "TEXT" ? g.outputText : fileUrl(g.outputPath),
    });
  };
  await visit(frame, 0);
  return { kind: "canvas", steps };
}

/** 提交画布作品：取框体当前选定的输出。同一框体重复提交 = 更新为最新选定 */
export async function submitFrame(workspaceId: string, frameId: string) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  const f = await db.query.frames.findFirst({ where: and(eq(frames.id, frameId), eq(frames.workspaceId, workspaceId)) });
  if (!ws || !f?.selectedGenerationId) return null;
  const g = await db.query.generations.findFirst({ where: eq(generations.id, f.selectedGenerationId) });
  if (!g?.outputPath) return null;
  const process = await canvasProcess(f);
  const fields = {
    path: g.outputPath,
    coverPath: f.type === "TEXT" ? null : g.outputPath,
    textContent: g.outputText,
    process,
    createdAt: new Date(),
  };
  const existing = await db.query.submissions.findFirst({
    where: and(eq(submissions.workspaceId, workspaceId), eq(submissions.frameKey, f.key)),
  });
  if (existing) {
    await db.update(submissions).set(fields).where(eq(submissions.id, existing.id));
    return existing;
  }
  const [s] = await db
    .insert(submissions)
    .values({
      workspaceId,
      studentId: ws.studentId,
      classroomId: ws.classroomId,
      type: f.type,
      title: f.title.replace(/框$/, ""),
      frameKey: f.key,
      shareToken: nanoid(10),
      ...fields,
    })
    .returning();
  return s;
}

/** 提交网页作品：把项目目录拍一个快照（之后学生继续改不影响已提交版本） */
export async function submitWeb(workspaceId: string, title: string, coverAsset: string | null) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) return null;
  const src = projectDir(workspaceId);
  if (!fs.existsSync(src)) return null;
  const snapId = nanoid(12);
  const dest = ensureDir(dataPath("submissions", snapId));
  fs.cpSync(src, dest, { recursive: true, filter: (p) => !p.includes("/.claude") && !p.endsWith("CLAUDE.md") });
  // 创作过程：学生发给 AI 的每一句话；混合课在前面加上画布上生成素材的那几步
  const room = await db.query.classrooms.findFirst({ where: eq(classrooms.id, ws.classroomId) });
  const lesson = room ? await db.query.lessons.findFirst({ where: eq(lessons.id, room.lessonId) }) : null;
  const mixed = lesson?.kind === "MIXED";
  const canvasSteps: WorkProcess["steps"] = [];
  if (mixed) {
    const fs_ = await db.query.frames.findMany({ where: and(eq(frames.workspaceId, workspaceId), eq(frames.isSpare, false)), orderBy: asc(frames.createdAt) });
    for (const f of fs_.filter((x) => x.selectedGenerationId)) {
      for (const st of (await canvasProcess(f)).steps) if (!canvasSteps.some((x) => x.output === st.output)) canvasSteps.push(st);
    }
  }
  const msgs = await db.query.codingMessages.findMany({ where: eq(codingMessages.workspaceId, workspaceId), orderBy: asc(codingMessages.seq) });
  const process: WorkProcess = {
    kind: mixed ? "mixed" : "coding",
    steps: [
      ...canvasSteps,
      ...msgs
        .filter((m) => m.role === "user")
        .map((m, i) => ({ title: mixed ? `编程 · 第 ${i + 1} 轮` : `第 ${i + 1} 轮`, prompt: String((m.content as { text?: string }).text ?? "") })),
    ],
  };
  const [s] = await db
    .insert(submissions)
    .values({
      workspaceId,
      studentId: ws.studentId,
      classroomId: ws.classroomId,
      type: "WEB",
      title: title || "我的网页",
      path: rel(dest),
      // 封面：项目里的某个素材（相对项目根目录，如 assets/fusion-1.png）→ 快照里的同一文件
      coverPath: coverAsset && /^assets\/[\w.-]+$/.test(coverAsset) && fs.existsSync(dataPath("submissions", snapId, coverAsset)) ? `${rel(dest)}/${coverAsset}` : null,
      process,
      shareToken: nanoid(10),
    })
    .returning();
  return s;
}
