import { eq } from "drizzle-orm";
import { db } from "@/db";
import { promptBlocks } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiSession("ADMIN"))) return jsonError(401, "需要机构管理员权限");
  const { id } = await params;
  const b = (await req.json()) as { enabled?: boolean; label?: string; text?: string };
  const patch: Partial<typeof promptBlocks.$inferInsert> = {};
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  if (b.label?.trim()) patch.label = b.label.trim().slice(0, 20);
  if (b.text?.trim()) patch.text = b.text.trim().slice(0, 200);
  await db.update(promptBlocks).set(patch).where(eq(promptBlocks.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiSession("ADMIN"))) return jsonError(401, "需要机构管理员权限");
  const { id } = await params;
  await db.delete(promptBlocks).where(eq(promptBlocks.id, id));
  return Response.json({ ok: true });
}
