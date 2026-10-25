"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** 调一个接口，成功后刷新当前页面数据 */
export function ApiButton({
  url,
  method = "POST",
  body,
  children,
  className = "btn btn-sm",
  confirm,
}: {
  url: string;
  method?: string;
  body?: unknown;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      aria-busy={busy}
      onClick={async () => {
        if (confirm && !window.confirm(confirm)) return;
        setBusy(true);
        const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
        if (!r.ok) alert((await r.json().catch(() => ({}))).error ?? "操作失败");
        setBusy(false);
        router.refresh();
      }}
    >
      {children}
    </button>
  );
}
