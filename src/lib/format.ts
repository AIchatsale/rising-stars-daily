import type { DeltaSource } from "./types";

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatDelta(value: number | null): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}`;
}

export function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  if (!year || !month || !day) return isoDate;
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.slice(0, 10).split("-");
  if (!month || !day) return isoDate;
  return `${Number(month)}/${Number(day)}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${formatted} UTC`;
}

export function deltaCaption(source: DeltaSource, approximate24h: boolean): string {
  switch (source) {
    case "snapshot":
      return approximate24h ? "+24h" : "较上次";
    case "created-window":
      return "创建以来";
    case "trending":
      return "Trending 今日";
    default:
      return "待对照";
  }
}
