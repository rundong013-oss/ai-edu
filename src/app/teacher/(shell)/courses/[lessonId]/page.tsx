import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { FileText, Presentation } from "lucide-react";
import { db } from "@/db";
import { courses, lessons } from "@/db/schema";
import { PageHeader } from "@/components/Shell";
import { Md } from "@/components/Md";
import { lessonTasksWithTemplates } from "@/server/workspace";
import { hasCanvas, hasCoding, kindLessonLabel } from "@/lib/lesson";

/** 提示词模板：填空处显示学生看到的标签（如「角色是谁」）和默认值 */
function Template({ tpl, slots }: { tpl: string; slots: { key: string; label: string; default: string }[] }) {
  return (
    <span className="leading-loose">
      {tpl.split(/(\{\{\w+\}\})/g).map((p, i) => {
        if (!p.startsWith("{{")) return p;
        const slot = slots.find((s) => s.key === p.slice(2, -2));
        return (
          <span key={i} className="mx-0.5 rounded bg-spark-dim px-1.5 py-0.5 text-spark" title={slot ? `默认：${slot.default}` : undefined}>
            {slot?.label ?? p.slice(2, -2)}
          </span>
        );
      })}
    </span>
  );
}

export default async function LessonPrep({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) notFound();
  const course = await db.query.courses.findFirst({ where: eq(courses.id, lesson.courseId) });
  const tasks = await lessonTasksWithTemplates(lessonId);

  return (
    <>
      <PageHeader
        title={`第 ${lesson.index} 节 · ${lesson.title}`}
        desc={`${course?.title} · ${lesson.subtitle} · ${lesson.durationMin} 分钟 · ${kindLessonLabel(lesson.kind)}`}
        actions={
          hasCanvas(lesson.kind) ? (
            <Link href={`/teacher/demo/${lesson.id}?tab=1`} target="_blank" className="btn btn-spark">
              <Presentation size={15} />
              打开演示画布
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-3 font-medium">教学目标</h2>
            <Md text={lesson.objectives || "（待填写）"} />
          </section>
          <section className="card p-5">
            <h2 className="mb-4 font-medium">课堂任务</h2>
            <ol className="space-y-4">
              {tasks.map((t, i) => (
                <li key={t.id} className="border-l-2 border-line pl-4">
                  <div className="font-medium">
                    <span className="mr-2 font-mono text-sm text-muted">{i + 1}</span>
                    {t.title}
                  </div>
                  <p className="mt-1 text-sm text-muted">{t.description}</p>
                  {t.templates.map((f) => (
                    <div key={f.id} className="mt-2 rounded-lg bg-night p-3 text-sm">
                      <div className="mb-1 text-xs text-muted">
                        {f.type === "VIDEO" ? "视频框" : f.type === "TEXT" ? "文字框" : "图片框"} · {f.title} · 可生成 {f.maxGenerations} 次 · 画幅 {f.aspectRatio}
                        {f.upstreamKeys.length > 0 && ` · 参考：${f.upstreamKeys.join("、")}`}
                        {f.crossLessonRefs.length > 0 && " · 自动参考上节课作品"}
                        {f.transparentBg && " · 透明背景"}
                      </div>
                      <Template tpl={f.promptTemplate} slots={f.slots} />
                    </div>
                  ))}
                  {t.codingPrompt && t.kind !== "FREE" && (
                    <div className="mt-2 rounded-lg bg-night p-3 text-sm text-ink/85">
                      <div className="mb-1 text-xs text-muted">Vibe Coding · 预设提示词（学生点「任务」自动填入，可以改）</div>
                      {t.codingPrompt}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-medium">
              <FileText size={16} className="text-muted" />
              教案
            </h2>
            <Md text={lesson.lessonPlan} />
          </section>
        </div>
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-medium">
              <Presentation size={16} className="text-muted" />
              PPT 课件
            </h2>
            <div className="grid aspect-video place-items-center rounded-lg border border-dashed border-line text-sm text-muted">课件待上传（占位）</div>
          </section>
          <section className="card space-y-1.5 p-5 text-sm text-muted">
            {hasCanvas(lesson.kind) && lesson.spareFrames > 0 && <p>本节每个学生有 {lesson.spareFrames} 个备用框体用于自由创作。</p>}
            {hasCoding(lesson.kind) && <p>本节每个学生最多和 AI 对话 {lesson.codingMaxTurns} 次。</p>}
            {lesson.kind === "MIXED" && <p>学生先在画布上完成素材，再点「下一步」进入编程；画布上选中的图会自动放进项目的 assets/ 文件夹。</p>}
          </section>
        </div>
      </div>
    </>
  );
}
