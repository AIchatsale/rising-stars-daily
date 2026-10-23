import { describe, expect, it } from "vitest";
import { heuristicClassification, llmSettingsFromEnv, parseClassificationResponse } from "@/lib/classify";
import { renderDigestHtml, renderDigestJson, renderDigestMarkdown } from "@/lib/digest";
import { smtpSettingsFromEnv } from "../scripts/email";
import { parseTrendingHtml } from "../scripts/trending";
import { buildDayReport } from "@/lib/report";
import { makeRepo, makeSnapshot, testConfig } from "./helpers";

describe("classification, digest, and optional delivery", () => {
  it("classifies a handbook as documentation with a heuristic opportunity", () => {
    const result = heuristicClassification(
      {
        fullName: "acme/handbook",
        name: "handbook",
        description: "A tutorial handbook",
        language: "Python",
        topics: ["llm"],
        stars: 100,
        delta: 25,
        growthPercent: 10,
        deltaKnown: true,
        trackedTopics: ["llm"],
      },
      ["应用", "文档", "工具"],
    );
    expect(result.category).toBe("文档");
    expect(result.source).toBe("heuristic");
    expect(result.opportunity).toContain("25");
  });

  it("parses a fenced LLM payload and drops invalid rows", () => {
    const parsed = parseClassificationResponse(
      '```json\n{"items":[{"fullName":"acme/desk","category":"不存在","summary":"客户档案","opportunity":"值得介绍","tags":["crm","ai"]},{"fullName":"broken"}]}\n```',
      ["应用", "工具"],
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      fullName: "acme/desk",
      category: "工具",
      summary: "客户档案",
      source: "llm",
    });
  });

  it("skips the model and SMTP when secrets are absent", () => {
    expect(llmSettingsFromEnv({}, { baseUrl: "https://example.test/v1", model: "demo" })).toBeNull();
    expect(
      llmSettingsFromEnv(
        { LLM_API_KEY: "test-key", LLM_MODEL: "local" },
        { baseUrl: "https://example.test/v1", model: "demo" },
      ),
    ).toMatchObject({ apiKey: "test-key", model: "local", baseUrl: "https://example.test/v1" });
    expect(smtpSettingsFromEnv({})).toBeNull();
    expect(
      smtpSettingsFromEnv({
        SMTP_HOST: "smtp.example.com",
        SMTP_FROM: "a@example.com",
        EMAIL_TO: "b@example.com",
      }),
    ).toMatchObject({
      host: "smtp.example.com",
      port: 587,
    });
  });

  it("renders an escapable markdown and HTML digest", () => {
    const config = testConfig({ topN: 5, recommendCount: 1 });
    const previous = makeSnapshot("2026-10-20", [makeRepo({ fullName: "acme/desk", stars: 10, topics: ["saas"] })]);
    const today = makeSnapshot("2026-10-21", [
      makeRepo({
        fullName: "acme/desk",
        stars: 16,
        topics: ["saas"],
        description: '<script>alert("x")</script>',
      }),
    ]);
    const report = buildDayReport({ today, previous, previousRanks: null, config });
    const markdown = renderDigestMarkdown(report, "https://example.test/rising/");
    const html = renderDigestHtml(report);
    const json = renderDigestJson(report);
    expect(markdown).toContain("# Github之星");
    expect(html).toContain("<title>Github之星");
    expect(markdown).toContain("## 今日建议带给客户");
    expect(markdown).toContain("acme/desk");
    expect(markdown).toContain("https://example.test/rising/");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(json.items[0]?.delta).toBe(6);
    expect(json.recommended[0]?.fullName).toBe("acme/desk");
  });

  it("reads repository names and today's stars from trending markup", () => {
    const html = `
      <article class="Box-row">
        <h2><a href="/login?return_to=%2Facme%2Fdesk">login</a></h2>
      </article>
      <article class="Box-row">
        <div><a href="/login?return_to=%2Facme%2Fdesk">star</a></div>
        <h2 class="h3"><a href="/acme/desk">acme / desk</a></h2>
        <span>1,949 stars today</span>
      </article>`;
    expect(parseTrendingHtml(html)).toEqual([{ fullName: "acme/desk", starsToday: 1949 }]);
  });
});
