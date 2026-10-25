"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// 记录本标签页里在站内走过几个页面（整页刷新会清零），给返回按钮判断能不能「后退」
let visited = 0;
export const canGoBackInApp = () => visited > 1;

export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    visited++;
  }, [pathname]);
  return null;
}
