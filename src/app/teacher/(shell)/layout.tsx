import { BookOpenText, Images, Presentation } from "lucide-react";
import { Shell } from "@/components/Shell";
import { requireRole } from "@/lib/auth";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole("TEACHER");
  return (
    <Shell
      roleLabel="教师端"
      userName={s.name}
      nav={[
        { href: "/teacher", label: "我的课堂", icon: <Presentation size={16} />, exact: true },
        { href: "/teacher/courses", label: "课程备课", icon: <BookOpenText size={16} /> },
        { href: "/teacher/works", label: "学生作品", icon: <Images size={16} /> },
      ]}
    >
      {children}
    </Shell>
  );
}
