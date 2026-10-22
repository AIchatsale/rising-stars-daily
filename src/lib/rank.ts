import { heuristicClassification } from "./classify";
import { addDays, hoursBetween } from "./dates";
import { isExcluded, matchTopics } from "./topics";
import type { AppConfig, Classification, RankedRepo, RepoSnapshot, Snapshot } from "./types";

type Draft = Omit<RankedRepo, "rank" | "rankChange" | "classification">;

function compareDrafts(a: Draft, b: Draft): number {
  if (a.deltaKnown !== b.deltaKnown) return a.deltaKnown ? -1 : 1;
  const deltaA = a.delta ?? Number.NEGATIVE_INFINITY;
  const deltaB = b.delta ?? Number.NEGATIVE_INFINITY;
  if (deltaB !== deltaA) return deltaB - deltaA;
  const growthA = a.growthPercent ?? Number.NEGATIVE_INFINITY;
  const growthB = b.growthPercent ?? Number.NEGATIVE_INFINITY;
  if (growthB !== growthA) return growthB - growthA;
  if (b.stars !== a.stars) return b.stars - a.stars;
  return a.fullName.localeCompare(b.fullName);
}

function usable(repo: RepoSnapshot, config: AppConfig): boolean {
  if (repo.archived || repo.isFork) return false;
  if (!repo.fullName.includes("/")) return false;
  return !isExcluded(repo.fullName, config.excludeNamePatterns);
}

function withTopics(repo: RepoSnapshot, config: AppConfig): Omit<
  Draft,
  "delta" | "baselineStars" | "growthPercent" | "isNew" | "deltaKnown" | "deltaSource"
> {
  return { ...repo, trackedTopics: matchTopics(repo, config) };
}

export type RankResult = {
  isFirstRun: boolean;
  previousDate: string | null;
  approximate24h: boolean;
  phrase: string;
  risingCount: number;
  items: RankedRepo[];
};

export function rankRisingStars(args: {
  today: Snapshot;
  previous: Snapshot | null;
  previousRanks: Map<string, number> | null;
  config: AppConfig;
  classifications?: Map<string, Classification>;
}): RankResult {
  const { today, config, classifications } = args;
  const previous =
    args.previous &&
    args.previous.source === today.source &&
    args.previous.date < today.date &&
    args.previous.repos.length > 0
      ? args.previous
      : null;
  const isFirstRun = previous == null;
  const previousByName = new Map(previous?.repos.map((repo) => [repo.fullName, repo]) ?? []);
  const trending = today.hints?.trendingDailyStars ?? {};
  const known: Draft[] = [];
  const unknown: Draft[] = [];

  for (const repo of today.repos) {
    if (!usable(repo, config)) continue;
    const ageHours = hoursBetween(today.generatedAt, repo.createdAt);
    const recent = ageHours >= 0 && ageHours <= config.newRepoWindowHours;
    const shared = withTopics(repo, config);

    if (!previous) {
      if (recent) {
        known.push({
          ...shared,
          delta: repo.stars,
          baselineStars: 0,
          growthPercent: null,
          isNew: true,
          deltaKnown: true,
          deltaSource: "created-window",
        });
        continue;
      }
      const trendingDelta = trending[repo.fullName];
      if (typeof trendingDelta === "number" && trendingDelta > 0) {
        const baseline = repo.stars - trendingDelta;
        known.push({
          ...shared,
          delta: trendingDelta,
          baselineStars: baseline > 0 ? baseline : 0,
          growthPercent: baseline > 0 ? (trendingDelta / baseline) * 100 : null,
          isNew: false,
          deltaKnown: true,
          deltaSource: "trending",
        });
        continue;
      }
      unknown.push({
        ...shared,
        delta: null,
        baselineStars: null,
        growthPercent: null,
        isNew: false,
        deltaKnown: false,
        deltaSource: "unknown",
      });
      continue;
    }

    const prev = previousByName.get(repo.fullName);
    if (!prev) {
      if (recent) {
        known.push({
          ...shared,
          delta: repo.stars,
          baselineStars: 0,
          growthPercent: null,
          isNew: true,
          deltaKnown: true,
          deltaSource: "created-window",
        });
      }
      continue;
    }
    const delta = repo.stars - prev.stars;
    if (delta <= 0) continue;
    known.push({
      ...shared,
      delta,
      baselineStars: prev.stars,
      growthPercent: prev.stars > 0 ? (delta / prev.stars) * 100 : null,
      isNew: false,
      deltaKnown: true,
      deltaSource: "snapshot",
    });
  }

  known.sort(compareDrafts);
  unknown.sort(compareDrafts);
  let chosen = known.slice(0, config.topN);
  if (isFirstRun && chosen.length < config.topN) {
    chosen = chosen.concat(unknown.slice(0, config.topN - chosen.length));
  }

  const items = chosen.map((draft, index) => {
    const rank = index + 1;
    const previousRank = args.previousRanks?.get(draft.fullName);
    const classification =
      classifications?.get(draft.fullName) ?? heuristicClassification(draft, config.llm.categories);
    return {
      ...draft,
      rank,
      rankChange: previousRank == null ? null : previousRank - rank,
      classification,
    };
  });

  const previousDate = previous?.date ?? null;
  const approximate24h = previousDate != null && addDays(previousDate, 1) === today.date;
  const phrase = isFirstRun
    ? "首次采集，暂无更早的同来源快照"
    : approximate24h
      ? "过去 24 小时"
      : `自 ${previousDate} 以来`;

  return {
    isFirstRun,
    previousDate,
    approximate24h,
    phrase,
    risingCount: known.length,
    items,
  };
}
