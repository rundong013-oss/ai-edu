// Vibe Coding 运行器：调用 Claude Agent SDK（Claude Code 同款引擎），把过程转成前端事件流。
// 速度方案：流式输出 / 写文件时实时推送草稿到预览 / 只开 Read·Write·Edit·TodoWrite / 素材清单直接放进系统提示。
import fs from "node:fs";
import path from "node:path";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentRuns, classrooms, codingMessages, lessons, usageRecords, workspaces } from "@/db/schema";
import { env } from "@/lib/env";
import { projectDir } from "@/lib/paths";
import { runMock } from "./mock";

// ---------- 事件（服务端 → 前端，经 SSE 推送） ----------
export type CodingEvent =
  | { t: "user"; text: string; runId: string }
  | { t: "text_delta"; id: string; text: string }
  | { t: "text"; id: string; text: string }
  | { t: "tool_start"; id: string; name: string; file?: string }
  | { t: "tool_end"; id: string; name: string; file?: string; ok: boolean; summary?: string }
  | { t: "draft"; file: string; content: string }
  | { t: "file"; file: string; at: number }
  | { t: "todos"; items: { content: string; status: string }[] }
  | { t: "done"; status: "DONE" | "ERROR" | "STOPPED"; error?: string; metrics: RunMetrics; turnsUsed: number };

export type RunMetrics = { ttftMs: number | null; firstPreviewMs: number | null; totalMs: number; costUsd: number; inputTokens: number; outputTokens: number; model: string };

type LiveRun = {
  runId: string;
  workspaceId: string;
  events: CodingEvent[];
  listeners: Set<(e: CodingEvent) => void>;
  abort: AbortController;
  finished: boolean;
};

// 进程内的运行表（单机部署足够；多机部署时换成 Redis 之类）
const g = globalThis as unknown as { __runs?: Map<string, LiveRun> };
const runs = (g.__runs ??= new Map());

export function getLiveRun(workspaceId: string) {
  return runs.get(workspaceId) ?? null;
}

export function subscribe(workspaceId: string, fn: (e: CodingEvent) => void) {
  const r = runs.get(workspaceId);
  if (!r) return () => {};
  r.listeners.add(fn);
  return () => r.listeners.delete(fn);
}

export function stopRun(workspaceId: string) {
  runs.get(workspaceId)?.abort.abort();
}

export class CodingQuotaError extends Error {}

function systemPrompt(dir: string) {
  const claudeMd = fs.existsSync(path.join(dir, "CLAUDE.md")) ? fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8") : "";
  let assets = "（暂无素材）";
  try {
    const list = JSON.parse(fs.readFileSync(path.join(dir, "assets", "assets.json"), "utf8")) as { file: string; type: string; title: string; from: string }[];
    if (list.length)
      assets = list
        .map((a) => {
          const head = `- ${a.file}（${a.type === "video" ? "视频" : a.type === "text" ? "文字" : "图片"}：${a.title}${a.from ? "，来自" + a.from : ""}）`;
          if (a.type !== "text") return head;
          // 文字素材直接把内容给模型，省一次读取
          let body = "";
          try {
            body = fs.readFileSync(path.join(dir, a.file), "utf8").slice(0, 600);
          } catch {}
          return `${head}\n  内容：${body.replace(/\n/g, " ")}`;
        })
        .join("\n");
  } catch {}
  const files = fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith(".") && f !== "CLAUDE.md" && f !== "assets")
    .join("、");
  return `${claudeMd}

## 当前项目
工作目录就是项目根目录。现有文件：${files}。
学生可用的素材（已经在项目里，图片/视频直接用相对路径引用，SVG 也当普通图片用 <img> 显示；文字素材可以直接把内容写进网页）：
${assets}

## 工作方式
- 你已经知道上面的文件和素材，不用再逐个读取确认；需要改已有文件时再 Read。
- 写文件时优先写 index.html，让学生最先看到页面。CSS 可以先内联在 index.html 里，之后再拆分也行。
- 完成后用 1–3 句中文告诉学生做了什么，并建议一个下一步可以试试的改动。`;
}

/** 学生发一条消息：扣一次对话额度 → 启动一次 agent 运行 */
export async function startCodingRun(workspaceId: string, prompt: string) {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) });
  if (!ws) throw new Error("找不到工作区");
  const room = await db.query.classrooms.findFirst({ where: eq(classrooms.id, ws.classroomId) });
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, room!.lessonId) });
  if (room!.status !== "LIVE") throw new CodingQuotaError("老师还没开课，或者已经下课了");
  if (runs.get(workspaceId) && !runs.get(workspaceId)!.finished) throw new CodingQuotaError("AI 还在写，等它写完再发");

  // 原子扣减对话次数，同时置 busy
  const ok = await db
    .update(workspaces)
    .set({ codingTurnsUsed: sql`${workspaces.codingTurnsUsed} + 1`, codingBusy: true })
    .where(and(eq(workspaces.id, workspaceId), lt(workspaces.codingTurnsUsed, lesson!.codingMaxTurns), eq(workspaces.codingBusy, false)))
    .returning({ used: workspaces.codingTurnsUsed });
  if (!ok.length) throw new CodingQuotaError(ws.codingBusy ? "AI 还在写，等它写完再发" : "这节课的对话次数用完了");

  const provider = env.codingProvider === "claude" && env.anthropicKey ? "claude" : "mock";
  const model = lesson!.codingModel || env.codingModel;
  const [run] = await db.insert(agentRuns).values({ workspaceId, prompt, provider, model }).returning();

  const live: LiveRun = { runId: run.id, workspaceId, events: [], listeners: new Set(), abort: new AbortController(), finished: false };
  runs.set(workspaceId, live);
  let seq = Date.now();
  const emit = (e: CodingEvent) => {
    live.events.push(e);
    for (const l of live.listeners) l(e);
  };
  const persist = (role: "user" | "assistant" | "tool", content: unknown) =>
    db.insert(codingMessages).values({ workspaceId, runId: run.id, role, content, seq: seq++ }).catch(() => {});

  emit({ t: "user", text: prompt, runId: run.id });
  await persist("user", { text: prompt });

  void (async () => {
    const t0 = Date.now();
    const m: RunMetrics = { ttftMs: null, firstPreviewMs: null, totalMs: 0, costUsd: 0, inputTokens: 0, outputTokens: 0, model };
    const mark = (k: "ttftMs" | "firstPreviewMs") => {
      if (m[k] === null) m[k] = Date.now() - t0;
    };
    let status: "DONE" | "ERROR" | "STOPPED" = "DONE";
    let error: string | undefined;
    let produced = false;
    try {
      const dir = projectDir(workspaceId);
      const sink = {
        emit: (e: CodingEvent) => {
          if (e.t === "text_delta" || e.t === "tool_start") mark("ttftMs");
          if (e.t === "draft" || e.t === "file") mark("firstPreviewMs");
          if (e.t === "file" || e.t === "text") produced = true;
          emit(e);
        },
        persist,
      };
      if (provider === "claude") {
        const r = await runClaude({ dir, prompt, model, resume: ws.agentSessionId, abort: live.abort, sink });
        m.costUsd = r.costUsd;
        m.inputTokens = r.inputTokens;
        m.outputTokens = r.outputTokens;
        if (r.sessionId) await db.update(workspaces).set({ agentSessionId: r.sessionId }).where(eq(workspaces.id, workspaceId));
        if (r.error) {
          status = "ERROR";
          error = r.error;
        }
      } else {
        await runMock({ dir, prompt, abort: live.abort, sink, first: !ws.agentSessionId });
        await db.update(workspaces).set({ agentSessionId: "mock" }).where(eq(workspaces.id, workspaceId));
      }
      if (live.abort.signal.aborted) status = "STOPPED";
    } catch (e) {
      status = live.abort.signal.aborted ? "STOPPED" : "ERROR";
      error = e instanceof Error ? e.message : String(e);
      console.error("[coding] run failed", error);
    }
    m.totalMs = Date.now() - t0;

    // 没产出任何东西就出错（如网络、鉴权问题）：退回这次对话次数
    const refund = status === "ERROR" && !produced;
    const [after] = await db
      .update(workspaces)
      .set({ codingBusy: false, lastActiveAt: new Date(), ...(refund ? { codingTurnsUsed: sql`max(${workspaces.codingTurnsUsed} - 1, 0)` } : {}) })
      .where(eq(workspaces.id, workspaceId))
      .returning({ used: workspaces.codingTurnsUsed });
    await db
      .update(agentRuns)
      .set({ status, error, ...m, totalMs: m.totalMs })
      .where(eq(agentRuns.id, run.id));
    await db.insert(usageRecords).values({
      studentId: ws.studentId,
      classroomId: ws.classroomId,
      lessonId: lesson!.id,
      kind: "CODING",
      provider,
      model,
      units: refund ? 0 : 1,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      costUsd: m.costUsd,
      latencyMs: m.totalMs,
      refId: run.id,
      success: status !== "ERROR",
    });
    if (error) await persist("assistant", { text: "", error });
    emit({ t: "done", status, error, metrics: m, turnsUsed: after?.used ?? 0 });
    live.finished = true;
    // 保留一会儿事件缓冲，供刚断线的前端补拉
    setTimeout(() => {
      if (runs.get(workspaceId) === live) runs.delete(workspaceId);
    }, 60_000);
  })();

  return { runId: run.id };
}

// ---------- Claude Agent SDK ----------

type Sink = { emit: (e: CodingEvent) => void; persist: (role: "user" | "assistant" | "tool", c: unknown) => Promise<unknown> };

/** 从流式的 Write 工具参数（不完整 JSON）里尽量提取 file_path 和 content */
function partialWrite(json: string): { file?: string; content?: string } {
  const out: { file?: string; content?: string } = {};
  const fm = json.match(/"file_path"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (fm) out.file = JSON.parse(`"${fm[1]}"`);
  const ci = json.indexOf('"content"');
  if (ci >= 0) {
    const start = json.indexOf('"', json.indexOf(":", ci) + 1);
    if (start >= 0) {
      let raw = json.slice(start + 1);
      // 截掉末尾不完整的转义和结束引号
      const end = raw.search(/(?<!\\)"\s*[,}]/);
      if (end >= 0) raw = raw.slice(0, end);
      raw = raw.replace(/\\u[0-9a-fA-F]{0,3}$/, "").replace(/\\$/, "");
      try {
        out.content = JSON.parse(`"${raw}"`);
      } catch {
        out.content = raw.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
    }
  }
  return out;
}

const relFile = (dir: string, p?: unknown) => (typeof p === "string" ? path.relative(dir, path.resolve(dir, p)).split(path.sep).join("/") : undefined);

async function runClaude(o: { dir: string; prompt: string; model: string; resume: string | null; abort: AbortController; sink: Sink }) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const { dir, sink } = o;
  const inside = (p: unknown) => typeof p === "string" && (path.resolve(dir, p) + path.sep).startsWith(dir + path.sep);

  const q = query({
    prompt: o.prompt,
    options: {
      cwd: dir,
      model: o.model,
      tools: ["Read", "Write", "Edit", "TodoWrite"],
      permissionMode: "acceptEdits",
      // 只允许读写项目目录里的文件
      canUseTool: async (name, input) => {
        if (name === "TodoWrite") return { behavior: "allow", updatedInput: input };
        if (["Read", "Write", "Edit"].includes(name) && inside(input.file_path)) return { behavior: "allow", updatedInput: input };
        return { behavior: "deny", message: "只能修改当前项目里的文件" };
      },
      settingSources: [],
      systemPrompt: systemPrompt(dir),
      includePartialMessages: true,
      maxTurns: 25,
      thinking: { type: "disabled" },
      resume: o.resume && o.resume !== "mock" ? o.resume : undefined,
      abortController: o.abort,
      env: { ...process.env, ANTHROPIC_API_KEY: env.anthropicKey, CLAUDE_AGENT_SDK_CLIENT_APP: "ai-edu/0.1" },
    },
  });

  // 当前流式中的内容块
  const blocks = new Map<number, { kind: "text" | "tool"; id: string; name?: string; json: string; text: string; lastDraft: number; file?: string }>();
  const toolNames = new Map<string, { name: string; file?: string; input?: Record<string, unknown> }>();
  let sessionId: string | null = null;
  let costUsd = 0,
    inputTokens = 0,
    outputTokens = 0;
  let error: string | undefined;

  for await (const msg of q) {
    if (msg.type === "system" && msg.subtype === "init") sessionId = msg.session_id;

    if (msg.type === "stream_event" && !msg.parent_tool_use_id) {
      const ev = msg.event;
      if (ev.type === "content_block_start") {
        const cb = ev.content_block;
        if (cb.type === "text") blocks.set(ev.index, { kind: "text", id: `${msg.uuid}-${ev.index}`, json: "", text: "", lastDraft: 0 });
        if (cb.type === "tool_use") {
          blocks.set(ev.index, { kind: "tool", id: cb.id, name: cb.name, json: "", text: "", lastDraft: 0 });
          sink.emit({ t: "tool_start", id: cb.id, name: cb.name });
        }
      } else if (ev.type === "content_block_delta") {
        const b = blocks.get(ev.index);
        if (!b) continue;
        if (ev.delta.type === "text_delta" && b.kind === "text") {
          b.text += ev.delta.text;
          sink.emit({ t: "text_delta", id: b.id, text: ev.delta.text });
        } else if (ev.delta.type === "input_json_delta" && b.kind === "tool") {
          b.json += ev.delta.partial_json;
          // 一拿到 file_path 就告诉前端在改哪个文件
          if (!b.file && b.name !== "TodoWrite") {
            const f = relFile(dir, partialWrite(b.json).file);
            if (f) {
              b.file = f;
              sink.emit({ t: "tool_start", id: b.id, name: b.name!, file: f });
            }
          }
          // Write 的内容边生成边推到预览（每 120ms 一次）
          if (b.name === "Write" && Date.now() - b.lastDraft > 120) {
            const pw = partialWrite(b.json);
            const file = relFile(dir, pw.file);
            if (file && pw.content && /\.(html|css)$/.test(file)) {
              b.lastDraft = Date.now();
              sink.emit({ t: "draft", file, content: pw.content });
            }
          }
        }
      } else if (ev.type === "content_block_stop") {
        const b = blocks.get(ev.index);
        if (b?.kind === "text" && b.text.trim()) {
          sink.emit({ t: "text", id: b.id, text: b.text });
          await sink.persist("assistant", { text: b.text });
        }
        blocks.delete(ev.index);
      }
    }

    // 完整的 assistant 消息：拿到工具调用的完整参数
    if (msg.type === "assistant" && !msg.parent_tool_use_id) {
      for (const c of msg.message.content) {
        if (c.type === "tool_use") {
          const input = c.input as Record<string, unknown>;
          const file = relFile(dir, input.file_path);
          toolNames.set(c.id, { name: c.name, file, input });
          if (c.name === "TodoWrite" && Array.isArray(input.todos)) {
            sink.emit({ t: "todos", items: (input.todos as { content: string; status: string }[]).map((x) => ({ content: x.content, status: x.status })) });
          }
        }
      }
    }

    // 工具结果：文件写完 → 通知预览刷新
    if (msg.type === "user" && !msg.parent_tool_use_id && Array.isArray(msg.message.content)) {
      for (const c of msg.message.content as { type: string; tool_use_id?: string; is_error?: boolean }[]) {
        if (c.type !== "tool_result" || !c.tool_use_id) continue;
        const t = toolNames.get(c.tool_use_id);
        if (!t) continue;
        const ok = !c.is_error;
        const summary =
          t.name === "Edit" ? "修改了一处" : t.name === "Write" ? "写入文件" : t.name === "Read" ? "读取文件" : t.name === "TodoWrite" ? "更新计划" : undefined;
        sink.emit({ t: "tool_end", id: c.tool_use_id, name: t.name, file: t.file, ok, summary });
        if (t.name !== "TodoWrite") await sink.persist("tool", { name: t.name, file: t.file, ok });
        if (ok && t.file && (t.name === "Write" || t.name === "Edit")) sink.emit({ t: "file", file: t.file, at: Date.now() });
      }
    }

    if (msg.type === "result") {
      costUsd = msg.total_cost_usd ?? 0;
      inputTokens = (msg.usage?.input_tokens ?? 0) + (msg.usage?.cache_creation_input_tokens ?? 0) + (msg.usage?.cache_read_input_tokens ?? 0);
      outputTokens = msg.usage?.output_tokens ?? 0;
      if (msg.subtype !== "success") error = `运行中断（${msg.subtype}）`;
    }
  }
  return { sessionId, costUsd, inputTokens, outputTokens, error };
}
