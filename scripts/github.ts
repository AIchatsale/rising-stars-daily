import type { RepoSnapshot } from "../src/lib/types";

type GithubRepoJson = {
  id?: number;
  name?: string;
  full_name?: string;
  private?: boolean;
  fork?: boolean;
  archived?: boolean;
  description?: string | null;
  language?: string | null;
  topics?: string[];
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  created_at?: string;
  pushed_at?: string;
  html_url?: string;
  license?: { spdx_id?: string | null } | null;
  owner?: { login?: string };
};

type GraphqlRepo = {
  databaseId?: number | null;
  name?: string | null;
  nameWithOwner?: string | null;
  description?: string | null;
  stargazerCount?: number | null;
  forkCount?: number | null;
  isArchived?: boolean | null;
  isFork?: boolean | null;
  isPrivate?: boolean | null;
  createdAt?: string | null;
  pushedAt?: string | null;
  url?: string | null;
  primaryLanguage?: { name?: string | null } | null;
  licenseInfo?: { spdxId?: string | null } | null;
  owner?: { login?: string | null } | null;
  issues?: { totalCount?: number | null } | null;
  repositoryTopics?: { nodes?: ({ topic?: { name?: string | null } | null } | null)[] | null } | null;
};

const API = "https://api.github.com";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mapGithubRepo(raw: GithubRepoJson): RepoSnapshot | null {
  if (!raw.full_name || !raw.owner?.login || !raw.name || !raw.html_url || !raw.created_at || !raw.pushed_at) return null;
  if (raw.private || raw.fork || raw.archived) return null;
  return {
    id: raw.id ?? 0,
    fullName: raw.full_name,
    name: raw.name,
    owner: raw.owner.login,
    description: raw.description ?? null,
    language: raw.language ?? null,
    topics: raw.topics ?? [],
    stars: raw.stargazers_count ?? 0,
    forks: raw.forks_count ?? 0,
    openIssues: raw.open_issues_count ?? 0,
    createdAt: raw.created_at,
    pushedAt: raw.pushed_at,
    url: raw.html_url,
    license: raw.license?.spdx_id ?? null,
    archived: false,
    isFork: false,
  };
}

function mapGraphqlRepo(node: GraphqlRepo | null): RepoSnapshot | null {
  if (!node?.nameWithOwner || !node.name || !node.url || !node.createdAt || !node.pushedAt) return null;
  if (node.isPrivate || node.isFork || node.isArchived) return null;
  const [ownerName] = node.nameWithOwner.split("/");
  const topics = (node.repositoryTopics?.nodes ?? [])
    .map((item) => item?.topic?.name)
    .filter((topic): topic is string => Boolean(topic));
  return {
    id: node.databaseId ?? 0,
    fullName: node.nameWithOwner,
    name: node.name,
    owner: node.owner?.login ?? ownerName ?? "",
    description: node.description ?? null,
    language: node.primaryLanguage?.name ?? null,
    topics,
    stars: node.stargazerCount ?? 0,
    forks: node.forkCount ?? 0,
    openIssues: node.issues?.totalCount ?? 0,
    createdAt: node.createdAt,
    pushedAt: node.pushedAt,
    url: node.url,
    license: node.licenseInfo?.spdxId ?? null,
    archived: false,
    isFork: false,
  };
}

export class GithubClient {
  private readonly searchGapMs: number;

  constructor(private readonly token: string | undefined) {
    this.searchGapMs = token ? 2_100 : 6_200;
  }

  private headers(extra?: HeadersInit): HeadersInit {
    const headers = new Headers(extra);
    headers.set("Accept", "application/vnd.github+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");
    headers.set("User-Agent", "rising-stars-monitor");
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    return headers;
  }

  private async request(url: string, init?: RequestInit, attempt = 0): Promise<Response> {
    const response = await fetch(url, {
      ...init,
      headers: this.headers(init?.headers),
      signal: AbortSignal.timeout(25_000),
    });
    if ((response.status === 403 || response.status === 429) && attempt < 1) {
      const retryAfter = Number(response.headers.get("retry-after") || "0");
      const remaining = response.headers.get("x-ratelimit-remaining");
      const reset = Number(response.headers.get("x-ratelimit-reset") || "0");
      let wait = retryAfter > 0 ? retryAfter * 1000 : 0;
      if (!wait && remaining === "0" && reset > 0) wait = Math.max(0, reset * 1000 - Date.now()) + 500;
      if (wait > 0 && wait <= 90_000) {
        console.log(`GitHub rate limit hit, waiting ${Math.ceil(wait / 1000)}s`);
        await sleep(wait);
        return this.request(url, init, attempt + 1);
      }
    }
    return response;
  }

  async search(query: string, perPage: number, pages: number): Promise<RepoSnapshot[]> {
    const repos: RepoSnapshot[] = [];
    for (let page = 1; page <= pages; page += 1) {
      const url = `${API}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}&page=${page}`;
      const response = await this.request(url);
      if (!response.ok) {
        const body = await response.text();
        console.warn(`Search failed (${response.status}) for "${query}": ${body.slice(0, 180)}`);
        break;
      }
      const payload = (await response.json()) as { items?: GithubRepoJson[]; incomplete_results?: boolean };
      const items = payload.items ?? [];
      for (const item of items) {
        const mapped = mapGithubRepo(item);
        if (mapped) repos.push(mapped);
      }
      console.log(
        `Search "${query.slice(0, 72)}" page ${page}: ${items.length} repos, remaining ${response.headers.get("x-ratelimit-remaining") ?? "?"}`,
      );
      if (items.length < perPage) break;
      await sleep(this.searchGapMs);
    }
    await sleep(this.searchGapMs);
    return repos;
  }

  async hydrate(fullNames: string[]): Promise<RepoSnapshot[]> {
    if (fullNames.length === 0) return [];
    if (this.token) return this.hydrateGraphql(fullNames);
    const repos: RepoSnapshot[] = [];
    for (const fullName of fullNames) {
      const response = await this.request(`${API}/repos/${fullName}`);
      if (!response.ok) {
        console.warn(`Could not refresh ${fullName} (${response.status})`);
        continue;
      }
      const mapped = mapGithubRepo((await response.json()) as GithubRepoJson);
      if (mapped) repos.push(mapped);
      await sleep(150);
    }
    return repos;
  }

  private async hydrateGraphql(fullNames: string[]): Promise<RepoSnapshot[]> {
    const repos: RepoSnapshot[] = [];
    const batchSize = 20;
    for (let offset = 0; offset < fullNames.length; offset += batchSize) {
      const batch = fullNames.slice(offset, offset + batchSize);
      const fields = batch
        .map((fullName, index) => {
          const [owner, name] = fullName.split("/");
          if (!owner || !name) return "";
          return `r${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
            databaseId
            name
            nameWithOwner
            description
            stargazerCount
            forkCount
            isArchived
            isFork
            isPrivate
            createdAt
            pushedAt
            url
            primaryLanguage { name }
            licenseInfo { spdxId }
            owner { login }
            issues { totalCount }
            repositoryTopics(first: 20) { nodes { topic { name } } }
          }`;
        })
        .filter(Boolean)
        .join("\n");
      const response = await this.request(`${API}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `query {\n${fields}\n}` }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`GraphQL hydration failed (${response.status}): ${body.slice(0, 180)}`);
      }
      const payload = (await response.json()) as { data?: Record<string, GraphqlRepo | null> };
      batch.forEach((_, index) => {
        const mapped = mapGraphqlRepo(payload.data?.[`r${index}`] ?? null);
        if (mapped) repos.push(mapped);
      });
    }
    return repos;
  }
}
