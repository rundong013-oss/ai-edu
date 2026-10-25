import fs from "node:fs";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { frames, generations, submissions, workspaces } from "@/db/schema";
import { dataPath, ensureDir, projectDir, rel } from "@/lib/paths";

/** 提交画布作品：取框体当前选定的输出。同一框体重复提交 = 更新为最新选定 */
export async function submitFrame(workspaceId: string, frameId: string) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  const f = await db.query.frames.findFirst({ where: and(eq(frames.id, frameId), eq(frames.workspaceId, workspaceId)) });
  if (!ws || !f?.selectedGenerationId) return null;
  const g = await db.query.generations.findFirst({ where: eq(generations.id, f.selectedGenerationId) });
  if (!g?.outputPath) return null;
  const existing = await db.query.submissions.findFirst({
    where: and(eq(submissions.workspaceId, workspaceId), eq(submissions.frameKey, f.key)),
  });
  if (existing) {
    await db.update(submissions).set({ path: g.outputPath, coverPath: g.outputPath, createdAt: new Date() }).where(eq(submissions.id, existing.id));
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
      path: g.outputPath,
      coverPath: g.outputPath,
      frameKey: f.key,
      shareToken: nanoid(10),
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
  fs.cpSync(src, dest, { recursive: true, filter: (p) => !p.includes(`${"/"}.claude`) && !p.endsWith("CLAUDE.md") });
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
      shareToken: nanoid(10),
    })
    .returning();
  return s;
}
