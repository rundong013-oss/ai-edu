"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceState } from "@/server/workspace";

const isRunning = (s: WorkspaceState | null) =>
  !!s?.frames.some((f) => f.generations.some((g) => g.status === "RUNNING" || g.status === "QUEUED"));

/** 轮询工作区状态：有生成在跑时 1.2s 一次，否则 5s 一次（用来感知老师开课/下课） */
export function useWorkspace(id: string) {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/workspaces/${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "加载失败");
        return null;
      }
      setError(null);
      setState(j as WorkspaceState);
      return j as WorkspaceState;
    } catch {
      setError("网络断开了，正在重试…");
      return null;
    }
  }, [id]);

  const cycle = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const j = await load();
    if (!alive.current) return j;
    timer.current = setTimeout(cycle, isRunning(j) ? 1200 : 5000);
    return j;
  }, [load]);

  useEffect(() => {
    alive.current = true;
    cycle();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [cycle]);

  return { state, setState, error, refresh: cycle };
}

export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `请求失败（${r.status}）`);
  return j as T;
}
