import { PageHeader } from "@/components/Shell";
import { coursesWithLessons } from "@/server/queries";
import { LessonQuota } from "./LessonQuota";

export default async function CoursesPage() {
  const courses = await coursesWithLessons();
  return (
    <>
      <PageHeader title="课程与额度" desc="每节课的算力额度在这里配置；每个框体的生成次数由课程内容决定" />
      <div className="space-y-6">
        {courses.map((c) => (
          <section key={c.id} className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <div className="font-medium">{c.title}</div>
              <div className="text-sm text-muted">{c.description}</div>
            </div>
            <table className="tbl">
              <tbody>
                {c.lessons.map((l) => (
                  <tr key={l.id} className={l.ready ? "" : "text-muted"}>
                    <td className="w-14 font-mono">{String(l.index).padStart(2, "0")}</td>
                    <td>
                      {l.title}
                      {l.subtitle && <span className="ml-2 text-sm text-muted">{l.subtitle}</span>}
                    </td>
                    <td className="w-24">{l.kind === "CANVAS" ? "画布" : "Vibe Coding"}</td>
                    <td>
                      {l.ready ? (
                        <LessonQuota id={l.id} kind={l.kind} spareFrames={l.spareFrames} codingMaxTurns={l.codingMaxTurns} codingModel={l.codingModel} />
                      ) : (
                        <span className="text-xs">内容待设计</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </>
  );
}
