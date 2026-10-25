import path from "node:path";

export const env = {
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-change-me-dev-secret-change-me",
  dataDir: path.resolve(process.cwd(), process.env.DATA_DIR || "./data"),
  imageProvider: (process.env.IMAGE_PROVIDER || "mock") as "openai" | "mock",
  openaiKey: process.env.OPENAI_API_KEY || "",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || undefined,
  videoProvider: (process.env.VIDEO_PROVIDER || "mock") as "mock",
  codingProvider: (process.env.CODING_PROVIDER || "mock") as "claude" | "mock",
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  codingModel: process.env.CODING_MODEL || "claude-sonnet-5-5",
};
