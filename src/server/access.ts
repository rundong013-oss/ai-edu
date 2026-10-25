import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classrooms, frames, workspaces } from "@/db/schema";
import type { SessionData } from "@/lib/session";

/** 学生只能操作自己的工作区；老师可以查看自己课堂里的工作区；管理员可查看全部 */
export async function loadWorkspaceFor(s: SessionData, workspaceId: string, mode: "read" | "write") {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) return null;
  const room = await db.query.classrooms.findFirst({ where: eq(classrooms.id, ws.classroomId) });
  if (!room) return null;
  if (s.role === "STUDENT") {
    if (ws.studentId !== s.uid) return null;
  } else if (mode === "write") {
    return null;
  } else if (s.role === "TEACHER" && room.teacherId !== s.uid) {
    return null;
  }
  return { ws, room };
}

export async function loadFrameFor(s: SessionData, frameId: string, mode: "read" | "write") {
  const f = await db.query.frames.findFirst({ where: eq(frames.id, frameId) });
  if (!f) return null;
  const r = await loadWorkspaceFor(s, f.workspaceId, mode);
  return r ? { ...r, frame: f } : null;
}
