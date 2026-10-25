import { requireRole } from "@/lib/auth";

// 全屏页面（查看学生画布、演示画布、投屏）：不带左侧导航
export default async function FullLayout({ children }: { children: React.ReactNode }) {
  await requireRole("TEACHER");
  return children;
}
