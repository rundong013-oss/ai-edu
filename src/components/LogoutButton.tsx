"use client";
import { LogOut } from "lucide-react";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <button
      className="btn btn-ghost btn-sm"
      title="退出登录"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      <LogOut size={15} />
      {!compact && "退出"}
    </button>
  );
}
