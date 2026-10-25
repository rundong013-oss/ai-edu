import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { licenses } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";

/** 授权 / 取消授权课包 */
export async function POST(req: Request) {
  const s = await apiSession("ADMIN");
  if (!s) return jsonError(401, "需要机构管理员权限");
  const { studentId, courseId, grant } = (await req.json()) as { studentId: string; courseId: string; grant: boolean };
  if (grant) await db.insert(licenses).values({ studentId, courseId, grantedById: s.uid }).onConflictDoNothing();
  else await db.delete(licenses).where(and(eq(licenses.studentId, studentId), eq(licenses.courseId, courseId)));
  return Response.json({ ok: true });
}
