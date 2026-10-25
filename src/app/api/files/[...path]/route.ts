import fs from "node:fs";
import { dataPath, mimeOf } from "@/lib/paths";

// 生成的媒体文件。文件名是随机 id，不可枚举；分享页也直接引用这里。
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  if (parts[0] !== "media" && parts[0] !== "submissions") return new Response("Not found", { status: 404 });
  let abs: string;
  try {
    abs = dataPath(...parts);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(abs), {
    headers: { "content-type": mimeOf(abs), "cache-control": "public, max-age=31536000, immutable" },
  });
}
