import { PageHeader } from "@/components/Shell";
import { allLicenses, coursesWithLessons, listUsers } from "@/server/queries";
import { LicenseToggle } from "./LicenseToggle";

export default async function LicensesPage() {
  const [students, courses, ls] = await Promise.all([listUsers("STUDENT"), coursesWithLessons(), allLicenses()]);
  const has = (s: string, c: string) => ls.some((l) => l.studentId === s && l.courseId === c);
  return (
    <>
      <PageHeader title="课包授权" desc="学生被授权某个课包后，老师才能把他加进这个课包的课堂" />
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>学生</th>
              {courses.map((c) => (
                <th key={c.id}>{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.name} <span className="ml-1 font-mono text-xs text-muted">{s.username}</span>
                </td>
                {courses.map((c) => (
                  <td key={c.id}>
                    <LicenseToggle studentId={s.id} courseId={c.id} on={has(s.id, c.id)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
