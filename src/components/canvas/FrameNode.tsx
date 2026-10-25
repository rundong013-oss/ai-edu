"use client";
import { memo, useEffect, useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Clapperboard, ImageIcon, TriangleAlert } from "lucide-react";
import type { FrameView } from "@/server/workspace";
import { NoiseField } from "@/components/NoiseField";
import { Media } from "./Media";

export type FrameNodeData = {
  frame: FrameView;
  taskNo: number | null; // 所属任务序号（备用框体为 null）
  inCurrentTask: boolean;
  submitted: boolean;
  onPick: (frameId: string, genId: string) => void;
  readOnly?: boolean;
};
export type FrameNodeType = Node<FrameNodeData, "frame">;

const WIDTH = 280;

function ratio(ar: string) {
  const [a, b] = ar.split(":").map(Number);
  return a && b ? b / a : 1;
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return <>{Math.max(0, Math.round((now - since) / 1000))}s</>;
}

export const FrameNode = memo(function FrameNode({ data, selected }: NodeProps<FrameNodeType>) {
  const { frame: f, taskNo, inCurrentTask, submitted, onPick, readOnly } = data;
  const running = f.generations.find((g) => g.status === "RUNNING" || g.status === "QUEUED");
  const left = f.maxGenerations - f.usedCount;
  const done = f.generations.filter((g) => g.status === "SUCCEEDED" || g.status === "FAILED");
  const lastFailed = !running && f.generations.at(-1)?.status === "FAILED" ? f.generations.at(-1) : null;
  const Icon = f.type === "VIDEO" ? Clapperboard : ImageIcon;

  return (
    <div
      className={`rounded-2xl border bg-panel transition-[border-color,box-shadow] ${
        selected
          ? "border-spark shadow-[0_0_0_3px_rgba(92,242,160,0.18)]"
          : inCurrentTask
            ? "border-[#3b4a44]"
            : "border-line opacity-80"
      }`}
      style={{ width: WIDTH }}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-night !bg-muted" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-night !bg-spark" />

      <div className="flex items-center gap-2 px-3 py-2.5">
        <Icon size={15} className={f.type === "VIDEO" ? "text-amber" : "text-spark"} />
        <span className="truncate text-sm font-medium">{f.title}</span>
        {taskNo !== null && <span className="text-xs text-muted">任务{taskNo}</span>}
        <span
          className={`ml-auto font-mono text-xs ${left === 0 ? "text-amber" : "text-muted"}`}
          title="剩余生成次数"
        >
          {left}/{f.maxGenerations}
        </span>
      </div>

      <div className="relative mx-3 overflow-hidden rounded-xl bg-night" style={{ height: (WIDTH - 24) * Math.min(ratio(f.aspectRatio), 1.4) }}>
        {f.selectedUrl && <Media url={f.selectedUrl} type={f.type} className="h-full w-full object-cover" />}
        {running && (
          <div className="absolute inset-0 bg-night/80">
            <NoiseField variant="render" progress={0.4} />
            <div className="absolute inset-x-0 bottom-3 text-center font-mono text-xs text-spark">
              正在生成 <Elapsed since={running.createdAt} />
            </div>
          </div>
        )}
        {!running && !f.selectedUrl && (
          <div className="absolute inset-0 grid place-items-center rounded-xl border border-dashed border-line px-6 text-center text-sm text-muted">
            {readOnly ? "演示框体" : lastFailed ? "上次没生成成功，再试一次" : "点我，写下提示词"}
          </div>
        )}
        {submitted && <span className="tag tag-live absolute left-2 top-2 bg-night/80">已提交</span>}
      </div>

      {/* 本框体的历史结果：点一下选为输出 */}
      <div className="flex min-h-11 items-center gap-1.5 px-3 py-2.5">
        {done.map((g) => (
          <button
            key={g.id}
            title={g.status === "FAILED" ? `失败：${g.error ?? ""}` : "选为这个框体的结果"}
            onClick={(e) => {
              e.stopPropagation();
              if (g.status === "SUCCEEDED" && !readOnly) onPick(f.id, g.id);
            }}
            className={`nodrag relative h-8 w-8 overflow-hidden rounded-md border ${
              g.id === f.selectedGenerationId ? "border-spark" : "border-line"
            }`}
          >
            {g.status === "SUCCEEDED" && g.url ? (
              <Media url={g.url} type={f.type} className="h-full w-full object-cover" />
            ) : (
              <TriangleAlert size={14} className="mx-auto text-danger" />
            )}
          </button>
        ))}
        {f.upstreamFrameIds.length > 0 && <span className="ml-auto text-xs text-muted">参考 {f.upstreamFrameIds.length} 个框体</span>}
      </div>
    </div>
  );
});
