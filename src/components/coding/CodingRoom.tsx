"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  CircleDashed,
  Code2,
  ExternalLink,
  FilePen,
  FileSearch,
  Loader2,
  Monitor,
  Pencil,
  RotateCw,
  Send,
  Smartphone,
  Square,
  TriangleAlert,
} from "lucide-react";
import { useCoding, type FeedItem } from "./useCoding";
import { Modal } from "@/components/canvas/SubmitDialog";

const TOOL_LABEL: Record<string, { icon: React.ReactNode; verb: string }> = {
  Write: { icon: <FilePen size={14} />, verb: "写入" },
  Edit: { icon: <Pencil size={14} />, verb: "修改" },
  Read: { icon: <FileSearch size={14} />, verb: "查看" },
};

function secs(ms: number | null) {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`;
}

function FeedRow({ item }: { item: FeedItem }) {
  switch (item.kind) {
    case "user":
      return (
        <div className="flex justify-end">
          <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-raised px-3.5 py-2.5 text-sm leading-relaxed">{item.text}</div>
        </div>
      );
    case "assistant":
      return (
        <div className={`whitespace-pre-wrap text-sm leading-relaxed text-ink/90 ${item.streaming ? "caret" : ""}`}>{item.text}</div>
      );
    case "tool": {
      const t = TOOL_LABEL[item.name] ?? { icon: <Code2 size={14} />, verb: item.name };
      return (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-night px-3 py-2 text-xs">
          <span className="text-muted">{t.icon}</span>
          <span>
            {t.verb} <span className="font-mono text-ink">{item.file ?? "…"}</span>
          </span>
          <span className="ml-auto">
            {item.status === "running" ? (
              <Loader2 size={14} className="animate-spin text-spark" />
            ) : item.status === "ok" ? (
              <Check size={14} className="text-spark" />
            ) : (
              <TriangleAlert size={14} className="text-danger" />
            )}
          </span>
        </div>
      );
    }
    case "todos":
      return (
        <div className="rounded-lg border border-line bg-night px-3 py-2.5 text-xs">
          <div className="mb-1.5 text-muted">计划</div>
          <ul className="space-y-1">
            {item.items.map((x, i) => (
              <li key={i} className={`flex items-center gap-2 ${x.status === "completed" ? "text-muted line-through" : ""}`}>
                {x.status === "completed" ? (
                  <Check size={13} className="text-spark" />
                ) : x.status === "in_progress" ? (
                  <Loader2 size={13} className="animate-spin text-spark" />
                ) : (
                  <CircleDashed size={13} className="text-muted" />
                )}
                {x.content}
              </li>
            ))}
          </ul>
        </div>
      );
    case "done":
      return (
        <div className="font-mono text-[11px] text-muted">
          {item.status === "STOPPED" ? "已停止" : item.status === "ERROR" ? `出错了：${item.error ?? ""}` : "完成"} · 首次预览 {secs(item.metrics.firstPreviewMs)} · 用时{" "}
          {secs(item.metrics.totalMs)}
        </div>
      );
    case "error":
      return <div className="text-xs text-danger">出错了：{item.text}</div>;
  }
}

/** 草稿预览：把正在生成的 HTML 放进 srcdoc，并插入 <base> 让相对路径的 css/素材正常加载 */
function withBase(html: string, base: string) {
  const tag = `<base href="${base}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + tag);
  return tag + html;
}

export function CodingRoom({ workspaceId, backHref = "/student", readOnly = false, viewerNote }: { workspaceId: string; backHref?: string; readOnly?: boolean; viewerNote?: string }) {
  const { state, feed, running, draft, previewVersion, bumpPreview, error, setError, send, stop } = useCoding(workspaceId);
  const [input, setInput] = useState("");
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [codeFile, setCodeFile] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const feedEnd = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  // 草稿预览节流：最多 4 帧/秒，避免 iframe 频繁重建
  const [shownDraft, setShownDraft] = useState<string | null>(null);
  const lastDraftAt = useRef(0);
  useEffect(() => {
    if (!draft || !draft.file.endsWith(".html")) {
      setShownDraft(null);
      return;
    }
    const wait = Math.max(0, 250 - (Date.now() - lastDraftAt.current));
    const t = setTimeout(() => {
      lastDraftAt.current = Date.now();
      setShownDraft(withBase(draft.content, `/preview/${workspaceId}/`));
    }, wait);
    return () => clearTimeout(t);
  }, [draft, workspaceId]);

  useEffect(() => {
    feedEnd.current?.scrollIntoView({ block: "end" });
  }, [feed]);

  useEffect(() => {
    if (!codeFile) return;
    fetch(`/preview/${workspaceId}/${codeFile}?v=${previewVersion}`)
      .then((r) => r.text())
      .then(setCode)
      .catch(() => setCode("（读取失败）"));
  }, [codeFile, previewVersion, workspaceId]);

  const assetsImages = useMemo(() => (state?.assets ?? []).filter((a) => a.type === "image" || a.type === "video"), [state]);

  if (!state) return <div className="grid h-dvh place-items-center text-muted">{error ?? "正在打开项目…"}</div>;

  const live = state.classroom.status === "LIVE";
  const left = state.lesson.maxTurns - state.workspace.turnsUsed;
  const canSend = live && !running && left > 0 && input.trim().length > 0;
  const codeFiles = state.files.filter((f) => /\.(html|css|js)$/.test(f.path));

  const submit = async () => {
    if (!input.trim() || !canSend) return;
    const ok = await send(input.trim());
    if (ok) setInput("");
  };

  const insertAsset = (file: string) => {
    const el = ta.current;
    const token = ` @${file} `;
    if (!el) return setInput((v) => v + token);
    const s = el.selectionStart ?? input.length;
    setInput(input.slice(0, s) + token + input.slice(el.selectionEnd ?? s));
    requestAnimationFrame(() => el.focus());
  };

  return (
    <div className="flex h-dvh flex-col">
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
        <span className={`tag ${live ? "tag-live" : ""}`}>
          {live && <span className="live-dot" />}
          {live ? "上课中" : state.classroom.status === "READY" ? "等待开课" : "已下课"}
        </span>
        {readOnly ? (
          <span className="tag ml-auto">{viewerNote ?? "只读查看"}</span>
        ) : (
          <button className="btn btn-spark btn-sm ml-auto" onClick={() => setShowSubmit(true)} disabled={!state.files.some((f) => f.path === "index.html")}>
            <Send size={14} />
            提交作品
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 对话 */}
        <section className="flex w-[440px] shrink-0 flex-col border-r border-line bg-panel">
          <div className="scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {feed.length === 0 && (
              <div className="rounded-xl border border-dashed border-line p-4 text-sm leading-relaxed text-muted">
                在下面告诉 AI 你想做什么样的网页。不知道怎么开口？点一下下面的「任务」，会帮你填好第一句话。
              </div>
            )}
            {feed.map((f) => (
              <FeedRow key={f.id} item={f} />
            ))}
            {running && !feed.some((f) => (f.kind === "assistant" && f.streaming) || (f.kind === "tool" && f.status === "running")) && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 size={13} className="animate-spin text-spark" />
                AI 正在思考…
              </div>
            )}
            <div ref={feedEnd} />
          </div>

          {readOnly ? (
            <div className="border-t border-line p-3 font-mono text-xs text-muted">
              已用 {state.workspace.turnsUsed}/{state.lesson.maxTurns} 次对话{running ? " · AI 正在写" : ""}
            </div>
          ) : (
          <div className="border-t border-line p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {state.tasks.map((t, i) => (
                <button
                  key={t.id}
                  title={t.description}
                  className="rounded-lg border border-line px-2 py-1 text-xs text-muted hover:border-spark hover:text-spark"
                  onClick={() => {
                    setInput(t.codingPrompt);
                    ta.current?.focus();
                  }}
                >
                  任务{i + 1} · {t.title.replace(/^任务[一二三四五六七八九十]+：/, "")}
                </button>
              ))}
            </div>
            {assetsImages.length > 0 && (
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-xs text-muted">我的素材</span>
                {assetsImages.map((a) => (
                  <button
                    key={a.file}
                    title={`插入 ${a.title}（${a.from}）`}
                    onClick={() => insertAsset(a.file)}
                    className="h-8 w-8 overflow-hidden rounded-md border border-line hover:border-spark"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/preview/${workspaceId}/${a.file}`} alt={a.title} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-line bg-night focus-within:border-spark">
              <textarea
                ref={ta}
                rows={3}
                value={input}
                disabled={!live}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={live ? "告诉 AI 你想做什么，或者想怎么改……" : "老师开课后才能发消息"}
                className="block w-full resize-none bg-transparent px-3 pt-2.5 text-sm leading-relaxed outline-none placeholder:text-muted"
              />
              <div className="flex items-center gap-2 px-2.5 pb-2">
                <span className={`font-mono text-xs ${left <= 2 ? "text-amber" : "text-muted"}`}>
                  剩 {left}/{state.lesson.maxTurns} 次
                </span>
                {error && <span className="truncate text-xs text-amber">{error}</span>}
                {running ? (
                  <button className="btn btn-sm ml-auto" onClick={stop}>
                    <Square size={12} />
                    停止
                  </button>
                ) : (
                  <button className="btn btn-spark btn-sm ml-auto" disabled={!canSend} onClick={submit}>
                    <Send size={13} />
                    发送
                  </button>
                )}
              </div>
            </div>
          </div>
          )}
        </section>

        {/* 预览 */}
        <section className="flex min-w-0 flex-1 flex-col bg-night">
          <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-3">
            <button className={`btn btn-ghost btn-sm ${device === "phone" && !codeFile ? "!text-spark" : ""}`} onClick={() => (setDevice("phone"), setCodeFile(null))}>
              <Smartphone size={14} />
              手机
            </button>
            <button className={`btn btn-ghost btn-sm ${device === "desktop" && !codeFile ? "!text-spark" : ""}`} onClick={() => (setDevice("desktop"), setCodeFile(null))}>
              <Monitor size={14} />
              电脑
            </button>
            <span className="mx-1 h-4 w-px bg-line" />
            {codeFiles.map((f) => (
              <button key={f.path} className={`btn btn-ghost btn-sm font-mono ${codeFile === f.path ? "!text-spark" : ""}`} onClick={() => setCodeFile(f.path)}>
                {f.path}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {shownDraft && (
                <span className="flex items-center gap-1.5 text-xs text-spark">
                  <span className="live-dot" />
                  正在写入
                </span>
              )}
              <button className="btn btn-ghost btn-sm" title="刷新预览" onClick={bumpPreview}>
                <RotateCw size={14} />
              </button>
              <a className="btn btn-ghost btn-sm" title="新窗口打开" href={`/preview/${workspaceId}/index.html`} target="_blank" rel="noreferrer">
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          <div className="relative grid min-h-0 flex-1 place-items-center overflow-auto p-5">
            {codeFile ? (
              <pre className="scroll-thin h-full w-full overflow-auto rounded-xl border border-line bg-panel p-4 font-mono text-xs leading-relaxed text-ink/85">{code}</pre>
            ) : (
              <div
                className={`overflow-hidden bg-white shadow-2xl shadow-black/60 transition-[width] ${
                  device === "phone" ? "h-[min(780px,100%)] w-[390px] rounded-[28px] border-[6px] border-[#1f2624]" : "h-full w-full rounded-xl border border-line"
                }`}
              >
                <iframe
                  key={shownDraft ? "draft" : `v${previewVersion}`}
                  title="预览"
                  sandbox="allow-scripts allow-modals"
                  className="h-full w-full"
                  {...(shownDraft ? { srcDoc: shownDraft } : { src: `/preview/${workspaceId}/index.html?v=${previewVersion}` })}
                />
              </div>
            )}
          </div>
        </section>
      </div>

      {showSubmit && (
        <WebSubmitDialog
          workspaceId={workspaceId}
          assets={assetsImages.filter((a) => a.type === "image")}
          onClose={() => setShowSubmit(false)}
          onDone={() => {
            setShowSubmit(false);
            setToast("已提交！老师那边马上能看到");
            setTimeout(() => setToast(null), 2600);
          }}
        />
      )}
      {toast && <div className="fixed left-1/2 top-16 -translate-x-1/2 rounded-lg border border-line bg-raised px-4 py-2 text-sm shadow-lg">{toast}</div>}
    </div>
  );
}

function WebSubmitDialog({
  workspaceId,
  assets,
  onClose,
  onDone,
}: {
  workspaceId: string;
  assets: { file: string; title: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("我的角色图鉴");
  const [cover, setCover] = useState<string | null>(assets[0]?.file ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title="提交网页作品" onClose={onClose}>
      <p className="mb-4 text-sm text-muted">提交的是网页现在的样子。之后你继续修改，可以再提交一次新版本。</p>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">作品名称</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30} />
      </label>
      {assets.length > 0 && (
        <div className="mt-4">
          <span className="mb-1.5 block text-sm text-muted">封面</span>
          <div className="flex gap-2">
            {assets.map((a) => (
              <button key={a.file} onClick={() => setCover(a.file)} className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${cover === a.file ? "border-spark" : "border-line"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/preview/${workspaceId}/${a.file}`} alt={a.title} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn btn-spark"
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true);
            const r = await fetch(`/api/workspaces/${workspaceId}/submit`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ web: { title, coverAsset: cover } }),
            });
            if (r.ok) onDone();
            else {
              setErr((await r.json()).error);
              setBusy(false);
            }
          }}
        >
          提交
        </button>
      </div>
    </Modal>
  );
}
