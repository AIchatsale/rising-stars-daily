"use client";

import { Badge } from "@/components/ui/badge";
import { LanguageDot } from "@/components/language-dot";
import { deltaCaption, formatDelta, formatNumber, formatPercent } from "@/lib/format";
import type { HistoryPoint, RankedRepo } from "@/lib/types";

function Sparkline({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.stars);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 96;
  const height = 32;
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = max === min ? height / 2 : height - ((value - min) / (max - min)) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="text-primary">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" points={coords.join(" ")} />
    </svg>
  );
}

function growthClass(delta: number | null): string {
  if (delta == null) return "bg-muted text-muted-foreground";
  if (delta > 0) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (delta < 0) return "bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return "bg-muted text-muted-foreground";
}

export function RisingCard({
  repo,
  approximate24h,
  history,
}: {
  repo: RankedRepo;
  approximate24h: boolean;
  history: HistoryPoint[];
}) {
  const caption = deltaCaption(repo.deltaSource, approximate24h);
  return (
    <article className="surface flex h-full flex-col p-4 transition hover:-translate-y-0.5 hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
            #{repo.rank}
            {repo.isNew ? " · 新仓库" : ""}
            {repo.rankChange != null && repo.rankChange !== 0 ? ` · ${repo.rankChange > 0 ? `↑${repo.rankChange}` : `↓${Math.abs(repo.rankChange)}`}` : ""}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold tracking-tight">
            <a href={repo.url} target="_blank" rel="noreferrer" className="hover:text-primary">
              {repo.name}
            </a>
          </h3>
          <p className="truncate text-xs text-muted-foreground">{repo.owner}</p>
        </div>
        <div className={`shrink-0 rounded-full px-2.5 py-1 text-right ${growthClass(repo.delta)}`}>
          <p className="text-sm font-semibold tabular-nums">{formatDelta(repo.delta)}</p>
          <p className="text-[10px] opacity-80">{caption}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-foreground/90">{repo.description || "仓库没有简介。"}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{repo.classification.opportunity}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge>{repo.classification.category}</Badge>
        <LanguageDot language={repo.language} />
        {repo.demo ? <Badge variant="outline">演示</Badge> : null}
        {repo.trackedTopics.slice(0, 3).map((topic) => (
          <Badge key={topic} variant="outline">
            {topic}
          </Badge>
        ))}
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div>
          <p className="text-sm font-medium tabular-nums">{formatNumber(repo.stars)} 星</p>
          <p className="text-xs tabular-nums text-muted-foreground">{formatPercent(repo.growthPercent)}</p>
        </div>
        <Sparkline points={history} />
      </div>
    </article>
  );
}
