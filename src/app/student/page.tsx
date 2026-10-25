import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { courses, licenses } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { LogoutButton } from "@/components/LogoutButton";
import { WorkCard } from "@/components/WorkCard";
import { studentClassrooms, submissionViews } from "@/server/queries";

export default async function StudentHome() {
  const s = await requireRole("STUDENT");
  const [rooms, works, lic] = await Promise.all([
    studentClassrooms(s.uid),
    submissionViews({ studentId: s.uid }),
    db.query.licenses.findMany({ where: eq(licenses.studentId, s.uid) }),
  ]);
  const myCourses = lic.length ? await db.query.courses.findMany({ where: inArray(courses.id, lic.map((l) => l.courseId)) }) : [];
  const live = rooms.filter((r) => r.status === "LIVE");
  const ready = rooms.filter((r) => r.status === "READY").sort((a, b) => a.course.level - b.course.level || a.lesson.index - b.lesson.index);
  const ended = rooms.filter((r) => r.status === "ENDED");

  return (
    <div className="mx-auto max-w-6xl px-6 pb-16">
      <header className="flex h-16 items-center gap-4">
        <span className="font-semibold">{BRAND.name}</span>
        <span className="text-sm text-muted">{myCourses.map((c) => c.code).join(" · ")}</span>
        <span className="ml-auto text-sm">{s.name}</span>
        <LogoutButton />
      </header>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{s.name}，今天想创造点什么？</h1>

      <section className="mt-8">
        {live.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {live.map((r) => (
              <Link key={r.id} href={`/student/room/${r.id}`} className="card group flex items-center gap-4 border-spark/40 p-5 transition-colors hover:bg-raised">
                <span className="live-dot" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-spark">正在上课 · {r.teacherName}</div>
                  <div className="mt-1 text-xl font-semibold">
                    第 {r.lesson.index} 节 · {r.lesson.title}
                  </div>
                  <div className="text-sm text-muted">{r.name}</div>
                </div>
                <span className="btn btn-spark">
                  进入课堂
                  <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card p-6 text-muted">现在没有正在上的课。老师开课后，这里会出现「进入课堂」。</div>
        )}
      </section>

      {ready.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm text-muted">即将上课</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {ready.map((r) => (
              <Link key={r.id} href={`/student/room/${r.id}`} className="card p-4 hover:bg-raised">
                <div className="font-medium">
                  第 {r.lesson.index} 节 · {r.lesson.title}
                </div>
                <div className="text-sm text-muted">
                  {r.name} · {r.teacherName}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">我的作品</h2>
        {works.length === 0 ? (
          <div className="card p-6 text-muted">在课堂里提交的作品都会收在这里，还可以分享给爸爸妈妈。</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {works.map((w) => (
              <WorkCard key={w.id} w={w} showStudent={false} />
            ))}
          </div>
        )}
      </section>

      {ended.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm text-muted">上过的课（可以回看）</h2>
          <div className="flex flex-wrap gap-2">
            {ended.map((r) => (
              <Link key={r.id} href={`/student/room/${r.id}`} className="btn btn-sm">
                第 {r.lesson.index} 节 · {r.lesson.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
