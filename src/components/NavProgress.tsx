"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** 让别处（比如 router.push、整页跳转之前）也能触发顶部进度条 */
export const startNav = () => window.dispatchEvent(new Event("nav:start"));

/**
 * 页面跳转反馈：
 * - 点站内链接时，被点的链接 / 按钮立即显示转圈（data-pending），顶部出现绿色进度条
 * - 新页面渲染出来后自动收起
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // 路由变化 = 新页面到了
  useEffect(() => {
    document.querySelectorAll("[data-pending]").forEach((el) => el.removeAttribute("data-pending"));
    if (phaseRef.current === "loading") {
      setPhase("done");
      const t = setTimeout(() => setPhase("idle"), 350);
      return () => clearTimeout(t);
    }
  }, [pathname, search]);

  useEffect(() => {
    let safety: ReturnType<typeof setTimeout>;
    const start = () => {
      setPhase("loading");
      clearTimeout(safety);
      // 兜底：15 秒还没跳转完成（比如被拦截了）就收起
      safety = setTimeout(() => {
        setPhase("idle");
        document.querySelectorAll("[data-pending]").forEach((el) => el.removeAttribute("data-pending"));
      }, 15000);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      a.setAttribute("data-pending", "1");
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("nav:start", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("nav:start", start);
      clearTimeout(safety);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className="h-full bg-spark shadow-[0_0_8px_var(--spark)]"
        style={{
          width: phase === "idle" ? "0%" : phase === "loading" ? "85%" : "100%",
          opacity: phase === "idle" ? 0 : 1,
          transition:
            phase === "loading" ? "width 6s cubic-bezier(0.1, 0.7, 0.2, 1), opacity 0.1s" : phase === "done" ? "width 0.2s ease-out, opacity 0.3s 0.15s" : "none",
        }}
      />
    </div>
  );
}
