// 课型相关的小工具：CANVAS 画布课、CODING Vibe Coding 课、MIXED 先画布后编程的混合课
export type LessonKind = "CANVAS" | "CODING" | "MIXED";

export const hasCanvas = (k: LessonKind) => k === "CANVAS" || k === "MIXED";
export const hasCoding = (k: LessonKind) => k === "CODING" || k === "MIXED";

/** 短标签：课程列表、表格里用 */
export function kindLabel(k: LessonKind) {
  return k === "CANVAS" ? "画布" : k === "CODING" ? "Vibe Coding" : "画布 + Vibe Coding";
}

/** 长标签：「画布课」「Vibe Coding 课」 */
export function kindLessonLabel(k: LessonKind) {
  return k === "CANVAS" ? "画布课" : k === "CODING" ? "Vibe Coding 课" : "画布 + Vibe Coding 课";
}
