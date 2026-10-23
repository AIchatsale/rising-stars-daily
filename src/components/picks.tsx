"use client";

import { Badge } from "@/components/ui/badge";
import { formatDelta, formatNumber } from "@/lib/format";
import type { DayReport } from "@/lib/types";

export function Picks({ report }: { report: DayReport }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">今天建议带给客户</h2>
        <p className="text-sm text-muted-foreground">按商业相关度而不是单纯涨星重排。清单、教程和演示仓库会往后放。</p>
      </div>
      {report.recommended.length === 0 ? (
        <p className="surface border-dashed px-4 py-8 text-sm text-muted-foreground">这一天没有足够的候选。</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {report.recommended.map((pick, index) => {
            const repo = report.items.find((item) => item.fullName === pick.fullName);
            return (
              <article key={pick.fullName} className="surface flex flex-col p-4">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-primary">0{index + 1}</p>
                <h3 className="mt-2 text-base font-semibold tracking-tight">
                  {repo ? (
                    <a href={repo.url} target="_blank" rel="noreferrer" className="hover:text-primary">
                      {pick.fullName}
                    </a>
                  ) : (
                    pick.fullName
                  )}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{pick.reason}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge>{pick.category}</Badge>
                  {pick.signals.map((signal) => (
                    <Badge key={signal} variant="outline">
                      {signal}
                    </Badge>
                  ))}
                </div>
                {repo ? (
                  <p className="mt-3 text-sm tabular-nums text-muted-foreground">
                    {formatNumber(repo.stars)} 星 · {formatDelta(repo.delta)}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
