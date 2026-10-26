import { notFound } from "next/navigation";
import { demoState } from "@/server/workspace";
import { CanvasDemo } from "@/components/canvas/CanvasRoom";

export default async function DemoCanvas({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const st = await demoState(lessonId);
  // 混合课只演示画布部分
  if (!st || st.lesson.kind === "CODING") notFound();
  return <CanvasDemo initial={JSON.parse(JSON.stringify(st))} backHref={`/teacher/courses/${lessonId}`} />;
}
