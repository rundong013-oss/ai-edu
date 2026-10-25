import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, signSession, ROLE_HOME } from "@/lib/session";

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  if (!username || !password) return Response.json({ error: "请输入账号和密码" }, { status: 400 });
  const u = await db.query.users.findFirst({ where: eq(users.username, username.trim()) });
  if (!u || u.disabled || !bcrypt.compareSync(password, u.passwordHash)) {
    return Response.json({ error: "账号或密码不对" }, { status: 401 });
  }
  const token = await signSession({ uid: u.id, role: u.role, name: u.name });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return Response.json({ ok: true, home: ROLE_HOME[u.role] });
}
