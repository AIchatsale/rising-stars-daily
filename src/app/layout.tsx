import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { DEFAULT_PAGES_URL } from "@/lib/pages-host";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const pagesUrl = process.env.NEXT_PUBLIC_PAGES_URL || DEFAULT_PAGES_URL;

export const metadata: Metadata = {
  metadataBase: new URL(pagesUrl),
  title: "昇星日报 · PandaWM",
  description: "熊猫出海给业务同事用的开源情报：每天找出涨得最快的 GitHub 项目，并按星标档位浏览可以拿去跟客户谈的仓库。",
};

const themeScript = `try{if(localStorage.getItem("pandawm-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={geist.variable} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
