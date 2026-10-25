"use client";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import Link from "next/link";
import { Check, ChevronLeft, Clapperboard, ImageIcon, Send, Type } from "lucide-react";
import type { WorkspaceState } from "@/server/workspace";
import { FrameNode, type FrameNodeType } from "./FrameNode";
import { PromptEditor } from "./PromptEditor";
import { api, useWorkspace } from "./useWorkspace";
import { SubmitDialog } from "./SubmitDialog";

const nodeTypes = { frame: FrameNode };

export function CanvasRoom({ workspaceId, backHref = "/student", readOnly = false, viewerNote }: { workspaceId: string; backHref?: string; readOnly?: boolean; viewerNote?: string }) {
  const { state, setState, error, refresh } = useWorkspace(workspaceId);
  if (!state) {
    return <div className="grid h-dvh place-items-center text-muted">{error ?? "正在打开画布…"}</div>;
  }
  return (
    <ReactFlowProvider>
      <CanvasInner state={state} setState={setState} refresh={refresh} error={error} backHref={backHref} readOnly={readOnly} viewerNote={viewerNote} />
    </ReactFlowProvider>
  );
}

/** 教师备课 / 投屏演示：用课程模板渲染一张不能生成的画布 */
export function CanvasDemo({ initial, backHref }: { initial: WorkspaceState; backHref: string }) {
  const [state, setState] = useState(initial);
  return (
    <ReactFlowProvider>
      <CanvasInner state={state} setState={setState} refresh={async () => state} error={null} backHref={backHref} readOnly viewerNote="演示模式：可以给学生讲解每个框体和提示词，不能生成" />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  state,
  setState,
  refresh,
  error,
  backHref,
  readOnly = false,
  viewerNote,
}: {
  state: WorkspaceState;
  setState: (s: WorkspaceState) => void;
  refresh: () => Promise<WorkspaceState | null>;
  error: string | null;
  backHref: string;
  readOnly?: boolean;
  viewerNote?: string;
}) {
  const rf = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localPos, setLocalPos] = useState<Record<string, { x: number; y: number }>>({});
  const [currentTask, setCurrentTask] = useState<string | null>(state.workspace.currentTaskId);
  const [toast, setToast] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);

  const live = state.classroom.status === "LIVE" && !readOnly;
  const blockedReason = readOnly ? viewerNote ?? "只读查看" : live ? null : state.classroom.status === "READY" ? "老师还没开课" : "这节课已经下课了";
  const taskNo = useMemo(() => new Map(state.tasks.map((t, i) => [t.id, i + 1])), [state.tasks]);
  const byId = useMemo(() => new Map(state.frames.map((f) => [f.id, f])), [state.frames]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const pick = useCallback(
    async (frameId: string, genId: string) => {
      if (readOnly) return;
      setState({
        ...state,
        frames: state.frames.map((f) =>
          f.id === frameId
            ? {
                ...f,
                selectedGenerationId: genId,
                selectedUrl: f.generations.find((g) => g.id === genId)?.url ?? null,
                selectedText: f.generations.find((g) => g.id === genId)?.text ?? null,
              }
            : f,
        ),
      });
      await api(`/api/frames/${frameId}`, "PATCH", { selectedGenerationId: genId }).catch((e) => flash(e.message));
      refresh();
    },
    [state, setState, refresh, readOnly],
  );

  const nodes: FrameNodeType[] = state.frames.map((f) => ({
    id: f.id,
    type: "frame",
    position: localPos[f.id] ?? { x: f.posX, y: f.posY },
    selected: f.id === selectedId,
    data: {
      frame: f,
      taskNo: f.taskId ? taskNo.get(f.taskId) ?? null : null,
      inCurrentTask: !currentTask || f.taskId === currentTask || f.isSpare,
      submitted: state.submittedFrameKeys.includes(f.key),
      onPick: pick,
      readOnly,
    },
  }));

  const edges: Edge[] = state.frames.flatMap((f) =>
    f.upstreamFrameIds.map((u) => ({
      id: `${u}->${f.id}`,
      source: u,
      target: f.id,
      animated: f.generations.some((g) => g.status === "RUNNING"),
      style: { stroke: byId.get(u)?.selectedUrl || byId.get(u)?.selectedText ? "var(--spark)" : "var(--line)", strokeWidth: 2 },
    })),
  );

  const onNodesChange = (changes: NodeChange<FrameNodeType>[]) => {
    for (const c of changes) {
      if (c.type === "position" && c.position) setLocalPos((p) => ({ ...p, [c.id]: c.position! }));
      if (c.type === "select" && c.selected) setSelectedId(c.id);
    }
  };

  const onConnect = async (c: Connection) => {
    if (readOnly) return;
    const target = byId.get(c.target);
    if (!target?.isSpare) return flash("课程框体的连线是固定的；备用框体可以自由连线");
    const ups = Array.from(new Set([...target.upstreamFrameIds, c.source]));
    await api(`/api/frames/${target.id}`, "PATCH", { upstreamFrameIds: ups }).catch((e) => flash(e.message));
    refresh();
  };

  const focusTask = (taskId: string) => {
    setCurrentTask(taskId);
    const fs = state.frames.filter((f) => f.taskId === taskId);
    if (fs.length) {
      // 底部有提示词编辑器，所以把框体放在画布上半部分
      const n = rf.getNode(fs[0].id);
      const x = (localPos[fs[0].id]?.x ?? fs[0].posX) + (n?.measured?.width ?? 280) / 2;
      const y = (localPos[fs[0].id]?.y ?? fs[0].posY) + (n?.measured?.height ?? 420) / 2;
      rf.setCenter(x, y + 170, { zoom: 0.85, duration: 500 });
      setSelectedId(fs[0].id);
    }
  };

  const addSpare = async (type: "IMAGE" | "VIDEO" | "TEXT") => {
    const center = rf.screenToFlowPosition({ x: window.innerWidth / 2 + 80, y: window.innerHeight / 2 - 150 });
    try {
      const f = await api<{ id: string }>(`/api/workspaces/${state.workspace.id}/frames`, "POST", { type, posX: center.x, posY: center.y });
      await refresh();
      setSelectedId(f.id);
    } catch (e) {
      flash((e as Error).message);
    }
  };

  const spareLeft = state.lesson.spareFrames - state.workspace.spareUsed;
  const taskDone = (taskId: string) => {
    const fs = state.frames.filter((f) => f.taskId === taskId);
    return fs.length > 0 && fs.every((f) => f.selectedGenerationId);
  };

  return (
    <div className="flex h-dvh flex-col">
      {/* 顶栏 */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
        <Link href={backHref} className="btn btn-ghost btn-sm" aria-label="返回">
          <ChevronLeft size={16} />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {state.lesson.courseCode} 第 {state.lesson.index} 节 · {state.lesson.title}
          </div>
          <div className="truncate text-xs text-muted">{state.classroom.name}</div>
        </div>
        {readOnly ? (
          <span className="tag">{viewerNote ?? "只读查看"}</span>
        ) : (
          <span className={`tag ${live ? "tag-live" : ""}`}>
            {live && <span className="live-dot" />}
            {live ? "上课中" : state.classroom.status === "READY" ? "等待开课" : "已下课"}
          </span>
        )}
        {error && <span className="text-xs text-amber">{error}</span>}
        {!readOnly && (
          <button className="btn btn-spark btn-sm ml-auto" onClick={() => setShowSubmit(true)}>
            <Send size={14} />
            提交作品
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 左侧：任务步骤 */}
        <aside className="scroll-thin flex w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-panel p-4">
          <h2 className="mb-3 text-sm text-muted">本节任务</h2>
          <ol className="space-y-1.5">
            {state.tasks.map((t, i) => {
              const done = t.kind !== "FREE" && taskDone(t.id);
              const active = currentTask === t.id;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => (t.kind === "FREE" ? setCurrentTask(t.id) : focusTask(t.id))}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      active ? "border-spark/50 bg-spark-dim" : "border-transparent hover:bg-raised"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-xs ${
                          done ? "bg-spark text-night" : active ? "border border-spark text-spark" : "border border-line text-muted"
                        }`}
                      >
                        {done ? <Check size={13} /> : i + 1}
                      </span>
                      <span className="text-sm font-medium">{t.title.replace(/^任务[一二三四五六七八九十]+：/, "")}</span>
                    </div>
                    {active && <p className="mt-2 pl-8 text-xs leading-relaxed text-muted">{t.description}</p>}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted">备用框体</span>
              <span className={`font-mono text-xs ${spareLeft === 0 ? "text-amber" : "text-muted"}`}>
                剩 {spareLeft}/{state.lesson.spareFrames}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button className="btn btn-sm" disabled={!live || spareLeft <= 0} onClick={() => addSpare("IMAGE")}>
                <ImageIcon size={14} />
                图片
              </button>
              <button className="btn btn-sm" disabled={!live || spareLeft <= 0} onClick={() => addSpare("VIDEO")}>
                <Clapperboard size={14} />
                视频
              </button>
              <button className="btn btn-sm" disabled={!live || spareLeft <= 0} onClick={() => addSpare("TEXT")}>
                <Type size={14} />
                文字
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">每个框体只能生成几次。想清楚再点生成，比多抽几次更重要。</p>
          </div>
        </aside>

        {/* 画布 */}
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={(_, n) => {
              if (!readOnly) api(`/api/frames/${n.id}`, "PATCH", { posX: n.position.x, posY: n.position.y }).catch(() => {});
            }}
            onConnect={onConnect}
            onPaneClick={() => setSelectedId(null)}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#26302c" bgColor="var(--night)" />
            <Controls position="bottom-left" showInteractive={false} />
          </ReactFlow>

          {selected && (
            <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
              <div className="pointer-events-auto">
                <PromptEditor
                  frame={selected}
                  upstream={selected.upstreamFrameIds.map((u) => byId.get(u)!).filter(Boolean)}
                  blocksLib={state.blocks}
                  canGenerate={live}
                  blockedReason={blockedReason}
                  onClose={() => setSelectedId(null)}
                  onDraft={(patch) => {
                    if (!readOnly) api(`/api/frames/${selected.id}`, "PATCH", patch).catch(() => {});
                  }}
                  onGenerate={async (prompt, slotValues, blockIds) => {
                    await api(`/api/frames/${selected.id}/generate`, "POST", { prompt, slotValues, blockIds });
                    await refresh();
                  }}
                />
              </div>
            </div>
          )}

          {toast && (
            <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg border border-line bg-raised px-4 py-2 text-sm shadow-lg">{toast}</div>
          )}
        </div>
      </div>

      {showSubmit && (
        <SubmitDialog
          state={state}
          onClose={() => setShowSubmit(false)}
          onDone={(n) => {
            setShowSubmit(false);
            flash(`已提交 ${n} 个作品，老师那边马上能看到`);
            refresh();
          }}
        />
      )}
    </div>
  );
}
