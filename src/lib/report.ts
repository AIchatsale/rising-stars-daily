import { rankRisingStars } from "./rank";
import { recommendPicks } from "./recommend";
import type { AppConfig, Classification, DayReport, Snapshot } from "./types";

export function buildDayReport(args: {
  today: Snapshot;
  previous: Snapshot | null;
  previousRanks: Map<string, number> | null;
  config: AppConfig;
  classifications?: Map<string, Classification>;
  llm?: DayReport["llm"];
}): DayReport {
  const ranked = rankRisingStars(args);
  const recommended = recommendPicks(ranked.items, args.config);
  const topicLeaders = args.config.topics.flatMap((topic) => {
    const leader = ranked.items.find((item) => item.trackedTopics.includes(topic.id) && item.deltaKnown);
    if (!leader) return [];
    return [{ topicId: topic.id, label: topic.label, fullName: leader.fullName }];
  });
  const growths = ranked.items
    .map((item) => item.growthPercent)
    .filter((value): value is number => value != null && Number.isFinite(value))
    .sort((a, b) => a - b);
  const medianGrowth = growths.length === 0 ? null : growths[Math.floor((growths.length - 1) / 2)] ?? null;
  const maxDelta = ranked.items.reduce<number | null>((max, item) => {
    if (item.delta == null) return max;
    return max == null ? item.delta : Math.max(max, item.delta);
  }, null);

  return {
    date: args.today.date,
    generatedAt: args.today.generatedAt,
    source: args.today.source,
    mode: ranked.isFirstRun ? "first-run" : "delta",
    previousDate: ranked.previousDate,
    isFirstRun: ranked.isFirstRun,
    approximate24h: ranked.approximate24h,
    phrase: ranked.phrase,
    llm: args.llm ?? "heuristic",
    email: "skipped",
    items: ranked.items,
    recommended,
    topicLeaders,
    stats: {
      candidates: args.today.repos.length,
      rising: ranked.risingCount,
      listed: ranked.items.length,
      maxDelta,
      medianGrowth,
    },
  };
}
