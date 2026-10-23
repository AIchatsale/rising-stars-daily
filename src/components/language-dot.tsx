const COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f0c419",
  Python: "#3776ab",
  Go: "#00add8",
  Rust: "#e43717",
  Java: "#e76f00",
  "C++": "#00599c",
  "C#": "#68217a",
  C: "#5c6bc0",
  Ruby: "#cc342d",
  PHP: "#777bb4",
  Swift: "#f05138",
  Kotlin: "#7f52ff",
  Dart: "#0175c2",
  Shell: "#4eaa25",
};

export function LanguageDot({ language }: { language: string | null | undefined }) {
  if (!language) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-2 rounded-full" style={{ background: COLORS[language] ?? "#8b97ab" }} aria-hidden="true" />
      {language}
    </span>
  );
}
