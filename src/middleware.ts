import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, ROLE_HOME, type Role } from "@/lib/session";

const AREA: Record<string, Role> = { admin: "ADMIN", teacher: "TEACHER", student: "STUDENT" };

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (pathname === "/") {
    return NextResponse.redirect(new URL(s ? ROLE_HOME[s.role] : "/login", req.url));
  }
  const need = AREA[pathname.split("/")[1]];
  if (need && (!s || s.role !== need)) {
    return NextResponse.redirect(new URL(s ? ROLE_HOME[s.role] : "/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/admin/:path*", "/teacher/:path*", "/student/:path*"] };
