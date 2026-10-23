import type { Metadata } from "next";
import { siteHash } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "高星项目库 · PandaWM" },
  description: "高星项目库已经并入首页。这个地址会打开首页的项目库一节。",
};

export default function LibraryPage() {
  const href = siteHash("library");
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-3 px-4 py-16 md:px-8">
      <script dangerouslySetInnerHTML={{ __html: `location.replace(${JSON.stringify(href)})` }} />
      <h1 className="text-2xl font-semibold tracking-tight">高星项目库</h1>
      <p className="text-sm leading-6 text-muted-foreground">这一节现在在首页下方。正在打开。</p>
      <a className="text-sm font-medium text-primary" href={href}>
        打开首页的高星项目库
      </a>
    </main>
  );
}
