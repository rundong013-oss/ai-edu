export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** 把 {{slot}} 模板用值填充 */
export function fillTemplate(tpl: string, values: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (values[k] ?? "").trim() || `（${k}）`);
}

export type Slot = { key: string; label: string; default: string; options?: string[] };
export type CodingPreset = { title: string; prompt: string };
