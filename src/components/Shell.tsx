import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { LogoutButton } from "./LogoutButton";
import { NavLink } from "./NavLink";

export type NavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean };

/** 机构端、教师端共用的左侧导航布局 */
export function Shell({
  roleLabel,
  userName,
  nav,
  children,
}: {
  roleLabel: string;
  userName: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col border-r border-line bg-panel px-3 py-5">
        <Link href="/" className="px-2">
          <div className="text-lg font-semibold">{BRAND.name}</div>
          <div className="mt-0.5 text-xs text-muted">{roleLabel}</div>
        </Link>
        <nav className="mt-7 flex flex-col gap-0.5">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.exact}>
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between border-t border-line px-2 pt-4">
          <span className="truncate text-sm">{userName}</span>
          <LogoutButton compact />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
    </div>
  );
}

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
