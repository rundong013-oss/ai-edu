"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type C = { id: string; title: string; lessons: { id: string; index: number; title: string; subtitle: string; kind: string; ready: boolean }[]; licensed: string[] };

export function NewClassroomForm({ courses, students }: { courses: C[]; students: { id: string; name: string; username: string }[] }) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const course = courses.find((c) => c.id === courseId);
  const [lessonId, setLessonId] = useState(course?.lessons.find((l) => l.ready)?.id ?? "");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lesson = course?.lessons.find((l) => l.id === lessonId);
  const placeholder = useMemo(() => (lesson ? `例如：周六 14:00 · 第 ${lesson.index} 节${lesson.title}` : "例如：周六 14:00 张老师班"), [lesson]);

  return (
    <form
      className="grid max-w-3xl gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const r = await fetch("/api/classrooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: name || placeholder.replace(/^例如：/, ""), lessonId, studentIds: [...picked] }),
        });
        const j = await r.json();
        if (!r.ok) {
          setErr(j.error);
          setBusy(false);
          return;
        }
        router.push(`/teacher/classrooms/${j.id}`);
      }}
    >
      <section className="card p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">课堂名称</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} />
        </label>
        <div className="mt-4 grid grid-cols-[180px_1fr] gap-3">
          <label>
            <span className="mb-1.5 block text-sm text-muted">课包</span>
            <select
              className="input"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setLessonId(courses.find((c) => c.id === e.target.value)?.lessons.find((l) => l.ready)?.id ?? "");
                setPicked(new Set());
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-sm text-muted">课节</span>
            <select className="input" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              {course?.lessons.map((l) => (
                <option key={l.id} value={l.id} disabled={!l.ready}>
                  第 {l.index} 节 · {l.title}
                  {l.subtitle ? `（${l.subtitle}）` : ""}
                  {l.ready ? (l.kind === "CODING" ? " · Vibe Coding" : " · 画布") : " · 待设计"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted">学生（已选 {picked.size} 人）</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked(new Set(students.filter((s) => course?.licensed.includes(s.id)).map((s) => s.id)))}>
            全选已授权
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {students.map((s) => {
            const ok = course?.licensed.includes(s.id);
            const on = picked.has(s.id);
            return (
              <button
                type="button"
                key={s.id}
                disabled={!ok}
                onClick={() => {
                  const n = new Set(picked);
                  if (on) n.delete(s.id);
                  else n.add(s.id);
                  setPicked(n);
                }}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  on ? "border-spark bg-spark-dim" : "border-line hover:border-muted"
                } disabled:cursor-not-allowed disabled:opacity-40`}
                title={ok ? "" : "还没有被授权这个课包"}
              >
                {s.name}
                <span className="ml-1.5 font-mono text-xs text-muted">{ok ? s.username : "未授权"}</span>
              </button>
            );
          })}
        </div>
      </section>

      {err && <p className="text-sm text-danger">{err}</p>}
      <div>
        <button className="btn btn-spark" disabled={busy || !lessonId}>
          创建课堂
        </button>
      </div>
    </form>
  );
}
