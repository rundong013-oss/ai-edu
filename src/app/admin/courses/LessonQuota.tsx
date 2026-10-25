"use client";
import { useState } from "react";

export function LessonQuota({ id, kind, spareFrames, codingMaxTurns, codingModel }: { id: string; kind: "CANVAS" | "CODING"; spareFrames: number; codingMaxTurns: number; codingModel: string }) {
  const [v, setV] = useState({ spareFrames, codingMaxTurns, codingModel });
  const [saved, setSaved] = useState(false);
  const save = async (patch: Partial<typeof v>) => {
    const next = { ...v, ...patch };
    setV(next);
    await fetch(`/api/admin/lessons/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };
  return (
    <div className="flex items-center gap-3 text-sm">
      {kind === "CANVAS" ? (
        <label className="flex items-center gap-2">
          <span className="text-muted">备用框体</span>
          <input type="number" min={0} max={20} className="input !h-8 w-16" defaultValue={v.spareFrames} onBlur={(e) => save({ spareFrames: Number(e.target.value) })} />
        </label>
      ) : (
        <>
          <label className="flex items-center gap-2">
            <span className="text-muted">对话次数</span>
            <input type="number" min={0} max={100} className="input !h-8 w-16" defaultValue={v.codingMaxTurns} onBlur={(e) => save({ codingMaxTurns: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted">模型</span>
            <select className="input !h-8 w-44" defaultValue={v.codingModel} onChange={(e) => save({ codingModel: e.target.value })}>
              <option value="">默认（环境变量）</option>
              <option value="claude-sonnet-5-5">Sonnet 5.5（效果好）</option>
              <option value="claude-haiku-5-5">Haiku 5.5（更快更省）</option>
            </select>
          </label>
        </>
      )}
      {saved && <span className="text-xs text-spark">已保存</span>}
    </div>
  );
}
