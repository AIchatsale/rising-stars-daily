import fs from "node:fs";
import path from "node:path";
import { llmSettingsFromEnv, type EnvMap } from "../src/lib/classify";
import { utcDateString } from "../src/lib/dates";
import { parseConfig } from "../src/lib/config";
import {
  annotateRepo,
  applyCommercialNotes,
  decideLibraryMode,
  emptyHistory,
  librarySearchQuery,
  parseCommercialNotes,
  pruneHistory,
  recordStars,
  selectLlmCandidates,
  splitWindow,
  starGrowth,
  starSlices,
  tierCounts,
  type DateWindow,
  type LibraryCatalog,
  type LibraryHistory,
  type LibraryRepo,
  type StarSlice,
} from "../src/lib/library";
import type { AppConfig } from "../src/lib/types";
import { loadDotEnv } from "./env";
import { GithubClient } from "./github";
import { readJson, repoRoot, writeJson } from "./paths";

const CATALOG_PATH = path.join(repoRoot, "data/library/catalog.json");
const HISTORY_PATH = path.join(repoRoot, "data/library/history.json");
const SEARCH_PAGE_SIZE = 100;
const SEARCH_RESULT_CAP = 1000;

type CrawlStats = {
  requests: number;
  cappedSlices: number;
  incomplete: boolean;
  repos: Map<string, LibraryRepo>;
};

async function crawlSlice(
  client: GithubClient,
  slice: StarSlice,
  today: string,
  stats: CrawlStats,
  maxRequests: number,
  window?: DateWindow,
  depth = 0,
): Promise<void> {
  if (stats.requests >= maxRequests) {
    stats.incomplete = true;
    return;
  }
  const query = librarySearchQuery(slice, window);
  const first = await client.searchLibraryPage(query, 1, SEARCH_PAGE_SIZE);
  stats.requests += 1;
  if (first.incomplete && depth < 2) {
    const retry = await client.searchLibraryPage(query, 1, SEARCH_PAGE_SIZE);
    stats.requests += 1;
    first.repos = retry.repos;
    first.total = retry.total;
    first.incomplete = retry.incomplete;
  }
  if (first.total > SEARCH_RESULT_CAP && depth < 12) {
    const range = window ?? { from: "2008-01-01", to: today };
    const parts = splitWindow(range);
    if (parts) {
      console.log(`Split ${query} (${first.total} results) at ${parts[0].to}`);
      for (const part of parts) await crawlSlice(client, slice, today, stats, maxRequests, part, depth + 1);
      return;
    }
  }
  if (first.total > SEARCH_RESULT_CAP) {
    stats.cappedSlices += 1;
    stats.incomplete = true;
    console.warn(`Capped ${query} at ${SEARCH_RESULT_CAP} of ${first.total}`);
  }
  for (const repo of first.repos) stats.repos.set(repo.fullName, repo);
  const pages = Math.min(10, Math.ceil(Math.min(first.total, SEARCH_RESULT_CAP) / SEARCH_PAGE_SIZE));
  for (let page = 2; page <= pages; page += 1) {
    if (stats.requests >= maxRequests) {
      stats.incomplete = true;
      return;
    }
    const next = await client.searchLibraryPage(query, page, SEARCH_PAGE_SIZE);
    stats.requests += 1;
    for (const repo of next.repos) stats.repos.set(repo.fullName, repo);
    if (next.repos.length < SEARCH_PAGE_SIZE) break;
  }
}

async function crawlSlices(client: GithubClient, slices: StarSlice[], today: string, maxRequests: number): Promise<CrawlStats> {
  const stats: CrawlStats = { requests: 0, cappedSlices: 0, incomplete: false, repos: new Map() };
  for (const slice of slices) {
    if (stats.requests >= maxRequests) {
      stats.incomplete = true;
      break;
    }
    await crawlSlice(client, slice, today, stats, maxRequests);
  }
  return stats;
}

function readCatalog(): LibraryCatalog | null {
  if (!fs.existsSync(CATALOG_PATH)) return null;
  try {
    const catalog = readJson<LibraryCatalog>(CATALOG_PATH);
    if (!Array.isArray(catalog.repos)) return null;
    return catalog;
  } catch (error) {
    console.warn(`Ignoring unreadable library catalog: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

function readHistory(): LibraryHistory {
  if (!fs.existsSync(HISTORY_PATH)) return emptyHistory();
  try {
    const history = readJson<LibraryHistory>(HISTORY_PATH);
    return history.series ? history : emptyHistory();
  } catch {
    return emptyHistory();
  }
}

function remember(history: LibraryHistory, repos: LibraryRepo[], date: string): void {
  for (const repo of repos) recordStars(history, repo.fullName, date, repo.stars);
}

async function attachLlmNotes(repos: LibraryRepo[], config: AppConfig, env: EnvMap): Promise<LibraryRepo[]> {
  const settings = llmSettingsFromEnv(env, config.llm);
  const candidates = selectLlmCandidates(repos, settings ? config.library.llmNotesPerRun : 0);
  if (!settings || candidates.length === 0) return repos;
  try {
    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: [
              "你帮业务团队判断高星开源项目值不值得介绍给客户。",
              '只输出 JSON：{"items":[{"fullName":"","note":""}]}',
              "note 用一句简体中文说明可能的商业用法和主要限制，不要夸张，不要承诺收益。",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              repos: candidates.map((repo) => ({
                fullName: repo.fullName,
                description: (repo.description ?? "").slice(0, 180),
                language: repo.language ?? null,
                topics: repo.topics ?? [],
                stars: repo.stars,
                license: repo.license ?? null,
                homepage: Boolean(repo.homepage),
                ownerType: repo.ownerType,
                pushedAt: repo.pushedAt,
              })),
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 180)}`);
    }
    const payload = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = payload.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : "";
    const notes = parseCommercialNotes(text);
    console.log(`LLM notes attached for ${notes.length} high-star repositories`);
    return applyCommercialNotes(repos, notes);
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]") : String(error);
    console.error(`LLM library notes skipped: ${message}`);
    return repos;
  }
}

function finish(repos: LibraryRepo[], previous: Map<string, LibraryRepo>, history: LibraryHistory, date: string, withinDays: number): LibraryRepo[] {
  return repos
    .filter((repo) => repo.stars > 0)
    .map((repo) => annotateRepo(repo, date, withinDays, previous.get(repo.fullName), starGrowth(history.series[repo.fullName], date, 30, repo.stars)))
    .sort((left, right) => right.stars - left.stars || left.fullName.localeCompare(right.fullName));
}

export async function refreshLibrary(options: { date: string; config: AppConfig; token?: string; env: EnvMap }): Promise<void> {
  const { date, config, token, env } = options;
  const previousCatalog = readCatalog();
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const mode = decideLibraryMode({
    hasCatalog: Boolean(previousCatalog && previousCatalog.repos.length > 0),
    forced: env.LIBRARY_FULL === "true",
    weekday,
    fullRefreshWeekday: config.library.fullRefreshWeekday,
  });
  const client = new GithubClient(token);
  const history = readHistory();
  const previous = new Map((previousCatalog?.repos ?? []).map((repo) => [repo.fullName, repo]));
  const minStars = config.library.minStars;
  let cursor = previousCatalog?.cursor ?? 0;
  let reported: number | null = previousCatalog?.coverage.reported ?? null;
  const observed = new Map<string, LibraryRepo>();

  console.log(`High-star library ${date}: ${mode}. Token: ${token ? "yes" : "no"}.`);

  if (mode === "full") {
    try {
      const headline = await client.searchLibraryPage(`stars:>=${minStars} fork:false archived:false`, 1, 1);
      reported = headline.total;
    } catch (error) {
      console.warn(`Library total unavailable: ${error instanceof Error ? error.message : error}`);
    }
    const stats = await crawlSlices(client, starSlices(minStars), date, config.library.maxSearchRequests);
    for (const repo of stats.repos.values()) {
      if (repo.stars >= minStars) observed.set(repo.fullName, repo);
    }
    const merged = new Map<string, LibraryRepo>();
    if (stats.incomplete) {
      for (const [fullName, repo] of previous) merged.set(fullName, repo);
    }
    for (const [fullName, repo] of observed) merged.set(fullName, repo);
    const repos = [...merged.values()].filter((repo) => repo.stars >= minStars);
    remember(history, [...observed.values()], date);
    const annotated = await attachLlmNotes(finish(repos, previous, history, date, config.library.activeWithinDays), config, env);
    writeCatalog({ date, mode, cursor, coverage: statsAsCoverage(stats, reported, annotated.length), repos: annotated }, history);
    return;
  }

  const highSlices = starSlices(Math.max(minStars, 20000)).filter((slice) => slice.min >= 20000);
  const stats = await crawlSlices(client, highSlices, date, Math.min(config.library.maxSearchRequests, 80));
  for (const repo of stats.repos.values()) {
    if (repo.stars >= minStars) observed.set(repo.fullName, repo);
  }
  const lower = [...previous.values()].filter((repo) => repo.stars < 20000).sort((left, right) => left.fullName.localeCompare(right.fullName));
  const cap = token ? config.library.dailyHydrateCap : Math.min(config.library.dailyHydrateCap, 15);
  const picked: string[] = [];
  if (lower.length > 0 && cap > 0) {
    const start = ((cursor % lower.length) + lower.length) % lower.length;
    for (let index = 0; index < Math.min(cap, lower.length); index += 1) picked.push(lower[(start + index) % lower.length]!.fullName);
    cursor = (start + picked.length) % lower.length;
  }
  console.log(`Refreshing stars for ${picked.length} known repositories below 20K`);
  try {
    for (const repo of await client.hydrateLibrary(picked)) {
      if (repo.stars >= minStars) observed.set(repo.fullName, repo);
    }
  } catch (error) {
    console.warn(`Library star refresh skipped: ${error instanceof Error ? error.message : error}`);
  }

  const merged = new Map(previous);
  for (const [fullName, repo] of observed) merged.set(fullName, repo);
  for (const fullName of picked) {
    const fresh = observed.get(fullName);
    if (fresh && fresh.stars < minStars) merged.delete(fullName);
  }
  const repos = [...merged.values()].filter((repo) => repo.stars >= minStars);
  remember(history, [...observed.values()], date);
  const annotated = await attachLlmNotes(finish(repos, previous, history, date, config.library.activeWithinDays), config, env);
  writeCatalog(
    {
      date,
      mode,
      cursor,
      coverage: { requests: stats.requests, reported, kept: annotated.length, cappedSlices: stats.cappedSlices, incomplete: stats.incomplete },
      repos: annotated,
    },
    history,
  );
}

function statsAsCoverage(stats: CrawlStats, reported: number | null, kept: number): LibraryCatalog["coverage"] {
  return { requests: stats.requests, reported, kept, cappedSlices: stats.cappedSlices, incomplete: stats.incomplete };
}

function writeCatalog(input: { date: string; mode: "full" | "incremental"; cursor: number; coverage: LibraryCatalog["coverage"]; repos: LibraryRepo[] }, history: LibraryHistory): void {
  const counts = tierCounts(input.repos);
  const catalog: LibraryCatalog = {
    generatedAt: new Date().toISOString(),
    date: input.date,
    mode: input.mode,
    cursor: input.cursor,
    coverage: input.coverage,
    repos: input.repos,
  };
  const kept = new Set(input.repos.map((repo) => repo.fullName));
  writeJson(CATALOG_PATH, catalog, null);
  writeJson(HISTORY_PATH, pruneHistory(history, kept), null);
  console.log(
    `Library ${input.mode}: ${input.repos.length} repos (reported ${input.coverage.reported ?? "?"}, 5K+ ${counts["5k"]}, 10K+ ${counts["10k"]}, 20K+ ${counts["20k"]}, 40K+ ${counts["40k"]}). Requests ${input.coverage.requests}. Incomplete ${input.coverage.incomplete}.`,
  );
}

async function main(): Promise<void> {
  loadDotEnv();
  const config = parseConfig(readJson(path.join(repoRoot, "config.json")));
  const date = (process.env.SNAPSHOT_DATE ?? utcDateString(new Date())).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("SNAPSHOT_DATE must be YYYY-MM-DD");
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || undefined;
  await refreshLibrary({ date, config, token, env: process.env });
}

const entry = process.argv[1] ?? "";
if (entry.endsWith(`${path.sep}collect-library.ts`) || entry.endsWith(`${path.sep}collect-library.js`)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
