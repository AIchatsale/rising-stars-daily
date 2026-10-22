export type TrendingHit = {
  fullName: string;
  starsToday: number | null;
};

export function parseTrendingHtml(html: string): TrendingHit[] {
  const hits: TrendingHit[] = [];
  const chunks = html.split(/<article\b/i).slice(1);
  for (const chunk of chunks) {
    const heading = chunk.match(/<h2[\s\S]*?<\/h2>/i)?.[0] ?? "";
    const href = heading.match(/href="\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)"/);
    if (!href) continue;
    const fullName = `${href[1]}/${href[2]}`;
    if (hits.some((hit) => hit.fullName === fullName)) continue;
    const starMatch = chunk.match(/([0-9][0-9,]*)\s+stars?\s+today/i);
    const parsed = starMatch ? Number(starMatch[1]?.replace(/,/g, "")) : Number.NaN;
    hits.push({ fullName, starsToday: Number.isFinite(parsed) ? parsed : null });
  }
  return hits;
}

export async function fetchTrending(): Promise<TrendingHit[]> {
  const response = await fetch("https://github.com/trending?since=daily", {
    headers: {
      "User-Agent": "rising-stars-monitor",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`GitHub Trending returned ${response.status}`);
  }
  return parseTrendingHtml(await response.text());
}
