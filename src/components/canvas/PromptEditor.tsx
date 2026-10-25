"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import type { FrameView, WorkspaceState } from "@/server/workspace";
import { fillTemplate } from "@/lib/json";
import { Media } from "./Media";

type Seg = { text: string } | { slot: string };
type Block = WorkspaceState["blocks"][number];

const CATEGORY_LABEL: Record<string, string> = {
  subject: "主体",
  detail: "细节",
  scene: "场景",
  style: "风格",
  light: "光影",
  camera: "镜头",
  action: "动作",
  fx: "特效",
  tone: "语气",
  format: "体裁",
};

function parse(tpl: string): Seg[] {
  const out: Seg[] = [];
  let last = 0;
  for (const m of tpl.matchAll(/\{\{(\w+)\}\}/g)) {
    if (m.index! > last) out.push({ text: tpl.slice(last, m.index) });
    out.push({ slot: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < tpl.length) out.push({ text: tpl.slice(last) });
  return out;
}

/** 字段宽度跟着内容走：中文按 1em、其它按 0.55em 估算 */
function fieldWidth(s: string) {
  let w = 0;
  for (const c of s) w += /[　-鿿＀-￯]/.test(c) ? 1 : 0.55;
  return `calc(${Math.max(w, 2)}em + 1.1rem)`;
}

export function PromptEditor({
  frame,
  upstream,
  blocksLib,
  canGenerate,
  blockedReason,
  onGenerate,
  onDraft,
  onClose,
}: {
  frame: FrameView;
  upstream: FrameView[];
  blocksLib: Block[];
  canGenerate: boolean;
  blockedReason: string | null;
  onGenerate: (prompt: string, slotValues: Record<string, string>, blockIds: string[]) => Promise<void>;
  onDraft: (patch: { prompt?: string; slotValues?: Record<string, string>; blockIds?: string[] }) => void;
  onClose: () => void;
}) {
  const tpl = frame.template;
  const segs = useMemo(() => (tpl ? parse(tpl.promptTemplate) : []), [tpl]);
  const [mode, setMode] = useState<"fill" | "free">(tpl ? "fill" : "free");
  const [values, setValues] = useState<Record<string, string>>(frame.slotValues);
  const [free, setFree] = useState(frame.prompt || (tpl ? fillTemplate(tpl.promptTemplate, frame.slotValues) : ""));
  const [picked, setPicked] = useState<string[]>(frame.blocks.map((b) => b.id));
  const [cat, setCat] = useState<string>(frame.allowedBlockCategories[0] ?? "style");
  const [focusSlot, setFocusSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // 切换到别的框体时重置
  useEffect(() => {
    setValues(frame.slotValues);
    setFree(frame.prompt || (frame.template ? fillTemplate(frame.template.promptTemplate, frame.slotValues) : ""));
    setMode(frame.template ? "fill" : "free");
    setPicked(frame.blocks.map((b) => b.id));
    setCat(frame.allowedBlockCategories[0] ?? "style");
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.id]);

  const prompt = mode === "fill" && tpl ? fillTemplate(tpl.promptTemplate, values) : free;
  const left = frame.maxGenerations - frame.usedCount;
  const running = frame.generations.some((g) => g.status === "RUNNING" || g.status === "QUEUED");
  const missingRefs = upstream.filter((u) => !u.selectedUrl && !u.selectedText);
  const slotDef = (k: string) => tpl?.slots.find((s) => s.key === k);
  const allowed = frame.allowedBlockCategories.filter((c) => blocksLib.some((b) => b.category === c));
  const pickedBlocks = picked.map((id) => blocksLib.find((b) => b.id === id)).filter((b): b is Block => !!b);
  const isText = frame.type === "TEXT";

  function draft(patch: { prompt?: string; slotValues?: Record<string, string>; blockIds?: string[] }) {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => onDraft(patch), 600);
  }

  function toggleBlock(b: Block) {
    let next: string[];
    if (picked.includes(b.id)) next = picked.filter((x) => x !== b.id);
    else {
      // 同一类别只保留一块（比如风格只能选一种），换成新的
      next = [...picked.filter((x) => blocksLib.find((y) => y.id === x)?.category !== b.category), b.id].slice(-6);
    }
    setPicked(next);
    draft({ blockIds: next });
  }

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await onGenerate(prompt, values, picked);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  const disabled = !canGenerate || left <= 0 || running || busy || !prompt.trim();

  return (
    <div className="card w-[min(720px,calc(100vw-360px))] p-4 shadow-2xl shadow-black/50" onKeyDown={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-center gap-3">
        <span className="font-medium">{frame.title}</span>
        {tpl && (
          <div className="flex rounded-lg border border-line p-0.5 text-xs">
            {(["fill", "free"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  if (m === "free" && mode === "fill") setFree(prompt);
                  setMode(m);
                }}
                className={`rounded-md px-2.5 py-1 ${mode === m ? "bg-raised text-ink" : "text-muted"}`}
              >
                {m === "fill" ? "填空" : "自己写"}
              </button>
            ))}
          </div>
        )}
        <button className="btn btn-ghost btn-sm ml-auto" onClick={onClose} aria-label="关闭">
          <X size={15} />
        </button>
      </div>

      {mode === "fill" && tpl ? (
        <div className="rounded-xl bg-night p-3.5 text-[15px] leading-[2.3]">
          {segs.map((s, i) =>
            "text" in s ? (
              <span key={i} className="text-ink/85">
                {s.text}
              </span>
            ) : (
              <input
                key={i}
                aria-label={slotDef(s.slot)?.label ?? s.slot}
                title={slotDef(s.slot)?.label}
                value={values[s.slot] ?? ""}
                onFocus={() => setFocusSlot(s.slot)}
                onChange={(e) => {
                  const v = { ...values, [s.slot]: e.target.value };
                  setValues(v);
                  draft({ slotValues: v });
                }}
                style={{ width: fieldWidth(values[s.slot] ?? "") }}
                className="mx-0.5 inline-block rounded-md border-b-2 border-spark/70 bg-spark-dim px-2 py-0 text-center font-medium text-spark outline-none focus:border-spark focus:bg-spark/20"
              />
            ),
          )}
          {pickedBlocks.map((b) => (
            <span key={b.id} className="ml-1 inline-flex items-center gap-1 rounded-md bg-raised px-2 py-0.5 text-sm text-ink">
              ，{b.label}
              <button onClick={() => toggleBlock(b)} aria-label={`去掉${b.label}`} className="text-muted hover:text-ink">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <>
          <textarea
            className="input min-h-28 text-[15px]"
            value={free}
            placeholder={isText ? "告诉 AI 要写什么：写给谁、写什么内容、写多长……" : "描述你想要的画面：主体、细节、场景、风格……"}
            onChange={(e) => {
              setFree(e.target.value);
              draft({ prompt: e.target.value });
            }}
          />
          {pickedBlocks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pickedBlocks.map((b) => (
                <span key={b.id} className="inline-flex items-center gap-1 rounded-md bg-raised px-2 py-0.5 text-sm">
                  + {b.label}
                  <button onClick={() => toggleBlock(b)} aria-label={`去掉${b.label}`} className="text-muted hover:text-ink">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* 选中某个空时，给出可选的灵感 */}
      {mode === "fill" && focusSlot && slotDef(focusSlot) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>{slotDef(focusSlot)!.label}：</span>
          {(slotDef(focusSlot)!.options ?? [slotDef(focusSlot)!.default]).map((o) => (
            <button
              key={o}
              className="rounded-md border border-line px-2 py-0.5 hover:border-spark hover:text-spark"
              onClick={() => {
                const v = { ...values, [focusSlot]: o };
                setValues(v);
                draft({ slotValues: v });
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      {/* 提示词积木：按类别挑一块拼进提示词 */}
      {allowed.length > 0 && (
        <div className="mt-3 rounded-xl border border-line p-2.5">
          <div className="mb-2 flex items-center gap-1">
            <span className="mr-1 text-xs text-muted">积木</span>
            {allowed.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-md px-2 py-0.5 text-xs ${cat === c ? "bg-raised text-ink" : "text-muted hover:text-ink"}`}
              >
                {CATEGORY_LABEL[c] ?? c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {blocksLib
              .filter((b) => b.category === cat)
              .map((b) => {
                const on = picked.includes(b.id);
                return (
                  <button
                    key={b.id}
                    title={b.text}
                    onClick={() => toggleBlock(b)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors ${
                      on ? "border-spark bg-spark-dim text-spark" : "border-line text-ink/80 hover:border-muted"
                    }`}
                  >
                    {!on && <Plus size={11} />}
                    {b.label}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {upstream.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{isText ? "参考" : "参考素材"}</span>
          {upstream.map((u) => (
            <span key={u.id} className="flex max-w-56 items-center gap-1.5 rounded-lg border border-line py-0.5 pl-0.5 pr-2" title={u.selectedText ?? u.title}>
              {u.type === "TEXT" ? (
                <span className="grid h-6 w-6 place-items-center rounded-md bg-raised text-[10px]">文</span>
              ) : u.selectedUrl ? (
                <Media url={u.selectedUrl} type={u.type} className="h-6 w-6 rounded-md object-cover" />
              ) : (
                <span className="h-6 w-6 rounded-md border border-dashed border-line" />
              )}
              <span className="truncate">{u.type === "TEXT" && u.selectedText ? u.selectedText.slice(0, 16) : u.title}</span>
            </span>
          ))}
          {missingRefs.length > 0 && <span className="text-amber">先把参考框体生成出来，效果会更好</span>}
        </div>
      )}
      {frame.template?.crossLessonRefs.length ? <p className="mt-2 text-xs text-muted">会自动参考你上节课的作品（如果有的话）</p> : null}

      <div className="mt-4 flex items-center gap-3">
        {!isText && <span className="text-xs text-muted">画幅 {frame.aspectRatio}</span>}
        {(err || blockedReason) && <span className="text-xs text-amber">{err ?? blockedReason}</span>}
        <button className="btn btn-spark ml-auto" disabled={disabled} onClick={go}>
          <Sparkles size={15} />
          {running ? "正在生成…" : left <= 0 ? "次数用完了" : `${isText ? "写出来" : "生成"}（剩 ${left} 次）`}
        </button>
      </div>
    </div>
  );
}
