import { PageHeader } from "@/components/Shell";
import { usageSummary } from "@/server/queries";

const s = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`);
const KIND = { IMAGE: "生图", VIDEO: "生视频", CODING: "Vibe Coding" } as const;

export default async function UsagePage() {
  const u = await usageSummary();
  const Table = ({ title, rows }: { title: string; rows: typeof u.byStudent }) => (
    <section className="card overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 font-medium">{title}</h2>
      <table className="tbl">
        <thead>
          <tr>
            <th></th>
            <th className="text-right">图片</th>
            <th className="text-right">视频</th>
            <th className="text-right">对话</th>
            <th className="text-right">Tokens</th>
            <th className="text-right">成本</th>
            <th className="text-right">失败</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="font-sans">{r.name}</td>
              <td className="text-right">{r.images}</td>
              <td className="text-right">{r.videos}</td>
              <td className="text-right">{r.codingTurns}</td>
              <td className="text-right">{r.tokens.toLocaleString()}</td>
              <td className="text-right">${r.cost.toFixed(3)}</td>
              <td className="text-right">{r.failures || ""}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center font-sans text-muted">
                还没有用量记录
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
  return (
    <>
      <PageHeader title="算力用量" desc="每一次生成都记一笔：谁、哪节课、用了什么模型、花了多少、用了多久" />
      <section className="card mb-6 p-4">
        <h2 className="mb-3 font-medium">速度</h2>
        <div className="grid grid-cols-2 gap-4 font-mono text-sm lg:grid-cols-4">
          <div>
            <div className="font-sans text-xs text-muted">生图平均</div>
            {s(u.latency.imageAvgMs)}
          </div>
          <div>
            <div className="font-sans text-xs text-muted">Vibe Coding 首次预览（平均 / P90）</div>
            {s(u.latency.codingFirstPreviewAvg)} / {s(u.latency.codingFirstPreviewP90)}
          </div>
          <div>
            <div className="font-sans text-xs text-muted">Vibe Coding 完成（平均 / P90）</div>
            {s(u.latency.codingTotalAvg)} / {s(u.latency.codingTotalP90)}
          </div>
          <div>
            <div className="font-sans text-xs text-muted">样本数</div>
            {u.latency.codingRuns} 次运行
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">目标：首次预览 &lt; 30s，首版完成 &lt; 2 分钟。</p>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Table title="按学生" rows={u.byStudent} />
        <Table title="按课节" rows={u.byLesson} />
      </div>
      <section className="card mt-6 overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 font-medium">最近记录</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>时间</th>
              <th>学生</th>
              <th>课节</th>
              <th>类型</th>
              <th>模型</th>
              <th className="text-right">耗时</th>
              <th className="text-right">成本</th>
            </tr>
          </thead>
          <tbody>
            {u.recent.map((r) => (
              <tr key={r.id} className={r.success ? "" : "text-amber"}>
                <td className="font-mono text-xs text-muted">{r.createdAt.toLocaleString("zh-CN", { hour12: false })}</td>
                <td>{r.studentName}</td>
                <td className="text-sm">{r.lessonName}</td>
                <td>{KIND[r.kind]}{r.success ? "" : "（失败，已退回次数）"}</td>
                <td className="font-mono text-xs">{r.model}</td>
                <td className="text-right font-mono">{s(r.latencyMs)}</td>
                <td className="text-right font-mono">${r.costUsd.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
