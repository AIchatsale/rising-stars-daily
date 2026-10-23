"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { LibraryGate } from "@/components/library-gate";
import { Picks } from "@/components/picks";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RankingTable, type SortKey } from "@/components/ranking-table";
import { RisingCard } from "@/components/rising-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deltaCaption, formatDate, formatDateTime, formatDelta, formatNumber, formatPercent, formatShortDate } from "@/lib/format";
import { dataUrl } from "@/lib/site";
import type { DayReport, HistoryFile, IndexFile, RankedRepo } from "@/lib/types";

const TrendChart = dynamic(() => import("@/components/trend-chart").then((mod) => mod.TrendChart), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted" />,
});

function compareNullable(left: number | string | null, right: number | string | null, direction: "asc" | "desc"): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  const factor = direction === "asc" ? 1 : -1;
  if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
  return String(left).localeCompare(String(right), "zh-CN") * factor;
}

function valueFor(repo: RankedRepo, key: SortKey): number | string | null {
  if (key === "language") return repo.language;
  if (key === "createdAt") return repo.createdAt;
  return repo[key];
}

export function Dashboard() {
  const [index, setIndex] = useState<IndexFile | null>(null);
  const [history, setHistory] = useState<HistoryFile | null>(null);
  const [report, setReport] = useState<DayReport | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("all");
  const [topic, setTopic] = useState("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [chartSelection, setChartSelection] = useState<string[]>([]);
  const [copyState, setCopyState] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadIndex() {
      try {
        const [indexResponse, historyResponse] = await Promise.all([
          fetch(dataUrl("index.json"), { cache: "no-store" }),
          fetch(dataUrl("history.json"), { cache: "no-store" }),
        ]);
        if (!indexResponse.ok) throw new Error(`索引读取失败（${indexResponse.status}）`);
        if (!historyResponse.ok) throw new Error(`历史读取失败（${historyResponse.status}）`);
        const indexJson = (await indexResponse.json()) as IndexFile;
        const historyJson = (await historyResponse.json()) as HistoryFile;
        if (cancelled) return;
        setIndex(indexJson);
        setHistory(historyJson);
        setDate((current) => current ?? indexJson.latest);
        setError(indexJson.dates.length === 0 ? "还没有任何快照。请先运行 npm run sample 或 npm run collect。" : null);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "数据读取失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadIndex();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    async function loadReport() {
      try {
        const response = await fetch(dataUrl(`rankings/${date}.json`), { cache: "no-store" });
        if (!response.ok) throw new Error(`无法读取 ${date} 的榜单（${response.status}）`);
        const json = (await response.json()) as DayReport;
        if (!cancelled) {
          setReport(json);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "榜单读取失败");
      }
    }
    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const filtered = useMemo(() => {
    if (!report) return [];
    const needle = query.trim().toLowerCase();
    return report.items.filter((item) => {
      if (language !== "all" && item.language !== language) return false;
      if (topic !== "all" && !item.trackedTopics.includes(topic)) return false;
      if (!needle) return true;
      const haystack = `${item.fullName} ${item.description ?? ""} ${item.classification.summary}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [report, language, topic, query]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => compareNullable(valueFor(a, sortKey), valueFor(b, sortKey), sortDir) || a.rank - b.rank);
  }, [filtered, sortKey, sortDir]);

  const languages = useMemo(() => {
    const present = new Set<string>(index?.filters.languages ?? []);
    for (const item of report?.items ?? []) {
      if (item.language) present.add(item.language);
    }
    return [...present].sort((a, b) => a.localeCompare(b, "en"));
  }, [index, report]);

  const historyFor = useMemo(() => {
    if (!history || !report) return {};
    return history[report.source] ?? {};
  }, [history, report]);

  useEffect(() => {
    const defaults = filtered
      .filter((item) => (historyFor[item.fullName]?.length ?? 0) > 1)
      .slice(0, 4)
      .map((item) => item.fullName);
    setChartSelection(defaults.length > 0 ? defaults : filtered.slice(0, 4).map((item) => item.fullName));
  }, [date, language, topic, query, report, filtered, historyFor]);

  function shiftDate(step: number) {
    if (!index || !date) return;
    const next = index.dates[index.dates.indexOf(date) + step];
    if (next) setDate(next);
  }

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "fullName" || key === "language" || key === "createdAt" ? "asc" : "desc");
  }

  async function copyDigest() {
    if (!date) return;
    try {
      const response = await fetch(dataUrl(`digests/${date}.md`), { cache: "no-store" });
      if (!response.ok) throw new Error("简报不存在");
      await navigator.clipboard.writeText(await response.text());
      setCopyState("已复制 Markdown");
    } catch {
      setCopyState("复制失败，请改用下载");
    }
  }

  const entry = index?.entries.find((item) => item.date === date);
  const banner = !report
    ? ""
    : report.source === "sample"
      ? "示例数据。星标走势是为了预览界面编写的演示序列，不是这些项目的真实历史。"
      : report.isFirstRun
        ? "这是第一次实测采集。创建不足 48 小时的仓库按累计星标计入增量；出现在 GitHub Trending 上的仓库使用页面给出的今日星标。其余仓库从下一份快照开始计算增速。"
        : `对照上一份实测快照。增量 = 今日星标 − 上次星标。${report.approximate24h ? "间隔大约 24 小时。" : `间隔不是正好一天：${report.phrase}。`}`;

  return (
    <div className="min-h-screen">
    <SiteHeader />
    <main>
    <section id="rising" className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-8 px-4 py-8 md:px-8 md:py-10">
      <header className="surface relative overflow-hidden px-6 py-8 md:px-8 md:py-10">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
        <p className="text-[11px] font-semibold tracking-[0.2em] text-primary">PANDAWM · RISING STARS</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">Github之星</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
          把过去 24 小时涨得最快的 GitHub 项目，整理成熊猫出海业务同事能直接拿去谈的名单。星标、增速和话题都按同一套口径排好。
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" disabled={!date} onClick={() => void copyDigest()}>
            复制简报
          </Button>
          {date ? (
            <>
              <a className={buttonVariants({ variant: "outline" })} href={dataUrl(`digests/${date}.md`)} download>
                Markdown
              </a>
              <a className={buttonVariants({ variant: "outline" })} href={dataUrl(`digests/${date}.json`)} download>
                JSON
              </a>
              <a className={buttonVariants({ variant: "default" })} href={dataUrl(`digests/${date}.html`)} target="_blank" rel="noreferrer">
                HTML 日报
              </a>
            </>
          ) : null}
        </div>
      </header>

      {copyState ? <p className="text-sm text-muted-foreground">{copyState}</p> : null}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="surface h-40 animate-pulse bg-muted" />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="surface border-destructive/30 px-4 py-5 text-sm">
          <p className="font-medium">看板暂时读不到数据</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
      ) : null}

      {index && date && report && !error ? (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight">{formatDate(date)}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => shiftDate(-1)} disabled={index.dates[0] === date}>
                  前一天
                </Button>
                <Button variant="outline" size="sm" onClick={() => shiftDate(1)} disabled={index.dates.at(-1) === date}>
                  后一天
                </Button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {index.dates.map((item) => {
                const meta = index.entries.find((entryItem) => entryItem.date === item);
                const active = item === date;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDate(item)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-left text-xs shadow-sm ${active ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/30"}`}
                  >
                    <span className="block font-medium">{formatShortDate(item)}</span>
                    <span className={active ? "text-primary-foreground/80" : "text-muted-foreground"}>
                      {meta?.source === "sample" ? "示例" : "实测"} · {meta?.mode === "first-run" ? "首次" : "对照"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="surface bg-secondary/70 px-4 py-3 text-sm leading-6 shadow-none">{banner}</p>

          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["候选仓库", formatNumber(report.stats.candidates)],
              ["上榜", formatNumber(report.stats.listed)],
              ["最大增量", formatDelta(report.stats.maxDelta)],
              ["中位增速", formatPercent(report.stats.medianGrowth)],
            ].map(([label, value]) => (
              <div key={label} className="surface px-4 py-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            快照时间 {formatDateTime(report.generatedAt)} · {report.phrase} · 摘要
            {report.llm === "ok" ? "来自模型" : report.llm === "failed" ? "回退到规则（模型调用失败）" : report.llm === "skipped" ? "使用规则（未配置模型密钥）" : "使用规则"}
            · 邮件
            {entry?.email === "sent" ? "已发送" : entry?.email === "failed" ? "发送失败，HTML 仍已保存" : "未外发"}
          </p>

          <Picks report={report} />

          {report.topicLeaders.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight">各话题里今天最快</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {report.topicLeaders.map((leader) => {
                  const repo = report.items.find((item) => item.fullName === leader.fullName);
                  return (
                    <button
                      key={leader.topicId}
                      type="button"
                      onClick={() => setTopic(leader.topicId)}
                      className="surface px-3 py-3 text-left transition hover:border-primary/40"
                    >
                      <p className="text-xs text-muted-foreground">{leader.label}</p>
                      <p className="mt-1 truncate text-sm font-medium">{leader.fullName}</p>
                      <p className="mt-1 text-sm tabular-nums text-primary">{repo ? formatDelta(repo.delta) : "—"}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="surface sticky top-16 z-30 space-y-3 bg-background/90 p-3 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="flex min-w-40 flex-col gap-1 text-xs text-muted-foreground">
                语言
                <Select
                  value={language}
                  onValueChange={(value) => {
                    if (typeof value === "string") setLanguage(value);
                  }}
                >
                  <SelectTrigger className="w-full md:w-44" aria-label="按语言筛选">
                    <SelectValue placeholder="全部语言" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部语言</SelectItem>
                    {languages.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                搜索
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="仓库名或简介" aria-label="搜索仓库" />
              </label>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              <Button type="button" size="sm" variant={topic === "all" ? "default" : "outline"} onClick={() => setTopic("all")}>
                全部
              </Button>
              {(index.filters.topics ?? []).map((item) => (
                <Button key={item.id} type="button" size="sm" variant={topic === item.id ? "default" : "outline"} onClick={() => setTopic(item.id)}>
                  {item.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">增速榜</h2>
              <Badge variant="outline">{filtered.length} 个项目</Badge>
            </div>
            {filtered.length === 0 ? (
              <p className="surface border-dashed px-4 py-10 text-center text-sm text-muted-foreground">没有符合当前语言、话题或搜索的项目。</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered.slice(0, 6).map((repo) => (
                  <RisingCard
                    key={repo.fullName}
                    repo={repo}
                    approximate24h={report.approximate24h}
                    history={historyFor[repo.fullName] ?? []}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">星标趋势</h2>
              <p className="text-sm text-muted-foreground">线条来自每日快照，最多同时看 6 个仓库。示例和实测不会连成一条线。</p>
            </div>
            <TrendChart
              series={filtered.slice(0, 8).map((repo) => ({ fullName: repo.fullName, points: historyFor[repo.fullName] ?? [] }))}
              selected={chartSelection}
              onToggle={(fullName) => {
                setChartSelection((current) => {
                  if (current.includes(fullName)) return current.filter((item) => item !== fullName);
                  if (current.length >= 6) return [...current.slice(1), fullName];
                  return [...current, fullName];
                });
              }}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight">完整排名</h2>
            {sorted.length === 0 ? null : (
              <div className="surface overflow-hidden">
              <RankingTable
                items={sorted}
                sortKey={sortKey}
                sortDir={sortDir}
                approximate24h={report.approximate24h}
                onSort={onSort}
              />
              </div>
            )}
          </section>

          <div className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p>
              排名按星标增量，而不是百分比，避免个位数仓库因为翻倍占据榜首。百分比只在有昨日星标时计算。
              {report.items[0] ? ` 榜首增量的口径是「${deltaCaption(report.items[0].deltaSource, report.approximate24h)}」。` : ""}
            </p>
            <p>每日简报同时写成 Markdown、JSON 和 HTML。配置 SMTP 后工作流会把 HTML 寄出；没有密钥时只保存文件。</p>
          </div>
        </>
      ) : null}
    </section>
    <LibraryGate />
    </main>
    <SiteFooter />
    </div>
  );
}
