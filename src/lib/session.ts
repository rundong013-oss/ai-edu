// 运行在 edge（middleware）和 node 两种环境：只用 jose，不引用 db。
import { SignJWT, jwtVerify } from "jose";

export type Role = "ADMIN" | "TEACHER" | "STUDENT";
export type SessionData = { uid: string; role: Role; name: string };

export const SESSION_COOKIE = "aiedu_session";
const DEV_SECRET = "dev-secret-change-me-dev-secret-change-me";
const key = () => {
  const secret = process.env.SESSION_SECRET;
  // 生产环境不允许用默认值或过短的密钥，否则任何人都能伪造登录
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32 || secret.startsWith("change-me"))) {
    throw new Error("SESSION_SECRET 未配置或太短（至少 32 个字符）");
  }
  return new TextEncoder().encode(secret || DEV_SECRET);
};

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
