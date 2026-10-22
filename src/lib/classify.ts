import type { AppConfig, Classification, RankedRepo } from "./types";

export type HeuristicInput = {
  fullName: string;
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  delta: number | null;
  growthPercent: number | null;
  deltaKnown: boolean;
  trackedTopics: string[];
};

const CATEGORY_RULES: { category: string; pattern: RegExp }[] = [
  { category: "文档", pattern: /awesome|handbook|tutorial|cheatsheet|documentation|\bdocs\b|指南|教程/i },
  { category: "示例", pattern: /\bexamples?\b|\bdemos?\b|\bsamples?\b|示例/i },
  { category: "插件", pattern: /plugin|extension|插件/i },
  { category: "模板", pattern: /template|starter|boilerplate|scaffold|模板/i },
  { category: "集成", pattern: /integration|wrapper|\bsdk\b|集成/i },
  { category: "框架", pattern: /framework|框架/i },
  { category: "库", pattern: /\blibrary\b|\blib\b|库/i },
  { category: "研究", pattern: /paper|research|论文|研究/i },
  { category: "应用", pattern: /\bapp\b|platform|dashboard|crm|应用|平台/i },
  { category: "工具", pattern: /\bcli\b|\btool\b|engine|工具/i },
];

function allowedCategory(category: string, categories: string[]): string {
  if (categories.includes(category)) return category;
  if (categories.includes("工具")) return "工具";
  return categories[0] ?? category;
}

export function inferCategory(repo: HeuristicInput, categories: string[]): string {
  const text = `${repo.fullName} ${repo.description ?? ""} ${repo.topics.join(" ")}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return allowedCategory(rule.category, categories);
  }
  return allowedCategory("工具", categories);
}

export function heuristicClassification(repo: HeuristicInput, categories: string[]): Classification {
  const category = inferCategory(repo, categories);
  const topicText = repo.trackedTopics.length ? `涉及 ${repo.trackedTopics.join("、")}。` : "";
  const summary = repo.description
    ? `${repo.name}：${repo.description}`
    : `${repo.fullName} 没有简介。当前归类为${category}。`;
  const deltaText =
    repo.deltaKnown && repo.delta != null
      ? `星标增量为 ${repo.delta}${repo.growthPercent != null ? `（${repo.growthPercent.toFixed(1)}%）` : ""}。`
      : "今天还没有可对照的星标增量。";
  const opportunity = `${deltaText}${topicText}若客户正在找可落地的${category}，可以把 ${repo.fullName} 放进候选，先核对协议、最近提交和维护者是否还在回应问题。`;
  const tags = [...repo.trackedTopics];
  if (repo.language) tags.push(repo.language);
  return {
    fullName: repo.fullName,
    category,
    summary: summary.slice(0, 180),
    opportunity: opportunity.slice(0, 240),
    tags: tags.slice(0, 4),
    source: "heuristic",
  };
}

export type LlmSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type EnvMap = Record<string, string | undefined>;

export function llmSettingsFromEnv(
  env: EnvMap,
  defaults: { baseUrl: string; model: string },
): LlmSettings | null {
  const apiKey = env.LLM_API_KEY?.trim() || env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (env.LLM_BASE_URL?.trim() || defaults.baseUrl).replace(/\/$/, ""),
    model: env.LLM_MODEL?.trim() || defaults.model,
  };
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) return String((part as { text: unknown }).text ?? "");
      return "";
    })
    .join("");
}

export function parseClassificationResponse(text: string, categories: string[]): Classification[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? text;
  const startObject = source.indexOf("{");
  const startArray = source.indexOf("[");
  let jsonText = source;
  if (startObject >= 0 && (startArray < 0 || startObject < startArray)) {
    jsonText = source.slice(startObject, source.lastIndexOf("}") + 1);
  } else if (startArray >= 0) {
    jsonText = source.slice(startArray, source.lastIndexOf("]") + 1);
  }
  const parsed = JSON.parse(jsonText) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : [];
  const results: Classification[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (typeof record.fullName !== "string" || !record.fullName.includes("/")) continue;
    const category = typeof record.category === "string" ? record.category.trim() : "";
    const summary = typeof record.summary === "string" ? record.summary.trim() : "";
    const opportunity = typeof record.opportunity === "string" ? record.opportunity.trim() : "";
    const tags = Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).slice(0, 4)
      : [];
    results.push({
      fullName: record.fullName.trim(),
      category: allowedCategory(category || "工具", categories),
      summary: summary.slice(0, 180),
      opportunity: opportunity.slice(0, 240),
      tags,
      source: "llm",
    });
  }
  return results;
}

const SYSTEM_PROMPT = [
  "你是开源项目研究员，服务对象是每天要向客户推荐项目的业务团队。",
  "只输出 JSON 对象，不要使用 Markdown。",
  '格式：{"items":[{"fullName":"","category":"","summary":"","opportunity":"","tags":[""]}]}',
  "category 必须取自用户给出的列表。",
  "summary 用一句简体中文说明项目做什么。",
  "opportunity 用一句简体中文说明为什么今天值得介绍给客户。结合星标增量，不要夸张，不要承诺商业收益。",
  "tags 给 2 到 4 个短词。信息不足时给出保守判断。",
].join("\n");

export async function requestClassifications(
  repos: HeuristicInput[],
  settings: LlmSettings,
  categories: string[],
): Promise<Classification[]> {
  const body = {
    model: settings.model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          categories,
          repos: repos.map((repo) => ({
            fullName: repo.fullName,
            description: (repo.description ?? "").slice(0, 280),
            language: repo.language,
            topics: repo.topics.slice(0, 12),
            stars: repo.stars,
            delta: repo.delta,
            growthPercent: repo.growthPercent == null ? null : Number(repo.growthPercent.toFixed(1)),
          })),
        }),
      },
    ],
  };
  const response = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: unknown } }[] };
  const text = messageText(payload.choices?.[0]?.message?.content);
  return parseClassificationResponse(text, categories);
}

export async function classifyRepos(
  repos: RankedRepo[],
  config: AppConfig,
  env: EnvMap,
): Promise<{ status: "skipped" | "ok" | "failed"; byRepo: Map<string, Classification>; error?: string }> {
  const settings = llmSettingsFromEnv(env, config.llm);
  const heuristicMap = () =>
    new Map(repos.map((repo) => [repo.fullName, heuristicClassification(repo, config.llm.categories)]));
  if (!settings) return { status: "skipped", byRepo: heuristicMap() };
  try {
    const parsed = await requestClassifications(repos.slice(0, config.llm.maxRepos), settings, config.llm.categories);
    const byName = new Map(parsed.map((item) => [item.fullName, item]));
    const byRepo = new Map<string, Classification>();
    for (const repo of repos) {
      const fromModel = byName.get(repo.fullName);
      const fallback = heuristicClassification(repo, config.llm.categories);
      if (!fromModel?.summary) {
        byRepo.set(repo.fullName, fallback);
        continue;
      }
      byRepo.set(repo.fullName, {
        ...fromModel,
        opportunity: fromModel.opportunity || fallback.opportunity,
        tags: fromModel.tags.length > 0 ? fromModel.tags : fallback.tags,
      });
    }
    return { status: "ok", byRepo };
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]") : String(error);
    return { status: "failed", error: message, byRepo: heuristicMap() };
  }
}
