import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";

export async function POST(req: Request) {
  if (!(await apiSession("ADMIN"))) return jsonError(401, "需要机构管理员权限");
  const { role, username, name, password } = (await req.json()) as { role: "TEACHER" | "STUDENT" | "ADMIN"; username: string; name: string; password?: string };
  if (!["TEACHER", "STUDENT", "ADMIN"].includes(role)) return jsonError(400, "角色不对");
  if (!/^[\w.-]{2,32}$/.test(username ?? "")) return jsonError(400, "账号只能用字母、数字、下划线，2–32 位");
  if (!name?.trim()) return jsonError(400, "请填写姓名");
  if (await db.query.users.findFirst({ where: eq(users.username, username) })) return jsonError(400, "这个账号已经存在");
  const [u] = await db
    .insert(users)
    .values({ role, username, name: name.trim(), passwordHash: bcrypt.hashSync(password || "123456", 10) })
    .returning({ id: users.id });
  return Response.json(u);
}
