import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseConfig } from "@/lib/config";
import { normalizeBasePath, resolvePagesHost } from "@/lib/pages-host";
import { dataUrl } from "@/lib/site";

describe("pages host", () => {
  it("serves the checked-in site at the custom domain root", () => {
    const config = parseConfig(JSON.parse(readFileSync("config.json", "utf8")));
    expect(config.site).toEqual({
      domain: "githubstars.pandawm.com",
      basePath: "",
      url: "https://githubstars.pandawm.com/",
    });
  });

  it("lets env override the domain, prefix, and public url", () => {
    expect(
      resolvePagesHost(
        { domain: "githubstars.pandawm.com", basePath: "" },
        {
          PAGES_DOMAIN: "preview.example.com",
          BASE_PATH: "/rising-stars-daily/",
          PAGES_URL: "https://preview.example.com/rising-stars-daily",
        },
      ),
    ).toEqual({
      domain: "preview.example.com",
      basePath: "/rising-stars-daily",
      url: "https://preview.example.com/rising-stars-daily/",
    });
  });

  it("treats a blank env value as unset and keeps root-relative data urls", () => {
    expect(resolvePagesHost({ domain: "githubstars.pandawm.com", basePath: "" }, { BASE_PATH: "  " }).basePath).toBe("");
    expect(normalizeBasePath(undefined)).toBe("");
    expect(dataUrl("index.json")).toBe("/data/index.json");
  });

  it("rejects a domain that is not a hostname", () => {
    expect(() => resolvePagesHost({ domain: "not a host" })).toThrow(/hostname/);
    expect(() => parseConfig({ topN: 10, newRepoWindowHours: 48, topics: [{ id: "ai", label: "AI", githubTopics: [], keywords: [] }], site: "githubstars.pandawm.com" })).toThrow(/site/);
  });
});
