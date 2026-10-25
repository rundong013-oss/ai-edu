import { apiSession, jsonError } from "@/lib/auth";
import { loadWorkspaceFor } from "@/server/access";
import { submitFrame, submitWeb } from "@/server/submit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("STUDENT");
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  const r = await loadWorkspaceFor(s, id, "write");
  if (!r) return jsonError(404, "找不到工作区");
  const body = (await req.json()) as { frameIds?: string[]; web?: { title: string; coverAsset?: string | null } };
  const out = [];
  for (const fid of body.frameIds ?? []) {
    const sub = await submitFrame(id, fid);
    if (sub) out.push(sub);
  }
  if (body.web) {
    const sub = await submitWeb(id, body.web.title, body.web.coverAsset ?? null);
    if (sub) out.push(sub);
  }
  if (!out.length) return jsonError(400, "没有可以提交的作品：先生成并选中一张结果");
  return Response.json({ submitted: out.length, submissions: out });
}
