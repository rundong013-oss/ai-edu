import Link from "next/link";
import { Code2 } from "lucide-react";
import type { SubmissionView } from "@/server/queries";

/** 作品卡片：图片/视频显示缩略图，网页显示封面或图标 */
export function WorkCard({ w, showStudent = true, actions }: { w: SubmissionView; showStudent?: boolean; actions?: React.ReactNode }) {
  const isSvgVideo = w.type === "VIDEO" && w.mediaUrl.endsWith(".svg");
  return (
    <div className="card overflow-hidden">
      <Link href={w.shareUrl} target="_blank" className="block aspect-[4/3] bg-night">
        {w.type === "WEB" ? (
          w.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.coverUrl} alt={w.title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-muted">
              <Code2 size={28} />
            </div>
          )
        ) : w.type === "VIDEO" && !isSvgVideo ? (
          <video src={w.mediaUrl} className="h-full w-full object-cover" muted loop autoPlay playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.mediaUrl} alt={w.title} className="h-full w-full object-cover" />
        )}
      </Link>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {w.title}
            <span className="ml-1.5 text-xs font-normal text-muted">{w.type === "WEB" ? "网页" : w.type === "VIDEO" ? "视频" : "图片"}</span>
          </div>
          <div className="truncate text-xs text-muted">
            {showStudent && `${w.studentName} · `}
            {w.lessonTitle}
          </div>
        </div>
        {actions}
      </div>
    </div>
  );
}
