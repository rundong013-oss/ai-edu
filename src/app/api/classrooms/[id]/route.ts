import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classrooms, classroomStudents, licenses, users, workspaces } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";
import { getOrCreateWorkspace } from "@/server/workspace";
import { prepareCodingProject } from "@/server/coding/project";
import { lessons } from "@/db/schema";

/** 开课 / 下课 / 改学生 / 投屏 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("TEACHER");
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  const room = await db.query.classrooms.findFirst({ where: and(eq(classrooms.id, id), eq(classrooms.teacherId, s.uid)) });
  if (!room) return jsonError(404, "课堂不存在");
  const body = (await req.json()) as { action: "start" | "end" | "reopen" | "spotlight" | "students"; submissionId?: string | null; studentIds?: string[] };

  if (body.action === "start") {
    await db.update(classrooms).set({ status: "LIVE", startedAt: room.startedAt ?? new Date(), endedAt: null }).where(eq(classrooms.id, id));
    // 预热：给每个学生建好工作区（编程课同时准备项目目录），学生进来就能直接开始
    const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, room.lessonId) });
    const members = await db.query.classroomStudents.findMany({ where: eq(classroomStudents.classroomId, id) });
    for (const m of members) {
      const ws = await getOrCreateWorkspace(id, m.studentId);
      if (lesson?.kind === "CODING") await prepareCodingProject(ws.id);
    }
  } else if (body.action === "end") {
    await db.update(classrooms).set({ status: "ENDED", endedAt: new Date() }).where(eq(classrooms.id, id));
  } else if (body.action === "reopen") {
    await db.update(classrooms).set({ status: "LIVE", endedAt: null }).where(eq(classrooms.id, id));
  } else if (body.action === "spotlight") {
    await db.update(classrooms).set({ spotlightSubmissionId: body.submissionId ?? null }).where(eq(classrooms.id, id));
  } else if (body.action === "students") {
    const ids = body.studentIds ?? [];
    const licensed = ids.length
      ? await db.query.licenses.findMany({ where: and(eq(licenses.courseId, room.courseId), inArray(licenses.studentId, ids)) })
      : [];
    const ok = new Set(licensed.map((l) => l.studentId));
    const bad = ids.filter((x) => !ok.has(x));
    if (bad.length) {
      const names = await db.query.users.findMany({ where: inArray(users.id, bad) });
      return jsonError(400, `${names.map((n) => n.name).join("、")} 还没有被授权这个课包`);
    }
    await db.delete(classroomStudents).where(eq(classroomStudents.classroomId, id));
    if (ids.length) await db.insert(classroomStudents).values(ids.map((sid) => ({ classroomId: id, studentId: sid })));
  }
  const updated = await db.query.classrooms.findFirst({ where: eq(classrooms.id, id) });
  return Response.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("TEACHER");
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  const room = await db.query.classrooms.findFirst({ where: and(eq(classrooms.id, id), eq(classrooms.teacherId, s.uid)) });
  if (!room) return jsonError(404, "课堂不存在");
  const used = await db.query.workspaces.findFirst({ where: eq(workspaces.classroomId, id) });
  if (used && room.status !== "READY") return jsonError(400, "已经上过课的课堂不能删除");
  await db.delete(classrooms).where(eq(classrooms.id, id));
  return Response.json({ ok: true });
}
