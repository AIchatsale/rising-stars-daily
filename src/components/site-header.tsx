import { siteHref } from "@/lib/site";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ current }: { current: "rising" | "library" }) {
  const items = [
    { id: "rising" as const, href: siteHref("/"), label: "昇星日报" },
    { id: "library" as const, href: siteHref("/library/"), label: "高星项目库" },
  ];
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
        <div className="flex items-center gap-2">
          <nav className="flex rounded-full border border-border bg-card p-1 shadow-sm" aria-label="栏目">
            {items.map((item) => {
              const active = item.id === current;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium md:text-sm ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
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
