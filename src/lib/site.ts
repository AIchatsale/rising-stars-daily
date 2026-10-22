export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function dataUrl(file: string): string {
  const prefix = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  return `${prefix}/data/${file}`;
}
