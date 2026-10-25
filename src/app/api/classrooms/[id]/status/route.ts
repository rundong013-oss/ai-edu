import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classrooms } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";
import { isStudentInClassroom } from "@/server/workspace";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession();
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  const room = await db.query.classrooms.findFirst({ where: eq(classrooms.id, id) });
  if (!room) return jsonError(404, "课堂不存在");
  if (s.role === "STUDENT" && !(await isStudentInClassroom(id, s.uid))) return jsonError(403, "你不在这个课堂里");
  return Response.json({ status: room.status, spotlightSubmissionId: room.spotlightSubmissionId });
}
