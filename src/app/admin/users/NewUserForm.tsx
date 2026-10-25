"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewUserForm() {
  const router = useRouter();
  const [f, setF] = useState({ role: "STUDENT", username: "", name: "", password: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card flex flex-wrap items-end gap-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const r = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
        setBusy(false);
        if (!r.ok) return setErr((await r.json()).error);
        setF({ ...f, username: "", name: "", password: "" });
        router.refresh();
      }}
    >
      <label className="w-28">
        <span className="mb-1 block text-xs text-muted">角色</span>
        <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="STUDENT">学生</option>
          <option value="TEACHER">老师</option>
          <option value="ADMIN">管理员</option>
        </select>
      </label>
      <label className="w-40">
        <span className="mb-1 block text-xs text-muted">账号</span>
        <input className="input" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="如 stu5" />
      </label>
      <label className="w-40">
        <span className="mb-1 block text-xs text-muted">姓名</span>
        <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </label>
      <label className="w-40">
        <span className="mb-1 block text-xs text-muted">初始密码</span>
        <input className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="至少 6 位" />
      </label>
      <button className="btn btn-spark" disabled={busy}>
        创建账号
      </button>
      {err && <p className="w-full text-sm text-danger">{err}</p>}
    </form>
  );
}
