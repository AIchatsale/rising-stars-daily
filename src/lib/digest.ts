import { deltaCaption, formatDate, formatDelta, formatNumber, formatPercent } from "./format";
import type { DayReport, RankedRepo } from "./types";

export type DigestRepo = {
  rank: number;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  delta: number | null;
  growthPercent: number | null;
  deltaSource: RankedRepo["deltaSource"];
  createdAt: string;
  category: string;
  summary: string;
  opportunity: string;
};

export type DigestJson = {
  date: string;
  source: DayReport["source"];
  mode: DayReport["mode"];
  phrase: string;
  previousDate: string | null;
  recommended: {
    fullName: string;
    reason: string;
    signals: string[];
    category: string;
    url?: string;
    stars?: number;
    delta: number | null;
    growthPercent: number | null;
  }[];
  items: DigestRepo[];
};

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function renderDigestJson(report: DayReport): DigestJson {
  return {
    date: report.date,
    source: report.source,
    mode: report.mode,
    phrase: report.phrase,
    previousDate: report.previousDate,
    recommended: report.recommended.map((pick) => {
      const item = report.items.find((entry) => entry.fullName === pick.fullName);
      return {
        ...pick,
        url: item?.url,
        stars: item?.stars,
        delta: item?.delta ?? null,
        growthPercent: item?.growthPercent ?? null,
      };
    }),
    items: report.items.map((item) => ({
      rank: item.rank,
      fullName: item.fullName,
      url: item.url,
      description: item.description,
      language: item.language,
      topics: item.trackedTopics,
      stars: item.stars,
      delta: item.delta,
      growthPercent: item.growthPercent,
      deltaSource: item.deltaSource,
      createdAt: item.createdAt,
      category: item.classification.category,
      summary: item.classification.summary,
      opportunity: item.classification.opportunity,
    })),
  };
}

export function renderDigestMarkdown(report: DayReport, pageUrl?: string): string {
  const lines: string[] = [
    `# 昇星日报 ${formatDate(report.date)}`,
    "",
    report.source === "sample"
      ? "数据来源：示例快照。星标走势是演示序列，不是这些仓库的真实历史。"
      : "数据来源：GitHub 实测快照。",
    `对照：${report.phrase}。`,
    "",
    "## 今日建议带给客户",
    "",
  ];

  if (report.recommended.length === 0) {
    lines.push("今天没有足够的候选。", "");
  }
  report.recommended.forEach((pick, index) => {
    const item = report.items.find((entry) => entry.fullName === pick.fullName);
    lines.push(`### ${index + 1}. ${pick.fullName}`);
    lines.push("");
    lines.push(`- 分类：${pick.category}`);
    if (item) {
      lines.push(
        `- 星标：${formatNumber(item.stars)}（${formatDelta(item.delta)}，${formatPercent(item.growthPercent)}，${deltaCaption(item.deltaSource, report.approximate24h)}）`,
      );
      lines.push(`- 链接：${item.url}`);
    }
    lines.push(`- 建议：${pick.reason}`);
    lines.push("");
  });

  lines.push("## 增速榜", "");
  lines.push("| 排名 | 项目 | 语言 | 分类 | 星标 | 增量 | 增速 | 话题 |");
  lines.push("| --- | --- | --- | --- | ---: | ---: | ---: | --- |");
  for (const item of report.items) {
    lines.push(
      `| ${item.rank} | ${cell(item.fullName)} | ${cell(item.language ?? "—")} | ${cell(item.classification.category)} | ${formatNumber(item.stars)} | ${formatDelta(item.delta)} | ${formatPercent(item.growthPercent)} | ${cell(item.trackedTopics.join(", ") || "—")} |`,
    );
  }
  lines.push("");
  if (report.topicLeaders.length > 0) {
    lines.push("## 话题观察", "");
    for (const leader of report.topicLeaders) {
      const item = report.items.find((entry) => entry.fullName === leader.fullName);
      lines.push(`- **${leader.label}**：${leader.fullName}${item ? `（${formatDelta(item.delta)}）` : ""}`);
    }
    lines.push("");
  }
  lines.push("---", "");
  lines.push("本简报由昇星日报自动生成，可转发给同事。星标增量来自相邻快照的差值；首次采集日会单独标明。");
  if (pageUrl) lines.push(`完整看板：${pageUrl}`);
  lines.push("");
  return lines.join("\n");
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderDigestHtml(report: DayReport, options?: { pageUrl?: string; limit?: number }): string {
  const items = options?.limit ? report.items.slice(0, options.limit) : report.items;
  const pageUrl = options?.pageUrl;
  const rows = items
    .map((item) => {
      return `<tr>
        <td style="padding:10px 8px;border-bottom:1px solid #eadfce;">${item.rank}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eadfce;">
          <a href="${escapeHtml(item.url)}" style="color:#1f4e49;font-weight:650;text-decoration:none;">${escapeHtml(item.fullName)}</a>
          <div style="color:#6e675e;font-size:12px;margin-top:3px;">${escapeHtml(item.classification.summary)}</div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #eadfce;">${escapeHtml(item.language ?? "—")}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eadfce;text-align:right;">${escapeHtml(formatNumber(item.stars))}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eadfce;text-align:right;color:#b8432f;font-weight:700;">${escapeHtml(formatDelta(item.delta))}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #eadfce;text-align:right;">${escapeHtml(formatPercent(item.growthPercent))}</td>
      </tr>`;
    })
    .join("");
  const picks = report.recommended
    .map((pick) => {
      const item = report.items.find((entry) => entry.fullName === pick.fullName);
      const href = item ? `<a href="${escapeHtml(item.url)}" style="color:#1f4e49;">${escapeHtml(pick.fullName)}</a>` : escapeHtml(pick.fullName);
      return `<div style="background:#fffdf8;border:1px solid #eadfce;border-radius:12px;padding:14px 16px;margin:0 0 10px;">
        <div style="font-size:12px;letter-spacing:0.08em;color:#8a6a2f;">${escapeHtml(pick.category)}</div>
        <div style="font-size:16px;margin:4px 0;">${href}</div>
        <p style="margin:6px 0 0;line-height:1.55;color:#3c342c;">${escapeHtml(pick.reason)}</p>
      </div>`;
    })
    .join("");
  const link = pageUrl
    ? `<p style="margin-top:18px;"><a href="${escapeHtml(pageUrl)}" style="color:#1f4e49;">打开完整看板</a></p>`
    : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>昇星日报 ${escapeHtml(formatDate(report.date))}</title>
</head>
<body style="margin:0;padding:24px;background:#f4efe6;color:#1c1915;font-family:'Segoe UI','PingFang SC','Noto Sans SC',sans-serif;">
  <div style="max-width:680px;margin:0 auto;">
    <p style="margin:0;font-size:12px;letter-spacing:0.16em;color:#8a6a2f;">RISING STARS</p>
    <h1 style="font-family:Georgia,'Songti SC',serif;font-weight:500;font-size:32px;margin:6px 0 8px;">昇星日报</h1>
    <p style="margin:0 0 18px;color:#6e675e;">${escapeHtml(formatDate(report.date))} · ${escapeHtml(report.phrase)}</p>
    <h2 style="font-size:18px;margin:0 0 10px;">今日建议带给客户</h2>
    ${picks || "<p>今天没有足够的候选。</p>"}
    <h2 style="font-size:18px;margin:22px 0 10px;">增速榜</h2>
    <table style="width:100%;border-collapse:collapse;background:#fffdf8;border-radius:12px;overflow:hidden;font-size:14px;">
      <thead>
        <tr style="background:#1f4e49;color:#f4efe6;text-align:left;">
          <th style="padding:8px;">#</th>
          <th style="padding:8px;">项目</th>
          <th style="padding:8px;">语言</th>
          <th style="padding:8px;text-align:right;">星标</th>
          <th style="padding:8px;text-align:right;">增量</th>
          <th style="padding:8px;text-align:right;">增速</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${link}
    <p style="color:#6e675e;font-size:12px;line-height:1.6;">增量来自仓库里保存的相邻星标快照。未配置 SMTP 时只生成这份 HTML，不外发。</p>
  </div>
</body>
</html>
`;
}
