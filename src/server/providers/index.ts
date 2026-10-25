import { env } from "@/lib/env";
import { mockImage, mockVideo } from "./mock";
import { openaiImage } from "./openai";
import type { ImageProvider, VideoProvider } from "./types";

export function imageProvider(): ImageProvider {
  if (env.imageProvider === "openai" && env.openaiKey) return openaiImage();
  return mockImage;
}

// 视频本期暂缓：统一走 mock，之后在这里接入真实模型
export function videoProvider(): VideoProvider {
  return mockVideo;
}
