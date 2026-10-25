import { eq } from "drizzle-orm";
import { db } from "@/db";
import { frames, generations } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";
import { loadFrameFor } from "@/server/access";
import { frameTemplates } from "@/db/schema";
import { DEFAULT_BLOCK_CATEGORIES, resolveBlocks } from "@/server/prompts";

/** 保存框体：位置、提示词、字段值、选定的输出、手动连线 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("STUDENT");
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  const r = await loadFrameFor(s, id, "write");
  if (!r) return jsonError(404, "找不到框体");
  const body = (await req.json()) as Partial<{
    posX: number;
    posY: number;
    prompt: string;
    slotValues: Record<string, string>;
    selectedGenerationId: string;
    upstreamFrameIds: string[];
    aspectRatio: string;
    blockIds: string[];
  }>;
  const patch: Partial<typeof frames.$inferInsert> = {};
  if (typeof body.posX === "number") patch.posX = body.posX;
  if (typeof body.posY === "number") patch.posY = body.posY;
  if (typeof body.prompt === "string") patch.prompt = body.prompt.slice(0, 2000);
  if (body.slotValues) patch.slotValues = body.slotValues;
  if (body.aspectRatio && r.frame.isSpare) patch.aspectRatio = body.aspectRatio;
  if (body.blockIds) {
    const tpl = r.frame.templateId ? await db.query.frameTemplates.findFirst({ where: eq(frameTemplates.id, r.frame.templateId) }) : null;
    patch.blocks = await resolveBlocks(body.blockIds, tpl?.blockCategories.length ? tpl.blockCategories : DEFAULT_BLOCK_CATEGORIES[r.frame.type]);
  }
  if (body.selectedGenerationId) {
    const g = await db.query.generations.findFirst({ where: eq(generations.id, body.selectedGenerationId) });
    if (!g || g.frameId !== id || g.status !== "SUCCEEDED") return jsonError(400, "只能选择这个框体里生成成功的结果");
    patch.selectedGenerationId = g.id;
  }
  if (body.upstreamFrameIds) {
    // 只允许连同一工作区里的其他框体，且只有备用框体可以改连线（课程预设的连线固定）
    if (!r.frame.isSpare) return jsonError(400, "课程框体的连线是固定的");
    const others = await db.query.frames.findMany({ where: eq(frames.workspaceId, r.ws.id) });
    const ok = new Set(others.filter((f) => f.id !== id).map((f) => f.id));
    patch.upstreamFrameIds = body.upstreamFrameIds.filter((x) => ok.has(x)).slice(0, 3);
  }
  await db.update(frames).set(patch).where(eq(frames.id, id));
  return Response.json({ ok: true });
}
