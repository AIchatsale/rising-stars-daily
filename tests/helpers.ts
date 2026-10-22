import { parseConfig } from "@/lib/config";
import type { AppConfig, RepoSnapshot, Snapshot } from "@/lib/types";

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return parseConfig({
    topN: 3,
    minStars: 20,
    newRepoWindowHours: 48,
    languages: ["TypeScript", "Python"],
    keywords: ["agent"],
    excludeNamePatterns: ["awesome-"],
    topics: [
      { id: "ai", label: "AI", githubTopics: ["ai", "machine-learning"], keywords: ["neural"] },
      { id: "llm", label: "LLM", githubTopics: ["llm"], keywords: ["rag"] },
      { id: "saas", label: "SaaS", githubTopics: ["saas"], keywords: ["billing"] },
      { id: "games", label: "游戏", githubTopics: ["game-engine"], keywords: ["gamedev"] },
    ],
    recommendCount: 2,
    llm: { categories: ["应用", "工具", "库", "框架", "模板", "插件", "文档", "示例", "集成", "研究"], maxRepos: 5 },
    ...overrides,
  });
}

export function makeRepo(partial: Partial<RepoSnapshot> & Pick<RepoSnapshot, "fullName" | "stars">): RepoSnapshot {
  const [owner, name] = partial.fullName.split("/");
  return {
    id: partial.id ?? partial.fullName.length,
    fullName: partial.fullName,
    name: partial.name ?? name ?? partial.fullName,
    owner: partial.owner ?? owner ?? "owner",
    description: partial.description === undefined ? "A useful project" : partial.description,
    language: partial.language === undefined ? "TypeScript" : partial.language,
    topics: partial.topics ?? [],
    stars: partial.stars,
    forks: partial.forks ?? 10,
    openIssues: partial.openIssues ?? 2,
    createdAt: partial.createdAt ?? "2024-01-01T00:00:00.000Z",
    pushedAt: partial.pushedAt ?? "2026-10-21T12:00:00.000Z",
    url: partial.url ?? `https://github.com/${partial.fullName}`,
    license: partial.license === undefined ? "MIT" : partial.license,
    archived: partial.archived ?? false,
    isFork: partial.isFork ?? false,
    demo: partial.demo,
  };
}

export function makeSnapshot(
  date: string,
  repos: RepoSnapshot[],
  extra: Partial<Snapshot> = {},
): Snapshot {
  return {
    date,
    generatedAt: extra.generatedAt ?? `${date}T22:00:00.000Z`,
    source: extra.source ?? "live",
    repos,
    hints: extra.hints,
    notice: extra.notice,
  };
}
