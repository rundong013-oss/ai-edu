"use client";
/** 框体结果：图片 / 视频 / 文字。mock 视频是带动画的 SVG，用 <img> 播放；真实视频用 <video> */
export function Media({
  url,
  type,
  text,
  className = "",
  alt = "",
}: {
  url: string | null;
  type: "IMAGE" | "VIDEO" | "TEXT";
  text?: string | null;
  className?: string;
  alt?: string;
}) {
  if (type === "TEXT") {
    return (
      <div className={`overflow-hidden whitespace-pre-wrap bg-panel p-2 text-[11px] leading-snug text-ink/80 ${className}`}>{text ?? "文字"}</div>
    );
  }
  if (!url) return null;
  if (type === "VIDEO" && !url.endsWith(".svg")) {
    return <video src={url} className={className} autoPlay loop muted playsInline />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} draggable={false} />;
}
