export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export function dataUrl(file: string): string {
  const prefix = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  return `${prefix}/data/${file}`;
}

export function siteHref(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const withSlash = normalized === "/" ? "/" : normalized.endsWith("/") ? normalized : `${normalized}/`;
  const prefix = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  if (withSlash === "/") return prefix ? `${prefix}/` : "/";
  return `${prefix}${withSlash}`;
}
