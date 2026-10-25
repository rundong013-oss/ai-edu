import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { BRAND } from "@/lib/brand";
import { submissionViews } from "@/server/queries";

/** 作品分享页：给家长看，手机优先。不需要登录。 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sub = await db.query.submissions.findFirst({ where: eq(submissions.shareToken, token) });
  if (!sub) notFound();
  const [w] = (await submissionViews({ studentId: sub.studentId })).filter((x) => x.id === sub.id);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const url = `${origin}/share/${token}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#e4ece8", light: "#00000000" } });

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
      <div className="mt-8 flex items-center gap-4 border-t border-line pt-6">
        <div className="h-24 w-24 shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="text-sm leading-relaxed text-muted">
          这是孩子在 AI 课上自己用 AI {w.type === "WEB" ? "做出来的网页" : w.type === "VIDEO" ? "生成的动画" : "画出来的作品"}。扫码或转发这个页面，就能在手机上打开。
        </p>
      </div>
    </main>
  );
}
