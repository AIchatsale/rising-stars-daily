"use client";

import { useState } from "react";
import { NEWSLETTER_INTERESTS, newsletterPublicConfig } from "@/lib/newsletter";

const config = newsletterPublicConfig({
  NEXT_PUBLIC_NEWSLETTER_PROVIDER: process.env.NEXT_PUBLIC_NEWSLETTER_PROVIDER,
  NEXT_PUBLIC_BUTTONDOWN_USERNAME: process.env.NEXT_PUBLIC_BUTTONDOWN_USERNAME,
});

export function SubscribeForm({ variant = "panel" }: { variant?: "panel" | "inline" }) {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "muted"; text: string } | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      event.preventDefault();
      setNotice({ tone: "error", text: "请填写有效的邮箱。" });
      return;
    }
    if (!config) {
      event.preventDefault();
      setNotice({ tone: "muted", text: "每日邮件还没开通，这个表单不会收集地址。想先收一版，去官网联系 PandaWM。" });
      return;
    }
    const emailInput = event.currentTarget.elements.namedItem("email");
    if (emailInput instanceof HTMLInputElement) emailInput.value = address;
    setEmail(address);
    setNotice({ tone: "muted", text: "确认页会在新窗口打开。点开确认信之后才算订阅成功。" });
  }

  const compact = variant === "inline";

  return (
    <form
      noValidate
      action={config?.action}
      method={config ? "post" : undefined}
      target={config ? "_blank" : undefined}
      rel={config ? "noopener" : undefined}
      onSubmit={onSubmit}
      className={compact ? "mt-6 border-t border-border/80 pt-5" : "surface p-4 md:p-5"}
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold tracking-tight">每天把 Github之星寄到邮箱</p>
        <p className="text-xs leading-5 text-muted-foreground">
          只发当天的增速榜和三条客户建议，并附上回到看板的链接。公司名和方向可以不填。
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs text-muted-foreground">
          邮箱
          <input
            required
            type="email"
            name={config ? "email" : undefined}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            aria-label="邮箱"
            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="min-w-0 flex-1 text-xs text-muted-foreground">
          公司（可选）
          <input
            type="text"
            name={config ? "metadata__company" : undefined}
            maxLength={80}
            placeholder="公司或团队"
            autoComplete="organization"
            aria-label="公司"
            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-9 w-full shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground sm:w-auto"
        >
          订阅日报
        </button>
      </div>
      <fieldset className="mt-3">
        <legend className="text-xs text-muted-foreground">感兴趣的方向（可选）</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {NEWSLETTER_INTERESTS.map((interest) => (
            <label key={interest.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
              <input type="checkbox" name={config ? "metadata__interests" : undefined} value={interest.id} />
              {interest.label}
            </label>
          ))}
        </div>
      </fieldset>
      {config ? <input type="hidden" name="embed" value="1" /> : null}
      {!config ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          每日邮件还没开通。可以先看看这张卡片，提交不会把地址发出去。
        </p>
      ) : null}
      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        邮箱只用于发送这份日报。提交后由 Buttondown 发确认信，点开链接才算订阅，之后每封邮件都能退订。未开通时，这里不会把地址发出去。
      </p>
      {notice ? (
        <p role="status" className={`mt-2 text-xs leading-5 ${notice.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {notice.text}
        </p>
      ) : null}
    </form>
  );
}
