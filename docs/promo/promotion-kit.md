# dsh-plugin-deploy 推广物料

> 状态：**草稿，待本人发布**。依据 `~/WorkSpace/social-media/AGENTS.md` 纪律 3（文章与独立新帖由本人执行）与纪律 9（X 禁止自动化发帖），AI 只备稿不代发。
> 发布后请回填 `~/WorkSpace/social-media/records/发布与互动台账.md`。

## 事实基线（写文案只能用这些，不得夸大）

| 项 | 事实 |
|---|---|
| npm | `dsh-plugin-deploy@0.1.3`，MIT，6 个文件 / 146 KB |
| GitHub | https://github.com/Octo-o-o-o/dsh-plugin-deploy |
| 测试 | 107 个单元测试全绿 |
| 已验证 | L1 临时预览、L2 自有账号、npm 发布、从 npm 安装，均在真实 dsh 0.1.0-rc.7 端到端跑通；0.1.3 同时订阅 rc.7 的 `credentials/updated` 与 0.1.1-rc.1 的 `credentials/reference-updated` |
| 生态位 | 调研时 dsh 生态部署类插件仅 1 个（只支持 Sealos），Cloudflare/Vercel/Netlify/VPS 方向 0 个 |
| 未做 | Vercel / Netlify / VPS / 自定义域 / Next.js SSR；未在 TUI/headless 验证 |

⚠️ 合规：AIGC 标识按平台勾选；小红书零站外导流；不写现雇主与客户名。

---

## 渠道一：dsh.pub 官方目录（优先级最高）

5 条前提**已全部满足**（仓库公开 / 包在仓根 / 产物已提交 / 名字不冒用官方 / README+LICENSE 齐全）。

流程：打开 https://dsh.pub/en/submit/ → 填表生成 `submissions/*.json` → 提 PR → 自动门禁通过后自动合并。

## 渠道二：awesome-dsh-plugin（★10,002）

提一个 PR，只加一个文件 `data/plugins/Octo-o-o-o__dsh-plugin-deploy.yml`：

```yaml
url: https://github.com/Octo-o-o-o/dsh-plugin-deploy
name: Octo-o-o-o/dsh-plugin-deploy
category: dev
description:
  en: 'Ship a project to Cloudflare and publish your dsh plugin to npm — no cloud account needed for the first deploy, credentials never reach the model.'
  zh: '一句话把项目部署到 Cloudflare、把做好的 dsh 插件发布到 npm：首次部署零账号，凭据模型看不到。'
```

然后 `npm ci && node scripts/generate-readme.mjs`，把重新生成的两个 README 一起提交。

## 渠道三：GitHub topics（已完成）

仓库已打 `dsh-plugin` / `deepseek-harness` / `cloudflare` / `cloudflare-workers` / `deploy` / `npm-publish` / `ai-agent`。

---

## 社媒草稿（待本人发布）

### X（英文，技术向）

> Built a DeepSeek Harness plugin that closes the last mile: your agent writes a site, then ships it.
>
> The part I didn't expect — Cloudflare has official temporary preview accounts built for AI agents. So the first deploy needs **no account at all**. You get a live URL, plus 60 minutes to claim it.
>
> It also publishes dsh plugins to npm, with 8 pre-flight checks (missing bundle patch, files leaking into the tarball, workspace: protocol left in). It published its own last two releases.
>
> Credentials never enter the model context — tokens travel through the process env, never through tool arguments or the session log.
>
> MIT · https://github.com/Octo-o-o-o/dsh-plugin-deploy

（发前自查：无内部路径、无 key、无雇主名 ✅）

### 即刻（中文，轻松）

> 给 DeepSeek Harness 写了个插件，解决最后一公里：AI 写完网站，然后把它发出去。
>
> 最意外的一点是——Cloudflare 有官方的"临时预览账号"，文档里明写是给 AI agent 设计的。所以第一次部署**完全不需要注册账号**，直接拿到能打开的地址，60 分钟内认领就能留下。
>
> 它也能把你写的 dsh 插件发到 npm，发布前会跑 8 项检查（少了 bundle 声明、该发的文件没进包、workspace: 协议忘了删……这些坑我调研时在生态里见得太多了）。最近两个版本就是它自己发布的自己。
>
> 凭据全程不进模型上下文。MIT 开源：github.com/Octo-o-o-o/dsh-plugin-deploy

### 知乎（中文，可展开成短文）

标题建议：《给 DeepSeek Harness 写了个部署插件：让"AI 写完的东西"真的能发出去》

结构：
1. 问题——agent 写完代码卡在最后一公里（注册、装 CLI、调认证）
2. 意外发现——Cloudflare 官方为 AI agent 做的临时预览账号（附文档链接），零账号拿 URL
3. 做插件时踩的坑（可展开成干货）：
   - `XDG_CONFIG_HOME` 在装过 wrangler 的机器上完全无效，得隔离 `HOME`
   - 插件生成的临时配置被当成静态资源部署到公网了
   - npm 不读环境变量里的 token，要用 `.npmrc` 的 `${VAR}` 插值
   - 4 个缺陷里 3 个只有真部署一次才会暴露
4. 安全设计——凭据只存引用名、不可逆动作要审批
5. 开源地址

（这篇最适合，因为踩坑细节是真干货，且都有实证）
