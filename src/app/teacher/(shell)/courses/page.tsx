import Link from "next/link";
import { PageHeader } from "@/components/Shell";
import { coursesWithLessons } from "@/server/queries";

export default async function TeacherCourses() {
  const courses = await coursesWithLessons();
  return (
    <>
      <PageHeader title="课程备课" desc="S1–S3 各 16 节，每节 90 分钟。目前 S1 前 3 节可以开课，其余为占位" />
      <div className="space-y-8">
        {courses.map((c) => (
          <section key={c.id}>
            <h2 className="font-medium">{c.title}</h2>
            <p className="mb-3 text-sm text-muted">{c.description}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {c.lessons.map((l) =>
                l.ready ? (
                  <Link key={l.id} href={`/teacher/courses/${l.id}`} className="card p-3.5 transition-colors hover:border-spark/50">
                    <div className="font-mono text-xs text-spark">{String(l.index).padStart(2, "0")}</div>
                    <div className="mt-1 font-medium">{l.title}</div>
                    <div className="text-xs text-muted">
                      {l.subtitle} · {l.kind === "CANVAS" ? "画布" : "Vibe Coding"}
                    </div>
                  </Link>
                ) : (
                  <div key={l.id} className="rounded-[0.9rem] border border-dashed border-line p-3.5 text-muted">
                    <div className="font-mono text-xs">{String(l.index).padStart(2, "0")}</div>
                    <div className="mt-1">{l.title}</div>
                    <div className="text-xs">{l.subtitle}</div>
                  </div>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
