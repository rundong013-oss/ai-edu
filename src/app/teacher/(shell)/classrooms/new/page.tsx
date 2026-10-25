import { PageHeader } from "@/components/Shell";
import { allLicenses, coursesWithLessons, listUsers } from "@/server/queries";
import { NewClassroomForm } from "./NewClassroomForm";

export default async function NewClassroomPage() {
  const [courses, students, ls] = await Promise.all([coursesWithLessons(), listUsers("STUDENT"), allLicenses()]);
  return (
    <>
      <PageHeader title="新建课堂" desc="课堂只对应一节课。下次上课再建一个新的课堂" />
      <NewClassroomForm
        courses={courses.map((c) => ({
          id: c.id,
          title: c.title,
          lessons: c.lessons.map((l) => ({ id: l.id, index: l.index, title: l.title, subtitle: l.subtitle, kind: l.kind, ready: l.ready })),
          licensed: ls.filter((l) => l.courseId === c.id).map((l) => l.studentId),
        }))}
        students={students.filter((s) => !s.disabled).map((s) => ({ id: s.id, name: s.name, username: s.username }))}
      />
    </>
  );
}
