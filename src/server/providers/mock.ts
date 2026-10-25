// mock 适配器：不调用任何外部服务，用 SVG 画出「看得出流程」的占位结果。
// - 生图：按提示词哈希出配色；有参考图时把参考图嵌进去（看得出图生图的输入关系）
// - 生视频：把参考图做成带动画的 SVG（推镜 + 发光 + 粒子），用 <img> 播放
import fs from "node:fs";
import type { ImageProvider, VideoProvider, ImageRequest } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function dims(ar: string): [number, number] {
  const [a, b] = ar.split(":").map(Number);
  if (!a || !b) return [768, 768];
  return a >= b ? [1024, Math.round((1024 * b) / a)] : [Math.round((1024 * a) / b), 1024];
}

function esc(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

function dataUri(ref: { abs: string; mime: string }) {
  return `data:${ref.mime};base64,${fs.readFileSync(ref.abs).toString("base64")}`;
}

function wrap(text: string, n: number) {
  const out: string[] = [];
  for (let i = 0; i < text.length && out.length < 4; i += n) out.push(text.slice(i, i + n));
  return out;
}

function imageSvg(req: ImageRequest) {
  const [w, h] = dims(req.aspectRatio);
  const hv = hash(req.prompt);
  const h1 = hv % 360,
    h2 = (h1 + 40 + (hv % 80)) % 360;
  const refs = req.refs.slice(0, 2);
  const refImgs = refs
    .map((r, i) => {
      const rw = refs.length === 1 ? w * 0.7 : w * 0.42;
      const x = refs.length === 1 ? (w - rw) / 2 : i === 0 ? w * 0.06 : w * 0.52;
      return `<image href="${dataUri(r)}" x="${x}" y="${h * 0.12}" width="${rw}" height="${h * 0.56}" preserveAspectRatio="xMidYMid slice" opacity="0.9" clip-path="url(#rc)"/>`;
    })
    .join("");
  const dots = Array.from({ length: 70 }, (_, i) => {
    const x = (hash(req.prompt + i) % w) | 0,
      y = (hash(i + req.prompt) % h) | 0,
      r = (hash("r" + i + req.prompt) % 3) + 1;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${((i % 7) + 2) / 14}"/>`;
  }).join("");
  const lines = wrap(req.prompt, Math.max(12, Math.floor(w / 40)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1},70%,22%)"/><stop offset="1" stop-color="hsl(${h2},75%,48%)"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.42" r="0.5"><stop offset="0" stop-color="hsl(${h2},100%,75%)" stop-opacity="0.55"/><stop offset="1" stop-color="hsl(${h2},100%,75%)" stop-opacity="0"/></radialGradient>
<clipPath id="rc"><rect x="0" y="0" width="${w}" height="${h}" rx="24"/></clipPath>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<rect width="${w}" height="${h}" fill="url(#glow)"/>
${dots}
${refImgs}
${refs.length === 0 ? `<circle cx="${w / 2}" cy="${h * 0.4}" r="${Math.min(w, h) * 0.18}" fill="none" stroke="white" stroke-opacity="0.6" stroke-width="3"/><circle cx="${w / 2}" cy="${h * 0.4}" r="${Math.min(w, h) * 0.08}" fill="white" fill-opacity="0.8"/>` : ""}
<rect x="0" y="${h * 0.72}" width="${w}" height="${h * 0.28}" fill="black" fill-opacity="0.45"/>
<text x="${w * 0.06}" y="${h * 0.72 + 38}" fill="#5cf2a0" font-family="monospace" font-size="22">MOCK · ${refs.length ? "图生图" : "文生图"}</text>
${lines.map((l, i) => `<text x="${w * 0.06}" y="${h * 0.72 + 76 + i * 30}" fill="white" font-family="sans-serif" font-size="22">${esc(l)}</text>`).join("")}
</svg>`;
}

function videoSvg(req: ImageRequest) {
  const [w, h] = dims(req.aspectRatio);
  const ref = req.refs[0];
  const base = ref
    ? `<image href="${dataUri(ref)}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" class="kb"/>`
    : `<rect width="${w}" height="${h}" fill="hsl(${hash(req.prompt) % 360},60%,30%)" class="kb"/>`;
  const parts = Array.from({ length: 40 }, (_, i) => {
    const x = hash(req.prompt + i) % w,
      d = 2 + (i % 5),
      delay = (i % 10) / 3;
    return `<circle cx="${x}" cy="${h}" r="${(i % 3) + 2}" fill="#ffe08a" style="animation: rise ${d}s ${delay}s linear infinite"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<style>
.kb{transform-origin:50% 50%;animation:kb 6s ease-in-out infinite alternate}
@keyframes kb{from{transform:scale(1) rotate(0deg)}to{transform:scale(1.18) rotate(-1.5deg)}}
.flash{animation:flash 3s ease-in-out infinite}
@keyframes flash{0%,70%,100%{opacity:0}80%{opacity:.55}}
@keyframes rise{from{transform:translateY(0);opacity:1}to{transform:translateY(-${h}px);opacity:0}}
</style>
<clipPath id="c"><rect width="${w}" height="${h}"/></clipPath>
<g clip-path="url(#c)">${base}<rect width="${w}" height="${h}" fill="white" class="flash"/>${parts}</g>
<rect x="0" y="${h - 64}" width="${w}" height="64" fill="black" fill-opacity="0.5"/>
<text x="24" y="${h - 24}" fill="#5cf2a0" font-family="monospace" font-size="22">MOCK VIDEO · ${esc(req.prompt.slice(0, 36))}</text>
</svg>`;
}

export const mockImage: ImageProvider = {
  name: "mock",
  model: "mock-image",
  async generate(req) {
    await sleep(2500 + Math.random() * 1500);
    return { bytes: Buffer.from(imageSvg(req)), ext: "svg", model: "mock-image", costUsd: 0 };
  },
};

export const mockVideo: VideoProvider = {
  name: "mock",
  model: "mock-video",
  async generate(req) {
    await sleep(4000 + Math.random() * 2000);
    return { bytes: Buffer.from(videoSvg(req)), ext: "svg", model: "mock-video", costUsd: 0 };
  },
};
