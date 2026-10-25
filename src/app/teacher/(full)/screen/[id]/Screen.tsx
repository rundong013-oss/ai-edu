"use client";
import { useEffect, useState } from "react";
import type { ClassroomLive } from "@/server/queries";
import { NoiseField } from "@/components/NoiseField";

/** 投屏页：老师在课堂面板点「投屏」的作品会全屏显示；没有选中时显示作品墙 */
export function Screen({ initial }: { initial: ClassroomLive }) {
  const [d, setD] = useState(initial);
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch(`/api/classrooms/${initial.room.id}/live`, { cache: "no-store" });
      if (r.ok) setD(await r.json());
    }, 2000);
    return () => clearInterval(t);
  }, [initial.room.id]);

  const spot = d.submissions.find((s) => s.id === d.room.spotlightSubmissionId);

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-night">
      <div className="absolute inset-0 opacity-50">
        <NoiseField variant="ambient" density={0.5} />
      </div>
      <header className="relative flex items-baseline gap-4 px-10 pt-8">
        <h1 className="text-3xl font-semibold">
          第 {d.lesson.index} 节 · {d.lesson.title}
        </h1>
        <span className="text-lg text-muted">{d.room.name}</span>
      </header>
      {spot ? (
        <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 p-10">
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            {spot.type === "TEXT" ? (
              <div className="max-h-full max-w-3xl overflow-auto whitespace-pre-wrap rounded-2xl bg-panel p-10 text-2xl leading-relaxed">{spot.textContent}</div>
            ) : spot.type === "WEB" ? (
              <iframe src={spot.mediaUrl} title={spot.title} sandbox="allow-scripts" className="h-full w-[min(480px,100%)] rounded-[28px] border-[6px] border-[#1f2624] bg-white" />
            ) : spot.type === "VIDEO" && !spot.mediaUrl.endsWith(".svg") ? (
              <video src={spot.mediaUrl} className="max-h-full max-w-full rounded-2xl" autoPlay loop muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={spot.mediaUrl} alt={spot.title} className="max-h-full max-w-full rounded-2xl shadow-2xl shadow-black/60" />
            )}
          </div>
          <div className="text-center">
            <div className="text-4xl font-semibold">{spot.studentName}</div>
            <div className="mt-1 text-xl text-muted">{spot.title}</div>
          </div>
        </section>
      ) : (
        <section className="relative grid flex-1 auto-rows-min grid-cols-4 gap-5 overflow-auto p-10">
          {d.submissions.map((w) => (
            <figure key={w.id} className="card overflow-hidden">
              {w.type === "WEB" || w.type === "TEXT" ? (
                <div className="aspect-[4/3] overflow-hidden whitespace-pre-wrap bg-panel p-4 text-sm text-muted">{w.type === "TEXT" ? w.textContent : "网页作品"}</div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.coverUrl ?? w.mediaUrl} alt={w.title} className="aspect-[4/3] w-full object-cover" />
              )}
              <figcaption className="p-3 text-lg">
                {w.studentName} <span className="text-base text-muted">{w.title}</span>
              </figcaption>
            </figure>
          ))}
          {d.submissions.length === 0 && <p className="col-span-4 mt-24 text-center text-2xl text-muted">同学们提交的作品会出现在这里</p>}
        </section>
      )}
    </main>
  );
}
