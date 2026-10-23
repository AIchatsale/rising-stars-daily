"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const LibraryBrowser = dynamic(() => import("@/components/library-browser").then((mod) => mod.LibraryBrowser), {
  ssr: false,
  loading: () => <LibraryPlaceholder />,
});

function LibraryPlaceholder() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 md:px-8 md:py-10">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.2em] text-primary">PANDAWM · HIGH-STAR LIBRARY</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">高星项目库</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">名单在接近这一段时加载，避免首页先去拉整份项目库。</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="surface h-24 animate-pulse bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function LibraryGate() {
  const section = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = section.current;
    if (!node) return;
    let frozen = false;
    const wantsLibrary = () => window.location.hash === "#library";
    const align = () => {
      if (frozen || !wantsLibrary()) return;
      const top = node.getBoundingClientRect().top;
      if (top > 64 && top < 96) return;
      node.scrollIntoView({ block: "start" });
    };
    if (wantsLibrary()) setReady(true);
    align();
    const resize = new ResizeObserver(align);
    resize.observe(document.documentElement);
    const reveal = new IntersectionObserver(
      (entries) => {
        if (wantsLibrary()) return;
        const visible = entries.some((entry) => entry.isIntersecting);
        if (!visible || document.documentElement.scrollHeight < window.innerHeight + 900) return;
        setReady(true);
        reveal.disconnect();
      },
      { rootMargin: "480px 0px" },
    );
    reveal.observe(node);
    const freeze = () => {
      frozen = true;
    };
    const onHash = () => {
      frozen = false;
      if (wantsLibrary()) setReady(true);
      align();
    };
    window.addEventListener("wheel", freeze, { passive: true });
    window.addEventListener("touchmove", freeze, { passive: true });
    window.addEventListener("keydown", freeze);
    window.addEventListener("hashchange", onHash);
    return () => {
      resize.disconnect();
      reveal.disconnect();
      window.removeEventListener("wheel", freeze);
      window.removeEventListener("touchmove", freeze);
      window.removeEventListener("keydown", freeze);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  return (
    <section id="library" ref={section} className="scroll-mt-20 border-t border-border">
      {ready ? <LibraryBrowser /> : <LibraryPlaceholder />}
    </section>
  );
}
