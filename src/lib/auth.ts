import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type Role, type SessionData } from "./session";

export async function getSession(): Promise<SessionData | null> {
  const c = await cookies();
  return verifySession(c.get(SESSION_COOKIE)?.value);
}

/** 页面用：未登录或角色不符时跳转登录页 */
export async function requireRole(...roles: Role[]): Promise<SessionData> {
  const s = await getSession();
  if (!s || !roles.includes(s.role)) redirect("/login");
  return s;
}

/** API 用：返回 session 或 null（调用方返回 401/403） */
export async function apiSession(...roles: Role[]): Promise<SessionData | null> {
  const s = await getSession();
  if (!s) return null;
  if (roles.length && !roles.includes(s.role)) return null;
  return s;
}

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}
