import { buttondownEmailBody, buttondownSlug, decorateDigestHtml } from "../src/lib/newsletter";

export type NewsletterMessage = {
  date: string;
  subject: string;
  html: string;
  text: string;
  pageUrl?: string;
};

export type NewsletterSender = {
  provider: "buttondown";
  send: (message: NewsletterMessage) => Promise<"sent" | "already-sent">;
};

export function newsletterSenderFromEnv(env: { [key: string]: string | undefined }): NewsletterSender | null {
  const provider = (env.NEWSLETTER_PROVIDER || "buttondown").trim();
  if (provider !== "buttondown") {
    console.warn(`NEWSLETTER_PROVIDER=${provider} is not implemented; subscriber send skipped`);
    return null;
  }
  const apiKey = env.BUTTONDOWN_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    provider: "buttondown",
    send: (message) => sendButtondown(apiKey, message),
  };
}

export async function sendButtondown(apiKey: string, message: NewsletterMessage): Promise<"sent" | "already-sent"> {
  const response = await fetch("https://api.buttondown.com/v1/emails", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
      "X-API-Version": "2026-04-01",
      // Current API returns sending_requires_confirmation until a key has sent once.
      "X-Buttondown-Live-Dangerously": "true",
    },
    body: JSON.stringify({
      subject: message.subject,
      body: buttondownEmailBody(decorateDigestHtml(message.html, message.pageUrl)),
      status: "about_to_send",
      slug: buttondownSlug(message.date),
    }),
  });
  if (response.ok) return "sent";
  const detail = await response.text();
  if ((response.status === 400 || response.status === 409) && /slug/i.test(detail)) return "already-sent";
  throw new Error(`Buttondown ${response.status}: ${detail.slice(0, 300)}`);
}
