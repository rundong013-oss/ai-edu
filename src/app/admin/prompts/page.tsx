import { asc } from "drizzle-orm";
import { db } from "@/db";
import { BLOCK_CATEGORIES, promptBlocks } from "@/db/schema";
import { PageHeader } from "@/components/Shell";
import { getAllSettings } from "@/server/prompts";
import { RuleEditor, BlockManager } from "./editors";

const RULES = [
  { key: "rules.image", title: "生图", desc: "每次生图时追加在提示词末尾" },
  { key: "rules.video", title: "生视频", desc: "每次生视频时追加在提示词末尾" },
  { key: "rules.text", title: "生文字", desc: "作为文字模型的系统提示词" },
  { key: "rules.coding", title: "Vibe Coding", desc: "写进每个学生项目的 CLAUDE.md（下次进入课堂时生效）" },
  { key: "rules.blocklist", title: "屏蔽词", desc: "学生提示词里出现这些词会被直接拦下，不扣次数。每行一个" },
] as const;

export default async function PromptsPage() {
  const [rules, blocks] = await Promise.all([getAllSettings(), db.query.promptBlocks.findMany({ orderBy: asc(promptBlocks.sortOrder) })]);
  return (
    <>
      <PageHeader title="提示词" desc="平台层规则对学生不可见、不可改；积木库是学生在画布里拼提示词用的片段" />
      <h2 className="mb-3 font-medium">平台层规则</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        {RULES.map((r) => (
          <RuleEditor key={r.key} k={r.key} title={r.title} desc={r.desc} value={rules[r.key]} />
        ))}
      </div>
      <h2 className="mb-3 mt-10 font-medium">提示词积木</h2>
      <p className="mb-4 text-sm text-muted">
        画布里每个框体按类别开放积木：图片框默认开放风格、光影、镜头、场景、细节；视频框开放动作、镜头、特效、风格；文字框开放体裁、语气。同一类别学生只能选一块。
      </p>
      <BlockManager categories={BLOCK_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} blocks={blocks.map((b) => ({ id: b.id, category: b.category, label: b.label, text: b.text, enabled: b.enabled }))} />
    </>
  );
}
