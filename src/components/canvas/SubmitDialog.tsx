"use client";
import { useState } from "react";
import type { WorkspaceState } from "@/server/workspace";
import { Media } from "./Media";
import { api } from "./useWorkspace";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal>
      <div className="card w-full max-w-xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function SubmitDialog({ state, onClose, onDone }: { state: WorkspaceState; onClose: () => void; onDone: (n: number) => void }) {
  const ready = state.frames.filter((f) => f.selectedUrl || f.selectedText);
  const [picked, setPicked] = useState<Set<string>>(new Set(ready.filter((f) => !state.submittedFrameKeys.includes(f.key)).map((f) => f.id)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Modal title="提交作品" onClose={onClose}>
      {ready.length === 0 ? (
        <p className="text-sm text-muted">还没有可以提交的作品。先在框体里生成，再选中你最满意的一张。</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">选择要提交给老师的作品。每个框体提交的是你当前选中的那一张；再次提交会更新成最新的。</p>
          <div className="grid grid-cols-3 gap-3">
            {ready.map((f) => {
              const on = picked.has(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    const n = new Set(picked);
                    if (on) n.delete(f.id);
                    else n.add(f.id);
                    setPicked(n);
                  }}
                  className={`overflow-hidden rounded-xl border text-left ${on ? "border-spark" : "border-line opacity-60"}`}
                >
                  <Media url={f.selectedUrl} type={f.type} text={f.selectedText} className="aspect-square w-full object-cover" />
                  <div className="truncate px-2 py-1.5 text-xs">
                    {f.title}
                    {state.submittedFrameKeys.includes(f.key) && <span className="ml-1 text-spark">已提交</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn btn-spark"
          disabled={busy || picked.size === 0}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ submitted: number }>(`/api/workspaces/${state.workspace.id}/submit`, "POST", { frameIds: [...picked] });
              onDone(r.submitted);
            } catch (e) {
              setErr((e as Error).message);
              setBusy(false);
            }
          }}
        >
          提交 {picked.size} 个作品
        </button>
      </div>
    </Modal>
  );
}
