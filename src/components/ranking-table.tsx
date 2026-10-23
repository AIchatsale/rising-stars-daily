"use client";

import { LanguageDot } from "@/components/language-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deltaCaption, formatDate, formatDelta, formatNumber, formatPercent } from "@/lib/format";
import type { RankedRepo } from "@/lib/types";

export type SortKey = "rank" | "fullName" | "language" | "stars" | "delta" | "growthPercent" | "createdAt";

const columns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "rank", label: "排名" },
  { key: "fullName", label: "项目" },
  { key: "language", label: "语言" },
  { key: "stars", label: "星标", align: "right" },
  { key: "delta", label: "增量", align: "right" },
  { key: "growthPercent", label: "增速", align: "right" },
  { key: "createdAt", label: "创建" },
];

export function RankingTable({
  items,
  sortKey,
  sortDir,
  approximate24h,
  onSort,
}: {
  items: RankedRepo[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  approximate24h: boolean;
  onSort: (key: SortKey) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => {
            const active = sortKey === column.key;
            const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";
            return (
              <TableHead key={column.key} aria-sort={ariaSort} className={column.align === "right" ? "text-right" : undefined}>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-primary"
                  onClick={() => onSort(column.key)}
                >
                  {column.label}
                  <span aria-hidden="true">{active ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
                </button>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.fullName}>
            <TableCell className="tabular-nums">{item.rank}</TableCell>
            <TableCell>
              <a href={item.url} target="_blank" rel="noreferrer" className="font-medium hover:text-primary">
                {item.fullName}
              </a>
              <div className="max-w-sm truncate text-xs text-muted-foreground">{item.classification.category}</div>
            </TableCell>
            <TableCell>{item.language ? <LanguageDot language={item.language} /> : "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(item.stars)}</TableCell>
            <TableCell className="text-right tabular-nums">
              <span className={item.delta != null && item.delta > 0 ? "font-medium text-emerald-700 dark:text-emerald-300" : undefined}>{formatDelta(item.delta)}</span>
              <div className="text-xs font-normal text-muted-foreground">{deltaCaption(item.deltaSource, approximate24h)}</div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatPercent(item.growthPercent)}</TableCell>
            <TableCell>{formatDate(item.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
