// OpenAI 图像适配器：无参考图走 images.generate（文生图），有参考图走 images.edit（图生图）。
import fs from "node:fs";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { env } from "@/lib/env";
import type { ImageProvider } from "./types";

function sizeFor(ar: string): "1024x1024" | "1024x1536" | "1536x1024" {
  const [a, b] = ar.split(":").map(Number);
  if (!a || !b || a === b) return "1024x1024";
  return a > b ? "1536x1024" : "1024x1536";
}

// 粗略单价（美元/张），用于用量看板估算；以实际账单为准
const PRICE: Record<string, number> = { low: 0.016, medium: 0.063, high: 0.25 };

export function openaiImage(): ImageProvider {
  const client = new OpenAI({ apiKey: env.openaiKey, baseURL: env.openaiBaseUrl });
  const model = env.openaiImageModel;
  const editModel = process.env.OPENAI_IMAGE_EDIT_MODEL || model;
  const quality = (process.env.OPENAI_IMAGE_QUALITY || "medium") as "low" | "medium" | "high";
  return {
    name: "openai",
    model,
    async generate(req) {
      // OpenAI 只接受位图作参考；mock 留下的 SVG 之类跳过
      const refs = req.refs.filter((r) => /image\/(png|jpeg|webp)/.test(r.mime));
      const call = async (size: ReturnType<typeof sizeFor> | "auto") => {
        if (refs.length) {
          const files = await Promise.all(
            refs.map((r) => toFile(fs.createReadStream(r.abs), path.basename(r.abs), { type: r.mime })),
          );
          return client.images.edit({ model: editModel, image: files, prompt: req.prompt, size, quality });
        }
        return client.images.generate({ model, prompt: req.prompt, size, quality, n: 1 });
      };
      let res;
      try {
        res = await call(sizeFor(req.aspectRatio));
      } catch (e) {
        // 新模型若不支持这个尺寸，退回 auto 再试一次
        if (e instanceof OpenAI.APIError && e.status === 400 && /size/i.test(e.message)) res = await call("auto");
        else throw e;
      }
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("模型没有返回图片");
      return { bytes: Buffer.from(b64, "base64"), ext: "png", model: refs.length ? editModel : model, costUsd: PRICE[quality] ?? 0 };
    },
  };
}
