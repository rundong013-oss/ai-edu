import { eq } from "drizzle-orm";
import { db } from "@/db";
import { frameTemplates, frames } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";
import { loadFrameFor } from "@/server/access";
import { QuotaError, startGeneration } from "@/server/generation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("STUDENT");
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  const r = await loadFrameFor(s, id, "write");
  if (!r) return jsonError(404, "找不到框体");
  if (r.room.status !== "LIVE") return jsonError(403, "老师还没开课，或者这节课已经结束了");

  const { prompt, slotValues } = (await req.json()) as { prompt: string; slotValues?: Record<string, string> };
  await db.update(frames).set({ prompt, ...(slotValues ? { slotValues } : {}) }).where(eq(frames.id, id));
  const tpl = r.frame.templateId ? await db.query.frameTemplates.findFirst({ where: eq(frameTemplates.id, r.frame.templateId) }) : null;
  try {
    const gen = await startGeneration({
      frame: r.frame,
      workspaceId: r.ws.id,
      studentId: s.uid,
      classroomId: r.room.id,
      lessonId: r.room.lessonId,
      prompt,
      crossRefs: tpl?.crossLessonRefs ?? [],
    });
    return Response.json({ id: gen.id });
  } catch (e) {
    if (e instanceof QuotaError) return jsonError(429, e.message);
    throw e;
  }
}
