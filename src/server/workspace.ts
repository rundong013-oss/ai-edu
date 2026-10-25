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
import { promptBlocks } from "@/db/schema";
import { DEFAULT_BLOCK_CATEGORIES } from "./prompts";

export async function enabledBlocks() {
  const rows = await db.query.promptBlocks.findMany({ orderBy: asc(promptBlocks.sortOrder) });
  return rows.filter((b) => b.enabled).map((b) => ({ id: b.id, category: b.category, label: b.label, text: b.text }));
}

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
  generations: { id: string; status: string; url: string | null; text: string | null; error: string | null; createdAt: number; latencyMs: number | null }[];
  selectedUrl: string | null;
  selectedText: string | null;
  allowedBlockCategories: string[];
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
        text: x.outputText,
        error: x.error,
        createdAt: x.createdAt.getTime(),
        latencyMs: x.latencyMs,
      })),
      selectedUrl: sel ? fileUrl(sel.outputPath) : null,
      selectedText: sel?.outputText ?? null,
      allowedBlockCategories: tpl?.blockCategories.length ? tpl.blockCategories : DEFAULT_BLOCK_CATEGORIES[f.type],
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
    blocks: await enabledBlocks(),
  };
}

export type WorkspaceState = NonNullable<Awaited<ReturnType<typeof workspaceState>>>;

/** 演示用的画布状态：直接由课节模板生成，不落库 */
export async function demoState(lessonId: string): Promise<WorkspaceState | null> {
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  if (!lesson) return null;
  const course = await db.query.courses.findFirst({ where: eq(courses.id, lesson.courseId) });
  const taskList = await lessonTasksWithTemplates(lessonId);
  const keyToId = new Map(taskList.flatMap((t) => t.templates).map((tpl) => [tpl.key, `demo-${tpl.id}`]));
  const frameViews: FrameView[] = taskList.flatMap((t) =>
    t.templates.map((tpl) => ({
      id: `demo-${tpl.id}`,
      workspaceId: "demo",
      templateId: tpl.id,
      taskId: t.id,
      key: tpl.key,
      type: tpl.type,
      title: tpl.title,
      isSpare: false,
      prompt: "",
      slotValues: Object.fromEntries(tpl.slots.map((s) => [s.key, s.default])),
      aspectRatio: tpl.aspectRatio,
      upstreamFrameIds: tpl.upstreamKeys.map((k) => keyToId.get(k)!).filter(Boolean),
      maxGenerations: tpl.maxGenerations,
      usedCount: 0,
      selectedGenerationId: null,
      posX: tpl.posX,
      posY: tpl.posY,
      createdAt: new Date(0),
      blocks: [],
      template: { promptTemplate: tpl.promptTemplate, slots: tpl.slots, crossLessonRefs: tpl.crossLessonRefs },
      generations: [],
      selectedUrl: null,
      selectedText: null,
      allowedBlockCategories: tpl.blockCategories.length ? tpl.blockCategories : DEFAULT_BLOCK_CATEGORIES[tpl.type],
    })),
  );
  return {
    workspace: {
      id: "demo",
      classroomId: "demo",
      studentId: "demo",
      currentTaskId: taskList[0]?.id ?? null,
      spareUsed: 0,
      agentSessionId: null,
      codingTurnsUsed: 0,
      codingBusy: false,
      lastActiveAt: null,
      createdAt: new Date(0),
    },
    classroom: { id: "demo", name: "备课演示", status: "READY" },
    lesson: { id: lesson.id, index: lesson.index, title: lesson.title, subtitle: lesson.subtitle, kind: lesson.kind, spareFrames: lesson.spareFrames, courseCode: course?.code ?? "" },
    tasks: taskList.map((t) => ({ id: t.id, order: t.order, title: t.title, description: t.description, kind: t.kind, codingPrompt: t.codingPrompt })),
    frames: frameViews,
    submittedFrameKeys: [],
    blocks: await enabledBlocks(),
  };
}
