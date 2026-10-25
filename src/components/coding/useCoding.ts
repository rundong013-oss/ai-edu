"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CodingState } from "@/server/coding/state";
import type { CodingEvent, RunMetrics } from "@/server/coding/runner";

export type FeedItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string; streaming: boolean }
  | { kind: "tool"; id: string; name: string; file?: string; status: "running" | "ok" | "error" }
  | { kind: "todos"; id: string; items: { content: string; status: string }[] }
  | { kind: "done"; id: string; status: string; error?: string; metrics: RunMetrics }
  | { kind: "error"; id: string; text: string };

/** 把数据库里的历史转成对话流 */
function historyToFeed(h: CodingState["history"]): FeedItem[] {
  const out: FeedItem[] = [];
  for (const m of h) {
    const c = m.content as { text?: string; error?: string; name?: string; file?: string; ok?: boolean };
    if (m.role === "user") out.push({ kind: "user", id: m.id, text: c.text ?? "" });
    else if (m.role === "assistant" && c.error) out.push({ kind: "error", id: m.id, text: c.error });
    else if (m.role === "assistant") out.push({ kind: "assistant", id: m.id, text: c.text ?? "", streaming: false });
    else if (m.role === "tool") out.push({ kind: "tool", id: m.id, name: c.name ?? "", file: c.file, status: c.ok ? "ok" : "error" });
  }
  return out;
}

export function useCoding(workspaceId: string) {
  const [state, setState] = useState<CodingState | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState<{ file: string; content: string } | null>(null);
  const [previewVersion, setPreviewVersion] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/coding/${workspaceId}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "加载失败");
      return null;
    }
    setState(j);
    return j as CodingState;
  }, [workspaceId]);

  const apply = useCallback((e: CodingEvent) => {
    setFeed((f) => {
      const next = [...f];
      const at = (id: string) => next.findIndex((x) => x.id === id);
      switch (e.t) {
        case "user":
          if (!next.some((x) => x.kind === "user" && x.id === `u-${e.runId}`)) next.push({ kind: "user", id: `u-${e.runId}`, text: e.text });
          break;
        case "text_delta": {
          const i = at(e.id);
          if (i >= 0 && next[i].kind === "assistant") next[i] = { ...next[i], text: (next[i] as { text: string }).text + e.text } as FeedItem;
          else next.push({ kind: "assistant", id: e.id, text: e.text, streaming: true });
          break;
        }
        case "text": {
          const i = at(e.id);
          if (i >= 0) next[i] = { kind: "assistant", id: e.id, text: e.text, streaming: false };
          else next.push({ kind: "assistant", id: e.id, text: e.text, streaming: false });
          break;
        }
        case "tool_start": {
          if (e.name === "TodoWrite") break;
          const i = at(e.id);
          if (i >= 0) next[i] = { ...(next[i] as Extract<FeedItem, { kind: "tool" }>), file: e.file };
          else next.push({ kind: "tool", id: e.id, name: e.name, file: e.file, status: "running" });
          break;
        }
        case "tool_end": {
          const i = at(e.id);
          if (i >= 0) next[i] = { kind: "tool", id: e.id, name: e.name, file: e.file, status: e.ok ? "ok" : "error" };
          break;
        }
        case "todos": {
          const i = next.findLastIndex((x) => x.kind === "todos");
          // 同一次运行里只保留一张计划卡片，原地更新
          const lastUser = next.findLastIndex((x) => x.kind === "user");
          if (i > lastUser) next[i] = { kind: "todos", id: next[i].id, items: e.items };
          else next.push({ kind: "todos", id: `todo-${Date.now()}`, items: e.items });
          break;
        }
        case "done":
          for (let k = 0; k < next.length; k++) {
            const x = next[k];
            if (x.kind === "assistant" && x.streaming) next[k] = { ...x, streaming: false };
            if (x.kind === "tool" && x.status === "running") next[k] = { ...x, status: e.status === "DONE" ? "ok" : "error" };
          }
          next.push({ kind: "done", id: `done-${Date.now()}`, status: e.status, error: e.error, metrics: e.metrics });
          break;
      }
      return next;
    });
    if (e.t === "draft") setDraft({ file: e.file, content: e.content });
    if (e.t === "file") {
      if (e.file.endsWith(".html")) setDraft(null);
      setPreviewVersion(e.at);
    }
    if (e.t === "done") {
      setRunning(false);
      setDraft(null);
      setPreviewVersion(Date.now());
    }
  }, []);

  const connect = useCallback(
    (from: number) => {
      esRef.current?.close();
      const es = new EventSource(`/api/coding/${workspaceId}/stream?from=${from}`);
      esRef.current = es;
      setRunning(true);
      es.onmessage = (m) => {
        const e = JSON.parse(m.data) as CodingEvent | { t: "idle" } | { t: "ping" };
        if (e.t === "ping") return;
        if (e.t === "idle") {
          setRunning(false);
          es.close();
          return;
        }
        apply(e);
        if (e.t === "done") {
          es.close();
          load();
        }
      };
      es.onerror = () => {
        es.close();
        // 断线：重新拉状态，若仍在运行则从头回放（前端按 id 去重）
        setTimeout(async () => {
          const s = await load();
          if (s?.live) {
            setFeed(historyToFeed(s.history.filter((h) => h.runId !== s.live!.runId)));
            connect(0);
          } else {
            if (s) setFeed(historyToFeed(s.history));
            setRunning(false);
          }
        }, 1500);
      };
    },
    [workspaceId, apply, load],
  );

  useEffect(() => {
    (async () => {
      const s = await load();
      if (!s) return;
      if (s.live) {
        // 运行中刷新页面：去掉本次运行已落库的消息，由事件回放完整重建
        setFeed(historyToFeed(s.history.filter((h) => h.runId !== s.live!.runId)));
        connect(0);
      } else {
        setFeed(historyToFeed(s.history));
      }
    })();
    return () => esRef.current?.close();
  }, [load, connect]);

  // 课堂状态（开课/下课）每 8 秒刷新一次
  useEffect(() => {
    const t = setInterval(() => {
      if (!running) load();
    }, 8000);
    return () => clearInterval(t);
  }, [load, running]);

  const send = useCallback(
    async (prompt: string) => {
      setError(null);
      const r = await fetch(`/api/coding/${workspaceId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error);
        return false;
      }
      setFeed((f) => [...f, { kind: "user", id: `u-${j.runId}`, text: prompt }]);
      setState((s) => (s ? { ...s, workspace: { ...s.workspace, turnsUsed: s.workspace.turnsUsed + 1 } } : s));
      connect(0);
      return true;
    },
    [workspaceId, connect],
  );

  const stop = useCallback(() => fetch(`/api/coding/${workspaceId}/stop`, { method: "POST" }), [workspaceId]);

  const bumpPreview = useCallback(() => setPreviewVersion(Date.now()), []);

  return { state, feed, running, draft, previewVersion, bumpPreview, error, setError, send, stop, reload: load };
}
