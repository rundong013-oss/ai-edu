import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";

/** 课节额度配置 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await apiSession("ADMIN"))) return jsonError(401, "需要机构管理员权限");
  const { id } = await params;
  const b = (await req.json()) as { spareFrames?: number; codingMaxTurns?: number; codingModel?: string };
  const clamp = (n: unknown, lo: number, hi: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : undefined);
  const patch: Partial<typeof lessons.$inferInsert> = {};
  const sf = clamp(b.spareFrames, 0, 20);
  const ct = clamp(b.codingMaxTurns, 0, 100);
  if (sf !== undefined) patch.spareFrames = sf;
  if (ct !== undefined) patch.codingMaxTurns = ct;
  if (typeof b.codingModel === "string") patch.codingModel = b.codingModel.trim();
  await db.update(lessons).set(patch).where(eq(lessons.id, id));
  return Response.json({ ok: true });
}
