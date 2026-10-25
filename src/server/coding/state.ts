import fs from "node:fs";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { codingMessages, lessons, workspaces, submissions } from "@/db/schema";
import { projectDir } from "@/lib/paths";
import { getClassroomFull, lessonTasksWithTemplates } from "@/server/workspace";
import { getLiveRun } from "./runner";
import { listProjectFiles } from "./project";

export async function codingState(workspaceId: string) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) return null;
  const full = await getClassroomFull(ws.classroomId);
  if (!full) return null;
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, full.lesson.id) });
  const tasks = await lessonTasksWithTemplates(full.lesson.id);
  const msgs = await db.query.codingMessages.findMany({ where: eq(codingMessages.workspaceId, workspaceId), orderBy: asc(codingMessages.seq) });
  let assets: { file: string; type: string; title: string; from: string }[] = [];
  try {
    assets = JSON.parse(fs.readFileSync(path.join(projectDir(workspaceId), "assets", "assets.json"), "utf8"));
  } catch {}
  const live = getLiveRun(workspaceId);
  const subs = await db.query.submissions.findMany({ where: eq(submissions.workspaceId, workspaceId) });
  return {
    workspace: { id: ws.id, turnsUsed: ws.codingTurnsUsed, busy: ws.codingBusy },
    classroom: { id: full.room.id, name: full.room.name, status: full.room.status },
    lesson: { index: full.lesson.index, title: full.lesson.title, courseCode: full.course.code, maxTurns: lesson!.codingMaxTurns },
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, description: t.description, kind: t.kind, codingPrompt: t.codingPrompt })),
    history: msgs.map((m) => ({ id: m.id, role: m.role, content: m.content as Record<string, unknown>, runId: m.runId })),
    live: live && !live.finished ? { runId: live.runId, eventCount: live.events.length } : null,
    files: listProjectFiles(workspaceId),
    assets,
    submittedCount: subs.filter((s) => s.type === "WEB").length,
  };
}
export type CodingState = NonNullable<Awaited<ReturnType<typeof codingState>>>;
