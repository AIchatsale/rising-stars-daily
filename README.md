# Github之星

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
- 中文看板：推荐卡片、话题和语言筛选、搜索、可排序表格、多日星标折线、按日期回看。高星项目库接在同一页下方，导航是页内锚点。
- 每天写出 `data/digests/` 下的 Markdown、JSON、HTML。配了 SMTP 才会寄出 HTML。
- 高星项目库：收集 5,000 星以上的仓库，按 5K / 10K / 20K / 40K 分档，标出协议、主页、组织账号、近期活跃和方向，并给一句中文商业用途说明。

## 高星项目库

项目库在首页的 `#library`。`/library/` 会转到 `/#library`，旧链接还能用。数据在 `data/library/catalog.json`，星标历史在 `data/library/history.json`。名单要滚到这一段附近才开始下载，首页先把增速榜画出来。

搜索要避开 GitHub「每个查询最多 1000 条」的限制，所以按星标区间切开；某个区间仍然超过 1000 条时，再按创建日期对半拆开。默认排除 fork 和已归档仓库。

- 每周日（UTC）做一次全量搜索，补上新进入 5,000 星的仓库。
- 其余日子只更新 20,000 星以上的区间，并轮换刷新一批已知仓库的星标。有 `GITHUB_TOKEN` 时每天大约刷新 600 个。
- 7 日、30 日增量要等同一仓库至少有一个足够早的历史点才会显示。
- 每个仓库都有规则生成的中文说明。配置了 `LLM_API_KEY` 时，每次再给星标最高、还没有模型说明的一小批项目补一句模型说明，失败就保留规则说明。

本地全量重建：

```bash
LIBRARY_FULL=true npm run library
```

手动跑 Actions 时可以勾选 **Full GitHub search for the high-star library**。不勾的话，只有周日会全量搜索。

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
| `library.minStars` | 高星项目库的最低星标，默认 5000 |
| `library.fullRefreshWeekday` | 全量搜索的 UTC 星期，`0` 是周日 |
| `library.dailyHydrateCap` | 非全量那天额外刷新多少个 2 万星以下的已知仓库 |
| `library.llmNotesPerRun` | 每次最多给多少个项目补模型说明 |
| `library.activeWithinDays` | 「近期活跃」看最近多少天有推送，默认 90 |
| `site.domain` | Pages 自定义域名，默认 `githubstars.pandawm.com`。构建时写入产物里的 `CNAME` |
| `site.basePath` | 资源前缀。自定义域名根路径留空；只有发布到 `username.github.io/仓库名/` 时才写成 `/仓库名` |
| `site.url` | 可选。邮件和 Markdown 里的看板链接。不填则由域名和 `basePath` 拼出来 |

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

`SMTP_HOST`、`SMTP_FROM`、`SMTP_TO` 缺任何一个，就不发这封内部副本。HTML 仍写在 `data/digests/日期.html`。手动运行时可以勾选 workflow 的 `skip_email`，那时订阅列表和内部副本都不发。

## 每日订阅（Buttondown）

首页标题下和页脚各有一张订阅卡。邮箱必填，公司名和方向（AI、SaaS、游戏、电商）选填。站点是纯静态的，所以订阅直接交给邮件服务，不经过仓库服务器。开通后，表单用普通 POST 在新窗口打开 Buttondown 的确认页，看板留在原处。确认页里如果出现验证码，要在那个窗口完成；不要改成 `fetch`，否则这一步会断。还没填写用户名时，卡片会写明还没开通，输入框也不会带上字段名，地址不会被提交。

默认服务是 [Buttondown](https://buttondown.com/pricing?plan=free)。免费档是 **100 个活跃订阅者**，按他们的定价说明，每天给整份名单发一封信不另收费，API 在免费档可用。表单提交到公开地址 `https://buttondown.com/api/emails/embed-subscribe/用户名`，页面里不放 API 密钥。Buttondown 默认要求双重确认：对方点开确认信才算订阅，发出去的邮件自带退订。超过 100 人后要升到 Basic（目前 $9/月）。

没有按这个方案用另外几家，是因为免费档对不上「静态页收集 + 每天发给几百人」：

- [Brevo 免费档](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) 每天 300 封，联系人可以很多，但自己画的表单要带 API 密钥才能做双重确认。超过 300 人的活动要第二天手动重发。
- [MailerLite 免费档](https://www.mailerlite.com/pricing) 250 个订阅者、每月 2,500 封。每天发给 250 人会超过月额度，而且免费档的 API 不能发信。
- [Mailchimp 免费档](https://mailchimp.com/help/about-mailchimp-pricing-plans/) 250 个联系人、每月 500 封（每天最多 250）。每天一封日报会很快用完，接口也不能从浏览器调用。
- [Resend 营销免费档](https://resend.com/pricing?product=marketing) 有 1,000 个联系人、广播不限封数，但双重确认要自己的服务器和 webhook。GitHub Pages 上做不到，把密钥放进页面也不安全。

### 要创建的账号

1. 打开 [buttondown.com](https://buttondown.com/pricing?plan=free) 注册一个免费通讯。用户名会出现在 `https://buttondown.com/你的用户名`。
2. 在通讯设置里保持双重确认（这是默认）。确认信和退订链接用 Buttondown 自带的即可。
3. 可选：在订阅设置里加两个字段。`company` 用文本；`interests` 用多选，选项 ID 写成 `ai`、`saas`、`games`、`commerce`（对应 AI、SaaS、游戏、电商）。建好之后，公司名和方向会出现在订阅者资料里。不建字段时，表单仍会带上这两项。
4. 在账号的 API keys 页面新建一把密钥。它只放在 GitHub Secret 里。

### 要填的 Variables 和 Secrets

仓库 **Settings → Secrets and variables → Actions**。

| 类型 | 名字 | 填什么 |
| --- | --- | --- |
| Variable | `BUTTONDOWN_USERNAME` | Buttondown 用户名，不要加网址 |
| Variable | `NEWSLETTER_PROVIDER` | 留空或填 `buttondown`。别的值会跳过发信 |
| Secret | `BUTTONDOWN_API_KEY` | 上一步的 API 密钥 |

`BUTTONDOWN_USERNAME` 会在 **Pages** 构建时写进页面，用来把表单提交到 Buttondown。改完这个 Variable 之后要再跑一次 **Pages**（或随便推一次 `main`），否则页面上还是「还没开通」。`BUTTONDOWN_API_KEY` 只在 **Rising Stars** 采集时使用：把当天的 HTML 日报排队发出去，正文里有今日建议、增速榜、回到看板的链接，以及 PandaWM 官网。同一天重复跑时用固定 slug `githubstars-日期`，已经排队过就不再发一封。

发信用的是当前 API 版本 `2026-04-01`。这一版第一次把状态设成 `about_to_send` 会要求确认，所以工作流每次请求都带 `X-Buttondown-Live-Dangerously: true`，不用在网页里再点一次。来源：[Safer defaults for the email creation API](https://buttondown.com/blog/safer-email-api-defaults)。

两个都没配时，采集照常完成，只在日志里写 subscriber send skipped。页面上的表单会提示还没开通，并且不会把邮箱提交出去。

## 部署到 GitHub

看板给客户看的地址是 **https://githubstars.pandawm.com/**。静态资源和数据都在这个域名的根路径，不会再加 `/rising-stars-daily/`。

1. 把这个仓库推到 GitHub。
2. 打开 Actions，允许工作流。若默认分支有保护，需要允许 GitHub Actions 推送，否则快照提交会失败。
3. Settings → Pages → Build and deployment，Source 选 **GitHub Actions**。
4. 在 `pandawm.com` 的 DNS 添加一条 CNAME：主机名 `githubstars`，目标 `aichatsale.github.io`。
5. Settings → Pages → Custom domain 填 `githubstars.pandawm.com`。证书签发后再勾选 Enforce HTTPS。构建产物根目录的 `CNAME` 也是这个域名，部署时会带上。
6. 需要模型和邮件时，在 Settings → Secrets and variables → Actions 添加上一节的 Secrets。`GITHUB_TOKEN` 由 Actions 自动提供，用来读公开仓库和把数据推回默认分支，不要自己建一个同名 Secret。
7. 推送到 `main` 会自动跑 **Pages**，用仓库里现成的数据发布界面。要更新星标，再手动运行 **Rising Stars**，或等到每天 01:00 UTC。仓库里已经有一份高星项目库全量结果；只有想马上重搜时才勾选 **Full GitHub search for the high-star library**。不勾选时，周日会自动全量搜索，其他日子只更新星标。

**Pages** 只构建和发布，不采集。**Rising Stars** 负责采集，把 `data/` 变基到最新的 `main` 再推回去，然后按当时的 `main` 构建发布。这样一次在旧提交上启动的采集，不会把后来的界面盖掉。Actions 用自带令牌推送数据时不会再触发 **Pages**，所以发布留在 **Rising Stars** 的最后一步。默认 `site.basePath` 为空，页面在域名根目录。邮件主题前缀是 `Github之星`，Markdown 里的链接默认是 `https://githubstars.pandawm.com/`。

要临时换域名或加路径前缀，可以改 `config.json`，也可以在仓库 Variables 里设置 `PAGES_DOMAIN`、`BASE_PATH`、`PAGES_URL`。环境变量优先于配置文件。只有重新发布到 `https://aichatsale.github.io/rising-stars-daily/` 时，才把 `site.basePath` 设为 `/rising-stars-daily`，并去掉自定义域名。

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
