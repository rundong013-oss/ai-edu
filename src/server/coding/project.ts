// Vibe Coding 项目目录：课节脚手架 + 学生自己的画布素材 + 课节专用 CLAUDE.md。
// 老师开课 / 学生进入时就准备好，agent 只在这个目录里改文件（速度方案第 3、7 条）。
import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { classrooms, lessons, submissions, workspaces } from "@/db/schema";
import { dataPath, ensureDir, projectDir } from "@/lib/paths";
import { getSetting } from "@/server/prompts";

const SCAFFOLD_ROOT = path.resolve(process.cwd(), "content", "scaffolds");

export const BASE_CLAUDE_MD = `# 项目规则（平台自动生成）
- 这是一个给小学生用的网页创作课。你在帮学生做一个静态网页。
- 只用原生 HTML / CSS / JavaScript，不用任何框架、构建工具或 npm 包；不要联网加载外部资源（字体、CDN 都不要）。
- 入口文件是 index.html，可以修改 style.css 和 app.js。不要删除 assets/ 里的文件。
- 每次先快速改出能看到的版本，再逐步完善：先写 HTML 结构，再写样式，最后加互动。
- 回复学生时用简单、鼓励的中文，不超过 3 句话；不要贴大段代码给学生看。
`;

type AssetEntry = { file: string; type: "image" | "video" | "text"; title: string; from: string };

/** 收集学生在同一课程其它课堂里提交过的画布作品，作为编程素材 */
async function collectAssets(workspaceId: string): Promise<{ src: string; entry: AssetEntry }[]> {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) return [];
  const room = await db.query.classrooms.findFirst({ where: eq(classrooms.id, ws.classroomId) });
  const sameCourseRooms = await db.query.classrooms.findMany({ where: and(eq(classrooms.courseId, room!.courseId), ne(classrooms.id, room!.id)) });
  if (!sameCourseRooms.length) return [];
  const lessonRows = await db.query.lessons.findMany({ where: inArray(lessons.id, sameCourseRooms.map((r) => r.lessonId)) });
  const subs = await db.query.submissions.findMany({
    where: and(eq(submissions.studentId, ws.studentId), inArray(submissions.classroomId, sameCourseRooms.map((r) => r.id))),
  });
  return subs
    .filter((s) => s.type !== "WEB")
    .map((s, i) => {
      const r = sameCourseRooms.find((x) => x.id === s.classroomId);
      const l = lessonRows.find((x) => x.id === r?.lessonId);
      const ext = path.extname(s.path);
      return {
        src: dataPath(s.path),
        entry: {
          file: `assets/${s.frameKey ?? "work"}-${i + 1}${ext}`,
          type: s.type === "VIDEO" ? ("video" as const) : s.type === "TEXT" ? ("text" as const) : ("image" as const),
          title: s.title,
          from: l ? `第 ${l.index} 节「${l.title}」` : "",
        },
      };
    });
}

/** 确保项目目录存在；已存在则只补充新素材（不覆盖学生改过的文件） */
export async function prepareCodingProject(workspaceId: string) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) return null;
  const room = await db.query.classrooms.findFirst({ where: eq(classrooms.id, ws.classroomId) });
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, room!.lessonId) });
  const dir = projectDir(workspaceId);
  const fresh = !fs.existsSync(path.join(dir, "index.html"));
  ensureDir(dir);

  if (fresh) {
    const scaffold = path.join(SCAFFOLD_ROOT, lesson?.codingScaffold || "blank");
    if (fs.existsSync(scaffold)) fs.cpSync(scaffold, dir, { recursive: true });
    else fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><meta charset=utf-8><title>我的网页</title><h1>我的网页</h1>");
  }
  // 平台层规则（机构后台可改）+ 课节规则
  const platformRule = await getSetting("rules.coding");
  fs.writeFileSync(path.join(dir, "CLAUDE.md"), `${BASE_CLAUDE_MD}- ${platformRule}\n\n${lesson?.codingClaudeMd ?? ""}\n`);

  // 素材
  const assetsDir = ensureDir(path.join(dir, "assets"));
  const assets = await collectAssets(workspaceId);
  const manifest: AssetEntry[] = [];
  for (const a of assets) {
    const dest = path.join(dir, a.entry.file);
    if (fs.existsSync(a.src) && !fs.existsSync(dest)) fs.copyFileSync(a.src, dest);
    if (fs.existsSync(dest)) manifest.push(a.entry);
  }
  // 学生手动拖进来的素材（不在清单里的文件）也保留
  for (const f of fs.readdirSync(assetsDir)) {
    if (f === "assets.json" || manifest.some((m) => m.file === `assets/${f}`)) continue;
    manifest.push({ file: `assets/${f}`, type: /\.(mp4|webm)$/.test(f) ? "video" : /\.(txt|md)$/.test(f) ? "text" : "image", title: f, from: "上传" });
  }
  fs.writeFileSync(path.join(assetsDir, "assets.json"), JSON.stringify(manifest, null, 2));
  return { dir, assets: manifest };
}

export function listProjectFiles(workspaceId: string) {
  const dir = projectDir(workspaceId);
  const out: { path: string; size: number }[] = [];
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "CLAUDE.md") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push({ path: path.relative(dir, p).split(path.sep).join("/"), size: fs.statSync(p).size });
    }
  };
  walk(dir);
  return out;
}
