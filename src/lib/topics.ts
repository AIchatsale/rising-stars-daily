import type { AppConfig, RepoSnapshot } from "./types";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function includesKeyword(haystack: string, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return false;
  if (needle.length <= 3) {
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:$|[^a-z0-9])`, "i");
    return pattern.test(haystack);
  }
  return haystack.toLowerCase().includes(needle);
}

export function matchTopics(
  repo: Pick<RepoSnapshot, "fullName" | "description" | "topics" | "name">,
  config: AppConfig,
): string[] {
  const topicSet = new Set(repo.topics.map((topic) => topic.toLowerCase()));
  const haystack = `${repo.fullName}\n${repo.name}\n${repo.description ?? ""}`;
  const matched: string[] = [];
  for (const topic of config.topics) {
    const byTopic = topic.githubTopics.some((name) => topicSet.has(name.toLowerCase()));
    const byKeyword = topic.keywords.some((keyword) => includesKeyword(haystack, keyword));
    if (byTopic || byKeyword) matched.push(topic.id);
  }
  return matched;
}

export function isExcluded(fullName: string, patterns: string[]): boolean {
  const name = fullName.toLowerCase();
  return patterns.some((pattern) => pattern && name.includes(pattern.toLowerCase()));
}
