import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

function dbUrl() {
  const dataDir = path.resolve(process.cwd(), process.env.DATA_DIR || "./data");
  fs.mkdirSync(dataDir, { recursive: true });
  return `file:${path.join(dataDir, "app.db")}`;
}

const g = globalThis as unknown as { __libsql?: Client };
const client = g.__libsql ?? createClient({ url: dbUrl() });
if (!g.__libsql) {
  g.__libsql = client;
  // WAL：并发读写更稳（多个学生同时生成）
  client.execute("PRAGMA journal_mode = WAL").catch(() => {});
  client.execute("PRAGMA foreign_keys = ON").catch(() => {});
  client.execute("PRAGMA busy_timeout = 5000").catch(() => {});
}

export const db = drizzle(client, { schema });
export { schema };
