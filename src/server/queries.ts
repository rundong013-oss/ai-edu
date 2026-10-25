// 各端页面用到的查询（服务端组件直接调用）
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  agentRuns,
  classrooms,
  classroomStudents,
  courses,
  frames,
  lessons,
  licenses,
  submissions,
  usageRecords,
  users,
  workspaces,
} from "@/db/schema";

export async function coursesWithLessons() {
  const cs = await db.query.courses.findMany({ orderBy: asc(courses.level) });
  const ls = await db.query.lessons.findMany({ orderBy: asc(lessons.index) });
  return cs.map((c) => ({ ...c, lessons: ls.filter((l) => l.courseId === c.id) }));
}

export async function listUsers(role?: "ADMIN" | "TEACHER" | "STUDENT") {
  return db.query.users.findMany({ where: role ? eq(users.role, role) : undefined, orderBy: asc(users.createdAt) });
}

export async function licensedStudentIds(courseId: string) {
  const ls = await db.query.licenses.findMany({ where: eq(licenses.courseId, courseId) });
  return ls.map((l) => l.studentId);
}

export async function allLicenses() {
  return db.select().from(licenses);
}

/** 老师的课堂列表 */
export async function teacherClassrooms(teacherId: string) {
  const rooms = await db.query.classrooms.findMany({ where: eq(classrooms.teacherId, teacherId), orderBy: desc(classrooms.createdAt) });
  return enrichRooms(rooms);
}

async function enrichRooms(rooms: (typeof classrooms.$inferSelect)[]) {
  if (!rooms.length) return [];
  const ls = await db.query.lessons.findMany({ where: inArray(lessons.id, rooms.map((r) => r.lessonId)) });
  const cs = await db.query.courses.findMany();
  const members = await db.query.classroomStudents.findMany({ where: inArray(classroomStudents.classroomId, rooms.map((r) => r.id)) });
  const subs = await db.query.submissions.findMany({ where: inArray(submissions.classroomId, rooms.map((r) => r.id)) });
  return rooms.map((r) => {
    const l = ls.find((x) => x.id === r.lessonId)!;
    return {
      ...r,
      lesson: l,
      course: cs.find((c) => c.id === r.courseId)!,
      studentCount: members.filter((m) => m.classroomId === r.id).length,
      submissionCount: subs.filter((s) => s.classroomId === r.id).length,
    };
  });
}

/** 学生的课堂列表 */
export async function studentClassrooms(studentId: string) {
  const ms = await db.query.classroomStudents.findMany({ where: eq(classroomStudents.studentId, studentId) });
  if (!ms.length) return [];
  const rooms = await db.query.classrooms.findMany({ where: inArray(classrooms.id, ms.map((m) => m.classroomId)), orderBy: desc(classrooms.createdAt) });
  const enriched = await enrichRooms(rooms);
  const teachers = await db.query.users.findMany({ where: inArray(users.id, rooms.map((r) => r.teacherId)) });
  return enriched.map((r) => ({ ...r, teacherName: teachers.find((t) => t.id === r.teacherId)?.name ?? "" }));
}

export type SubmissionView = Awaited<ReturnType<typeof submissionViews>>[number];

export async function submissionViews(where: { studentId?: string; classroomIds?: string[] }) {
  const conds = [];
  if (where.studentId) conds.push(eq(submissions.studentId, where.studentId));
  if (where.classroomIds) {
    if (!where.classroomIds.length) return [];
    conds.push(inArray(submissions.classroomId, where.classroomIds));
  }
  const subs = await db.query.submissions.findMany({ where: conds.length ? and(...conds) : undefined, orderBy: desc(submissions.createdAt) });
  if (!subs.length) return [];
  const studs = await db.query.users.findMany({ where: inArray(users.id, [...new Set(subs.map((s) => s.studentId))]) });
  const rooms = await db.query.classrooms.findMany({ where: inArray(classrooms.id, [...new Set(subs.map((s) => s.classroomId))]) });
  const ls = rooms.length ? await db.query.lessons.findMany({ where: inArray(lessons.id, rooms.map((r) => r.lessonId)) }) : [];
  return subs.map((s) => {
    const room = rooms.find((r) => r.id === s.classroomId);
    const l = ls.find((x) => x.id === room?.lessonId);
    return {
      ...s,
      studentName: studs.find((u) => u.id === s.studentId)?.name ?? "",
      classroomName: room?.name ?? "",
      lessonTitle: l ? `第 ${l.index} 节 · ${l.title}` : "",
      mediaUrl: s.type === "WEB" ? `/s/${s.shareToken}/index.html` : `/api/files/${s.path}`,
      coverUrl: s.coverPath ? `/api/files/${s.coverPath}` : s.type !== "WEB" ? `/api/files/${s.path}` : null,
      shareUrl: `/share/${s.shareToken}`,
    };
  });
}

/** 课堂实时面板：每个学生的进度 */
export async function classroomLive(classroomId: string) {
  const room = await db.query.classrooms.findFirst({ where: eq(classrooms.id, classroomId) });
  if (!room) return null;
  const lesson = (await db.query.lessons.findFirst({ where: eq(lessons.id, room.lessonId) }))!;
  const course = (await db.query.courses.findFirst({ where: eq(courses.id, room.courseId) }))!;
  const members = await db.query.classroomStudents.findMany({ where: eq(classroomStudents.classroomId, classroomId) });
  const studs = members.length ? await db.query.users.findMany({ where: inArray(users.id, members.map((m) => m.studentId)) }) : [];
  const wss = await db.query.workspaces.findMany({ where: eq(workspaces.classroomId, classroomId) });
  const fs = wss.length ? await db.query.frames.findMany({ where: inArray(frames.workspaceId, wss.map((w) => w.id)) }) : [];
  const running = wss.length
    ? await db.all<{ workspace_id: string; n: number }>(
        sql`select workspace_id, count(*) as n from generations where status in ('RUNNING','QUEUED') and workspace_id in (${sql.join(
          wss.map((w) => sql`${w.id}`),
          sql`, `,
        )}) group by workspace_id`,
      )
    : [];
  const subs = await submissionViews({ classroomIds: [classroomId] });
  const lastRuns = wss.length
    ? await db.query.agentRuns.findMany({ where: inArray(agentRuns.workspaceId, wss.map((w) => w.id)), orderBy: desc(agentRuns.createdAt) })
    : [];

  const students = studs.map((s) => {
    const ws = wss.find((w) => w.studentId === s.id);
    const wf = ws ? fs.filter((f) => f.workspaceId === ws.id && !f.isSpare) : [];
    const lastRun = ws ? lastRuns.find((r) => r.workspaceId === ws.id) : undefined;
    return {
      id: s.id,
      name: s.name,
      workspaceId: ws?.id ?? null,
      framesDone: wf.filter((f) => f.selectedGenerationId).length,
      framesTotal: wf.length,
      generationsUsed: ws ? fs.filter((f) => f.workspaceId === ws.id).reduce((a, f) => a + f.usedCount, 0) : 0,
      generating: running.find((r) => r.workspace_id === ws?.id)?.n ?? 0,
      codingTurnsUsed: ws?.codingTurnsUsed ?? 0,
      codingBusy: ws?.codingBusy ?? false,
      lastPrompt: lastRun?.prompt ?? null,
      submissions: subs.filter((x) => x.studentId === s.id).length,
    };
  });
  return { room, lesson, course, students, submissions: subs };
}
export type ClassroomLive = NonNullable<Awaited<ReturnType<typeof classroomLive>>>;

/** 用量汇总 */
export async function usageSummary() {
  const rows = await db.select().from(usageRecords).orderBy(desc(usageRecords.createdAt));
  const studs = await db.query.users.findMany({ where: eq(users.role, "STUDENT") });
  const ls = await db.query.lessons.findMany();
  const cs = await db.query.courses.findMany();
  const runs = await db.select().from(agentRuns).where(eq(agentRuns.status, "DONE"));
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => typeof x === "number");
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const p = (xs: (number | null)[], q: number) => {
    const v = xs.filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
    return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * q))] : null;
  };
  const byKind = (k: string) => rows.filter((r) => r.kind === k);
  const lessonName = (id: string) => {
    const l = ls.find((x) => x.id === id);
    const c = cs.find((x) => x.id === l?.courseId);
    return l ? `${c?.code ?? ""} 第 ${l.index} 节 · ${l.title}` : id;
  };
  const group = <K extends string>(key: (r: (typeof rows)[number]) => K) => {
    const m = new Map<K, typeof rows>();
    for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
    return [...m.entries()].map(([k, rs]) => ({
      key: k,
      images: rs.filter((r) => r.kind === "IMAGE" && r.success).length,
      videos: rs.filter((r) => r.kind === "VIDEO" && r.success).length,
      codingTurns: rs.filter((r) => r.kind === "CODING").reduce((a, r) => a + r.units, 0),
      tokens: rs.reduce((a, r) => a + r.inputTokens + r.outputTokens, 0),
      cost: rs.reduce((a, r) => a + r.costUsd, 0),
      failures: rs.filter((r) => !r.success).length,
    }));
  };
  return {
    totals: {
      images: byKind("IMAGE").filter((r) => r.success).length,
      videos: byKind("VIDEO").filter((r) => r.success).length,
      codingTurns: byKind("CODING").reduce((a, r) => a + r.units, 0),
      cost: rows.reduce((a, r) => a + r.costUsd, 0),
      failures: rows.filter((r) => !r.success).length,
    },
    latency: {
      imageAvgMs: avg(byKind("IMAGE").filter((r) => r.success).map((r) => r.latencyMs)),
      videoAvgMs: avg(byKind("VIDEO").filter((r) => r.success).map((r) => r.latencyMs)),
      codingTtftAvg: avg(runs.map((r) => r.ttftMs)),
      codingFirstPreviewAvg: avg(runs.map((r) => r.firstPreviewMs)),
      codingFirstPreviewP90: p(runs.map((r) => r.firstPreviewMs), 0.9),
      codingTotalAvg: avg(runs.map((r) => r.totalMs)),
      codingTotalP90: p(runs.map((r) => r.totalMs), 0.9),
      codingRuns: runs.length,
    },
    byStudent: group((r) => r.studentId).map((g) => ({ ...g, name: studs.find((s) => s.id === g.key)?.name ?? g.key })),
    byLesson: group((r) => r.lessonId).map((g) => ({ ...g, name: lessonName(g.key) })),
    recent: rows.slice(0, 30).map((r) => ({ ...r, studentName: studs.find((s) => s.id === r.studentId)?.name ?? "", lessonName: lessonName(r.lessonId) })),
  };
}

export async function overviewCounts() {
  const [u, rooms, subs] = await Promise.all([db.select().from(users), db.select().from(classrooms), db.select({ n: sql<number>`count(*)` }).from(submissions)]);
  return {
    students: u.filter((x) => x.role === "STUDENT").length,
    teachers: u.filter((x) => x.role === "TEACHER").length,
    liveRooms: rooms.filter((r) => r.status === "LIVE").length,
    rooms: rooms.length,
    submissions: subs[0]?.n ?? 0,
  };
}
