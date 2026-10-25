import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE, signSession, ROLE_HOME } from "@/lib/session";

// 登录失败限流：同一 IP + 账号 15 分钟内最多失败 10 次（进程内存，单机够用）
const WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 10;
const g = globalThis as unknown as { __loginFails?: Map<string, { n: number; first: number }> };
const fails = (g.__loginFails ??= new Map());

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  if (!username || !password) return Response.json({ error: "请输入账号和密码" }, { status: 400 });
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const k = `${ip}|${username.trim()}`;
  const f = fails.get(k);
  if (f && Date.now() - f.first < WINDOW && f.n >= MAX_FAILS) {
    return Response.json({ error: "尝试次数太多，请 15 分钟后再试" }, { status: 429 });
  }
  const u = await db.query.users.findFirst({ where: eq(users.username, username.trim()) });
  if (!u || u.disabled || !bcrypt.compareSync(password, u.passwordHash)) {
    const cur = f && Date.now() - f.first < WINDOW ? f : { n: 0, first: Date.now() };
    fails.set(k, { ...cur, n: cur.n + 1 });
    return Response.json({ error: "账号或密码不对" }, { status: 401 });
  }
  fails.delete(k);
  const token = await signSession({ uid: u.id, role: u.role, name: u.name });
  const https = h.get("x-forwarded-proto") === "https";
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: https, path: "/", maxAge: 60 * 60 * 24 * 7 });
  return Response.json({ ok: true, home: ROLE_HOME[u.role] });
}
