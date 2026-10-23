import { describe, expect, it, vi } from "vitest";
import { buttondownSlug, decorateDigestHtml, newsletterPublicConfig } from "@/lib/newsletter";
import { newsletterSenderFromEnv, sendButtondown } from "../scripts/newsletter";

describe("newsletter subscription", () => {
  it("stays closed until a Buttondown username is configured", () => {
    expect(newsletterPublicConfig({})).toBeNull();
    expect(newsletterPublicConfig({ NEXT_PUBLIC_BUTTONDOWN_USERNAME: "bad name" })).toBeNull();
    expect(newsletterPublicConfig({ NEXT_PUBLIC_NEWSLETTER_PROVIDER: "brevo", BUTTONDOWN_USERNAME: "pandawm" })).toBeNull();
    expect(newsletterPublicConfig({ BUTTONDOWN_USERNAME: "pandawm" })).toMatchObject({
      provider: "buttondown",
      action: "https://buttondown.com/api/emails/embed-subscribe/pandawm",
    });
  });

  it("skips sending when the API key is absent and queues HTML when it is present", async () => {
    expect(newsletterSenderFromEnv({})).toBeNull();
    expect(newsletterSenderFromEnv({ NEWSLETTER_PROVIDER: "mailchimp", BUTTONDOWN_API_KEY: "secret" })).toBeNull();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendButtondown("test-key", {
      date: "2026-10-23",
      subject: "Github之星 2026-10-23",
      html: "<p>今日建议带给客户</p>",
      text: "今日建议",
      pageUrl: "https://githubstars.pandawm.com/",
    });
    expect(result).toBe("sent");
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.buttondown.com/v1/emails");
    const headers = request.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Token test-key");
    expect(headers["X-API-Version"]).toBe("2026-04-01");
    expect(headers["X-Buttondown-Live-Dangerously"]).toBe("true");
    const body = JSON.parse(String(request.body));
    expect(body.status).toBe("about_to_send");
    expect(body.slug).toBe(buttondownSlug("2026-10-23"));
    expect(body.body.startsWith("<!-- buttondown-editor-mode: fancy -->")).toBe(true);
    expect(body.body).toContain("www.pandawm.com");
    expect(body.body).toContain("https://githubstars.pandawm.com/");
    vi.unstubAllGlobals();
  });

  it("does not treat the first-send confirmation error as a duplicate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"code":"sending_requires_confirmation"}', { status: 400 })));
    await expect(
      sendButtondown("test-key", { date: "2026-10-23", subject: "Github之星", html: "<p>hi</p>", text: "hi" }),
    ).rejects.toThrow(/sending_requires_confirmation/);
    vi.unstubAllGlobals();
  });

  it("treats a duplicate daily slug as already sent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"code":"slug_already_exists"}', { status: 400 })));
    await expect(
      sendButtondown("test-key", { date: "2026-10-23", subject: "Github之星", html: "<p>hi</p>", text: "hi" }),
    ).resolves.toBe("already-sent");
    vi.unstubAllGlobals();
  });

  it("adds the PandaWM call to action without dropping the digest", () => {
    const html = decorateDigestHtml("<html><body><p>今日建议带给客户</p></body></html>", "https://githubstars.pandawm.com/");
    expect(html).toContain("今日建议带给客户");
    expect(html).toContain("https://www.pandawm.com");
    expect(html.indexOf("今日建议带给客户")).toBeLessThan(html.indexOf("www.pandawm.com"));
  });
});
