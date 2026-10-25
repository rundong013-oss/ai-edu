import { apiSession, jsonError } from "@/lib/auth";
import { loadWorkspaceFor } from "@/server/access";
import { getLiveRun, subscribe, type CodingEvent } from "@/server/coding/runner";

export const dynamic = "force-dynamic";

/** SSE：回放本次运行已有的事件（从 from 开始），然后实时推送，直到 done */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiSession();
  if (!s) return jsonError(401, "请先登录");
  const { id } = await params;
  if (!(await loadWorkspaceFor(s, id, "read"))) return jsonError(404, "找不到工作区");
  const from = Number(new URL(req.url).searchParams.get("from") ?? 0);
  const run = getLiveRun(id);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(ctrl) {
      let closed = false;
      const send = (e: CodingEvent | { t: "idle" } | { t: "ping" }) => {
        if (closed) return;
        try {
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          closed = true;
        }
      };
      if (!run) {
        send({ t: "idle" });
        ctrl.close();
        return;
      }
      for (const e of run.events.slice(from)) send(e);
      if (run.finished) {
        ctrl.close();
        return;
      }
      const ping = setInterval(() => send({ t: "ping" }), 15000);
      const off = subscribe(id, (e) => {
        send(e);
        if (e.t === "done") {
          clearInterval(ping);
          off();
          closed = true;
          try {
            ctrl.close();
          } catch {}
        }
      });
      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        off();
        closed = true;
      });
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}
