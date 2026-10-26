// 混合课的阶段判断（画布 → 编程），画布和混合课外壳都会用到

/** 画布任务（不带编程提示词的任务）里的框体都选好了结果 */
export function isCanvasDone(s: { tasks?: { id: string; codingPrompt: string; kind: string }[]; frames?: { taskId: string | null; selectedGenerationId: string | null }[] } | null) {
  if (!s?.tasks || !s.frames) return false;
  const canvasTasks = s.tasks.filter((t) => !t.codingPrompt && t.kind !== "FREE").map((t) => t.id);
  const fs = s.frames.filter((f) => f.taskId && canvasTasks.includes(f.taskId));
  return fs.length > 0 && fs.every((f) => f.selectedGenerationId);
}
