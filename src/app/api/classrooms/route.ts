import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classrooms, classroomStudents, lessons, licenses, users } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";

/** 老师创建课堂：课堂名 → 课节 → 学生（只能加已授权该课包的学生） */
export async function POST(req: Request) {
  const s = await apiSession("TEACHER");
  if (!s) return jsonError(401, "请先登录");
  const { name, lessonId, studentIds = [] } = (await req.json()) as { name: string; lessonId: string; studentIds: string[] };
  if (!name?.trim()) return jsonError(400, "给课堂起个名字");
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) return jsonError(400, "请选择课节");
  if (!lesson.ready) return jsonError(400, "这节课的内容还没设计好，暂时不能开课");

  const licensed = studentIds.length
    ? await db.query.licenses.findMany({ where: and(eq(licenses.courseId, lesson.courseId), inArray(licenses.studentId, studentIds)) })
    : [];
  const ok = new Set(licensed.map((l) => l.studentId));
  const rejected = studentIds.filter((x) => !ok.has(x));
  if (rejected.length) {
    const names = await db.query.users.findMany({ where: inArray(users.id, rejected) });
    return jsonError(400, `${names.map((n) => n.name).join("、")} 还没有被授权这个课包，请联系机构管理员`);
  }

  const [room] = await db
    .insert(classrooms)
    .values({ name: name.trim(), teacherId: s.uid, courseId: lesson.courseId, lessonId: lesson.id })
    .returning();
  if (studentIds.length) await db.insert(classroomStudents).values(studentIds.map((sid) => ({ classroomId: room.id, studentId: sid })));
  return Response.json(room);
}
