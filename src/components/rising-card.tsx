"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deltaCaption, formatDate, formatDelta, formatNumber, formatPercent } from "@/lib/format";
import type { HistoryPoint, RankedRepo } from "@/lib/types";

function Sparkline({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.stars);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 92;
  const height = 28;
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = max === min ? height / 2 : height - ((value - min) / (max - min)) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="text-primary">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.6" points={coords.join(" ")} />
    </svg>
  );
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
    <Card className="h-full bg-card/95">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-muted-foreground">
              #{repo.rank} · {repo.owner}
              {repo.isNew ? " · 新仓库" : ""}
              {repo.rankChange != null && repo.rankChange !== 0
                ? ` · ${repo.rankChange > 0 ? `上升 ${repo.rankChange}` : `下降 ${Math.abs(repo.rankChange)}`}`
                : ""}
            </p>
            <CardTitle className="font-heading text-xl">
              <a href={repo.url} target="_blank" rel="noreferrer" className="hover:text-primary">
                {repo.name}
              </a>
            </CardTitle>
          </div>
          <div className="text-right">
            <p className="font-heading text-2xl text-primary tabular-nums">{formatDelta(repo.delta)}</p>
            <p className="text-xs text-muted-foreground">{caption}</p>
            <p className="text-xs tabular-nums text-muted-foreground">{formatPercent(repo.growthPercent)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="line-clamp-3 text-sm leading-6">{repo.description || "仓库没有简介。"}</p>
        <p className="text-sm leading-6 text-muted-foreground">{repo.classification.summary}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{repo.classification.category}</Badge>
          {repo.language ? <Badge variant="outline">{repo.language}</Badge> : null}
          {repo.demo ? <Badge variant="outline">演示</Badge> : null}
          {repo.trackedTopics.slice(0, 3).map((topic) => (
            <Badge key={topic} variant="outline">
              {topic}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div className="text-sm">
            <p className="tabular-nums">{formatNumber(repo.stars)} 星</p>
            <p className="text-xs text-muted-foreground">创建于 {formatDate(repo.createdAt)}</p>
          </div>
          <Sparkline points={history} />
        </div>
      </CardContent>
    </Card>
  );
}
