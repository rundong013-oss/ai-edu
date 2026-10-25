import { apiSession, jsonError } from "@/lib/auth";
import { loadWorkspaceFor } from "@/server/access";
import { codingState } from "@/server/coding/state";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession();
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  if (!(await loadWorkspaceFor(s, id, "read"))) return jsonError(404, "找不到工作区");
  return Response.json(await codingState(id));
}
