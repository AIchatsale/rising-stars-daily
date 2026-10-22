import { describe, expect, it } from "vitest";
import { includesKeyword, matchTopics } from "@/lib/topics";
import { buildSearchQueries } from "@/lib/queries";
import { parseConfig } from "@/lib/config";
import { makeRepo, testConfig } from "./helpers";

describe("topics and queries", () => {
  it("matches exact GitHub topics and avoids short keywords inside other words", () => {
    const config = testConfig();
    expect(includesKeyword("send email reports", "ai")).toBe(false);
    expect(includesKeyword("an ai workflow", "ai")).toBe(true);
    const matched = matchTopics(
      makeRepo({ fullName: "acme/mail", stars: 1, description: "send email reports", topics: ["llm"] }),
      config,
    );
    expect(matched).toEqual(["llm"]);
    const byKeyword = matchTopics(
      makeRepo({ fullName: "acme/brain", stars: 1, description: "neural rendering", topics: [] }),
      config,
    );
    expect(byKeyword).toEqual(["ai"]);
  });

  it("builds one query per tracked topic and respects the query budget", () => {
    const config = testConfig({
      maxSearchQueries: 4,
      keywordQueryLimit: 2,
      languageQueryLimit: 2,
      discover: { recentlyCreated: true, recentlyPushed: true, githubTrending: true },
    });
    const queries = buildSearchQueries(config, "2026-10-22");
    expect(queries).toHaveLength(4);
    expect(queries[0]).toContain("created:>2026-10-19");
    expect(queries.some((query) => query.startsWith("topic:ai"))).toBe(true);
    expect(queries.some((query) => query.startsWith("topic:llm"))).toBe(true);
  });

  it("rejects a config without topics", () => {
    expect(() => parseConfig({ topN: 10, newRepoWindowHours: 48, topics: [] })).toThrow(/topics/);
  });
});
