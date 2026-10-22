import { describe, expect, it } from "vitest";
import { buildDayReport } from "@/lib/report";
import { recommendPicks } from "@/lib/recommend";
import { makeRepo, makeSnapshot, testConfig } from "./helpers";

describe("recommendations and topic leaders", () => {
  it("prefers a product with a smaller delta over an awesome-list that the ranker already dropped", () => {
    const config = testConfig({ topN: 5, recommendCount: 1 });
    const previous = makeSnapshot("2026-10-20", [
      makeRepo({ fullName: "lists/awesome-ai", stars: 100, description: "awesome list of papers" }),
      makeRepo({ fullName: "acme/billing", stars: 200, topics: ["saas"], description: "billing platform for teams" }),
    ]);
    const today = makeSnapshot("2026-10-21", [
      makeRepo({ fullName: "lists/awesome-ai", stars: 900, description: "awesome list of papers" }),
      makeRepo({
        fullName: "acme/billing",
        stars: 260,
        topics: ["saas"],
        description: "billing platform for teams",
      }),
    ]);
    const report = buildDayReport({ today, previous, previousRanks: null, config });
    expect(report.items.some((item) => item.fullName === "lists/awesome-ai")).toBe(false);
    expect(report.recommended[0]?.fullName).toBe("acme/billing");
    expect(report.topicLeaders.find((leader) => leader.topicId === "saas")?.fullName).toBe("acme/billing");
  });

  it("penalizes a demo repository when choosing picks", () => {
    const config = testConfig({ recommendCount: 1, topN: 5 });
    const previous = makeSnapshot("2026-10-20", [
      makeRepo({ fullName: "sample-labs/ledgerline", stars: 100, demo: true, topics: ["llm"] }),
      makeRepo({ fullName: "acme/desk", stars: 100, topics: ["saas"], description: "CRM for agencies" }),
    ]);
    const today = makeSnapshot("2026-10-21", [
      makeRepo({ fullName: "sample-labs/ledgerline", stars: 400, demo: true, topics: ["llm"] }),
      makeRepo({ fullName: "acme/desk", stars: 180, topics: ["saas"], description: "CRM for agencies" }),
    ]);
    const report = buildDayReport({ today, previous, previousRanks: null, config });
    expect(report.items[0]?.fullName).toBe("sample-labs/ledgerline");
    expect(recommendPicks(report.items, config)[0]?.fullName).toBe("acme/desk");
  });
});
