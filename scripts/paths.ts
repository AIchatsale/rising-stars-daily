import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function writeJson(file: string, data: unknown, space: number | null = 2): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = space == null ? JSON.stringify(data) : JSON.stringify(data, null, space);
  fs.writeFileSync(file, space == null ? body : `${body}\n`);
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}
