import { ArrowUpRight } from "lucide-react";
import { SubscribeForm } from "@/components/subscribe-form";

export function SiteFooter() {
  return (
    <footer className="mt-6 border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:px-8">
        <div>
          <p className="text-sm font-medium">PandaWM 熊猫出海</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            这份看板给业务同事筛项目。如果要谈海外获客、GEO 或广告投放，去官网联系。
          </p>
          <a
            href="https://www.pandawm.com"
            className="mt-4 inline-flex h-9 w-fit items-center gap-1 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-sm transition hover:border-primary/40 hover:text-primary"
          >
            pandawm.com
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
        <SubscribeForm />
      </div>
    </footer>
  );
}
