export type ImageRequest = {
  prompt: string;
  aspectRatio: string; // "1:1" | "3:4" | "16:9" ...
  refs: { abs: string; mime: string }[]; // 参考图（图生图）
};
export type MediaResult = { bytes: Buffer; ext: string; model: string; costUsd: number };

export interface ImageProvider {
  name: string;
  model: string;
  generate(req: ImageRequest): Promise<MediaResult>;
}
export interface VideoProvider {
  name: string;
  model: string;
  generate(req: ImageRequest & { durationSec?: number }): Promise<MediaResult>;
}
