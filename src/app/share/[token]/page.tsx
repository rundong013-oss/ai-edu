import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { BRAND } from "@/lib/brand";
import { submissionViews } from "@/server/queries";

const KIND = { IMAGE: "画出来的作品", VIDEO: "生成的动画", WEB: "做出来的网页", TEXT: "写出来的作品" } as const;

/** 作品分享页：给家长看，手机优先，不需要登录。下半部分展示「孩子是怎么做出来的」 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sub = await db.query.submissions.findFirst({ where: eq(submissions.shareToken, token) });
  if (!sub) notFound();
  const [w] = (await submissionViews({ studentId: sub.studentId })).filter((x) => x.id === sub.id);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const url = `${origin}/share/${token}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#e4ece8", light: "#00000000" } });
  const steps = w.process?.steps ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-8">
      <div className="text-sm text-muted">{BRAND.name} · 学生作品</div>
      <h1 className="mt-2 text-2xl font-semibold">{w.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {w.studentName} · {w.lessonTitle} · {w.createdAt.toLocaleDateString("zh-CN")}
      </p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-panel">
        {w.type === "WEB" ? (
          <iframe src={w.mediaUrl} title={w.title} sandbox="allow-scripts allow-modals" className="h-[75dvh] w-full bg-white" />
        ) : w.type === "TEXT" ? (
          <div className="whitespace-pre-wrap p-5 text-[15px] leading-relaxed">{w.textContent}</div>
        ) : w.type === "VIDEO" && !w.mediaUrl.endsWith(".svg") ? (
          <video src={w.mediaUrl} className="w-full" controls autoPlay loop muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.mediaUrl} alt={w.title} className="w-full" />
        )}
      </div>
      {w.type === "WEB" && (
        <a href={w.mediaUrl} target="_blank" rel="noreferrer" className="btn mt-3 self-start">
          全屏打开网页
        </a>
      )}

      {steps.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">是怎么做出来的</h2>
          <p className="mt-1 text-sm text-muted">
            {w.process?.kind === "coding"
              ? "孩子用自己的话一步步告诉 AI 要做什么、怎么改："
              : w.process?.kind === "mixed"
                ? "孩子先写提示词让 AI 画出素材，再用自己的话一步步告诉 AI 要做什么、怎么改："
                : "每一步都是孩子自己写的提示词，AI 按提示词生成："}
          </p>
          <ol className="mt-4 space-y-4">
            {steps.map((s, i) => (
              <li key={i} className="relative border-l-2 border-line pl-5">
                <span className="absolute -left-[9px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-spark font-mono text-[10px] text-night">{i + 1}</span>
                <div className="text-sm font-medium">{s.title}</div>
                <blockquote className="mt-1.5 rounded-lg bg-panel px-3 py-2 text-sm leading-relaxed text-ink/85">「{s.prompt}」</blockquote>
                {(s.blocks?.length || s.attempts) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-muted">
                    {s.blocks?.map((b) => (
                      <span key={b} className="rounded-md border border-line px-1.5 py-0.5">
                        + {b}
                      </span>
                    ))}
                    {s.attempts ? <span>试了 {s.attempts} 次，选了最满意的一个</span> : null}
                  </div>
                )}
                {s.output &&
                  (s.output.startsWith("/api/files/") ? (
                    !s.output.endsWith(".txt") && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.output} alt={s.title} className="mt-2 h-28 rounded-lg border border-line object-cover" />
                    )
                  ) : (
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{s.output}</p>
                  ))}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-10 flex items-center gap-4 border-t border-line pt-6">
        <div className="h-24 w-24 shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="text-sm leading-relaxed text-muted">这是孩子在 AI 课上自己用 AI {KIND[w.type]}。扫码或转发这个页面，就能在手机上打开。</p>
      </div>
    </main>
  );
}
