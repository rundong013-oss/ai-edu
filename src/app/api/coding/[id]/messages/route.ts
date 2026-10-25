import { apiSession, jsonError } from "@/lib/auth";
import { loadWorkspaceFor } from "@/server/access";
import { CodingQuotaError, startCodingRun } from "@/server/coding/runner";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession("STUDENT");
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  if (!(await loadWorkspaceFor(s, id, "write"))) return jsonError(404, "找不到工作区");
  const { prompt } = (await req.json()) as { prompt: string };
  if (!prompt?.trim()) return jsonError(400, "先写点什么");
  try {
    return Response.json(await startCodingRun(id, prompt.trim().slice(0, 2000)));
  } catch (e) {
    if (e instanceof CodingQuotaError) return jsonError(429, e.message);
    throw e;
  }
}
