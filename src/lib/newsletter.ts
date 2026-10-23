export const NEWSLETTER_INTERESTS = [
  { id: "ai", label: "AI" },
  { id: "saas", label: "SaaS" },
  { id: "games", label: "游戏" },
  { id: "commerce", label: "电商" },
] as const;

const USERNAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export type NewsletterProviderId = "buttondown";

export type NewsletterPublicConfig = {
  provider: NewsletterProviderId;
  buttondownUsername: string;
  action: string;
};

export function normalizeButtondownUsername(value: string | undefined): string | null {
  const username = value?.trim() ?? "";
  return USERNAME.test(username) ? username : null;
}

export function newsletterPublicConfig(env: { [key: string]: string | undefined }): NewsletterPublicConfig | null {
  const provider = (env.NEXT_PUBLIC_NEWSLETTER_PROVIDER || env.NEWSLETTER_PROVIDER || "buttondown").trim();
  if (provider !== "buttondown") return null;
  const username = normalizeButtondownUsername(env.NEXT_PUBLIC_BUTTONDOWN_USERNAME || env.BUTTONDOWN_USERNAME);
  if (!username) return null;
  return {
    provider,
    buttondownUsername: username,
    action: `https://buttondown.com/api/emails/embed-subscribe/${username}`,
  };
}

export function decorateDigestHtml(html: string, pageUrl?: string): string {
  const board = pageUrl
    ? `<p style="margin:8px 0 0;"><a href="${escapeAttribute(pageUrl)}" style="color:#1268e5;">打开 Github之星</a></p>`
    : "";
  const cta = `<div style="margin-top:22px;padding:16px 18px;border:1px solid #d5deeb;border-radius:12px;background:#f7f9fc;">
  <p style="margin:0;font-weight:650;">PandaWM 熊猫出海</p>
  <p style="margin:8px 0 0;line-height:1.55;">名单里如果有想拿去跟客户谈的项目，或要做海外获客、GEO 和广告投放，来官网联系。</p>
  <p style="margin:8px 0 0;"><a href="https://www.pandawm.com" style="color:#1268e5;">www.pandawm.com</a></p>
  ${board}
</div>`;
  if (html.includes("</body>")) return html.replace("</body>", `${cta}</body>`);
  return `${html}\n${cta}`;
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

export function buttondownEmailBody(html: string): string {
  return `<!-- buttondown-editor-mode: fancy -->\n${html}`;
}

export function buttondownSlug(date: string): string {
  return `githubstars-${date}`;
}
