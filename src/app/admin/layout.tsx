import { BarChart3, BookOpen, KeyRound, LayoutDashboard, Users } from "lucide-react";
import { Shell } from "@/components/Shell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole("ADMIN");
  return (
    <Shell
      roleLabel="机构后台"
      userName={s.name}
      nav={[
        { href: "/admin", label: "概览", icon: <LayoutDashboard size={16} />, exact: true },
        { href: "/admin/users", label: "账号", icon: <Users size={16} /> },
        { href: "/admin/licenses", label: "课包授权", icon: <KeyRound size={16} /> },
        { href: "/admin/courses", label: "课程与额度", icon: <BookOpen size={16} /> },
        { href: "/admin/usage", label: "算力用量", icon: <BarChart3 size={16} /> },
      ]}
    >
      {children}
    </Shell>
  );
}
