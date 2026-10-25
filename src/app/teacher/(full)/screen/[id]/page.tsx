import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { classroomLive } from "@/server/queries";
import { Screen } from "./Screen";

export default async function ScreenPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("TEACHER");
  const { id } = await params;
  const live = await classroomLive(id);
  if (!live || live.room.teacherId !== s.uid) notFound();
  return <Screen initial={JSON.parse(JSON.stringify(live))} />;
}
