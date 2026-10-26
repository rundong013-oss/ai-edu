import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/Shell";
import { requireRole } from "@/lib/auth";
import { teacherClassrooms } from "@/server/queries";
import { kindLabel } from "@/lib/lesson";

const STATUS = { READY: "未开课", LIVE: "上课中", ENDED: "已下课" } as const;

export default async function TeacherHome() {
  const s = await requireRole("TEACHER");
  const rooms = await teacherClassrooms(s.uid);
  return (
    <>
      <PageHeader
        title="我的课堂"
        desc="每次上课建一个课堂：选好课节，把学生拉进来，然后开课"
        actions={
          <Link href="/teacher/classrooms/new" className="btn btn-spark">
            <Plus size={16} />
            新建课堂
          </Link>
        }
      />
      {rooms.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          还没有课堂。
          <Link href="/teacher/classrooms/new" className="ml-1 text-spark">
            新建第一个课堂
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>课堂</th>
                <th>课节</th>
                <th>学生</th>
                <th>作品</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="hover:bg-raised/40">
                  <td>
                    <Link href={`/teacher/classrooms/${r.id}`} className="font-medium hover:text-spark">
                      {r.name}
                    </Link>
                  </td>
                  <td className="text-sm">
                    {r.course.code} 第 {r.lesson.index} 节 · {r.lesson.title}
                    <span className="ml-1.5 text-xs text-muted">{kindLabel(r.lesson.kind)}</span>
                  </td>
                  <td className="font-mono">{r.studentCount}</td>
                  <td className="font-mono">{r.submissionCount}</td>
                  <td>
                    <span className={`tag ${r.status === "LIVE" ? "tag-live" : ""}`}>
                      {r.status === "LIVE" && <span className="live-dot" />}
                      {STATUS[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
