import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { Suspense } from "react";
import { NavTracker } from "@/components/NavTracker";
import { NavProgress } from "@/components/NavProgress";

export const metadata: Metadata = {
  title: BRAND.name,
  description: "AI 教学一体化平台：画布创作 + Vibe Coding",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh">
        <NavTracker />
        <Suspense>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
