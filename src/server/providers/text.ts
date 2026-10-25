// 生文字框体：默认用 Claude（Haiku 档，快且便宜），支持把上游图片作为输入（看图写话）。
import fs from "node:fs";
import { env } from "@/lib/env";

export type TextResult = { text: string; model: string; costUsd: number; inputTokens: number; outputTokens: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 粗略单价（美元 / 百万 token），用于用量估算
const PRICE: Record<string, [number, number]> = { haiku: [1, 5], sonnet: [3, 15] };

export async function generateText(o: { system: string; prompt: string; images: { abs: string; mime: string }[] }): Promise<TextResult> {
  const model = process.env.TEXT_MODEL || "claude-haiku-5-5";
  if ((process.env.TEXT_PROVIDER || (env.anthropicKey ? "claude" : "mock")) === "mock" || !env.anthropicKey) {
    await sleep(1500);
    return {
      text: `（mock 文字结果）\n根据你的要求：${o.prompt.slice(0, 60)}……\n这里会是 AI 写出的文字。`,
      model: "mock-text",
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }
  const images = o.images
    .filter((i) => /image\/(png|jpeg|webp|gif)/.test(i.mime))
    .slice(0, 3)
    .map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: fs.readFileSync(i.abs).toString("base64") } }));
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system: o.system,
      messages: [{ role: "user", content: [...images, { type: "text", text: o.prompt }] }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `文字模型调用失败（${r.status}）`);
  const text = (j.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n").trim();
  if (!text) throw new Error("模型没有返回文字");
  const inT = j.usage?.input_tokens ?? 0,
    outT = j.usage?.output_tokens ?? 0;
  const [pi, po] = PRICE[model.includes("sonnet") ? "sonnet" : "haiku"];
  return { text, model, costUsd: (inT * pi + outT * po) / 1e6, inputTokens: inT, outputTokens: outT };
}
