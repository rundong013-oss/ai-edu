import Link from "next/link";
import { PageHeader } from "@/components/Shell";
import { overviewCounts, usageSummary } from "@/server/queries";

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <div className="card h-full p-4 transition-colors hover:border-[#3a4642]">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 font-mono text-2xl">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminHome() {
  const [c, u] = await Promise.all([overviewCounts(), usageSummary()]);
  return (
    <>
      <PageHeader title="概览" desc="账号、课堂和算力的整体情况" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="学生" value={c.students} href="/admin/users" />
        <Stat label="老师" value={c.teachers} href="/admin/users" />
        <Stat label="上课中的课堂" value={`${c.liveRooms} / ${c.rooms}`} />
        <Stat label="学生作品" value={c.submissions} />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">算力消耗</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="生成图片" value={u.totals.images} href="/admin/usage" />
        <Stat label="生成视频" value={u.totals.videos} href="/admin/usage" />
        <Stat label="Vibe Coding 对话" value={u.totals.codingTurns} href="/admin/usage" />
        <Stat label="估算成本（美元）" value={`$${u.totals.cost.toFixed(2)}`} href="/admin/usage" />
      </div>
    </>
  );
}
