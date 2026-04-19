import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "中華基督教會基慈小學 — 會議紀錄生成器",
  description: "AI 自動生成會議紀錄 Powered by Qwen AI",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
