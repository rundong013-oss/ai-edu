"use client";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import { PolyhedronField } from "@/components/PolyhedronField";
import { BRAND } from "@/lib/brand";
import { startNav } from "@/components/NavProgress";

const DEMO = [
  { label: "学生", username: "stu1" },
  { label: "老师", username: "teacher" },
  { label: "机构后台", username: "admin" },
];

/** 品牌标：一个线框多面体，和背景的粒子多面体呼应 */
function Mark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-xl border border-spark/30 bg-spark-dim text-spark"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9Z" />
        <path d="M12 2.5v6.5m0 0 8.5-1.5M12 9 3.5 7.5M12 9l-5 9.6M12 9l5 9.6M7 18.6h10" opacity=".7" />
      </svg>
    </span>
  );
}

export function LoginForm({ showDemo }: { showDemo: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(u = username, p = password) {
    if (!u.trim() || !p) {
      setErr("请输入账号和密码");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: u.trim(), password: p }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "登录失败，请重试");
        setBusy(false);
        return;
      }
      startNav();
      window.location.href = j.home;
    } catch {
      setErr("网络连接失败，请稍后再试");
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-night">
      {/* 背景：深色渐变 + 粒子多面体 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_72%_50%,#14211b_0%,var(--night)_70%)]" />
      <div className="absolute inset-0">
        <PolyhedronField anchor={0.68} />
      </div>
      {/* 左侧压暗，保证文字可读 */}
      <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,var(--night)_0%,rgba(13,17,16,0.7)_32%,transparent_58%)] lg:block" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-night to-transparent" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-6 lg:px-10">
        {/* 顶栏 */}
        <header className="login-rise flex items-center gap-2.5">
          <Mark size={32} />
          <span className="font-semibold tracking-tight">{BRAND.name}</span>
          <span className="font-mono text-xs text-muted">/ {BRAND.en}</span>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_420px] lg:gap-16">
          {/* 左：品牌叙事 */}
          <section className="hidden lg:block">
            <div className="login-rise" style={{ animationDelay: "80ms" }}>
              <span className="tag font-mono">AI 创造力课堂</span>
            </div>
            <h1 className="login-rise mt-6 text-6xl leading-[1.12] font-semibold tracking-tight xl:text-7xl" style={{ animationDelay: "160ms" }}>
              把想象
              <br />
              <span className="text-spark">变成作品。</span>
            </h1>
            <p className="login-rise mt-6 max-w-md text-lg leading-relaxed text-muted" style={{ animationDelay: "240ms" }}>
              画角色、做动画、写网页，一节课一块画布，
              <br />
              从一个点子做出一件能分享的作品。
            </p>
          </section>

          {/* 右：登录卡片 */}
          <section className="login-rise mx-auto w-full max-w-[420px]" style={{ animationDelay: "200ms" }}>
            <div className="mb-8 lg:hidden">
              <h1 className="text-4xl leading-tight font-semibold tracking-tight">
                把想象<span className="text-spark">变成作品。</span>
              </h1>
            </div>

            <form
              className="rounded-3xl border border-white/10 p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-8"
              style={{ background: "linear-gradient(160deg, rgba(27,33,32,0.62), rgba(13,17,16,0.5))" }}
              onSubmit={(e) => {
                e.preventDefault();
                login();
              }}
            >
              <div className="font-mono text-xs tracking-[0.25em] text-spark">WELCOME BACK</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">登录</h2>
              <p className="mt-2 text-sm text-muted">老师、学生和机构管理员都从这里进入。</p>

              <div className="mt-7 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">账号</span>
                  <span className="relative block">
                    <User size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                    <input
                      className="input !h-12 !rounded-xl !bg-night/70 !pl-10"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="输入你的账号"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      autoFocus
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">密码</span>
                  <span className="relative block">
                    <Lock size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                    <input
                      className="input !h-12 !rounded-xl !bg-night/70 !pr-16 !pl-10"
                      type={reveal ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="输入密码"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((v) => !v)}
                      className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
                      aria-label={reveal ? "隐藏密码" : "显示密码"}
                    >
                      {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
                      {reveal ? "隐藏" : "显示"}
                    </button>
                  </span>
                </label>
              </div>

              <p className="mt-3 min-h-5 text-sm text-danger" role="alert">
                {err}
              </p>

              <button className="btn btn-spark mt-2 !h-12 w-full !rounded-xl text-base font-semibold" disabled={busy} aria-busy={busy}>
                {busy ? "登录中…" : "进入工作台"}
                <ArrowRight size={18} />
              </button>

              {showDemo && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="mb-2.5 text-xs text-muted">演示账号（密码都是 123456）</p>
                  <div className="flex gap-2">
                    {DEMO.map((d) => (
                      <button key={d.username} type="button" className="btn btn-sm flex-1" onClick={() => login(d.username, "123456")} disabled={busy}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </section>
        </div>

        <footer className="login-rise font-mono text-xs text-muted" style={{ animationDelay: "320ms" }}>
          —— {BRAND.name} · 创造力教育平台
        </footer>
      </div>
    </main>
  );
}
