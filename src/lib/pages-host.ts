export const DEFAULT_PAGES_DOMAIN = "githubstars.pandawm.com";
export const DEFAULT_PAGES_URL = `https://${DEFAULT_PAGES_DOMAIN}/`;

type Env = Record<string, string | undefined>;

export type PagesHost = {
  domain: string;
  basePath: string;
  url: string;
};

function nonempty(env: Env, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeDomain(value: string): string {
  const domain = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new Error(`site.domain must be a hostname like ${DEFAULT_PAGES_DOMAIN}`);
  }
  return domain;
}

export function normalizeBasePath(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed || trimmed === "/") return "";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const basePath = withSlash.replace(/\/+$/, "");
  if (!/^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(basePath)) {
    throw new Error("site.basePath must be empty or a URL path prefix such as /rising-stars-daily");
  }
  return basePath;
}

function normalizePagesUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("site.url must be an absolute http(s) URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("site.url must be an absolute http(s) URL");
  }
  const pathname = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${pathname}/`;
}

export function resolvePagesHost(site: unknown, env: Env = {}): PagesHost {
  const record = site !== null && typeof site === "object" && !Array.isArray(site) ? (site as Record<string, unknown>) : {};
  const domain = normalizeDomain(
    nonempty(env, "PAGES_DOMAIN") ??
      (typeof record.domain === "string" && record.domain.trim() ? record.domain : DEFAULT_PAGES_DOMAIN),
  );
  const basePath = normalizeBasePath(
    nonempty(env, "BASE_PATH") ??
      nonempty(env, "NEXT_PUBLIC_BASE_PATH") ??
      (typeof record.basePath === "string" ? record.basePath : ""),
  );
  const fileUrl = typeof record.url === "string" && record.url.trim() ? record.url.trim() : undefined;
  const url = normalizePagesUrl(nonempty(env, "PAGES_URL") ?? fileUrl ?? `https://${domain}${basePath}/`);
  return { domain, basePath, url };
}
