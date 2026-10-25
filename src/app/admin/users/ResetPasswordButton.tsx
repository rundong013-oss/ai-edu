"use client";
import { useState } from "react";

export function ResetPasswordButton({ id, name }: { id: string; name: string }) {
  const [pw, setPw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (pw)
    return (
      <span className="text-sm">
        新密码 <span className="select-all rounded bg-raised px-1.5 py-0.5 font-mono text-spark">{pw}</span>
      </span>
    );
  return (
    <button
      className="btn btn-ghost btn-sm"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`给 ${name} 生成一个新密码？旧密码会立即失效。`)) return;
        setBusy(true);
        const r = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ resetPassword: true }) });
        const j = await r.json();
        setBusy(false);
        if (r.ok) setPw(j.newPassword);
        else alert(j.error ?? "操作失败");
      }}
    >
      重置密码
    </button>
  );
}
