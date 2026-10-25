"use client";
import { useEffect, useRef } from "react";

/**
 * 粒子场：「噪声 → 画面」。
 * - variant="ambient"：登录页背景，0/1 字符与光点缓慢漂移，鼠标附近会被轻微推开。
 * - variant="render"：框体「正在生成」时，噪点在框内闪烁并逐渐向中心聚拢，progress 越大越密集。
 */
export function NoiseField({
  variant = "ambient",
  progress = 0,
  className = "",
  density = 1,
}: {
  variant?: "ambient" | "render";
  progress?: number;
  className?: string;
  density?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0,
      h = 0,
      raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type P = { x: number; y: number; vx: number; vy: number; r: number; glyph: string | null; a: number; tw: number };
    let ps: P[] = [];
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(((w * h) / (variant === "ambient" ? 5200 : 260)) * density);
      ps = Array.from({ length: Math.min(n, variant === "ambient" ? 420 : 900) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.15,
        vy: variant === "ambient" ? -0.08 - Math.random() * 0.25 : (Math.random() - 0.5) * 0.15,
        r: Math.random() * 1.3 + 0.3,
        glyph: variant === "ambient" && Math.random() < 0.22 ? (Math.random() < 0.5 ? "0" : "1") : null,
        a: Math.random() * 0.6 + 0.15,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const pr = progressRef.current;
      ctx.font = "11px 'JetBrains Mono', monospace";
      for (const p of ps) {
        if (!reduce) {
          if (variant === "render") {
            // 向中心聚拢 + 抖动，progress 越大聚拢越强
            const cx = w / 2,
              cy = h / 2;
            p.vx += (cx - p.x) * 0.00004 * (0.3 + pr) + (Math.random() - 0.5) * 0.08;
            p.vy += (cy - p.y) * 0.00004 * (0.3 + pr) + (Math.random() - 0.5) * 0.08;
            p.vx *= 0.96;
            p.vy *= 0.96;
          } else {
            const dx = p.x - mouse.x,
              dy = p.y - mouse.y,
              d2 = dx * dx + dy * dy;
            if (d2 < 120 * 120) {
              const f = (1 - Math.sqrt(d2) / 120) * 0.35;
              p.x += (dx / (Math.sqrt(d2) + 0.01)) * f * 3;
              p.y += (dy / (Math.sqrt(d2) + 0.01)) * f * 3;
            }
          }
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
        }
        const twinkle = 0.55 + 0.45 * Math.sin(t / 700 + p.tw);
        const alpha = p.a * twinkle * (variant === "render" ? 0.5 + pr * 0.5 : 1);
        ctx.fillStyle = `rgba(92,242,160,${alpha})`;
        if (p.glyph) ctx.fillText(p.glyph, p.x, p.y);
        else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    if (variant === "ambient") window.addEventListener("mousemove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, [variant, density]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none ${className}`} style={{ width: "100%", height: "100%" }} />;
}
