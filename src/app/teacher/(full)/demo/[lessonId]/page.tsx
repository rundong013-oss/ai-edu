import { notFound } from "next/navigation";
import { demoState } from "@/server/workspace";
import { CanvasDemo } from "@/components/canvas/CanvasRoom";

export default async function DemoCanvas({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const st = await demoState(lessonId);
  if (!st || st.lesson.kind !== "CANVAS") notFound();
  return <CanvasDemo initial={JSON.parse(JSON.stringify(st))} backHref={`/teacher/courses/${lessonId}`} />;
}
