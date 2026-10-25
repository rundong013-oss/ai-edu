import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("ADMIN");
  if (!s) return jsonError(401, "需要机构管理员权限");
  const { id } = await params;
  const body = (await req.json()) as { disabled?: boolean; resetPassword?: boolean; name?: string };
  if (id === s.uid && body.disabled) return jsonError(400, "不能停用自己");
  const patch: Partial<typeof users.$inferInsert> = {};
  if (typeof body.disabled === "boolean") patch.disabled = body.disabled;
  if (body.resetPassword) patch.passwordHash = bcrypt.hashSync("123456", 10);
  if (body.name?.trim()) patch.name = body.name.trim();
  await db.update(users).set(patch).where(eq(users.id, id));
  return Response.json({ ok: true });
}
