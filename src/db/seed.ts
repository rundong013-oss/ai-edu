// 写入演示账号 + 课程内容。可重复运行：课程内容按 code/序号更新，账号已存在则跳过。
import "dotenv/config";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { users, courses, lessons, tasks, frameTemplates, licenses, promptBlocks } from "./schema";
import { DEFAULT_BLOCKS } from "../server/prompts";
import { curriculum, PLAN_PLACEHOLDER } from "../content/curriculum";

// 本地开发：所有演示账号密码 123456。
// 服务器部署：ADMIN_PASSWORD 设置管理员密码；DEMO_PASSWORD 设置演示老师/学生的密码；SEED_DEMO=false 则不建演示老师/学生。
async function seedUsers() {
  const prod = process.env.NODE_ENV === "production";
  const adminPw = process.env.ADMIN_PASSWORD || (prod ? "" : "123456");
  const demoPw = process.env.DEMO_PASSWORD || (prod ? "" : "123456");
  if (prod && !adminPw) throw new Error("生产环境需要设置 ADMIN_PASSWORD");
  const admin = await db.query.users.findFirst({ where: eq(users.username, "admin") });
  if (!admin) await db.insert(users).values({ username: "admin", name: "机构管理员", role: "ADMIN", passwordHash: bcrypt.hashSync(adminPw, 10) });
  if (process.env.SEED_DEMO === "false" || !demoPw) return;
  const pw = bcrypt.hashSync(demoPw, 10);
  const demo = [
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

      // 任务按序号、框体模板按 key 原地更新：已有工作区里框体的 taskId / templateId 不会失效
      const defs = l.tasks ?? [];
      const oldTasks = await db.query.tasks.findMany({ where: eq(tasks.lessonId, lesson!.id) });
      for (const old of oldTasks) if (old.order >= defs.length) await db.delete(tasks).where(eq(tasks.id, old.id));
      for (const [ti, t] of defs.entries()) {
        const tFields = { title: t.title, description: t.description, kind: t.kind, codingPrompt: t.codingPrompt ?? "" };
        let task = oldTasks.find((x) => x.order === ti);
        if (task) await db.update(tasks).set(tFields).where(eq(tasks.id, task.id));
        else [task] = await db.insert(tasks).values({ ...tFields, lessonId: lesson!.id, order: ti }).returning();
        const oldTpls = await db.query.frameTemplates.findMany({ where: eq(frameTemplates.taskId, task!.id) });
        const keys = new Set((t.frames ?? []).map((f) => f.key));
        for (const o of oldTpls) if (!keys.has(o.key)) await db.delete(frameTemplates).where(eq(frameTemplates.id, o.id));
        for (const [fi, f] of (t.frames ?? []).entries()) {
          const fFields = {
            order: fi,
            type: f.type,
            title: f.title,
            promptTemplate: f.promptTemplate,
            slots: f.slots,
            aspectRatio: f.aspectRatio ?? "1:1",
            maxGenerations: f.maxGenerations ?? 3,
            upstreamKeys: f.upstreamKeys ?? [],
            crossLessonRefs: f.crossLessonRefs ?? [],
            blockCategories: f.blockCategories ?? [],
            posX: f.pos[0],
            posY: f.pos[1],
          };
          const o = oldTpls.find((x) => x.key === f.key);
          if (o) await db.update(frameTemplates).set(fFields).where(eq(frameTemplates.id, o.id));
          else await db.insert(frameTemplates).values({ ...fFields, taskId: task!.id, key: f.key });
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

async function seedBlocks() {
  const n = await db.select().from(promptBlocks);
  if (n.length) return; // 积木库已在后台维护过，不覆盖
  await db.insert(promptBlocks).values(DEFAULT_BLOCKS.map((b, i) => ({ ...b, sortOrder: i })));
}

(async () => {
  await seedUsers();
  await seedBlocks();
  await seedCurriculum();
  await seedLicenses();
  const n = await db.select().from(lessons);
  console.log(`seed ok: ${n.length} lessons`);
  process.exit(0);
})();
