"use client";
import { useEffect, useState } from "react";
import { Check, Code2, Palette } from "lucide-react";
import { PageLoading } from "@/components/PageLoading";
import { CanvasRoom } from "@/components/canvas/CanvasRoom";
import { CodingRoom } from "@/components/coding/CodingRoom";
import { isCanvasDone } from "./stage";

type Stage = "canvas" | "coding";

/**
 * 混合课：同一节课里先在画布上生成素材（如游戏主角），再用 Vibe Coding 做成作品。
 * 两个阶段共用一个工作区；切到编程时同步一次素材，画布上选中的图会出现在项目的 assets/ 里。
 */
export function MixedRoom({
  workspaceId,
  classroomId,
  backHref = "/student",
  readOnly = false,
  viewerNote,
}: {
  workspaceId: string;
  /** 学生端传入：切到编程时调用进入接口同步素材；老师只读查看时不传 */
  classroomId?: string;
  backHref?: string;
  readOnly?: boolean;
  viewerNote?: string;
}) {
  const [stage, setStage] = useState<Stage | null>(null);
  const [canvasDone, setCanvasDone] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const memoKey = `mixed-stage:${workspaceId}`;

  // 初始阶段：记住上次停留的阶段；没有记录时，已经开始编程就进编程，否则从画布开始
  useEffect(() => {
    let alive = true;
    (async () => {
      let remembered: Stage | null = null;
      try {
        const v = sessionStorage.getItem(memoKey);
        if (v === "canvas" || v === "coding") remembered = v;
      } catch {}
      const r = await fetch(`/api/workspaces/${workspaceId}`, { cache: "no-store" }).catch(() => null);
      const j = r?.ok ? await r.json() : null;
      if (!alive) return;
      const done = isCanvasDone(j);
      setCanvasDone(done);
      setStage(remembered ?? (j?.workspace?.codingTurnsUsed > 0 ? "coding" : "canvas"));
    })();
    return () => {
      alive = false;
    };
  }, [workspaceId, memoKey]);

  const go = async (s: Stage) => {
    if (s === stage) return;
    try {
      sessionStorage.setItem(memoKey, s);
    } catch {}
    if (s === "coding" && classroomId && !readOnly) {
      // 把画布上刚选好的图同步进项目，再打开编程界面
      setSyncing(true);
      await fetch(`/api/classrooms/${classroomId}/enter`, { method: "POST" }).catch(() => {});
      setSyncing(false);
    }
    setStage(s);
  };

  if (!stage || syncing) return <PageLoading full text={syncing ? "正在把你的作品搬进项目…" : "正在打开课堂…"} />;

  const nav = <StageNav stage={stage} canvasDone={canvasDone} onChange={go} />;
  return stage === "canvas" ? (
    <CanvasRoom
      workspaceId={workspaceId}
      backHref={backHref}
      readOnly={readOnly}
      viewerNote={viewerNote}
      stageNav={nav}
      onCanvasDone={setCanvasDone}
      onNext={readOnly ? undefined : () => go("coding")}
    />
  ) : (
    <CodingRoom workspaceId={workspaceId} backHref={backHref} readOnly={readOnly} viewerNote={viewerNote} stageNav={nav} />
  );
}

function StageNav({ stage, canvasDone, onChange }: { stage: Stage; canvasDone: boolean; onChange: (s: Stage) => void }) {
  const item = (s: Stage, n: number, label: string, icon: React.ReactNode, done = false) => {
    const on = stage === s;
    return (
      <button
        onClick={() => onChange(s)}
        className={`flex h-8 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${on ? "bg-raised text-ink" : "text-muted hover:text-ink"}`}
        aria-current={on ? "step" : undefined}
      >
        <span
          className={`grid h-5 w-5 place-items-center rounded-full font-mono text-[11px] ${
            done ? "bg-spark text-night" : on ? "border border-spark text-spark" : "border border-line"
          }`}
        >
          {done ? <Check size={12} /> : n}
        </span>
        {icon}
        {label}
      </button>
    );
  };
  return (
    <nav className="flex items-center gap-1 rounded-xl border border-line bg-night p-1" aria-label="课堂步骤">
      {item("canvas", 1, "画布创作", <Palette size={14} />, canvasDone)}
      <span className="h-px w-4 bg-line" />
      {item("coding", 2, "编程实现", <Code2 size={14} />)}
    </nav>
  );
}
