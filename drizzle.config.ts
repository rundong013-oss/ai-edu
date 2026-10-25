import { defineConfig } from "drizzle-kit";
import path from "node:path";

const dataDir = path.resolve(process.env.DATA_DIR || "./data");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: `file:${path.join(dataDir, "app.db")}` },
});
