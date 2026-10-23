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
    if (window.location.hash === "#library") {
      setReady(true);
      return;
    }
    const node = section.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        // The rising section is still a short skeleton on the first callback, which
        // would otherwise pull the 7MB catalog into the initial paint.
        if (!visible || document.documentElement.scrollHeight < window.innerHeight + 900) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin: "480px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="library" ref={section} className="scroll-mt-20 border-t border-border">
      {ready ? <LibraryBrowser /> : <LibraryPlaceholder />}
    </section>
  );
}
