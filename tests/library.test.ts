import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  applyCommercialNotes,
  commercialNote,
  decideLibraryMode,
  emptyHistory,
  exportRow,
  filterLibrary,
  inTier,
  librarySearchQuery,
  licenseKind,
  matchLibraryCategories,
  parseCommercialNotes,
  recordStars,
  selectLlmCandidates,
  sortLibrary,
  splitWindow,
  starGrowth,
  starSlices,
  tierCounts,
  tierOf,
  toCsv,
  toLibraryRepo,
  type LibraryRepo,
} from "@/lib/library";
import { siteHref } from "@/lib/site";

function repo(partial: Partial<LibraryRepo> & Pick<LibraryRepo, "fullName" | "stars">): LibraryRepo {
  return {
    fullName: partial.fullName,
    stars: partial.stars,
    forks: partial.forks ?? 10,
    createdAt: partial.createdAt ?? "2020-01-01T00:00:00Z",
    pushedAt: partial.pushedAt ?? "2026-10-01T00:00:00Z",
    ownerType: partial.ownerType ?? "org",
    description: partial.description,
    language: partial.language,
    topics: partial.topics,
    license: partial.license,
    homepage: partial.homepage,
    note: partial.note,
    noteSource: partial.noteSource,
  };
}

describe("high-star library", () => {
  it("places repositories into exclusive star tiers and counts them", () => {
    expect(tierOf(4999)).toBeNull();
    expect(tierOf(5000)).toBe("5k");
    expect(tierOf(9999)).toBe("5k");
    expect(tierOf(10000)).toBe("10k");
    expect(tierOf(20000)).toBe("20k");
    expect(tierOf(40000)).toBe("40k");
    expect(inTier(12000, "10k")).toBe(true);
    expect(inTier(12000, "5k")).toBe(false);
    const counts = tierCounts([{ stars: 5000 }, { stars: 15000 }, { stars: 15000 }, { stars: 80000 }]);
    expect(counts).toEqual({ "5k": 1, "10k": 2, "20k": 0, "40k": 1 });
  });

  it("covers every star count from 5000 upward without gaps or overlaps", () => {
    const slices = starSlices(5000);
    expect(slices[0]).toEqual({ min: 5000, max: 5249 });
    expect(slices.at(-1)).toEqual({ min: 100000, max: null });
    for (let index = 0; index < slices.length - 1; index += 1) {
      expect(slices[index + 1]?.min).toBe((slices[index]?.max ?? 0) + 1);
    }
    expect(librarySearchQuery({ min: 5000, max: 5249 })).toBe("stars:5000..5249 fork:false archived:false");
    expect(librarySearchQuery({ min: 40000, max: null }, { from: "2020-01-01", to: "2020-06-01" })).toBe(
      "stars:>=40000 fork:false archived:false created:2020-01-01..2020-06-01",
    );
  });

  it("splits a created-date window into two contiguous halves", () => {
    expect(splitWindow({ from: "2020-01-01", to: "2020-01-01" })).toBeNull();
    const [left, right] = splitWindow({ from: "2020-01-01", to: "2020-01-10" }) ?? [];
    expect(left).toEqual({ from: "2020-01-01", to: "2020-01-05" });
    expect(right).toEqual({ from: "2020-01-06", to: "2020-01-10" });
  });

  it("classifies licenses and commercial categories", () => {
    expect(licenseKind("MIT")).toBe("permissive");
    expect(licenseKind("Apache-2.0")).toBe("permissive");
    expect(licenseKind("GPL-3.0-only")).toBe("copyleft");
    expect(licenseKind("AGPL-3.0")).toBe("copyleft");
    expect(licenseKind("LGPL-2.1-only")).toBe("weak-copyleft");
    expect(licenseKind("BUSL-1.1")).toBe("restricted");
    expect(licenseKind(null)).toBe("unknown");
    expect(matchLibraryCategories({ fullName: "acme/shop", description: "headless ecommerce checkout", topics: [] }).map((item) => item.id)).toEqual(["commerce"]);
    expect(matchLibraryCategories({ fullName: "acme/brain", topics: ["llm"], description: "mail client" }).map((item) => item.id)).toContain("llm");
    expect(matchLibraryCategories({ fullName: "acme/mail", description: "send email reports", topics: [] })).toEqual([]);
  });

  it("writes a Chinese commercial note and keeps an LLM note when present", () => {
    const sample = repo({
      fullName: "acme/desk",
      stars: 8200,
      license: "MIT",
      homepage: "https://desk.example",
      ownerType: "org",
      pushedAt: "2026-10-20T00:00:00Z",
      topics: ["saas"],
      description: "CRM for agencies",
    });
    const note = commercialNote(sample, "2026-10-23", 90, 120);
    expect(note).toContain("acme/desk");
    expect(note).toContain("宽松许可证");
    expect(note).toContain("独立主页");
    expect(note).toContain("组织账号");
    expect(note).toContain("SaaS");
    expect(note).toContain("120");
    const kept = applyCommercialNotes([sample], [{ fullName: "acme/desk", note: "适合作为客户演示的 CRM 底座。" }]);
    expect(kept[0]?.noteSource).toBe("llm");
    expect(selectLlmCandidates(kept, 5)).toEqual([]);
    expect(parseCommercialNotes('```json\n{"items":[{"fullName":"acme/desk","note":"可以评估集成。"},{"fullName":"broken"}]}\n```')).toEqual([
      { fullName: "acme/desk", note: "可以评估集成。" },
    ]);
  });

  it("drops forks and records 7-day and 30-day growth only when history exists", () => {
    expect(toLibraryRepo({ full_name: "acme/fork", fork: true, created_at: "2020-01-01T00:00:00Z", pushed_at: "2026-01-01T00:00:00Z", stargazers_count: 9000 })).toBeNull();
    const mapped = toLibraryRepo({
      full_name: "acme/lib",
      owner: { login: "acme", type: "Organization" },
      description: "A library",
      stargazers_count: 9100,
      forks_count: 80,
      license: { spdx_id: "Apache-2.0" },
      created_at: "2019-05-01T00:00:00Z",
      pushed_at: "2026-10-22T12:00:00Z",
      homepage: "https://acme.example",
      topics: ["sdk"],
    });
    expect(mapped?.ownerType).toBe("org");
    expect(mapped?.homepage).toBe("https://acme.example");
    const history = emptyHistory();
    recordStars(history, "acme/lib", "2026-09-01", 8000);
    recordStars(history, "acme/lib", "2026-10-16", 8900);
    recordStars(history, "acme/lib", "2026-10-23", 9100);
    expect(starGrowth(history.series["acme/lib"], "2026-10-23", 7, 9100)).toBe(200);
    expect(starGrowth(history.series["acme/lib"], "2026-10-23", 30, 9100)).toBe(1100);
    expect(starGrowth(history.series["acme/other"], "2026-10-23", 7, 9100)).toBeNull();
    expect(decideLibraryMode({ hasCatalog: false, forced: false, weekday: 3, fullRefreshWeekday: 0 })).toBe("full");
    expect(decideLibraryMode({ hasCatalog: true, forced: false, weekday: 3, fullRefreshWeekday: 0 })).toBe("incremental");
    expect(decideLibraryMode({ hasCatalog: true, forced: false, weekday: 0, fullRefreshWeekday: 0 })).toBe("full");
    expect(decideLibraryMode({ hasCatalog: true, forced: true, weekday: 3, fullRefreshWeekday: 0 })).toBe("full");
  });

  it("filters, sorts, and exports the visible list", () => {
    const asOf = "2026-10-23";
    const rows = [
      repo({ fullName: "acme/old", stars: 6000, language: "Go", license: "GPL-3.0", pushedAt: "2024-01-01T00:00:00Z", description: "legacy engine" }),
      repo({ fullName: "acme/new", stars: 22000, language: "TypeScript", license: "MIT", homepage: "https://new.example", pushedAt: "2026-10-20T00:00:00Z", topics: ["llm"], description: "agent runtime" }),
    ];
    const filtered = filterLibrary(rows, {
      tier: "20k",
      language: "TypeScript",
      category: "llm",
      license: "permissive",
      activeOnly: true,
      query: "agent",
      asOf,
      activeWithinDays: 90,
      minStars: 5000,
    });
    expect(filtered.map((item) => item.fullName)).toEqual(["acme/new"]);
    const history = emptyHistory();
    recordStars(history, "acme/new", addDays(asOf, -8), 21000);
    const sorted = sortLibrary(rows, "growth7", history, asOf);
    expect(sorted[0]?.fullName).toBe("acme/new");
    const csv = toCsv([exportRow(rows[1]!, history, asOf, 90)]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("acme/new");
    expect(csv).toContain("https://github.com/acme/new");
    expect(siteHref("/library/")).toBe("/library/");
  });
});
