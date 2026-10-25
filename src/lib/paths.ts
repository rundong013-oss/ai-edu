import path from "node:path";
import fs from "node:fs";
import { env } from "./env";

/** 所有落盘文件都在 DATA_DIR 下；数据库里只存相对路径。 */
export function dataPath(...parts: string[]) {
  const p = path.resolve(env.dataDir, ...parts);
  if (!p.startsWith(env.dataDir + path.sep) && p !== env.dataDir) {
    throw new Error("path escapes data dir");
  }
  return p;
}

export function rel(abs: string) {
  return path.relative(env.dataDir, abs).split(path.sep).join("/");
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 学生在某课堂的 Vibe Coding 项目目录 */
export function projectDir(workspaceId: string) {
  return dataPath("projects", workspaceId);
}

/** 生成文件的公开 URL（经 /api/files 鉴权读取） */
export function fileUrl(relPath: string | null | undefined) {
  return relPath ? `/api/files/${relPath}` : null;
}

/** 在 root 下安全拼接，防止 ../ 越界 */
export function safeJoin(root: string, sub: string) {
  const p = path.resolve(root, sub);
  if (p !== root && !p.startsWith(root + path.sep)) return null;
  return p;
}

export const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ico": "image/x-icon",
};
export function mimeOf(file: string) {
  return MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
}
