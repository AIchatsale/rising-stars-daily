import { ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-6 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <p className="text-sm font-medium">PandaWM 熊猫出海</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            这份看板给业务同事筛项目。如果要谈海外获客、GEO 或广告投放，去官网联系。
          </p>
        </div>
        <a
          href="https://www.pandawm.com"
          className="inline-flex h-9 w-fit items-center gap-1 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-sm transition hover:border-primary/40 hover:text-primary"
        >
          pandawm.com
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </footer>
  );
}
