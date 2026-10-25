"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function RuleEditor({ k, title, desc, value }: { k: string; title: string; desc: string; value: string }) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [state, setState] = useState<"" | "saving" | "saved">("");
  const save = async (body: object) => {
    setState("saving");
    await fetch("/api/admin/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: k, ...body }) });
    setState("saved");
    router.refresh();
    setTimeout(() => setState(""), 1500);
  };
  return (
    <section className="card p-4">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted">{desc}</span>
      </div>
      <textarea className="input min-h-28 text-sm" value={v} onChange={(e) => setV(e.target.value)} />
      <div className="mt-2 flex items-center justify-end gap-2">
        {state === "saved" && <span className="text-xs text-spark">已保存</span>}
        <button className="btn btn-ghost btn-sm" onClick={async () => { await save({ reset: true }); window.location.reload(); }}>
          恢复默认
        </button>
        <button className="btn btn-sm" disabled={state === "saving" || v === value} aria-busy={state === "saving"} onClick={() => save({ value: v })}>
          保存
        </button>
      </div>
    </section>
  );
}

type B = { id: string; category: string; label: string; text: string; enabled: boolean };

export function BlockManager({ categories, blocks }: { categories: { key: string; label: string }[]; blocks: B[] }) {
  const router = useRouter();
  const [f, setF] = useState({ category: categories[0].key, label: "", text: "" });
  const [err, setErr] = useState<string | null>(null);
  const call = async (url: string, method: string, body?: object) => {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) setErr((await r.json()).error);
    router.refresh();
    return r.ok;
  };
  return (
    <div className="space-y-4">
      <form
        className="card flex flex-wrap items-end gap-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          if (await call("/api/admin/blocks", "POST", f)) setF({ ...f, label: "", text: "" });
        }}
      >
        <label className="w-28">
          <span className="mb-1 block text-xs text-muted">类别</span>
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="w-36">
          <span className="mb-1 block text-xs text-muted">名称（学生看到的）</span>
          <input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="如：蒸汽朋克" />
        </label>
        <label className="min-w-64 flex-1">
          <span className="mb-1 block text-xs text-muted">拼进提示词的内容</span>
          <input className="input" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="如：蒸汽朋克风格，黄铜齿轮与蒸汽" />
        </label>
        <button className="btn btn-spark">添加积木</button>
        {err && <p className="w-full text-sm text-danger">{err}</p>}
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {categories.map((c) => {
          const list = blocks.filter((b) => b.category === c.key);
          if (!list.length) return null;
          return (
            <section key={c.key} className="card overflow-hidden">
              <h3 className="border-b border-line px-4 py-2.5 text-sm font-medium">
                {c.label} <span className="text-muted">{list.length}</span>
              </h3>
              <table className="tbl">
                <tbody>
                  {list.map((b) => (
                    <tr key={b.id} className={b.enabled ? "" : "opacity-45"}>
                      <td className="w-28 font-medium">{b.label}</td>
                      <td className="text-sm text-muted">{b.text}</td>
                      <td className="w-32 text-right">
                        <button className="btn btn-ghost btn-sm" onClick={() => call(`/api/admin/blocks/${b.id}`, "PATCH", { enabled: !b.enabled })}>
                          {b.enabled ? "停用" : "启用"}
                        </button>
                        <button className="btn btn-ghost btn-sm" aria-label="删除" onClick={() => call(`/api/admin/blocks/${b.id}`, "DELETE")}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
