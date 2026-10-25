import fs from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { dataPath, mimeOf, safeJoin } from "@/lib/paths";

// 网页作品的分享地址：提交时的快照，学生之后再改也不影响
export async function GET(_: Request, { params }: { params: Promise<{ token: string; path?: string[] }> }) {
  const { token, path: parts = [] } = await params;
  const sub = await db.query.submissions.findFirst({ where: eq(submissions.shareToken, token) });
  if (!sub || sub.type !== "WEB") return new Response("Not found", { status: 404 });
  const root = dataPath(sub.path);
  const abs = safeJoin(root, parts.length ? parts.map(decodeURIComponent).join("/") : "index.html");
  if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(abs), { headers: { "content-type": mimeOf(abs), "cache-control": "public, max-age=300" } });
}
