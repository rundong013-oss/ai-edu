// 本地自检：用 .env 里的 OpenAI key 和模型名生成一张图，确认生图链路可用。
// 运行：npm run test:image
import "dotenv/config";
import fs from "node:fs";
import { openaiImage } from "../src/server/providers/openai";

(async () => {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ .env 里没有 OPENAI_API_KEY");
    process.exit(1);
  }
  const p = openaiImage();
  console.log(`→ 用 ${p.model} 生成一张测试图…`);
  const t0 = Date.now();
  try {
    const r = await p.generate({ prompt: "一只戴着宇航员头盔的小狐狸，站在月球上，3D 卡通风格", aspectRatio: "1:1", refs: [] });
    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync("data/test-image.png", r.bytes);
    console.log(`✅ 成功，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s，已保存到 data/test-image.png`);
    console.log("   现在把 .env 里的 IMAGE_PROVIDER 改成 \"openai\" 即可在画布里真实生图。");
  } catch (e) {
    console.error("❌ 失败：", e instanceof Error ? e.message : e);
    console.error("   常见原因：模型名不对（去 OpenAI 后台 Models 页确认）、网络访问不了 api.openai.com（可配置 OPENAI_BASE_URL）、账户没有余额。");
    process.exit(1);
  }
})();
