import fs from "node:fs";
import path from "node:path";
import { resolvePagesHost } from "../src/lib/pages-host";
import { readJson, repoRoot } from "./paths";

const raw = readJson<{ site?: unknown }>(path.join(repoRoot, "config.json"));
const pages = resolvePagesHost(raw.site, process.env);
const body = [`base_path=${pages.basePath}`, `pages_url=${pages.url}`, `pages_domain=${pages.domain}`, ""].join("\n");

console.error(`Pages host ${pages.url} (domain ${pages.domain}, base path ${pages.basePath || "/"})`);
const output = process.env.GITHUB_OUTPUT;
if (output) fs.appendFileSync(output, body);
else process.stdout.write(body);
