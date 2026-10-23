export type DeltaSource = "snapshot" | "created-window" | "trending" | "unknown";

export type DataSource = "sample" | "live";

export type TopicConfig = {
  id: string;
  label: string;
  githubTopics: string[];
  keywords: string[];
  minStars?: number;
};

export type PagesHostConfig = {
  domain: string;
  basePath: string;
  url: string;
};

export type AppConfig = {
  topN: number;
  minStars: number;
  newRepoWindowHours: number;
  maxCandidates: number;
  searchPerPage: number;
  searchPages: number;
  maxSearchQueries: number;
  languageQueryLimit: number;
  keywordQueryLimit: number;
  hydrationCapWithoutToken: number;
  hydrationCapWithToken: number;
  languages: string[];
  keywords: string[];
  excludeNamePatterns: string[];
  topics: TopicConfig[];
  discover: {
    recentlyCreated: boolean;
    recentlyPushed: boolean;
    githubTrending: boolean;
  };
  llm: {
    model: string;
    baseUrl: string;
    maxRepos: number;
    categories: string[];
  };
  email: {
    subjectPrefix: string;
    topInEmail: number;
  };
  site: PagesHostConfig;
  recommendCount: number;
  library: {
    minStars: number;
    fullRefreshWeekday: number;
    dailyHydrateCap: number;
    llmNotesPerRun: number;
    activeWithinDays: number;
    maxSearchRequests: number;
  };
};

export type RepoSnapshot = {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  createdAt: string;
  pushedAt: string;
  url: string;
  license: string | null;
  archived: boolean;
  isFork: boolean;
  demo?: boolean;
};

export type Snapshot = {
  date: string;
  generatedAt: string;
  source: DataSource;
  notice?: string;
  repos: RepoSnapshot[];
  hints?: {
    trendingDailyStars?: Record<string, number>;
  };
  collection?: {
    queries: number;
    searchRepos: number;
    trendingRepos: number;
    hydrated: number;
  };
};

export type Classification = {
  fullName: string;
  category: string;
  summary: string;
  opportunity: string;
  tags: string[];
  source: "llm" | "heuristic";
};

export type RankedRepo = RepoSnapshot & {
  rank: number;
  delta: number | null;
  baselineStars: number | null;
  growthPercent: number | null;
  isNew: boolean;
  deltaKnown: boolean;
  deltaSource: DeltaSource;
  rankChange: number | null;
  trackedTopics: string[];
  classification: Classification;
};

export type RecommendedPick = {
  fullName: string;
  reason: string;
  signals: string[];
  category: string;
};

export type TopicLeader = {
  topicId: string;
  label: string;
  fullName: string;
};

export type DeliveryStatus = "skipped" | "sent" | "failed";

export type LlmStatus = "skipped" | "ok" | "failed" | "heuristic";

export type DayReport = {
  date: string;
  generatedAt: string;
  source: DataSource;
  mode: "delta" | "first-run";
  previousDate: string | null;
  isFirstRun: boolean;
  approximate24h: boolean;
  phrase: string;
  llm: LlmStatus;
  email: DeliveryStatus;
  items: RankedRepo[];
  recommended: RecommendedPick[];
  topicLeaders: TopicLeader[];
  stats: {
    candidates: number;
    rising: number;
    listed: number;
    maxDelta: number | null;
    medianGrowth: number | null;
  };
};

export type IndexEntry = {
  date: string;
  source: DataSource;
  mode: "delta" | "first-run";
  previousDate: string | null;
  llm: LlmStatus;
  email: DeliveryStatus;
  itemCount: number;
};

export type IndexFile = {
  generatedAt: string;
  latest: string | null;
  dates: string[];
  filters: {
    languages: string[];
    topics: { id: string; label: string }[];
  };
  entries: IndexEntry[];
};

export type HistoryPoint = {
  date: string;
  stars: number;
};

export type HistoryFile = {
  sample: Record<string, HistoryPoint[]>;
  live: Record<string, HistoryPoint[]>;
};
