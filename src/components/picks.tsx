"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDelta, formatNumber } from "@/lib/format";
import type { DayReport } from "@/lib/types";

export function Picks({ report }: { report: DayReport }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading text-2xl">今日建议带给客户</h2>
        <p className="text-sm text-muted-foreground">按商业相关度而不是单纯涨星重新排过。清单、教程和演示仓库会被往后放。</p>
      </div>
      {report.recommended.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">这一天没有足够的候选。</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {report.recommended.map((pick, index) => {
            const repo = report.items.find((item) => item.fullName === pick.fullName);
            return (
              <Card key={pick.fullName} className="bg-card/95">
                <CardHeader>
                  <p className="text-xs tracking-[0.14em] text-primary">建议 {index + 1}</p>
                  <CardTitle className="font-heading text-lg">
                    {repo ? (
                      <a href={repo.url} target="_blank" rel="noreferrer" className="hover:text-primary">
                        {pick.fullName}
                      </a>
                    ) : (
                      pick.fullName
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-6">{pick.reason}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge>{pick.category}</Badge>
                    {pick.signals.map((signal) => (
                      <Badge key={signal} variant="outline">
                        {signal}
                      </Badge>
                    ))}
                  </div>
                  {repo ? (
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {formatNumber(repo.stars)} 星 · {formatDelta(repo.delta)}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
