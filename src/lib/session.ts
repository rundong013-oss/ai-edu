// 运行在 edge（middleware）和 node 两种环境：只用 jose，不引用 db。
import { SignJWT, jwtVerify } from "jose";

export type Role = "ADMIN" | "TEACHER" | "STUDENT";
export type SessionData = { uid: string; role: Role; name: string };

export const SESSION_COOKIE = "aiedu_session";
const key = () =>
  new TextEncoder().encode(process.env.SESSION_SECRET || "dev-secret-change-me-dev-secret-change-me");

export async function signSession(data: SessionData) {
  return new SignJWT(data)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionData | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { uid: payload.uid as string, role: payload.role as Role, name: payload.name as string };
  } catch {
    return null;
  }
}

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  TEACHER: "/teacher",
  STUDENT: "/student",
};
