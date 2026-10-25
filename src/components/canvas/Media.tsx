"use client";
/** 图片或视频结果。mock 视频是带动画的 SVG，用 <img> 播放；真实视频用 <video> */
export function Media({ url, type, className = "", alt = "" }: { url: string; type: "IMAGE" | "VIDEO"; className?: string; alt?: string }) {
  if (type === "VIDEO" && !url.endsWith(".svg")) {
    return <video src={url} className={className} autoPlay loop muted playsInline />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} draggable={false} />;
}
