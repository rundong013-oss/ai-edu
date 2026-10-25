import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { classroomLive } from "@/server/queries";
import { LivePanel } from "./LivePanel";

export default async function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("TEACHER");
  const { id } = await params;
  const live = await classroomLive(id);
  if (!live || live.room.teacherId !== s.uid) notFound();
  return <LivePanel initial={JSON.parse(JSON.stringify(live))} />;
}
