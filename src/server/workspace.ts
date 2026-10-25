// 工作区：一个学生在一个课堂里的全部状态。首次进入课堂时按课节模板实例化框体。
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  classrooms,
  classroomStudents,
  frames,
  frameTemplates,
  generations,
  lessons,
  courses,
  tasks,
  workspaces,
  submissions,
  type Frame,
} from "@/db/schema";
import { fileUrl } from "@/lib/paths";

export async function getClassroomFull(classroomId: string) {
  const room = await db.query.classrooms.findFirst({ where: eq(classrooms.id, classroomId) });
  if (!room) return null;
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, room.lessonId) });
  const course = await db.query.courses.findFirst({ where: eq(courses.id, room.courseId) });
  return { room, lesson: lesson!, course: course! };
}

export async function isStudentInClassroom(classroomId: string, studentId: string) {
  const r = await db.query.classroomStudents.findFirst({
    where: and(eq(classroomStudents.classroomId, classroomId), eq(classroomStudents.studentId, studentId)),
  });
  return !!r;
}

export async function lessonTasksWithTemplates(lessonId: string) {
  const ts = await db.query.tasks.findMany({ where: eq(tasks.lessonId, lessonId), orderBy: asc(tasks.order) });
  const tpls = ts.length
    ? await db.query.frameTemplates.findMany({
        where: inArray(frameTemplates.taskId, ts.map((t) => t.id)),
        orderBy: asc(frameTemplates.order),
      })
    : [];
  return ts.map((t) => ({ ...t, templates: tpls.filter((f) => f.taskId === t.id) }));
}

/** 取或建工作区；新建时把课节的框体模板实例化成框体，并按 key 解析上游连线 */
export async function getOrCreateWorkspace(classroomId: string, studentId: string) {
  const existing = await db.query.workspaces.findFirst({
    where: and(eq(workspaces.classroomId, classroomId), eq(workspaces.studentId, studentId)),
  });
  if (existing) return existing;

  const full = await getClassroomFull(classroomId);
  if (!full) throw new Error("课堂不存在");
  const taskList = await lessonTasksWithTemplates(full.lesson.id);

  const [ws] = await db
    .insert(workspaces)
    .values({ classroomId, studentId, currentTaskId: taskList[0]?.id ?? null })
    .onConflictDoNothing()
    .returning();
  if (!ws) {
    // 并发创建：另一个请求已经建好
    return (await db.query.workspaces.findFirst({
      where: and(eq(workspaces.classroomId, classroomId), eq(workspaces.studentId, studentId)),
    }))!;
  }

  const keyToId = new Map<string, string>();
  const created: { id: string; upstreamKeys: string[] }[] = [];
  for (const t of taskList) {
    for (const tpl of t.templates) {
      const defaults = Object.fromEntries(tpl.slots.map((s) => [s.key, s.default]));
      const [f] = await db
        .insert(frames)
        .values({
          workspaceId: ws.id,
          templateId: tpl.id,
          taskId: t.id,
          key: tpl.key,
          type: tpl.type,
          title: tpl.title,
          slotValues: defaults,
          prompt: "",
          aspectRatio: tpl.aspectRatio,
          maxGenerations: tpl.maxGenerations,
          posX: tpl.posX,
          posY: tpl.posY,
        })
        .returning();
      keyToId.set(tpl.key, f.id);
      created.push({ id: f.id, upstreamKeys: tpl.upstreamKeys });
    }
  }
  for (const c of created) {
    const ids = c.upstreamKeys.map((k) => keyToId.get(k)).filter(Boolean) as string[];
    if (ids.length) await db.update(frames).set({ upstreamFrameIds: ids }).where(eq(frames.id, c.id));
  }
  return ws;
}

export type FrameView = Frame & {
  template: { promptTemplate: string; slots: { key: string; label: string; default: string; options?: string[] }[]; crossLessonRefs: string[] } | null;
  generations: { id: string; status: string; url: string | null; error: string | null; createdAt: number; latencyMs: number | null }[];
  selectedUrl: string | null;
};

/** 画布需要的全部状态（前端轮询这个接口） */
export async function workspaceState(workspaceId: string) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) return null;
  const full = await getClassroomFull(ws.classroomId);
  if (!full) return null;
  const taskList = await lessonTasksWithTemplates(full.lesson.id);
  const fs = await db.query.frames.findMany({ where: eq(frames.workspaceId, ws.id), orderBy: asc(frames.createdAt) });
  const gens = fs.length
    ? await db.query.generations.findMany({ where: inArray(generations.frameId, fs.map((f) => f.id)), orderBy: asc(generations.createdAt) })
    : [];
  const tplById = new Map(taskList.flatMap((t) => t.templates).map((t) => [t.id, t]));
  const subs = await db.query.submissions.findMany({ where: eq(submissions.workspaceId, ws.id) });

  const frameViews: FrameView[] = fs.map((f) => {
    const g = gens.filter((x) => x.frameId === f.id);
    const sel = g.find((x) => x.id === f.selectedGenerationId);
    const tpl = f.templateId ? tplById.get(f.templateId) : null;
    return {
      ...f,
      template: tpl ? { promptTemplate: tpl.promptTemplate, slots: tpl.slots, crossLessonRefs: tpl.crossLessonRefs } : null,
      generations: g.map((x) => ({
        id: x.id,
        status: x.status,
        url: fileUrl(x.outputPath),
        error: x.error,
        createdAt: x.createdAt.getTime(),
        latencyMs: x.latencyMs,
      })),
      selectedUrl: sel ? fileUrl(sel.outputPath) : null,
    };
  });

  return {
    workspace: ws,
    classroom: { id: full.room.id, name: full.room.name, status: full.room.status },
    lesson: {
      id: full.lesson.id,
      index: full.lesson.index,
      title: full.lesson.title,
      subtitle: full.lesson.subtitle,
      kind: full.lesson.kind,
      spareFrames: full.lesson.spareFrames,
      courseCode: full.course.code,
    },
    tasks: taskList.map((t) => ({ id: t.id, order: t.order, title: t.title, description: t.description, kind: t.kind, codingPrompt: t.codingPrompt })),
    frames: frameViews,
    submittedFrameKeys: subs.filter((s) => s.frameKey).map((s) => s.frameKey!),
  };
}

export type WorkspaceState = NonNullable<Awaited<ReturnType<typeof workspaceState>>>;
