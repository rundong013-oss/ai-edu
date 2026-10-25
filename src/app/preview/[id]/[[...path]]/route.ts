import fs from "node:fs";
import { mimeOf, projectDir, safeJoin } from "@/lib/paths";

// 学生项目的实时预览（工作区 id 不可枚举）。页面放在带 sandbox 的 iframe 里显示。
export async function GET(_: Request, { params }: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path: parts = [] } = await params;
  if (!/^[\w-]+$/.test(id)) return new Response("Not found", { status: 404 });
  const root = projectDir(id);
  const sub = parts.length ? parts.map(decodeURIComponent).join("/") : "index.html";
  if (sub === "CLAUDE.md" || sub.startsWith(".")) return new Response("Not found", { status: 404 });
  const abs = safeJoin(root, sub);
  if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(abs), { headers: { "content-type": mimeOf(abs), "cache-control": "no-store" } });
}
