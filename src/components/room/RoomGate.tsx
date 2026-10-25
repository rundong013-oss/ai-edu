"use client";
import { useEffect, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { PageLoading } from "@/components/PageLoading";
import { NoiseField } from "@/components/NoiseField";
import { CanvasRoom } from "@/components/canvas/CanvasRoom";
import { CodingRoom } from "@/components/coding/CodingRoom";

/** 等待开课 → 开课后自动进入画布 / Vibe Coding */
export function RoomGate({
  classroomId,
  kind,
  title,
  roomName,
  studentName,
}: {
  classroomId: string;
  kind: "CANVAS" | "CODING";
  title: string;
  roomName: string;
  studentName: string;
}) {
  const [ws, setWs] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // 先尝试进入；只有确认「还没开课」才显示等待页，避免已开课时闪一下等待画面
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const tryEnter = async () => {
      const r = await fetch(`/api/classrooms/${classroomId}/enter`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!alive) return;
      if (r.ok) setWs(j.workspaceId);
      else {
        setWaiting(true);
        setMsg(r.status === 409 ? null : j.error);
        t = setTimeout(tryEnter, 3000);
      }
    };
    tryEnter();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [classroomId]);

  if (ws) return kind === "CODING" ? <CodingRoom workspaceId={ws} /> : <CanvasRoom workspaceId={ws} />;
  if (!waiting) return <PageLoading full text="正在进入课堂…" />;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden">
      <div className="absolute inset-0 opacity-70">
        <NoiseField variant="ambient" density={0.7} />
      </div>
      <div className="absolute left-4 top-4">
        <BackButton fallback="/student" label="返回" />
      </div>
      <div className="relative text-center">
        <p className="text-sm text-muted">{roomName}</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-6 flex items-center justify-center gap-2 text-muted">
          <span className="live-dot" />
          {msg ?? `${studentName}，等老师开课后会自动进入`}
        </p>
      </div>
    </main>
  );
}
