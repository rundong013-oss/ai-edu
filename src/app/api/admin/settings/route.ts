import { apiSession, jsonError } from "@/lib/auth";
import { PLATFORM_DEFAULTS, setSetting, type SettingKey } from "@/server/prompts";

export async function PUT(req: Request) {
  if (!(await apiSession("ADMIN"))) return jsonError(401, "需要机构管理员权限");
  const { key, value, reset } = (await req.json()) as { key: SettingKey; value?: string; reset?: boolean };
  if (!(key in PLATFORM_DEFAULTS)) return jsonError(400, "未知的配置项");
  await setSetting(key, reset ? PLATFORM_DEFAULTS[key] : String(value ?? "").slice(0, 4000));
  return Response.json({ ok: true });
}
