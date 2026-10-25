import { apiSession, jsonError } from "@/lib/auth";
import { classroomLive } from "@/server/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("TEACHER");
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  const live = await classroomLive(id);
  if (!live || live.room.teacherId !== s.uid) return jsonError(404, "课堂不存在");
  return Response.json(live);
}
