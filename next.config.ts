import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { resolvePagesHost } from "./src/lib/pages-host";

const root = process.cwd();
const raw = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8")) as { site?: unknown };
const pages = resolvePagesHost(raw.site, process.env);

const publicDir = path.join(root, "public");
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "CNAME"), `${pages.domain}\n`);

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: pages.basePath,
    NEXT_PUBLIC_PAGES_URL: pages.url,
    NEXT_PUBLIC_NEWSLETTER_PROVIDER: process.env.NEWSLETTER_PROVIDER || process.env.NEXT_PUBLIC_NEWSLETTER_PROVIDER || "buttondown",
    NEXT_PUBLIC_BUTTONDOWN_USERNAME: process.env.BUTTONDOWN_USERNAME || process.env.NEXT_PUBLIC_BUTTONDOWN_USERNAME || "",
  },
  ...(pages.basePath ? { basePath: pages.basePath, assetPrefix: pages.basePath } : {}),
};

export default nextConfig;
