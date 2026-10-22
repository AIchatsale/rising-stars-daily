import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "昇星日报",
  description: "每日对照 GitHub 星标快照，找出过去 24 小时增速最快的开源项目，供业务团队筛选可以带给客户的机会。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${fraunces.variable} ${geist.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
