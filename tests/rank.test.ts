import { describe, expect, it } from "vitest";
import { rankRisingStars } from "@/lib/rank";
import { makeRepo, makeSnapshot, testConfig } from "./helpers";

const config = testConfig();

describe("rankRisingStars", () => {
  it("diffs snapshots and ranks by 24h star delta, then growth", () => {
    const previous = makeSnapshot("2026-10-20", [
      makeRepo({ fullName: "acme/steady", stars: 100, topics: ["llm"] }),
      makeRepo({ fullName: "acme/rocket", stars: 10, topics: ["llm"] }),
      makeRepo({ fullName: "acme/flat", stars: 50 }),
      makeRepo({ fullName: "acme/cooled", stars: 80 }),
    ]);
    const today = makeSnapshot("2026-10-21", [
      makeRepo({ fullName: "acme/steady", stars: 110, topics: ["llm"] }),
      makeRepo({ fullName: "acme/rocket", stars: 20, topics: ["llm"] }),
      makeRepo({ fullName: "acme/flat", stars: 50 }),
      makeRepo({ fullName: "acme/cooled", stars: 70 }),
    ]);
    const result = rankRisingStars({ today, previous, previousRanks: null, config });
    expect(result.isFirstRun).toBe(false);
    expect(result.approximate24h).toBe(true);
    expect(result.phrase).toBe("过去 24 小时");
    expect(result.items.map((item) => item.fullName)).toEqual(["acme/rocket", "acme/steady"]);
    expect(result.items[0]).toMatchObject({ delta: 10, growthPercent: 100, baselineStars: 10, deltaSource: "snapshot" });
    expect(result.items[1]).toMatchObject({ delta: 10, growthPercent: 10, baselineStars: 100 });
  });

  it("treats a baseline of zero as unknown growth rather than infinity", () => {
    const previous = makeSnapshot("2026-10-20", [makeRepo({ fullName: "acme/zero", stars: 0 })]);
    const today = makeSnapshot("2026-10-21", [makeRepo({ fullName: "acme/zero", stars: 8 })]);
    const result = rankRisingStars({ today, previous, previousRanks: null, config });
    expect(result.items[0]).toMatchObject({ delta: 8, growthPercent: null, deltaKnown: true });
  });

  it("ranks a repo created inside the window by lifetime stars when it is new to the snapshot", () => {
    const previous = makeSnapshot("2026-10-20", [makeRepo({ fullName: "acme/old", stars: 100 })]);
    const today = makeSnapshot("2026-10-21", [
      makeRepo({ fullName: "acme/old", stars: 100 }),
      makeRepo({
        fullName: "acme/newborn",
        stars: 40,
        createdAt: "2026-10-21T08:00:00.000Z",
        topics: ["saas"],
      }),
      makeRepo({
        fullName: "acme/ancient-new-to-us",
        stars: 900,
        createdAt: "2020-01-01T00:00:00.000Z",
      }),
    ]);
    const result = rankRisingStars({ today, previous, previousRanks: null, config });
    expect(result.items.map((item) => item.fullName)).toEqual(["acme/newborn"]);
    expect(result.items[0]).toMatchObject({
      isNew: true,
      delta: 40,
      deltaSource: "created-window",
      growthPercent: null,
    });
  });

  it("on the first run, ranks recent repos by stars and uses trending deltas for older repos", () => {
    const today = makeSnapshot(
      "2026-10-22",
      [
        makeRepo({ fullName: "acme/brand-new", stars: 120, createdAt: "2026-10-22T01:00:00.000Z" }),
        makeRepo({ fullName: "acme/trending-old", stars: 5000, createdAt: "2022-01-01T00:00:00.000Z" }),
        makeRepo({ fullName: "acme/quiet-old", stars: 8000, createdAt: "2021-01-01T00:00:00.000Z" }),
      ],
      { hints: { trendingDailyStars: { "acme/trending-old": 300 } } },
    );
    const result = rankRisingStars({
      today,
      previous: null,
      previousRanks: null,
      config: testConfig({ topN: 3 }),
    });
    expect(result.isFirstRun).toBe(true);
    expect(result.phrase).toContain("首次采集");
    expect(result.items.map((item) => [item.fullName, item.deltaSource, item.delta])).toEqual([
      ["acme/trending-old", "trending", 300],
      ["acme/brand-new", "created-window", 120],
      ["acme/quiet-old", "unknown", null],
    ]);
    expect(result.items[2]?.deltaKnown).toBe(false);
  });

  it("does not borrow a sample snapshot as the baseline for a live day", () => {
    const sample = makeSnapshot("2026-10-21", [makeRepo({ fullName: "acme/old", stars: 10 })], { source: "sample" });
    const live = makeSnapshot("2026-10-22", [
      makeRepo({ fullName: "acme/old", stars: 999, createdAt: "2020-01-01T00:00:00.000Z" }),
    ]);
    const result = rankRisingStars({ today: live, previous: sample, previousRanks: null, config });
    expect(result.isFirstRun).toBe(true);
    expect(result.items[0]?.deltaSource).toBe("unknown");
  });

  it("limits the list to topN and records rank change", () => {
    const previous = makeSnapshot("2026-10-20", [
      makeRepo({ fullName: "acme/a", stars: 10 }),
      makeRepo({ fullName: "acme/b", stars: 10 }),
      makeRepo({ fullName: "acme/c", stars: 10 }),
    ]);
    const today = makeSnapshot("2026-10-21", [
      makeRepo({ fullName: "acme/a", stars: 11 }),
      makeRepo({ fullName: "acme/b", stars: 30 }),
      makeRepo({ fullName: "acme/c", stars: 20 }),
    ]);
    const result = rankRisingStars({
      today,
      previous,
      previousRanks: new Map([
        ["acme/a", 1],
        ["acme/b", 3],
      ]),
      config: testConfig({ topN: 2 }),
    });
    expect(result.items.map((item) => item.fullName)).toEqual(["acme/b", "acme/c"]);
    expect(result.risingCount).toBe(3);
    expect(result.items[0]?.rankChange).toBe(2);
    expect(result.items[1]?.rankChange).toBeNull();
  });

  it("drops excluded, archived, and forked repositories", () => {
    const previous = makeSnapshot("2026-10-20", [
      makeRepo({ fullName: "lists/awesome-tools", stars: 10 }),
      makeRepo({ fullName: "acme/archived", stars: 10 }),
      makeRepo({ fullName: "acme/forked", stars: 10 }),
      makeRepo({ fullName: "acme/keep", stars: 10 }),
    ]);
    const today = makeSnapshot("2026-10-21", [
      makeRepo({ fullName: "lists/awesome-tools", stars: 500 }),
      makeRepo({ fullName: "acme/archived", stars: 500, archived: true }),
      makeRepo({ fullName: "acme/forked", stars: 500, isFork: true }),
      makeRepo({ fullName: "acme/keep", stars: 12 }),
    ]);
    const result = rankRisingStars({ today, previous, previousRanks: null, config });
    expect(result.items.map((item) => item.fullName)).toEqual(["acme/keep"]);
  });

  it("labels a multi-day gap instead of calling it 24 hours", () => {
    const previous = makeSnapshot("2026-10-18", [makeRepo({ fullName: "acme/gap", stars: 10 })]);
    const today = makeSnapshot("2026-10-21", [makeRepo({ fullName: "acme/gap", stars: 15 })]);
    const result = rankRisingStars({ today, previous, previousRanks: null, config });
    expect(result.approximate24h).toBe(false);
    expect(result.phrase).toBe("自 2026-10-18 以来");
    expect(result.items[0]?.delta).toBe(5);
  });
});
