import { apiSession, jsonError } from "@/lib/auth";
import { getClassroomFull, getOrCreateWorkspace, isStudentInClassroom } from "@/server/workspace";
import { prepareCodingProject } from "@/server/coding/project";
import { hasCoding } from "@/lib/lesson";

/** 学生进入课堂：开课后才能进；首次进入时创建工作区（画布框体 / 编程项目目录） */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("STUDENT");
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  if (!(await isStudentInClassroom(id, s.uid))) return jsonError(403, "老师还没把你加进这个课堂");
  const full = await getClassroomFull(id);
  if (!full) return jsonError(404, "课堂不存在");
  if (full.room.status === "READY") return jsonError(409, "等待开课");
  const ws = await getOrCreateWorkspace(id, s.uid);
  if (hasCoding(full.lesson.kind)) await prepareCodingProject(ws.id);
  return Response.json({ workspaceId: ws.id, kind: full.lesson.kind });
}
