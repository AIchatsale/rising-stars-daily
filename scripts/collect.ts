import fs from "node:fs";
import path from "node:path";
import { utcDateString } from "../src/lib/dates";
import { parseConfig } from "../src/lib/config";
import { buildSearchQueries } from "../src/lib/queries";
import type { RepoSnapshot, Snapshot } from "../src/lib/types";
import { loadDotEnv } from "./env";
import { GithubClient } from "./github";
import { readJson, repoRoot, writeJson } from "./paths";
import { rebuild } from "./rebuild";
import { fetchTrending } from "./trending";

function latestLiveBefore(date: string): Snapshot | null {
  const folder = path.join(repoRoot, "data/snapshots/live");
  if (!fs.existsSync(folder)) return null;
  const files = fs
    .readdirSync(folder)
    .filter((file) => file.endsWith(".json") && file.slice(0, 10) < date)
    .sort();
  const last = files.at(-1);
  return last ? readJson<Snapshot>(path.join(folder, last)) : null;
}

async function main(): Promise<void> {
  loadDotEnv();
  const config = parseConfig(readJson(path.join(repoRoot, "config.json")));
  const date = (process.env.SNAPSHOT_DATE ?? utcDateString(new Date())).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("SNAPSHOT_DATE must be YYYY-MM-DD");
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || undefined;
  console.log(
    `Collecting ${date}. Token: ${token ? "yes" : "no"}. LLM: ${process.env.LLM_API_KEY || process.env.OPENAI_API_KEY ? "yes" : "no"}. SMTP: ${process.env.SMTP_HOST ? "yes" : "no"}.`,
  );

  const client = new GithubClient(token);
  const queries = buildSearchQueries(config, date);
  const byName = new Map<string, RepoSnapshot>();
  for (const query of queries) {
    for (const repo of await client.search(query, Math.min(config.searchPerPage, 100), config.searchPages)) {
      byName.set(repo.fullName, repo);
    }
  }
  const searchRepos = byName.size;
  console.log(`Search discovered ${searchRepos} unique repositories across ${queries.length} queries`);

  const trendingHits = config.discover.githubTrending
    ? await fetchTrending().catch((error: unknown) => {
        console.warn(`Trending fetch skipped: ${error instanceof Error ? error.message : error}`);
        return [];
      })
    : [];
  console.log(`Trending candidates: ${trendingHits.length}`);

  const previous = latestLiveBefore(date);
  const cap = token ? config.hydrationCapWithToken : config.hydrationCapWithoutToken;
  const missing: string[] = [];
  const seen = new Set<string>();
  const remember = (fullName: string) => {
    if (byName.has(fullName) || seen.has(fullName) || missing.length >= cap) return;
    seen.add(fullName);
    missing.push(fullName);
  };
  for (const hit of trendingHits) remember(hit.fullName);
  for (const repo of [...(previous?.repos ?? [])].sort((a, b) => b.stars - a.stars)) remember(repo.fullName);

  console.log(`Hydrating ${missing.length} repositories not present in search results`);
  for (const repo of await client.hydrate(missing)) byName.set(repo.fullName, repo);

  const trendingNames = new Set(trendingHits.map((hit) => hit.fullName));
  const previousNames = new Set(previous?.repos.map((repo) => repo.fullName) ?? []);
  const recentCutoff = Date.now() - config.newRepoWindowHours * 3_600_000;
  const isRecent = (repo: RepoSnapshot) => {
    const created = new Date(repo.createdAt).getTime();
    return Number.isFinite(created) && created >= recentCutoff;
  };
  const all = [...byName.values()];
  const pinned = all.filter(
    (repo) => trendingNames.has(repo.fullName) || previousNames.has(repo.fullName) || isRecent(repo),
  );
  console.log(
    `Keeping ${pinned.length} pinned repositories (${all.filter(isRecent).length} created within ${config.newRepoWindowHours}h)`,
  );
  const room = Math.max(0, config.maxCandidates - pinned.length);
  const others = all
    .filter((repo) => !trendingNames.has(repo.fullName) && !previousNames.has(repo.fullName))
    .sort((a, b) => b.stars - a.stars || a.fullName.localeCompare(b.fullName))
    .slice(0, room);
  const repos = [...pinned, ...others].sort((a, b) => a.fullName.localeCompare(b.fullName));
  if (repos.length === 0) {
    throw new Error("No repositories collected. Check network access and the GitHub rate limit.");
  }

  const trendingDailyStars: Record<string, number> = {};
  for (const hit of trendingHits) {
    if (hit.starsToday != null && repos.some((repo) => repo.fullName === hit.fullName)) {
      trendingDailyStars[hit.fullName] = hit.starsToday;
    }
  }
  const snapshot: Snapshot = {
    date,
    generatedAt: new Date().toISOString(),
    source: "live",
    repos,
    hints: Object.keys(trendingDailyStars).length > 0 ? { trendingDailyStars } : undefined,
    collection: {
      queries: queries.length,
      searchRepos,
      trendingRepos: trendingHits.length,
      hydrated: missing.length,
    },
  };
  writeJson(path.join(repoRoot, "data/snapshots/live", `${date}.json`), snapshot);
  console.log(`Wrote live snapshot ${date} with ${repos.length} repositories`);
  await rebuild({ llmDate: date, sendEmail: true });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
