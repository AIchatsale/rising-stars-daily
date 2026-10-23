"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { siteHash, siteHref } from "@/lib/site";

const items = [
  { id: "rising", label: "Github之星" },
  { id: "library", label: "高星项目库" },
];

export function SiteHeader() {
  const [current, setCurrent] = useState("rising");

  useEffect(() => {
    const nodes = items
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (window.location.hash === "#library") setCurrent("library");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible?.target.id) setCurrent(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.25, 0.5] },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
        <a href={siteHref("/")} className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-[11px] font-semibold tracking-tight text-primary-foreground">PW</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight">PandaWM</span>
            <span className="hidden truncate text-[11px] text-muted-foreground sm:block">熊猫出海 · 开源情报</span>
          </span>
        </a>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <nav className="flex rounded-full border border-border bg-card p-1 shadow-sm" aria-label="栏目">
            {items.map((item) => {
              const active = item.id === current;
              return (
                <a
                  key={item.id}
                  href={siteHash(item.id)}
                  aria-current={active ? "location" : undefined}
                  className={`whitespace-nowrap rounded-full px-2 py-1.5 text-[11px] font-medium sm:px-3 sm:text-xs md:text-sm ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
