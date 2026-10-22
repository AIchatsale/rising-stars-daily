import path from "node:path";
import type { RepoSnapshot, Snapshot } from "../src/lib/types";
import { rebuild } from "./rebuild";
import { SAMPLE_DATES, sampleCatalog } from "./sample-catalog";
import { repoRoot, writeJson } from "./paths";

function snapshotFor(date: (typeof SAMPLE_DATES)[number]): Snapshot {
  const repos: RepoSnapshot[] = sampleCatalog.flatMap((entry) => {
    const stars = entry.stars[date];
    if (stars == null) return [];
    const [owner, name] = entry.fullName.split("/");
    const repo: RepoSnapshot = {
      id: entry.id,
      fullName: entry.fullName,
      name: name ?? entry.fullName,
      owner: owner ?? "owner",
      description: entry.description,
      language: entry.language,
      topics: entry.topics,
      stars,
      forks: entry.forks,
      openIssues: entry.openIssues,
      createdAt: entry.createdAt,
      pushedAt: `${date}T18:00:00.000Z`,
      url: `https://github.com/${entry.fullName}`,
      license: entry.license,
      archived: false,
      isFork: false,
      demo: entry.demo,
    };
    return [repo];
  });
  repos.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return {
    date,
    generatedAt: `${date}T22:00:00.000Z`,
    source: "sample",
    notice: "示例快照。星标为演示序列，不是这些仓库的真实历史。",
    repos,
  };
}

async function main(): Promise<void> {
  for (const date of SAMPLE_DATES) {
    writeJson(path.join(repoRoot, "data/snapshots/sample", `${date}.json`), snapshotFor(date));
  }
  await rebuild({ sendEmail: false });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
