# 昇星日报

每天采集一批 GitHub 仓库，把星标记进仓库里的 JSON 快照，再和上一天对照，找出过去 24 小时涨得最快的开源项目。页面是给业务团队用的：除了增速榜，还有「今天建议带给客户」的三条简评，以及可以转发的 Markdown / JSON / HTML 日报。

静态看板用 GitHub Pages 发布。定时任务在 GitHub Actions 里跑。

## 灵感来源

实现是单独写的，没有复制这两个仓库的代码。它们都是 MIT 许可，这里借用的是产品思路：

- [awesome-trending-repos](https://github.com/furkankoykiran/awesome-trending-repos)：每天用 Actions 采集、对照历史、标出 24 小时 Rising Stars，做成可筛选的可视化页面，再发布到 GitHub Pages。本仓库沿用「采集 → 快照差分 → 静态看板 → 自动发布」这条链路。增速以仓库里保存的星标差分为准；GitHub Trending 只在没有昨日快照时，当作今日增量的补充。
- [github-topics-trending](https://github.com/geekjourneyx/github-topics-trending)：按可配置话题追踪仓库，用模型给暴涨项目写分类和摘要，并发送 HTML 日报。本仓库把话题写进 `config.json`，模型走可替换的 OpenAI 兼容接口，邮件走 SMTP。密钥没配时这两步直接跳过，采集和页面照常完成。

## 功能

- 定时（每天 01:00 UTC）和手动 `workflow_dispatch` 都会跑。
- 用 GitHub Search API 找最近创建、最近有推送、以及配置话题下的仓库，并可选读取 GitHub Trending 页面补充候选。
- 每日快照写在 `data/snapshots/`。有上一份同来源快照时，增量 = 今日星标 − 上次星标，增速 = 增量 / 上次星标。
- 第一次没有昨日快照时：48 小时内新建的仓库按累计星标排名；Trending 页面上的旧仓库使用页面给出的「今日星标」；其余仓库先入榜但增量标成待对照。
- 榜单按增量排序，不按百分比，避免很小的仓库因为翻倍挤到前面。
- 中文看板：推荐卡片、话题和语言筛选、搜索、可排序表格、多日星标折线、按日期回看。
- 每天写出 `data/digests/` 下的 Markdown、JSON、HTML。配了 SMTP 才会寄出 HTML。

## 本地运行

需要 Node.js 22。

```bash
npm ci
npm test
npm run sample   # 生成可预览的示例快照，并算出榜单和简报
npm run dev      # http://127.0.0.1:43123
```

对照真实 GitHub API：

```bash
# 可选。不设置也能跑，只是 Search API 额度更低，查询之间会自动放慢。
export GITHUB_TOKEN=github_pat_xxx
npm run collect
```

`npm run collect` 会写入 `data/snapshots/live/当天.json`，重算榜单，并在密钥齐全时调用模型和发信。然后刷新看板，日期条里会出现「实测」。

构建静态站点：

```bash
npm run build
# 产物在 out/
```

## 配置

编辑根目录的 `config.json`。

| 字段 | 作用 |
| --- | --- |
| `topN` | 榜单保留多少个项目 |
| `minStars` | 搜索时的最低星标 |
| `newRepoWindowHours` | 没有历史对照时，多新的仓库可以把累计星标当成增量。默认 48 |
| `languages` | 参与搜索的语言，也会出现在看板的语言筛选里 |
| `keywords` | 额外的搜索词，例如 `agent`、`self-hosted` |
| `topics` | 要追踪的话题。`githubTopics` 用来搜 GitHub topic，`keywords` 用来在名称和简介里匹配，`label` 是看板上的中文或英文标签 |
| `excludeNamePatterns` | 名称里带这些片段的仓库不进榜，默认排除 awesome-list 一类清单 |
| `recommendCount` | 「建议带给客户」的条数 |
| `llm.maxRepos` / `llm.categories` | 模型最多概括多少个上榜项目，以及允许的分类 |
| `email.topInEmail` | 邮件里的榜单长度。页面上的 HTML 文件仍包含完整上榜名单 |
| `discover.githubTrending` | 设为 `false` 就不再请求 Trending 页面 |

话题示例：

```json
{
  "id": "llm",
  "label": "LLM",
  "githubTopics": ["llm", "rag"],
  "keywords": ["llm", "rag", "agent"],
  "minStars": 30
}
```

改完配置后执行 `npm run rebuild`，示例数据和已有实测快照会按新规则重算。这不会重新请求 GitHub。

## 可选的模型摘要

在 Actions 的 Secrets 里添加：

| Secret | 作用 |
| --- | --- |
| `LLM_API_KEY` | 必填才会调用模型。也认本地环境变量 `OPENAI_API_KEY` |
| `LLM_BASE_URL` | 可选，默认 `https://api.openai.com/v1`。任何兼容 `/chat/completions` 的服务都可以 |
| `LLM_MODEL` | 可选，默认用 `config.json` 里的 `llm.model` |

没有密钥时，每个项目仍有一条基于简介、增量和话题的规则摘要，任务记为跳过，不会失败。模型调用失败时同样回退到规则摘要，并在看板上标明。

## 可选的 HTML 邮件

| Secret | 作用 |
| --- | --- |
| `SMTP_HOST` | SMTP 主机 |
| `SMTP_PORT` | 可选，默认 587。465 会走隐式 TLS |
| `SMTP_USER` / `SMTP_PASSWORD` | 需要认证时再填 |
| `SMTP_FROM` | 发件人 |
| `SMTP_TO` | 收件人，多个地址用逗号分隔 |

`SMTP_HOST`、`SMTP_FROM`、`SMTP_TO` 缺任何一个，就只把 HTML 留在 `data/digests/日期.html`，不发信。手动运行时可以勾选 workflow 的 `skip_email`。

## 部署到 GitHub

1. 把这个仓库推到 GitHub。
2. 打开 Actions，允许工作流。若默认分支有保护，需要允许 GitHub Actions 推送，否则快照提交会失败。
3. Settings → Pages → Build and deployment，Source 选 **GitHub Actions**。
4. 需要模型和邮件时，在 Settings → Secrets and variables → Actions 添加上一节的 Secrets。`GITHUB_TOKEN` 由 Actions 自动提供，用来读公开仓库和把数据推回默认分支，不要自己建一个同名 Secret。
5. 在 Actions 里手动运行 **Rising Stars**，或等到每天 01:00 UTC。

工作流会：采集 → 把 `data/` 提交回仓库 → 构建静态页面 → 部署到 Pages。项目页的地址是 `https://<用户名>.github.io/<仓库名>/`。如果仓库名是 `<用户名>.github.io`，页面在站点根目录。

## 数据

```text
data/snapshots/sample/YYYY-MM-DD.json   示例快照
data/snapshots/live/YYYY-MM-DD.json     实测快照
data/rankings/YYYY-MM-DD.json           当天榜单、推荐和摘要
data/digests/YYYY-MM-DD.md|json|html    可转发的日报
data/history.json                       按来源分开的星标序列
data/index.json                         日期索引和筛选项
```

示例快照和实测快照不会拿来互相比增量，趋势图也不会把两条线接在一起。示例数字只为了在第一次采集之前就能打开看板。

## 测试

```bash
npm test
```

测试覆盖快照差分、零星标时的增速、新仓库、首次运行、Trending 补充、示例/实测隔离、排除清单仓库、话题匹配、模型 JSON 解析、密钥缺失时跳过，以及简报转义。

## 额度

Search API 在有令牌时大约每分钟 30 次，没有令牌时大约每分钟 10 次。脚本会按这个间隔等待，并在遇到可恢复的限流时最多再等 90 秒。候选数量、查询条数和补全上限都在 `config.json`。没有令牌时，补全旧仓库星标的次数会降到 `hydrationCapWithoutToken`，所以从第二天起如果要得到完整对照，建议配置 `GITHUB_TOKEN`。
