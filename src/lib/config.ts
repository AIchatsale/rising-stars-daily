import { resolvePagesHost } from "./pages-host";
import type { AppConfig, TopicConfig } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value;
}

function expectPositiveInt(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function expectSite(value: unknown): unknown {
  if (value == null) return undefined;
  if (!isRecord(value)) throw new Error("site must be an object");
  return value;
}

function parseTopic(value: unknown, index: number): TopicConfig {
  if (!isRecord(value)) throw new Error(`topics[${index}] must be an object`);
  const id = value.id;
  const label = value.label;
  if (typeof id !== "string" || !id.trim()) throw new Error(`topics[${index}].id is required`);
  if (typeof label !== "string" || !label.trim()) throw new Error(`topics[${index}].label is required`);
  const minStars = typeof value.minStars === "number" ? value.minStars : undefined;
  if (minStars != null && minStars < 0) {
    throw new Error(`topics[${index}].minStars must be a non-negative number`);
  }
  return {
    id: id.trim(),
    label: label.trim(),
    githubTopics: expectStringArray(value.githubTopics, `topics[${index}].githubTopics`),
    keywords: expectStringArray(value.keywords, `topics[${index}].keywords`),
    minStars,
  };
}

export function parseConfig(raw: unknown): AppConfig {
  if (!isRecord(raw)) throw new Error("config must be an object");
  const topicsRaw = raw.topics;
  if (!Array.isArray(topicsRaw) || topicsRaw.length === 0) {
    throw new Error("topics must be a non-empty array");
  }
  const discover = isRecord(raw.discover) ? raw.discover : {};
  const llm = isRecord(raw.llm) ? raw.llm : {};
  const email = isRecord(raw.email) ? raw.email : {};
  const categories = llm.categories == null ? ["应用", "工具", "库", "框架", "模板", "插件", "文档", "示例", "集成", "研究"] : expectStringArray(llm.categories, "llm.categories");
  if (categories.length === 0) throw new Error("llm.categories must not be empty");

  return {
    topN: expectPositiveInt(raw.topN, "topN"),
    minStars: typeof raw.minStars === "number" && raw.minStars >= 0 ? raw.minStars : 30,
    newRepoWindowHours: expectPositiveInt(raw.newRepoWindowHours ?? 48, "newRepoWindowHours"),
    maxCandidates: expectPositiveInt(raw.maxCandidates ?? 160, "maxCandidates"),
    searchPerPage: expectPositiveInt(raw.searchPerPage ?? 30, "searchPerPage"),
    searchPages: expectPositiveInt(raw.searchPages ?? 1, "searchPages"),
    maxSearchQueries: expectPositiveInt(raw.maxSearchQueries ?? 12, "maxSearchQueries"),
    languageQueryLimit: typeof raw.languageQueryLimit === "number" ? raw.languageQueryLimit : 2,
    keywordQueryLimit: typeof raw.keywordQueryLimit === "number" ? raw.keywordQueryLimit : 2,
    hydrationCapWithoutToken: expectPositiveInt(raw.hydrationCapWithoutToken ?? 25, "hydrationCapWithoutToken"),
    hydrationCapWithToken: expectPositiveInt(raw.hydrationCapWithToken ?? 240, "hydrationCapWithToken"),
    languages: expectStringArray(raw.languages ?? [], "languages"),
    keywords: expectStringArray(raw.keywords ?? [], "keywords"),
    excludeNamePatterns: expectStringArray(raw.excludeNamePatterns ?? [], "excludeNamePatterns"),
    topics: topicsRaw.map(parseTopic),
    discover: {
      recentlyCreated: discover.recentlyCreated !== false,
      recentlyPushed: discover.recentlyPushed !== false,
      githubTrending: discover.githubTrending !== false,
    },
    llm: {
      model: typeof llm.model === "string" && llm.model.trim() ? llm.model.trim() : "gpt-4o-mini",
      baseUrl: typeof llm.baseUrl === "string" && llm.baseUrl.trim() ? llm.baseUrl.trim() : "https://api.openai.com/v1",
      maxRepos: expectPositiveInt(llm.maxRepos ?? 12, "llm.maxRepos"),
      categories,
    },
    email: {
      subjectPrefix: typeof email.subjectPrefix === "string" && email.subjectPrefix.trim() ? email.subjectPrefix.trim() : "昇星日报",
      topInEmail: expectPositiveInt(email.topInEmail ?? 10, "email.topInEmail"),
    },
    site: resolvePagesHost(expectSite(raw.site)),
    recommendCount: expectPositiveInt(raw.recommendCount ?? 3, "recommendCount"),
    library: parseLibrary(raw.library),
  };
}

function parseLibrary(value: unknown): AppConfig["library"] {
  const library = isRecord(value) ? value : {};
  const weekday = library.fullRefreshWeekday ?? 0;
  if (typeof weekday !== "number" || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new Error("library.fullRefreshWeekday must be an integer from 0 (Sunday) to 6");
  }
  return {
    minStars: expectPositiveInt(library.minStars ?? 5000, "library.minStars"),
    fullRefreshWeekday: weekday,
    dailyHydrateCap: expectPositiveInt(library.dailyHydrateCap ?? 600, "library.dailyHydrateCap"),
    llmNotesPerRun: expectPositiveInt(library.llmNotesPerRun ?? 24, "library.llmNotesPerRun"),
    activeWithinDays: expectPositiveInt(library.activeWithinDays ?? 90, "library.activeWithinDays"),
    maxSearchRequests: expectPositiveInt(library.maxSearchRequests ?? 420, "library.maxSearchRequests"),
  };
}
