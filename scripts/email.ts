import nodemailer from "nodemailer";

export type SmtpSettings = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
  to: string;
};

export function smtpSettingsFromEnv(env: { [key: string]: string | undefined }): SmtpSettings | null {
  const host = env.SMTP_HOST?.trim();
  const from = env.SMTP_FROM?.trim();
  const to = env.EMAIL_TO?.trim();
  if (!host || !from || !to) return null;
  const port = Number(env.SMTP_PORT || "587");
  if (!Number.isFinite(port) || port <= 0) return null;
  const user = env.SMTP_USER?.trim();
  return {
    host,
    port,
    from,
    to,
    user: user || undefined,
    password: user ? env.SMTP_PASSWORD : undefined,
  };
}

export async function sendHtmlEmail(
  settings: SmtpSettings,
  message: { subject: string; html: string; text: string },
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: settings.user ? { user: settings.user, pass: settings.password ?? "" } : undefined,
  });
  await transporter.sendMail({
    from: settings.from,
    to: settings.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
