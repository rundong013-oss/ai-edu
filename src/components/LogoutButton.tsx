"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { startNav } from "./NavProgress";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      title="退出登录"
      aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        startNav();
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      <LogOut size={15} />
      {!compact && "退出"}
    </button>
  );
}
