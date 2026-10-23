import type { Metadata } from "next";
import { LibraryBrowser } from "@/components/library-browser";

export const metadata: Metadata = {
  title: "高星项目库 · PandaWM",
  description: "按星标档位浏览 5,000 星以上的开源项目，并标出协议、活跃度和可能的商业用途。",
};

export default function LibraryPage() {
  return <LibraryBrowser />;
}
