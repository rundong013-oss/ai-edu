import { requireRole } from "@/lib/auth";
export default async function Page() {
  const s = await requireRole("STUDENT");
  return <div className="p-8">你好，{s.name}</div>;
}
