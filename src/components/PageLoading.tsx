import { Loader2 } from "lucide-react";

/** 页面 / 区块加载提示（服务器在海外时跳转要一两秒，没有提示容易以为卡住） */
export function PageLoading({ text = "正在打开…", full = false }: { text?: string; full?: boolean }) {
  const inner = (
    <div className="flex items-center gap-2 py-10 text-sm text-muted">
      <Loader2 size={16} className="animate-spin text-spark" />
      {text}
    </div>
  );
  return full ? <div className="grid min-h-dvh place-items-center">{inner}</div> : inner;
}
