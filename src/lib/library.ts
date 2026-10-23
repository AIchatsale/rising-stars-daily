import { addDays } from "./dates";
import { includesKeyword } from "./topics";

export type OwnerKind = "org" | "user";
export type LicenseKind = "permissive" | "weak-copyleft" | "copyleft" | "restricted" | "unknown";
export type LibraryTierId = "5k" | "10k" | "20k" | "40k";
export type NoteSource = "heuristic" | "llm";

export type LibraryRepo = {
  fullName: string;
  description?: string;
  language?: string;
  topics?: string[];
  stars: number;
  forks: number;
  license?: string;
  createdAt: string;
  pushedAt: string;
  homepage?: string;
  ownerType: OwnerKind;
  note?: string;
  noteSource?: NoteSource;
};

export type LibraryCoverage = {
  requests: number;
  reported: number | null;
  kept: number;
  cappedSlices: number;
  incomplete: boolean;
};

export type LibraryCatalog = {
  generatedAt: string;
  date: string;
  mode: "full" | "incremental";
  cursor: number;
  coverage: LibraryCoverage;
  repos: LibraryRepo[];
};

export type LibraryHistory = {
  series: Record<string, [string, number][]>;
};

export type StarSlice = { min: number; max: number | null };
export type DateWindow = { from: string; to: string };

export const LIBRARY_TIERS: { id: LibraryTierId; label: string; min: number; max: number | null; range: string }[] = [
  { id: "5k", label: "5K+", min: 5000, max: 9999, range: "5千–1万" },
  { id: "10k", label: "10K+", min: 10000, max: 19999, range: "1万–2万" },
  { id: "20k", label: "20K+", min: 20000, max: 39999, range: "2万–4万" },
  { id: "40k", label: "40K+", min: 40000, max: null, range: "4万以上" },
];

export const LIBRARY_CATEGORIES: { id: string; label: string; topics: string[]; keywords: string[] }[] = [
  { id: "ai", label: "AI", topics: ["artificial-intelligence", "machine-learning", "deep-learning", "ai", "neural-network"], keywords: ["machine learning", "deep learning", "neural network"] },
  { id: "llm", label: "LLM", topics: ["llm", "rag", "langchain", "chatgpt", "openai", "large-language-models"], keywords: ["llm", "large language model", "rag"] },
  { id: "saas", label: "SaaS", topics: ["saas", "crm", "billing", "subscription"], keywords: ["saas", "subscription", "multi-tenant"] },
  { id: "devtools", label: "开发工具", topics: ["developer-tools", "devtools", "cli", "sdk", "framework"], keywords: ["developer tool", "command line"] },
  { id: "games", label: "游戏", topics: ["game", "gamedev", "game-engine", "game-development"], keywords: ["game engine", "gamedev"] },
  { id: "web3", label: "Web3", topics: ["web3", "ethereum", "blockchain", "solidity", "cryptocurrency"], keywords: ["blockchain", "solidity", "smart contract"] },
  { id: "commerce", label: "电商", topics: ["ecommerce", "e-commerce", "shopify", "magento"], keywords: ["e-commerce", "ecommerce", "shopping cart"] },
];

const SLICE_EDGES = [5000, 5250, 5500, 5750, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500, 10000, 11000, 12000, 14000, 16000, 18000, 20000, 25000, 30000, 40000, 60000, 100000];

const PERMISSIVE = new Set([
  "MIT", "MIT-0", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "BSD-3-Clause-Clear", "ISC", "0BSD", "Unlicense",
  "Zlib", "BSL-1.0", "PostgreSQL", "NCSA", "BlueOak-1.0.0", "CC0-1.0", "OFL-1.1", "WTFPL",
]);

export type GithubLibraryJson = {
  full_name?: string;
  private?: boolean;
  fork?: boolean;
  archived?: boolean;
  description?: string | null;
  language?: string | null;
  topics?: string[];
  stargazers_count?: number;
  forks_count?: number;
  created_at?: string;
  pushed_at?: string;
  homepage?: string | null;
  license?: { spdx_id?: string | null } | null;
  owner?: { login?: string; type?: string };
};

export function starSlices(minStars = 5000): StarSlice[] {
  const edges = SLICE_EDGES.filter((edge) => edge > minStars);
  edges.unshift(minStars);
  return edges.map((min, index) => {
    const next = edges[index + 1];
    return next == null ? { min, max: null } : { min, max: next - 1 };
  });
}

export function librarySearchQuery(slice: StarSlice, window?: DateWindow): string {
  const stars = slice.max == null ? `stars:>=${slice.min}` : `stars:${slice.min}..${slice.max}`;
  const created = window ? ` created:${window.from}..${window.to}` : "";
  return `${stars} fork:false archived:false${created}`;
}

export function splitWindow(window: DateWindow): [DateWindow, DateWindow] | null {
  const start = Date.parse(`${window.from}T00:00:00Z`);
  const end = Date.parse(`${window.to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 86_400_000) return null;
  const mid = start + Math.floor((end - start) / 86_400_000 / 2) * 86_400_000;
  const midDate = new Date(mid).toISOString().slice(0, 10);
  const nextDate = new Date(mid + 86_400_000).toISOString().slice(0, 10);
  if (nextDate > window.to) return null;
  return [
    { from: window.from, to: midDate },
    { from: nextDate, to: window.to },
  ];
}

export function tierOf(stars: number): LibraryTierId | null {
  if (stars >= 40000) return "40k";
  if (stars >= 20000) return "20k";
  if (stars >= 10000) return "10k";
  if (stars >= 5000) return "5k";
  return null;
}

export function inTier(stars: number, tier: "all" | LibraryTierId, minStars = 5000): boolean {
  if (stars < minStars) return false;
  if (tier === "all") return true;
  const found = LIBRARY_TIERS.find((item) => item.id === tier);
  if (!found || stars < found.min) return false;
  return found.max == null || stars <= found.max;
}

export function tierCounts(repos: { stars: number }[]): Record<LibraryTierId, number> {
  const counts: Record<LibraryTierId, number> = { "5k": 0, "10k": 0, "20k": 0, "40k": 0 };
  for (const repo of repos) {
    const tier = tierOf(repo.stars);
    if (tier) counts[tier] += 1;
  }
  return counts;
}

export function licenseKind(spdx: string | null | undefined): LicenseKind {
  if (!spdx || spdx === "NOASSERTION" || spdx === "NONE") return "unknown";
  const id = spdx.toUpperCase();
  if (id.includes("SSPL") || id.includes("BUSL") || id.includes("COMMONS-CLAUSE") || id.includes("CC-BY-NC")) return "restricted";
  if (id.includes("LGPL") || id.startsWith("MPL") || id.includes("EPL") || id.includes("CDDL")) return "weak-copyleft";
  if (id.includes("AGPL") || id.includes("GPL") || id.includes("EUPL") || id.startsWith("OSL-")) return "copyleft";
  if (PERMISSIVE.has(spdx) || id.startsWith("MIT") || id.startsWith("BSD-") || id.startsWith("APACHE-") || id === "ISC" || id.startsWith("UNLICENSE")) {
    return "permissive";
  }
  return "unknown";
}

export function licenseLabel(kind: LicenseKind): string {
  if (kind === "permissive") return "宽松协议";
  if (kind === "weak-copyleft") return "弱 copyleft";
  if (kind === "copyleft") return "Copyleft";
  if (kind === "restricted") return "商用限制";
  return "协议未标明";
}

export function isListRepo(repo: { fullName: string; topics?: string[] }): boolean {
  const name = repo.fullName.toLowerCase();
  if (name.includes("awesome-") || name.endsWith("/awesome")) return true;
  return (repo.topics ?? []).some((topic) => topic.toLowerCase() === "awesome-list");
}

export function matchLibraryCategories(repo: { fullName: string; description?: string; topics?: string[] }): { id: string; label: string }[] {
  const topicSet = new Set((repo.topics ?? []).map((topic) => topic.toLowerCase()));
  const name = repo.fullName.split("/")[1] ?? repo.fullName;
  const haystack = `${repo.fullName}\n${name}\n${repo.description ?? ""}`;
  const matched: { id: string; label: string }[] = [];
  for (const category of LIBRARY_CATEGORIES) {
    const byTopic = category.topics.some((topic) => topicSet.has(topic.toLowerCase()));
    const byKeyword = category.keywords.some((keyword) => includesKeyword(haystack, keyword));
    if (byTopic || byKeyword) matched.push({ id: category.id, label: category.label });
  }
  return matched;
}

export function isRecentlyActive(pushedAt: string, asOf: string, withinDays: number): boolean {
  const pushed = pushedAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pushed)) return false;
  return pushed >= addDays(asOf, -withinDays);
}

export function signalLabels(repo: LibraryRepo, asOf: string, withinDays: number): string[] {
  const labels = [licenseLabel(licenseKind(repo.license))];
  if (repo.homepage) labels.push("有主页");
  if (repo.ownerType === "org") labels.push("组织维护");
  labels.push(isRecentlyActive(repo.pushedAt, asOf, withinDays) ? "近期活跃" : "更新偏旧");
  if (isListRepo(repo)) labels.push("清单");
  return labels;
}

export function commercialNote(repo: LibraryRepo, asOf: string, withinDays: number, growth30?: number | null): string {
  const parts: string[] = [];
  if (isListRepo(repo)) parts.push("这是清单型仓库，适合当资料目录，不适合直接嵌进产品");
  const kind = licenseKind(repo.license);
  if (kind === "permissive") parts.push("宽松许可证，适合作为商业产品的依赖或二次开发起点");
  else if (kind === "weak-copyleft") parts.push("弱 copyleft，和闭源代码组合前要核对链接方式");
  else if (kind === "copyleft") parts.push("copyleft 许可证，闭源产品改代码或一起发布前需要法务确认");
  else if (kind === "restricted") parts.push("带额外商业限制，不能当成普通开源依赖");
  else parts.push("协议未标明，商用前先打开 LICENSE");
  if (repo.homepage) parts.push("有独立主页，便于判断是不是公司在运营");
  if (repo.ownerType === "org") parts.push("由组织账号维护");
  else parts.push("由个人账号维护");
  if (isRecentlyActive(repo.pushedAt, asOf, withinDays)) parts.push("近期仍有推送");
  else parts.push("最近提交偏旧，引入前先确认还有人维护");
  const labels = matchLibraryCategories(repo).map((category) => category.label);
  if (labels.length > 0) parts.push(`方向接近${labels.join("、")}`);
  if (growth30 != null && growth30 > 0) parts.push(`近 30 天星标增加 ${growth30}`);
  return `${repo.fullName}：${parts.join("；")}。`.slice(0, 320);
}

export function cleanHomepage(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed.slice(0, 300);
}

export function toLibraryRepo(raw: GithubLibraryJson): LibraryRepo | null {
  if (!raw.full_name || !raw.full_name.includes("/") || !raw.created_at || !raw.pushed_at) return null;
  if (raw.private || raw.fork || raw.archived) return null;
  const description = raw.description?.trim();
  const topics = (raw.topics ?? []).map((topic) => topic.trim()).filter(Boolean).slice(0, 8);
  const license = raw.license?.spdx_id && raw.license.spdx_id !== "NOASSERTION" ? raw.license.spdx_id : undefined;
  const homepage = cleanHomepage(raw.homepage);
  return {
    fullName: raw.full_name,
    ...(description ? { description: description.slice(0, 180) } : {}),
    ...(raw.language ? { language: raw.language } : {}),
    ...(topics.length > 0 ? { topics } : {}),
    stars: raw.stargazers_count ?? 0,
    forks: raw.forks_count ?? 0,
    ...(license ? { license } : {}),
    createdAt: raw.created_at,
    pushedAt: raw.pushed_at,
    ...(homepage ? { homepage } : {}),
    ownerType: raw.owner?.type === "Organization" ? "org" : "user",
  };
}

export function annotateRepo(repo: LibraryRepo, asOf: string, withinDays: number, previous?: LibraryRepo, growth30?: number | null): LibraryRepo {
  if (previous?.noteSource === "llm" && previous.note) {
    return { ...repo, note: previous.note, noteSource: "llm" };
  }
  return { ...repo, note: commercialNote(repo, asOf, withinDays, growth30), noteSource: "heuristic" };
}

export function decideLibraryMode(input: { hasCatalog: boolean; forced: boolean; weekday: number; fullRefreshWeekday: number }): "full" | "incremental" {
  if (!input.hasCatalog || input.forced || input.weekday === input.fullRefreshWeekday) return "full";
  return "incremental";
}

export function recordStars(history: LibraryHistory, fullName: string, date: string, stars: number): void {
  const next = (history.series[fullName] ?? []).filter(([pointDate]) => pointDate !== date);
  next.push([date, stars]);
  next.sort((left, right) => left[0].localeCompare(right[0]));
  history.series[fullName] = next.slice(-40);
}

export function starGrowth(points: [string, number][] | undefined, asOf: string, days: number, currentStars: number): number | null {
  if (!points || points.length === 0) return null;
  const target = addDays(asOf.slice(0, 10), -days);
  const baseline = points.filter(([date]) => date <= target).sort((left, right) => left[0].localeCompare(right[0])).at(-1);
  if (!baseline) return null;
  return currentStars - baseline[1];
}

export type LibraryFilters = {
  tier: "all" | LibraryTierId;
  language: string;
  category: string;
  license: "all" | LicenseKind;
  activeOnly: boolean;
  query: string;
  asOf: string;
  activeWithinDays: number;
  minStars: number;
};

export function filterLibrary(repos: LibraryRepo[], filters: LibraryFilters): LibraryRepo[] {
  const needle = filters.query.trim().toLowerCase();
  return repos.filter((repo) => {
    if (!inTier(repo.stars, filters.tier, filters.minStars)) return false;
    if (filters.language !== "all" && repo.language !== filters.language) return false;
    if (filters.category !== "all" && !matchLibraryCategories(repo).some((category) => category.id === filters.category)) return false;
    if (filters.license !== "all" && licenseKind(repo.license) !== filters.license) return false;
    if (filters.activeOnly && !isRecentlyActive(repo.pushedAt, filters.asOf, filters.activeWithinDays)) return false;
    if (!needle) return true;
    const haystack = `${repo.fullName} ${repo.description ?? ""} ${(repo.topics ?? []).join(" ")} ${repo.note ?? ""}`.toLowerCase();
    return haystack.includes(needle);
  });
}

export type LibrarySortKey = "stars" | "forks" | "growth7" | "growth30" | "pushed" | "created" | "name";

export function sortLibrary(repos: LibraryRepo[], key: LibrarySortKey, history: LibraryHistory, asOf: string): LibraryRepo[] {
  const growth = (repo: LibraryRepo, days: number) => starGrowth(history.series[repo.fullName], asOf, days, repo.stars);
  const value = (repo: LibraryRepo): number | string | null => {
    if (key === "stars") return repo.stars;
    if (key === "forks") return repo.forks;
    if (key === "growth7") return growth(repo, 7);
    if (key === "growth30") return growth(repo, 30);
    if (key === "pushed") return repo.pushedAt;
    if (key === "created") return repo.createdAt;
    return repo.fullName;
  };
  const direction = key === "name" ? 1 : -1;
  return [...repos].sort((left, right) => {
    const a = value(left);
    const b = value(right);
    if (a == null && b == null) return left.fullName.localeCompare(right.fullName);
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === "number" && typeof b === "number" && a !== b) return (a - b) * direction;
    return String(a).localeCompare(String(b), "zh-CN") * direction || left.fullName.localeCompare(right.fullName);
  });
}

export type LibraryExportRow = {
  fullName: string;
  owner: string;
  name: string;
  description: string;
  language: string;
  topics: string;
  stars: number;
  forks: number;
  license: string;
  licenseKind: string;
  createdAt: string;
  pushedAt: string;
  homepage: string;
  url: string;
  ownerType: string;
  categories: string;
  signals: string;
  note: string;
  growth7: number | null;
  growth30: number | null;
};

export function exportRow(repo: LibraryRepo, history: LibraryHistory, asOf: string, withinDays: number): LibraryExportRow {
  const [owner, name] = repo.fullName.split("/");
  return {
    fullName: repo.fullName,
    owner: owner ?? "",
    name: name ?? repo.fullName,
    description: repo.description ?? "",
    language: repo.language ?? "",
    topics: (repo.topics ?? []).join(" "),
    stars: repo.stars,
    forks: repo.forks,
    license: repo.license ?? "",
    licenseKind: licenseLabel(licenseKind(repo.license)),
    createdAt: repo.createdAt,
    pushedAt: repo.pushedAt,
    homepage: repo.homepage ?? "",
    url: `https://github.com/${repo.fullName}`,
    ownerType: repo.ownerType === "org" ? "组织" : "个人",
    categories: matchLibraryCategories(repo).map((category) => category.label).join(" "),
    signals: signalLabels(repo, asOf, withinDays).join(" "),
    note: repo.note ?? commercialNote(repo, asOf, withinDays),
    growth7: starGrowth(history.series[repo.fullName], asOf, 7, repo.stars),
    growth30: starGrowth(history.series[repo.fullName], asOf, 30, repo.stars),
  };
}

function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: LibraryExportRow[]): string {
  const header = ["fullName", "owner", "name", "description", "language", "topics", "stars", "forks", "license", "licenseKind", "createdAt", "pushedAt", "homepage", "url", "ownerType", "categories", "signals", "note", "growth7", "growth30"];
  const lines = rows.map((row) => header.map((key) => csvCell(row[key as keyof LibraryExportRow])).join(","));
  return `\uFEFF${header.join(",")}\n${lines.join("\n")}\n`;
}

export function selectLlmCandidates(repos: LibraryRepo[], limit: number): LibraryRepo[] {
  return [...repos]
    .filter((repo) => repo.noteSource !== "llm")
    .sort((left, right) => right.stars - left.stars || left.fullName.localeCompare(right.fullName))
    .slice(0, Math.max(0, limit));
}

export function parseCommercialNotes(text: string): { fullName: string; note: string }[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? text;
  const start = source.indexOf("{");
  const jsonText = start >= 0 ? source.slice(start, source.lastIndexOf("}") + 1) : source;
  const parsed = JSON.parse(jsonText) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : [];
  const notes: { fullName: string; note: string }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (typeof record.fullName !== "string" || !record.fullName.includes("/")) continue;
    if (typeof record.note !== "string" || !record.note.trim()) continue;
    notes.push({ fullName: record.fullName.trim(), note: record.note.trim().slice(0, 320) });
  }
  return notes;
}

export function applyCommercialNotes(repos: LibraryRepo[], notes: { fullName: string; note: string }[]): LibraryRepo[] {
  const byName = new Map(notes.map((note) => [note.fullName, note.note]));
  return repos.map((repo) => {
    const note = byName.get(repo.fullName);
    if (!note) return repo;
    return { ...repo, note, noteSource: "llm" as const };
  });
}

export function emptyHistory(): LibraryHistory {
  return { series: {} };
}

export function pruneHistory(history: LibraryHistory, keep: Set<string>): LibraryHistory {
  const series: LibraryHistory["series"] = {};
  for (const [fullName, points] of Object.entries(history.series)) {
    if (keep.has(fullName)) series[fullName] = points;
  }
  return { series };
}
