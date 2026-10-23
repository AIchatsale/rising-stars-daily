import { siteHref } from "@/lib/site";

export function SiteNav({ current }: { current: "rising" | "library" }) {
  const items = [
    { id: "rising" as const, href: siteHref("/"), label: "昇星日报" },
    { id: "library" as const, href: siteHref("/library/"), label: "高星项目库" },
  ];
  return (
    <nav className="flex gap-2" aria-label="栏目">
      {items.map((item) => {
        const active = item.id === current;
        return (
          <a
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm ${active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"}`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
