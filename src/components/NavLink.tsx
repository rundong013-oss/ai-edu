"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const p = usePathname();
  const active = exact ? p === href : p === href || p.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
        active ? "bg-raised text-ink [&_svg]:text-spark" : "text-muted hover:bg-raised/60 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
