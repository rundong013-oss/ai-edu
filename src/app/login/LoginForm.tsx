"use client";
import { useState } from "react";
import { NoiseField } from "@/components/NoiseField";
import { BRAND } from "@/lib/brand";
import { startNav } from "@/components/NavProgress";

const DEMO = [
  { label: "学生", username: "stu1" },
  { label: "老师", username: "teacher" },
  { label: "机构后台", username: "admin" },
];

export function LoginForm({ showDemo }: { showDemo: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(u = username, p = password) {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error);
      setBusy(false);
      return;
    }
    startNav();
    window.location.href = j.home;
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div className="absolute inset-0">
        <NoiseField variant="ambient" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--night)_75%)]" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8">
          <div className="font-mono text-sm text-spark">{BRAND.en.toLowerCase().replace(" ", "_")}</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{BRAND.name}</h1>
          <p className="mt-2 text-muted">{BRAND.tagline}</p>
        </div>

        <form
          className="card space-y-3 p-5 backdrop-blur"
          style={{ background: "rgba(20,25,24,0.82)" }}
          onSubmit={(e) => {
            e.preventDefault();
            login();
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">账号</span>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted">密码</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {err && <p className="text-sm text-danger">{err}</p>}
          <button className="btn btn-spark w-full" disabled={busy} aria-busy={busy}>
            {busy ? "登录中…" : "登录"}
          </button>
        </form>

        {showDemo && (
        <div className="mt-5 text-sm text-muted">
          <p className="mb-2">演示账号（密码都是 123456）</p>
          <div className="flex gap-2">
            {DEMO.map((d) => (
              <button key={d.username} className="btn btn-sm" onClick={() => login(d.username, "123456")} disabled={busy}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        )}
      </div>
    </main>
  );
}
