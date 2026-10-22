import { hoursBetween } from "./dates";
import { isExcluded } from "./topics";
import type { AppConfig, RankedRepo, RecommendedPick } from "./types";

const PERMISSIVE = /^(MIT|Apache-2.0|BSD-3-Clause|BSD-2-Clause|MPL-2.0|ISC)$/;

function scoreItem(item: RankedRepo, config: AppConfig): number {
  let score = 0;
  if (item.demo) score -= 40;
  if (isExcluded(item.fullName, config.excludeNamePatterns)) score -= 30;
  if (item.classification.category === "文档") score -= 8;
  if (item.classification.category === "示例") score -= 5;
  if (!item.description) score -= 5;
  if (item.deltaKnown && item.delta != null) score += Math.min(item.delta, 5000) / 25;
  if ((item.growthPercent ?? 0) >= 20 && (item.delta ?? 0) >= 40) score += 8;
  score += Math.min(item.trackedTopics.length, 2) * 4;
  if (item.license && PERMISSIVE.test(item.license)) score += 3;
  const ageDays = hoursBetween(item.pushedAt, item.createdAt) / 24;
  if (ageDays >= 0 && ageDays <= 180 && item.stars >= 80) score += 6;
  if (["应用", "工具", "框架", "集成"].includes(item.classification.category)) score += 3;
  if (!item.deltaKnown) score -= 4;
  return score;
}

function signalsFor(item: RankedRepo): string[] {
  const signals: string[] = [];
  if (item.isNew) signals.push("新仓库");
  if ((item.growthPercent ?? 0) >= 20 && (item.delta ?? 0) >= 40) signals.push("增速陡");
  if (item.trackedTopics.length > 0) signals.push(item.trackedTopics.slice(0, 2).join(" / "));
  if (item.license && item.license !== "NOASSERTION") signals.push(item.license);
  if (item.deltaSource === "trending") signals.push("Trending 对照");
  if (!item.deltaKnown) signals.push("增量待明日确认");
  return signals.slice(0, 4);
}

export function recommendPicks(items: RankedRepo[], config: AppConfig): RecommendedPick[] {
  return [...items]
    .sort((a, b) => scoreItem(b, config) - scoreItem(a, config) || a.rank - b.rank)
    .slice(0, config.recommendCount)
    .map((item) => ({
      fullName: item.fullName,
      reason: item.classification.opportunity,
      signals: signalsFor(item),
      category: item.classification.category,
    }));
}
