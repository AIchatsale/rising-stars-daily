import { addDays } from "./dates";
import type { AppConfig } from "./types";

function quote(value: string): string {
  const cleaned = value.replace(/"/g, "").trim();
  return /[\s:]/.test(cleaned) ? `"${cleaned}"` : cleaned;
}

function topicToken(value: string): string | null {
  const token = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]*$/.test(token) ? token : null;
}

export function buildSearchQueries(config: AppConfig, snapshotDate: string): string[] {
  const since = addDays(snapshotDate, -3);
  const createdFloor = Math.max(10, Math.floor(config.minStars / 2));
  const queries: string[] = [];
  const common = "fork:false archived:false";

  if (config.discover.recentlyCreated) {
    queries.push(`created:>${since} stars:>=${createdFloor} ${common}`);
  }
  if (config.discover.recentlyPushed) {
    queries.push(`pushed:>${since} stars:>=${Math.max(config.minStars, 200)} ${common}`);
  }
  for (const topic of config.topics) {
    const token = topic.githubTopics.map(topicToken).find((item): item is string => item != null);
    if (!token) continue;
    const floor = topic.minStars ?? config.minStars;
    queries.push(`topic:${token} pushed:>${since} stars:>=${floor} ${common}`);
  }
  for (const keyword of config.keywords.slice(0, Math.max(0, config.keywordQueryLimit))) {
    queries.push(`${quote(keyword)} in:name,description pushed:>${since} stars:>=${config.minStars} ${common}`);
  }
  for (const language of config.languages.slice(0, Math.max(0, config.languageQueryLimit))) {
    queries.push(`language:${quote(language)} pushed:>${since} stars:>=${Math.max(config.minStars, 150)} ${common}`);
  }
  return queries.slice(0, config.maxSearchQueries);
}
