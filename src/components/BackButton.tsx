"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { canGoBackInApp } from "./NavTracker";
import { startNav } from "./NavProgress";

/**
 * 返回按钮：从哪来回哪去。
 * - 在新标签页里打开的（链接带 ?tab=1，比如老师点「演示画布」「查看」）：关掉这个标签页，回到原来的页面
 * - 同一标签页里从站内页面跳过来的：后退一页
 * - 都不是（比如直接打开链接）：跳到默认页面
 */
export function BackButton({ fallback, label }: { fallback: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      aria-label="返回"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        startNav();
        if (new URLSearchParams(window.location.search).get("tab") === "1") {
          window.close();
          // 浏览器不允许关闭时（比如标签页里已经跳转过），退回到正常跳转
          setTimeout(() => router.push(fallback), 300);
          return;
        }
        if (canGoBackInApp()) router.back();
        else router.push(fallback);
      }}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <ChevronLeft size={16} />}
      {label}
    </button>
  );
}
