// mock 编程引擎：没有 Anthropic key 时用来调试界面，模拟「流式文字 → 边写边预览 → 完成」的完整过程。
import fs from "node:fs";
import path from "node:path";
import type { CodingEvent } from "./runner";

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      rej(new Error("stopped"));
    });
  });

function page(prompt: string, img: string | null) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>我的战甲兽图鉴</title>
<style>
  body { margin: 0; font-family: "PingFang SC", system-ui, sans-serif; background: radial-gradient(circle at 50% 0%, #2b1d5c, #0b0b18 70%); color: #fff; }
  .page { max-width: 560px; margin: 0 auto; padding: 28px 18px 60px; }
  h1 { margin: 0; font-size: 34px; letter-spacing: 1px; }
  .motto { color: #b9a8ff; margin: 6px 0 20px; }
  .hero { width: 100%; aspect-ratio: 3/4; border-radius: 22px; object-fit: cover; box-shadow: 0 0 40px #7c5cff88; background: linear-gradient(135deg,#7c5cff,#00d4ff); }
  .stats { display: grid; gap: 12px; margin: 22px 0; }
  .stat { background: #ffffff10; border-radius: 14px; padding: 12px 14px; }
  .bar { height: 10px; border-radius: 9px; background: #ffffff18; margin-top: 8px; overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 9px; background: linear-gradient(90deg,#ff5f8f,#ffd166); }
  p.story { line-height: 1.8; color: #dcd6ff; }
</style>
</head>
<body>
<main class="page">
  <h1>星光战甲兽</h1>
  <p class="motto">守护星空的最后一道光！</p>
  ${img ? `<img class="hero" src="${img}" alt="我的角色" />` : `<div class="hero"></div>`}
  <section class="stats">
    <div class="stat">力量 <div class="bar"><i style="width:86%"></i></div></div>
    <div class="stat">速度 <div class="bar"><i style="width:72%"></i></div></div>
    <div class="stat">智慧 <div class="bar"><i style="width:64%"></i></div></div>
  </section>
  <p class="story">（mock 模式生成：${prompt.slice(0, 40).replace(/</g, "&lt;")}…）它由机甲英雄和萌宠伙伴合体而成，每当夜空出现裂缝，它就会出发修补星光。</p>
</main>
</body>
</html>
`;
}

export async function runMock(o: {
  dir: string;
  prompt: string;
  abort: AbortController;
  first: boolean;
  sink: { emit: (e: CodingEvent) => void; persist: (role: "user" | "assistant" | "tool", c: unknown) => Promise<unknown> };
}) {
  const s = o.abort.signal;
  let img: string | null = null;
  try {
    const list = JSON.parse(fs.readFileSync(path.join(o.dir, "assets", "assets.json"), "utf8")) as { file: string; type: string }[];
    img = list.find((a) => a.type === "image")?.file ?? null;
  } catch {}

  const say = async (id: string, text: string) => {
    for (const ch of text.match(/.{1,3}/gu) ?? []) {
      await sleep(35, s);
      o.sink.emit({ t: "text_delta", id, text: ch });
    }
    o.sink.emit({ t: "text", id, text });
    await o.sink.persist("assistant", { text });
  };

  await sleep(600, s);
  await say(`m1-${Date.now()}`, "好的，我来帮你做！先把页面结构写出来。");
  o.sink.emit({ t: "todos", items: [
    { content: "写出页面结构", status: "in_progress" },
    { content: "加上属性卡片和进度条", status: "pending" },
    { content: "写一段角色故事", status: "pending" },
  ] });

  const id = `tool-${Date.now()}`;
  o.sink.emit({ t: "tool_start", id, name: "Write" });
  const html = page(o.prompt, img);
  for (let i = 200; i < html.length; i += 160) {
    await sleep(90, s);
    o.sink.emit({ t: "draft", file: "index.html", content: html.slice(0, i) });
  }
  fs.writeFileSync(path.join(o.dir, "index.html"), html);
  o.sink.emit({ t: "tool_end", id, name: "Write", file: "index.html", ok: true, summary: "写入文件" });
  await o.sink.persist("tool", { name: "Write", file: "index.html", ok: true });
  o.sink.emit({ t: "file", file: "index.html", at: Date.now() });
  o.sink.emit({ t: "todos", items: [
    { content: "写出页面结构", status: "completed" },
    { content: "加上属性卡片和进度条", status: "completed" },
    { content: "写一段角色故事", status: "completed" },
  ] });
  await say(`m2-${Date.now()}`, "图鉴做好啦！右边就能看到。下一步可以试试：让进度条在打开页面时慢慢涨上去。");
}
