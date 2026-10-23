import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { classifyRepos } from "../src/lib/classify";
import { parseConfig } from "../src/lib/config";
import { renderDigestHtml, renderDigestJson, renderDigestMarkdown } from "../src/lib/digest";
import { buildDayReport } from "../src/lib/report";
import type {
  Classification,
  DayReport,
  DeliveryStatus,
  HistoryFile,
  IndexFile,
  Snapshot,
} from "../src/lib/types";
import { resolvePagesHost } from "../src/lib/pages-host";
import { sendHtmlEmail, smtpSettingsFromEnv } from "./email";
import { readJson, repoRoot, writeJson } from "./paths";

export type RebuildOptions = {
  llmDate?: string | null;
  sendEmail?: boolean;
};

function dataPath(...parts: string[]): string {
  return path.join(repoRoot, "data", ...parts);
}

function readSnapshots(): Snapshot[] {
  const snapshots: Snapshot[] = [];
  for (const source of ["sample", "live"] as const) {
    const folder = dataPath("snapshots", source);
    if (!fs.existsSync(folder)) continue;
    for (const file of fs.readdirSync(folder).filter((name) => name.endsWith(".json")).sort()) {
      snapshots.push(readJson<Snapshot>(path.join(folder, file)));
    }
  }
  return snapshots;
}

function readRankings(): Map<string, DayReport> {
  const folder = dataPath("rankings");
  const reports = new Map<string, DayReport>();
  if (!fs.existsSync(folder)) return reports;
  for (const file of fs.readdirSync(folder).filter((name) => name.endsWith(".json"))) {
    try {
      const report = readJson<DayReport>(path.join(folder, file));
      if (report.date) reports.set(report.date, report);
    } catch (error) {
      console.warn(`Skipping unreadable ranking ${file}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return reports;
}

function copyPublishedData(): void {
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/copy-data.mjs")], { stdio: "inherit" });
}

async function deliver(report: DayReport, subjectPrefix: string, limit: number, pageUrl?: string): Promise<DeliveryStatus> {
  if (process.env.SKIP_EMAIL === "true") {
    console.log("SKIP_EMAIL is set, digest saved without sending");
    return "skipped";
  }
  const settings = smtpSettingsFromEnv(process.env);
  if (!settings) {
    console.log("SMTP secrets absent, HTML digest saved without sending");
    return "skipped";
  }
  try {
    await sendHtmlEmail(settings, {
      subject: `${subjectPrefix} ${report.date}`,
      html: renderDigestHtml(report, { pageUrl, limit }),
      text: renderDigestMarkdown(report, pageUrl),
    });
    console.log(`Sent the daily digest to ${settings.to}`);
    return "sent";
  } catch (error) {
    console.error(`Email failed: ${error instanceof Error ? error.message : error}`);
    return "failed";
  }
}

function removeStale(folder: string, keep: Set<string>): void {
  if (!fs.existsSync(folder)) return;
  for (const file of fs.readdirSync(folder)) {
    const date = file.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || keep.has(date)) continue;
    fs.rmSync(path.join(folder, file), { force: true });
  }
}

export async function rebuild(options: RebuildOptions = {}): Promise<void> {
  const config = parseConfig(readJson(path.join(repoRoot, "config.json")));
  const snapshots = readSnapshots();
  const existing = readRankings();
  const reports: DayReport[] = [];
  const pageUrl = resolvePagesHost(readJson<{ site?: unknown }>(path.join(repoRoot, "config.json")).site, process.env).url;

  for (const source of ["sample", "live"] as const) {
    const days = snapshots.filter((snapshot) => snapshot.source === source).sort((a, b) => a.date.localeCompare(b.date));
    let previous: Snapshot | null = null;
    let previousRanks: Map<string, number> | null = null;
    for (const today of days) {
      const existingReport = existing.get(today.date);
      const reused = new Map<string, Classification>();
      if (today.date !== options.llmDate && existingReport?.source === today.source) {
        for (const item of existingReport.items ?? []) {
          if (item.classification?.source === "llm") reused.set(item.fullName, item.classification);
        }
      }
      let report = buildDayReport({
        today,
        previous,
        previousRanks,
        config,
        classifications: reused.size > 0 ? reused : undefined,
        llm: "heuristic",
      });
      if (today.date === options.llmDate) {
        const outcome = await classifyRepos(report.items, config, process.env);
        if (outcome.status === "failed") console.error(`LLM classification failed: ${outcome.error ?? "unknown error"}`);
        if (outcome.status === "skipped") console.log("LLM_API_KEY absent, heuristic summaries kept");
        if (outcome.status === "ok") console.log("LLM summaries attached");
        report = buildDayReport({
          today,
          previous,
          previousRanks,
          config,
          classifications: outcome.byRepo,
          llm: outcome.status === "ok" ? "ok" : outcome.status === "failed" ? "failed" : "skipped",
        });
      } else if (existingReport?.source === today.source) {
        report.llm = existingReport.llm;
        report.email = existingReport.email;
      }
      reports.push(report);
      previous = today;
      previousRanks = new Map(report.items.map((item) => [item.fullName, item.rank]));
    }
  }

  const published = new Map<string, DayReport>();
  for (const report of reports) {
    const current = published.get(report.date);
    if (!current || report.source === "live") published.set(report.date, report);
  }

  if (options.sendEmail && options.llmDate) {
    const report = published.get(options.llmDate);
    if (report?.source === "live") {
      report.email = await deliver(report, config.email.subjectPrefix, config.email.topInEmail, pageUrl);
    }
  }

  const rankingDir = dataPath("rankings");
  const digestDir = dataPath("digests");
  fs.mkdirSync(rankingDir, { recursive: true });
  fs.mkdirSync(digestDir, { recursive: true });
  for (const report of published.values()) {
    writeJson(path.join(rankingDir, `${report.date}.json`), report);
    fs.writeFileSync(path.join(digestDir, `${report.date}.md`), renderDigestMarkdown(report, pageUrl));
    writeJson(path.join(digestDir, `${report.date}.json`), renderDigestJson(report));
    fs.writeFileSync(path.join(digestDir, `${report.date}.html`), renderDigestHtml(report, { pageUrl }));
    const leader = report.items[0];
    console.log(
      `${report.date} ${report.source} ${report.mode}: ${report.items.length} listed, leader ${leader?.fullName ?? "none"} ${leader?.delta ?? "—"}`,
    );
  }

  const keep = new Set(published.keys());
  removeStale(rankingDir, keep);
  removeStale(digestDir, keep);

  const history: HistoryFile = { sample: {}, live: {} };
  for (const source of ["sample", "live"] as const) {
    const names = new Set(reports.filter((report) => report.source === source).flatMap((report) => report.items.map((item) => item.fullName)));
    const days = snapshots.filter((snapshot) => snapshot.source === source).sort((a, b) => a.date.localeCompare(b.date));
    for (const fullName of names) {
      const series = days.flatMap((day) => {
        const repo = day.repos.find((item) => item.fullName === fullName);
        return repo ? [{ date: day.date, stars: repo.stars }] : [];
      });
      if (series.length > 0) history[source][fullName] = series;
    }
  }
  writeJson(dataPath("history.json"), history);

  const entries = [...published.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((report) => ({
      date: report.date,
      source: report.source,
      mode: report.mode,
      previousDate: report.previousDate,
      llm: report.llm,
      email: report.email,
      itemCount: report.items.length,
    }));
  const index: IndexFile = {
    generatedAt: new Date().toISOString(),
    latest: entries.at(-1)?.date ?? null,
    dates: entries.map((entry) => entry.date),
    filters: {
      languages: config.languages,
      topics: config.topics.map((topic) => ({ id: topic.id, label: topic.label })),
    },
    entries,
  };
  writeJson(dataPath("index.json"), index);
  copyPublishedData();
}

async function main(): Promise<void> {
  const { loadDotEnv } = await import("./env");
  loadDotEnv();
  await rebuild({ sendEmail: process.env.SEND_EMAIL === "true" });
}

const entry = process.argv[1] ?? "";
if (entry.endsWith(`${path.sep}rebuild.ts`) || entry.endsWith(`${path.sep}rebuild.js`)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
