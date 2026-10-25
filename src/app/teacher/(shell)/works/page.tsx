import { PageHeader } from "@/components/Shell";
import { WorkCard } from "@/components/WorkCard";
import { requireRole } from "@/lib/auth";
import { submissionViews, teacherClassrooms } from "@/server/queries";

export default async function TeacherWorks() {
  const s = await requireRole("TEACHER");
  const rooms = await teacherClassrooms(s.uid);
  const works = await submissionViews({ classroomIds: rooms.map((r) => r.id) });
  return (
    <>
      <PageHeader title="学生作品" desc="点开作品是分享页，可以直接发到家长群；页面里有二维码" />
      {works.length === 0 ? (
        <div className="card p-10 text-center text-muted">还没有学生提交作品</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {works.map((w) => (
            <WorkCard key={w.id} w={w} />
          ))}
        </div>
      )}
    </>
  );
}
