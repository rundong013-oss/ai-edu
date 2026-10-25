import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, workspaces } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { loadWorkspaceFor } from "@/server/access";
import { getClassroomFull } from "@/server/workspace";
import { CanvasRoom } from "@/components/canvas/CanvasRoom";
import { CodingRoom } from "@/components/coding/CodingRoom";

/** 老师只读查看某个学生的画布 / 编程过程 */
export default async function ViewWorkspace({ params }: { params: Promise<{ wsId: string }> }) {
  const s = await requireRole("TEACHER");
  const { wsId } = await params;
  const r = await loadWorkspaceFor(s, wsId, "read");
  if (!r) notFound();
  const full = await getClassroomFull(r.room.id);
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, wsId) });
  const stu = await db.query.users.findFirst({ where: eq(users.id, ws!.studentId) });
  const note = `正在查看 ${stu?.name ?? "学生"} 的${full!.lesson.kind === "CANVAS" ? "画布" : "项目"}（只读）`;
  const back = `/teacher/classrooms/${r.room.id}`;
  return full!.lesson.kind === "CODING" ? (
    <CodingRoom workspaceId={wsId} backHref={back} readOnly viewerNote={note} />
  ) : (
    <CanvasRoom workspaceId={wsId} backHref={back} readOnly viewerNote={note} />
  );
}
