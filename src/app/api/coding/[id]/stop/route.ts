import { apiSession, jsonError } from "@/lib/auth";
import { loadWorkspaceFor } from "@/server/access";
import { stopRun } from "@/server/coding/runner";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("STUDENT");
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  if (!(await loadWorkspaceFor(s, id, "write"))) return jsonError(404, "找不到工作区");
  stopRun(id);
  return Response.json({ ok: true });
}
