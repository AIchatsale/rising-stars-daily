"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LanguageDot } from "@/components/language-dot";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatDateTime, formatDelta, formatNumber } from "@/lib/format";
import {
  exportRow,
  filterLibrary,
  LIBRARY_CATEGORIES,
  LIBRARY_TIERS,
  licenseKind,
  licenseLabel,
  matchLibraryCategories,
  signalLabels,
  sortLibrary,
  starGrowth,
  tierCounts,
  toCsv,
  type LibraryCatalog,
  type LibraryHistory,
  type LibrarySortKey,
  type LibraryTierId,
  type LicenseKind,
} from "@/lib/library";
import { dataUrl } from "@/lib/site";

const ROW_HEIGHT = 188;
const PAGE_SIZE = 40;

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function LibraryBrowser() {
  const [catalog, setCatalog] = useState<LibraryCatalog | null>(null);
  const [history, setHistory] = useState<LibraryHistory>({ series: {} });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"all" | LibraryTierId>("all");
  const [language, setLanguage] = useState("all");
  const [category, setCategory] = useState("all");
  const [license, setLicense] = useState<"all" | LicenseKind>("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<LibrarySortKey>("stars");
  const [page, setPage] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const viewport = 640;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [catalogResponse, historyResponse] = await Promise.all([
          fetch(dataUrl("library/catalog.json"), { cache: "no-store" }),
          fetch(dataUrl("library/history.json"), { cache: "no-store" }),
        ]);
        if (catalogResponse.status === 404) {
          if (!cancelled) setError("还没有高星项目库。运行一次 Rising Stars 工作流后，这里会列出 5,000 星以上的仓库。");
          return;
        }
        if (!catalogResponse.ok) throw new Error(`项目库读取失败（${catalogResponse.status}）`);
        const catalogJson = (await catalogResponse.json()) as LibraryCatalog;
        const historyJson = historyResponse.ok ? ((await historyResponse.json()) as LibraryHistory) : { series: {} };
        if (!cancelled) {
          setCatalog(catalogJson);
          setHistory(historyJson.series ? historyJson : { series: {} });
          setError(catalogJson.repos.length === 0 ? "项目库是空的。勾选工作流里的全量搜索后再跑一次。" : null);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "项目库读取失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const asOf = catalog?.date ?? "1970-01-01";
  const withinDays = 90;
  const counts = useMemo(() => tierCounts(catalog?.repos ?? []), [catalog]);
  const languages = useMemo(() => {
    const tally = new Map<string, number>();
    for (const repo of catalog?.repos ?? []) {
      if (!repo.language) continue;
      tally.set(repo.language, (tally.get(repo.language) ?? 0) + 1);
    }
    return [...tally.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([name]) => name);
  }, [catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    return sortLibrary(
      filterLibrary(catalog.repos, { tier, language, category, license, activeOnly, query, asOf, activeWithinDays: withinDays, minStars: 5000 }),
      sortKey,
      history,
      asOf,
    );
  }, [catalog, history, tier, language, category, license, activeOnly, query, sortKey, asOf]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 3);
  const visibleCount = Math.ceil(viewport / ROW_HEIGHT) + 6;
  const visibleRows = pageRows.slice(start, start + visibleCount);

  useEffect(() => {
    setPage(1);
  }, [tier, language, category, license, activeOnly, query, sortKey]);

  useEffect(() => {
    setScrollTop(0);
    scroller.current?.scrollTo({ top: 0 });
  }, [page, tier, language, category, license, activeOnly, query, sortKey]);

  function exportFiltered(kind: "csv" | "json") {
    if (!catalog) return;
    const rows = filtered.map((repo) => exportRow(repo, history, asOf, withinDays));
    const stamp = catalog.date;
    if (kind === "json") {
      download(`high-star-library-${stamp}.json`, JSON.stringify(rows, null, 2), "application/json");
      return;
    }
    download(`high-star-library-${stamp}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  }

  return (
    <div className="min-h-screen">
    <SiteHeader current="library" />
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
      <header className="surface relative overflow-hidden px-6 py-8 md:px-8 md:py-10">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-primary">PANDAWM · HIGH-STAR LIBRARY</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-5xl">高星项目库</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
              已经站稳的开源项目，按 5,000 星以上的档位看协议、活跃度和能不能拿去跟客户谈。周日全量补新仓库，其余日子更新已知星标。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" disabled={filtered.length === 0} onClick={() => exportFiltered("csv")}>
              导出 CSV
            </Button>
            <Button variant="default" disabled={filtered.length === 0} onClick={() => exportFiltered("json")}>
              导出 JSON
            </Button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="surface h-24 animate-pulse bg-muted" />
          ))}
        </div>
      ) : null}
      {error ? (
        <div className="surface border-destructive/30 px-4 py-5 text-sm">
          <p className="font-medium">项目库暂时读不到数据</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
      ) : null}

      {catalog && !error ? (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {LIBRARY_TIERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={tier === item.id}
                onClick={() => setTier((current) => (current === item.id ? "all" : item.id))}
                className={`surface px-4 py-3 text-left transition ${tier === item.id ? "border-transparent bg-primary text-primary-foreground shadow-none" : "hover:border-primary/40"}`}
              >
                <dt className={`text-xs ${tier === item.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{item.label} · {item.range}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{formatNumber(counts[item.id])}</dd>
              </button>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            共 {formatNumber(catalog.repos.length)} 个不少于 5,000 星的项目
            {catalog.coverage.reported != null ? `，GitHub 搜索报告约 ${formatNumber(catalog.coverage.reported)} 个` : ""}
            。快照 {formatDate(catalog.date)} {formatDateTime(catalog.generatedAt)} · {catalog.mode === "full" ? "全量搜索" : "增量更新星标"}
            {catalog.coverage.incomplete ? " · 这次搜索碰到了结果上限，已保留已有记录" : ""}
            。7 日和 30 日增量要等历史点攒够才显示。
          </p>

          <div className="surface sticky top-16 z-30 space-y-3 bg-background/90 p-3 backdrop-blur-xl">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.8fr))]">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目、作者、简介、话题" aria-label="搜索项目" />
              <Select value={language} onValueChange={(value) => { if (typeof value === "string") setLanguage(value); }}>
                <SelectTrigger aria-label="按语言筛选"><SelectValue placeholder="全部语言" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部语言</SelectItem>
                  {languages.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={(value) => { if (typeof value === "string") setCategory(value); }}>
                <SelectTrigger aria-label="按方向筛选"><SelectValue placeholder="全部方向" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部方向</SelectItem>
                  {LIBRARY_CATEGORIES.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={license} onValueChange={(value) => { if (typeof value === "string") setLicense(value as "all" | LicenseKind); }}>
                <SelectTrigger aria-label="按协议筛选"><SelectValue placeholder="全部协议" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部协议</SelectItem>
                  {(["permissive", "weak-copyleft", "copyleft", "restricted", "unknown"] as const).map((item) => (
                    <SelectItem key={item} value={item}>{licenseLabel(item)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortKey} onValueChange={(value) => { if (typeof value === "string") setSortKey(value as LibrarySortKey); }}>
                <SelectTrigger aria-label="排序"><SelectValue placeholder="按星标" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stars">星标从高到低</SelectItem>
                  <SelectItem value="forks">Fork 从高到低</SelectItem>
                  <SelectItem value="growth7">近 7 日增量</SelectItem>
                  <SelectItem value="growth30">近 30 日增量</SelectItem>
                  <SelectItem value="pushed">最近推送</SelectItem>
                  <SelectItem value="created">最近创建</SelectItem>
                  <SelectItem value="name">名称</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} />
              只看近 90 天有推送
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>筛选后 {formatNumber(filtered.length)} 个 · 第 {currentPage}/{pageCount} 页</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</Button>
              <Button variant="outline" size="sm" disabled={currentPage >= pageCount} onClick={() => setPage((value) => value + 1)}>下一页</Button>
            </div>
          </div>

          {pageRows.length === 0 ? <p className="surface border-dashed px-4 py-10 text-center text-sm text-muted-foreground">没有符合筛选的项目。</p> : null}
          {pageRows.length > 0 ? (
            <div
              ref={scroller}
              className="surface max-h-[70vh] overflow-auto"
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            >
              <div style={{ height: pageRows.length * ROW_HEIGHT, position: "relative" }}>
                {visibleRows.map((repo, index) => {
                  const rowIndex = start + index;
                  const [owner, name] = repo.fullName.split("/");
                  const growth7 = starGrowth(history.series[repo.fullName], asOf, 7, repo.stars);
                  const growth30 = starGrowth(history.series[repo.fullName], asOf, 30, repo.stars);
                  return (
                      <article
                      key={repo.fullName}
                      className="absolute inset-x-0 grid gap-2 overflow-hidden border-b border-border/80 px-4 py-3 md:grid-cols-[minmax(0,1fr)_9.5rem]"
                      style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <a href={`https://github.com/${repo.fullName}`} target="_blank" rel="noreferrer" className="truncate font-semibold tracking-tight hover:text-primary">
                            {name} <span className="font-normal text-muted-foreground">/ {owner}</span>
                          </a>
                          <span className="text-[11px] text-muted-foreground">{repo.ownerType === "org" ? "组织" : "个人"}</span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{repo.description || "没有简介"}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <LanguageDot language={repo.language} />
                          {signalLabels(repo, asOf, withinDays).map((label) => <Badge key={label} variant="secondary">{label}</Badge>)}
                          {matchLibraryCategories(repo).map((item) => <Badge key={item.id} variant="outline">{item.label}</Badge>)}
                          {repo.homepage ? <a className="text-xs text-primary underline-offset-2 hover:underline" href={repo.homepage} target="_blank" rel="noreferrer">主页</a> : null}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{repo.note}</p>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-3 text-xs md:grid-cols-1 md:text-right">
                        <div><dt className="text-muted-foreground">星标</dt><dd className="font-medium tabular-nums">{formatNumber(repo.stars)}</dd></div>
                        <div><dt className="text-muted-foreground">Fork</dt><dd className="tabular-nums">{formatNumber(repo.forks)}</dd></div>
                        <div>
                          <dt className="text-muted-foreground">近 7 日</dt>
                          <dd className={`tabular-nums ${growth7 != null && growth7 > 0 ? "font-medium text-emerald-700 dark:text-emerald-300" : ""}`}>{formatDelta(growth7)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">近 30 日</dt>
                          <dd className={`tabular-nums ${growth30 != null && growth30 > 0 ? "font-medium text-emerald-700 dark:text-emerald-300" : ""}`}>{formatDelta(growth30)}</dd>
                        </div>
                        <div className="col-span-2 truncate text-muted-foreground md:col-span-1">
                          {repo.license || licenseLabel(licenseKind(repo.license))} · 创建 {formatDate(repo.createdAt)} · 推送 {formatDate(repo.pushedAt)}
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
    <SiteFooter />
    </div>
  );
}
