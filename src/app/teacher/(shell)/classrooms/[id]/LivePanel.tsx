"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Code2, Eye, MonitorUp, Play, Presentation, Square, Trash2 } from "lucide-react";
import type { ClassroomLive } from "@/server/queries";
import { WorkCard } from "@/components/WorkCard";
import { hasCanvas, kindLessonLabel } from "@/lib/lesson";

export function LivePanel({ initial }: { initial: ClassroomLive }) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const id = d.room.id;

  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch(`/api/classrooms/${id}/live`, { cache: "no-store" });
      if (r.ok) setD(await r.json());
    }, 3000);
    return () => clearInterval(t);
  }, [id]);

  const act = async (action: string, extra: object = {}) => {
    setBusy(action === "spotlight" ? `spotlight:${(extra as { submissionId?: string }).submissionId ?? "off"}` : action);
    const r = await fetch(`/api/classrooms/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    if (!r.ok) alert((await r.json()).error);
    const l = await fetch(`/api/classrooms/${id}/live`, { cache: "no-store" });
    if (l.ok) setD(await l.json());
    setBusy(null);
  };

  const canvas = d.lesson.kind === "CANVAS";
  const mixed = d.lesson.kind === "MIXED";
  const status = d.room.status;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">
            {d.course.code} 第 {d.lesson.index} 节 · {d.lesson.title} · {kindLessonLabel(d.lesson.kind)}
          </div>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {d.room.name}
            <span className={`tag ${status === "LIVE" ? "tag-live" : ""}`}>
              {status === "LIVE" && <span className="live-dot" />}
              {status === "READY" ? "未开课" : status === "LIVE" ? "上课中" : "已下课"}
            </span>
          </h1>
        </div>
        <div className="flex gap-2">
          {hasCanvas(d.lesson.kind) && (
            <Link href={`/teacher/demo/${d.lesson.id}?tab=1`} target="_blank" className="btn">
              <Presentation size={15} />
              演示画布
            </Link>
          )}
          <Link href={`/teacher/screen/${id}`} target="_blank" className="btn">
            <MonitorUp size={15} />
            投屏页
          </Link>
          {status === "READY" && (
            <>
              <button className="btn btn-ghost" disabled={!!busy} aria-busy={busy === "delete"} onClick={async () => {
                if (!confirm("删除这个课堂？")) return;
                setBusy("delete");
                await fetch(`/api/classrooms/${id}`, { method: "DELETE" });
                router.push("/teacher");
              }}>
                <Trash2 size={15} />
              </button>
              <button className="btn btn-spark" disabled={!!busy} aria-busy={busy === "start"} onClick={() => act("start")}>
                <Play size={15} />
                开课
              </button>
            </>
          )}
          {status === "LIVE" && (
            <button className="btn" disabled={!!busy} aria-busy={busy === "end"} onClick={() => confirm("下课后学生不能再生成，确定？") && act("end")}>
              <Square size={14} />
              下课
            </button>
          )}
          {status === "ENDED" && (
            <button className="btn" disabled={!!busy} aria-busy={busy === "reopen"} onClick={() => act("reopen")}>
              <Play size={15} />
              重新开课
            </button>
          )}
        </div>
      </div>

      <h2 className="mb-3 text-sm text-muted">学生进度（{d.students.length} 人，每 3 秒刷新）</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {d.students.map((s) => {
          const canvasPct = s.framesTotal ? s.framesDone / s.framesTotal : 0;
          const codingPct = Math.min(1, s.codingTurnsUsed / Math.max(1, d.lesson.codingMaxTurns));
          // 混合课：画布占 30%，编程占 70%
          const pct = canvas ? canvasPct : mixed ? canvasPct * 0.3 + codingPct * 0.7 : codingPct;
          const canvasText = s.generating ? `正在生成 ${s.generating} 张` : `完成 ${s.framesDone}/${s.framesTotal} 个框体`;
          const codingText = s.codingBusy ? "AI 正在写" : `已对话 ${s.codingTurnsUsed}/${d.lesson.codingMaxTurns} 次`;
          const activity = !s.workspaceId
            ? "还没进入"
            : canvas
              ? canvasText
              : mixed
                ? s.generating || (!s.codingTurnsUsed && !s.codingBusy)
                  ? `① 画布：${canvasText}`
                  : `② 编程：${codingText}`
                : codingText;
          const hot = s.generating > 0 || s.codingBusy;
          return (
            <div key={s.id} className={`card p-4 ${hot ? "border-spark/40" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.name}</span>
                {hot && <span className="live-dot" />}
                {s.submissions > 0 && <span className="tag tag-live ml-auto">交了 {s.submissions} 个</span>}
              </div>
              <div className="mt-1 text-sm text-muted">{activity}</div>
              {!canvas && s.codingTurnsUsed > 0 && s.lastPrompt && <div className="mt-1 truncate text-xs text-muted" title={s.lastPrompt}>“{s.lastPrompt}”</div>}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
                <div className="h-full rounded-full bg-spark transition-[width]" style={{ width: `${Math.round(pct * 100)}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span className="font-mono">{canvas || mixed ? `已生成 ${s.generationsUsed} 次` : ""}</span>
                {s.workspaceId && (
                  <Link href={`/teacher/view/${s.workspaceId}?tab=1`} target="_blank" className="btn btn-ghost btn-sm">
                    {canvas ? <Eye size={14} /> : <Code2 size={14} />}
                    查看
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-sm text-muted">已提交的作品（{d.submissions.length}）· 点「投屏」让它显示在投屏页上</h2>
      {d.submissions.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">学生提交的作品会出现在这里</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {d.submissions.map((w) => {
            const on = d.room.spotlightSubmissionId === w.id;
            return (
              <WorkCard
                key={w.id}
                w={w}
                actions={
                  <button
                    className={`btn btn-sm ${on ? "btn-spark" : ""}`}
                    aria-busy={busy === `spotlight:${on ? "off" : w.id}`}
                    onClick={() => act("spotlight", { submissionId: on ? null : w.id })}
                  >
                    <MonitorUp size={13} />
                    {on ? "投屏中" : "投屏"}
                  </button>
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
