import { db } from "@/db";
import { BLOCK_CATEGORIES, promptBlocks } from "@/db/schema";
import { apiSession, jsonError } from "@/lib/auth";

export async function POST(req: Request) {
  if (!(await apiSession("ADMIN"))) return jsonError(401, "需要机构管理员权限");
  const { category, label, text } = (await req.json()) as { category: string; label: string; text: string };
  if (!BLOCK_CATEGORIES.some((c) => c.key === category)) return jsonError(400, "类别不对");
  if (!label?.trim() || !text?.trim()) return jsonError(400, "名称和内容都要填");
  const [b] = await db.insert(promptBlocks).values({ category, label: label.trim().slice(0, 20), text: text.trim().slice(0, 200), sortOrder: Date.now() % 1e9 }).returning();
  return Response.json(b);
}
