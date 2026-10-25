import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { frames, lessons, workspaces } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";
import { loadWorkspaceFor } from "@/server/access";

/** 添加备用框体（每节课有固定个数） */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("STUDENT");
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  const r = await loadWorkspaceFor(s, id, "write");
  if (!r) return jsonError(404, "找不到工作区");
  if (r.room.status !== "LIVE") return jsonError(403, "老师还没开课");
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, r.room.lessonId) });
  const { type, posX = 0, posY = 0 } = (await req.json()) as { type: "IMAGE" | "VIDEO"; posX?: number; posY?: number };

  const ok = await db
    .update(workspaces)
    .set({ spareUsed: sql`${workspaces.spareUsed} + 1` })
    .where(and(eq(workspaces.id, id), lt(workspaces.spareUsed, lesson!.spareFrames)))
    .returning({ n: workspaces.spareUsed });
  if (!ok.length) return jsonError(429, "这节课的备用框体用完了");

  const [f] = await db
    .insert(frames)
    .values({
      workspaceId: id,
      key: `spare${ok[0].n}`,
      type: type === "VIDEO" ? "VIDEO" : "IMAGE",
      title: `${type === "VIDEO" ? "视频" : "图片"}备用框体 ${ok[0].n}`,
      isSpare: true,
      maxGenerations: 2,
      aspectRatio: type === "VIDEO" ? "16:9" : "1:1",
      posX,
      posY,
    })
    .returning();
  return Response.json(f);
}
