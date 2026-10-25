// 写入演示账号 + 课程内容。可重复运行：课程内容按 code/序号更新，账号已存在则跳过。
import "dotenv/config";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { users, courses, lessons, tasks, frameTemplates, licenses } from "./schema";
import { curriculum, PLAN_PLACEHOLDER } from "../content/curriculum";

async function seedUsers() {
  const pw = bcrypt.hashSync("123456", 10);
  const demo = [
    { username: "admin", name: "机构管理员", role: "ADMIN" as const },
    { username: "teacher", name: "张老师", role: "TEACHER" as const },
    { username: "teacher2", name: "李老师", role: "TEACHER" as const },
    { username: "stu1", name: "小明", role: "STUDENT" as const },
    { username: "stu2", name: "小红", role: "STUDENT" as const },
    { username: "stu3", name: "小刚", role: "STUDENT" as const },
    { username: "stu4", name: "小美", role: "STUDENT" as const },
  ];
  for (const u of demo) {
    const exists = await db.query.users.findFirst({ where: eq(users.username, u.username) });
    if (!exists) await db.insert(users).values({ ...u, passwordHash: pw });
  }
}

async function seedCurriculum() {
  for (const c of curriculum) {
    let course = await db.query.courses.findFirst({ where: eq(courses.code, c.code) });
    if (course) {
      await db.update(courses).set({ title: c.title, description: c.description, level: c.level }).where(eq(courses.id, course.id));
    } else {
      [course] = await db.insert(courses).values({ code: c.code, title: c.title, description: c.description, level: c.level }).returning();
    }
    for (const l of c.lessons) {
      const fields = {
        title: l.title,
        subtitle: l.subtitle ?? "",
        kind: l.kind,
        ready: l.ready,
        objectives: l.objectives ?? "",
        lessonPlan: PLAN_PLACEHOLDER,
        spareFrames: l.spareFrames ?? 2,
        codingMaxTurns: l.codingMaxTurns ?? 12,
        codingScaffold: l.codingScaffold ?? "",
        codingClaudeMd: l.codingClaudeMd ?? "",
      };
      let lesson = await db.query.lessons.findFirst({ where: and(eq(lessons.courseId, course!.id), eq(lessons.index, l.index)) });
      if (lesson) await db.update(lessons).set(fields).where(eq(lessons.id, lesson.id));
      else [lesson] = await db.insert(lessons).values({ ...fields, courseId: course!.id, index: l.index }).returning();

      // 任务和框体模板整体替换（已开课的框体实例保存了自己的副本，不受影响）
      await db.delete(tasks).where(eq(tasks.lessonId, lesson!.id));
      for (const [ti, t] of (l.tasks ?? []).entries()) {
        const [task] = await db
          .insert(tasks)
          .values({ lessonId: lesson!.id, order: ti, title: t.title, description: t.description, kind: t.kind, codingPrompt: t.codingPrompt ?? "" })
          .returning();
        for (const [fi, f] of (t.frames ?? []).entries()) {
          await db.insert(frameTemplates).values({
            taskId: task.id,
            key: f.key,
            order: fi,
            type: f.type,
            title: f.title,
            promptTemplate: f.promptTemplate,
            slots: f.slots,
            aspectRatio: f.aspectRatio ?? "1:1",
            maxGenerations: f.maxGenerations ?? 3,
            upstreamKeys: f.upstreamKeys ?? [],
            crossLessonRefs: f.crossLessonRefs ?? [],
            posX: f.pos[0],
            posY: f.pos[1],
          });
        }
      }
    }
  }
}

async function seedLicenses() {
  const s1 = await db.query.courses.findFirst({ where: eq(courses.code, "S1") });
  const admin = await db.query.users.findFirst({ where: eq(users.username, "admin") });
  for (const name of ["stu1", "stu2", "stu3"]) {
    const s = await db.query.users.findFirst({ where: eq(users.username, name) });
    if (!s || !s1) continue;
    await db.insert(licenses).values({ studentId: s.id, courseId: s1.id, grantedById: admin?.id }).onConflictDoNothing();
  }
}

(async () => {
  await seedUsers();
  await seedCurriculum();
  await seedLicenses();
  const n = await db.select().from(lessons);
  console.log(`seed ok: ${n.length} lessons`);
  process.exit(0);
})();
