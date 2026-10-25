import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getClassroomFull, isStudentInClassroom } from "@/server/workspace";
import { RoomGate } from "@/components/room/RoomGate";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("STUDENT");
  const { id } = await params;
  const full = await getClassroomFull(id);
  if (!full || !(await isStudentInClassroom(id, s.uid))) notFound();
  return (
    <RoomGate
      classroomId={id}
      kind={full.lesson.kind}
      title={`${full.course.code} 第 ${full.lesson.index} 节 · ${full.lesson.title}`}
      roomName={full.room.name}
      studentName={s.name}
    />
  );
}
