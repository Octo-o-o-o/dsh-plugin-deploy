<h1 align="center">dsh-plugin-deploy</h1>

<p align="center">
  <b>一句话把项目发到 Cloudflare，一句话把插件发到 npm。</b><br>
  DeepSeek Harness 插件 · 没有云账号也能拿到线上地址 · 凭据模型看不到
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-plugin-deploy"><img alt="npm" src="https://img.shields.io/npm/v/dsh-plugin-deploy?color=cb3837&logo=npm" /></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <a href="https://deepseek-harness.github.io/deepseek-harness/"><img alt="harness" src="https://img.shields.io/badge/harness-0.1.0--rc.7-4c1?logo=deepseek" /></a>
  <img alt="tests" src="https://img.shields.io/badge/tests-106%20passed-brightgreen" />
  <img alt="tracks" src="https://img.shields.io/badge/track-Host%20%2B%20Web%20UI-8957e5" />
  <a href="https://dsh.pub/en/plugins/?q=Octo-o-o-o%2Fdsh-plugin-deploy"><img alt="dsh.pub" src="https://dsh.pub/api/badges/Octo-o-o-o/dsh-plugin-deploy.svg" /></a>
</p>

<p align="center">
  <b>简体中文</b> · <a href="README.en.md">English</a>
</p>

---

```
你：帮我把这个网站发出去

Agent：调用 deploy 工具 …
       ┌─────────────────────────────────────────┐
       │ 临时预览地址                              │
       │ https://my-site.breezy-broom.workers.dev │
       │ ⏱ 必须认领，否则会被删除 · 剩余 60 minutes  │
       │ [打开认领链接]                            │
       └─────────────────────────────────────────┘
```

**没有 Cloudflare 账号也能拿到能打开的线上地址。** 这不是模拟——用的是 Cloudflare 官方为 AI agent 设计的临时预览账号。

---

## 目录

- [它解决什么问题](#它解决什么问题)
- [30 秒开始](#30-秒开始)
- [能力一：把项目部署到 Cloudflare](#能力一把项目部署到-cloudflare)
- [能力二：把你做的 dsh 插件发布出去](#能力二把你做的-dsh-插件发布出去)
- [不想打字？会话标题旁有个按钮](#不想打字会话标题旁有个按钮)
- [配置凭据](#配置凭据)
- [它为什么会打断你](#它为什么会打断你)
- [安全设计](#安全设计)
- [已知限制](#已知限制)
- [常见问题](#常见问题)
- [从源码开发](#从源码开发)
- [致谢与相关项目](#致谢与相关项目)
- [License](#license)

---

## 它解决什么问题

AI 帮你写完了一个网站、一个 Worker、一个插件——然后卡在最后一公里：

| 你想做的事 | 没有这个插件时 | 有了之后 |
|---|---|---|
| 把刚做好的页面发出去看看 | 注册 Cloudflare → 建项目 → 装 wrangler → 写配置 → 调试认证 | 说一句「发出去」，拿到 URL |
| 部署到自己的账号 | 每次都要处理认证状态、写 `wrangler.jsonc` | 存一次 token 引用名，之后一句话 |
| 把做好的 dsh 插件发布 | 手动检查 8 处易错点 → `npm pack` 看清单 → `npm publish` 撞 2FA | 一条命令，校验不过就不让发 |

而且它**不会**为了省事牺牲安全：token 永远不进对话、不进日志；对外发布一定要你点确认。

---

## 30 秒开始

```sh
# 装进你的 dsh profile（需要 pnpm 在 PATH 上）
npx @deepseek-ai/dsh plugin --profile web add dsh-plugin-deploy

# 启动
npx @deepseek-ai/dsh web
```

然后在对话里说：

> 帮我把 `./my-site` 这个目录发出去

就这样。**首次不需要任何账号**——插件会走 Cloudflare 的临时预览账号，几十秒后给你一个能打开的地址。

> [!NOTE]
> 需要本机装了 [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) ≥ 4.102.0（临时预览要求）。没装的话插件会告诉你怎么装，不会闷头失败。

> [!TIP]
> **刚发布的新版本装不到？** pnpm 有 `minimumReleaseAge` 供应链保护，新版本在冷却期内不会被自动选中——`add dsh-plugin-deploy` 可能装到上一个版本。想立刻用最新版就显式指定：`add dsh-plugin-deploy@0.1.2`。

---

## 能力一：把项目部署到 Cloudflare

插件提供工具 `deploy` 与斜杠命令 `/deploy`。

### 两种模式，自动选，也可以指定

| 模式 | 适合谁 | 拿到什么 | 需要账号吗 |
|---|---|---|---|
| **`temporary`** 临时预览 | 想立刻看效果、还没有 Cloudflare 账号 | `*.workers.dev` 地址 + **60 分钟**认领窗口 | ❌ 不需要 |
| **`account`** 自有账号 | 要长期在线的正式地址 | 你账号下的持久 URL | ✅ 需要（token 或已 `wrangler login`） |

默认 `auto`：本机已认证就走 `account`，没认证就走 `temporary`。想强制某一种，直接说「用临时预览」或「发到我的账号」。

### 关于临时预览，你必须知道的

这是 Cloudflare 官方能力（[Claim deployments](https://developers.cloudflare.com/workers/platform/claim-deployments/)），文档里明写是为 AI agent 场景设计的。但有个硬约束：

> [!WARNING]
> **60 分钟内不认领，Cloudflare 会删除该临时账号及其全部资源。**
> 插件会在结果卡片里显示倒计时和认领链接，并在下次部署时提醒你还有未认领的记录。
> 认领链接本身是一种凭据，它会出现在会话记录里——**别把这个会话分享出去**。

插件在文案上严格区分：临时预览叫「临时预览地址」，绝不说成「已上线」。

### 支持的项目形态

- 纯静态目录（`index.html` 等）
- Vite 类构建产物（`dist/`）
- 已有 `wrangler.jsonc` / `wrangler.toml` / `wrangler.json` 的 Worker 项目

检测不出来时**会问你**，不会瞎猜。没有 wrangler 配置的项目，插件会临时生成一份——写在系统临时目录，**不往你的仓库里塞文件**。

---

## 能力二：把你做的 dsh 插件发布出去

插件提供工具 `publish_plugin` 与斜杠命令 `/publish-plugin`。

> 这部分是给**插件作者**用的：你用 dsh 写了个插件，想让别人装得上。

### 三种模式

```sh
check   # 只校验，零副作用（默认）
pack    # 校验通过 → 打出 .tgz
npm     # 校验通过 + 你点确认 → 发布到 npm
```

### 校验才是重点

生态里大量插件「装上了但不激活」「npm 发布漏文件」「GitHub 装下来缺 lib/」。发布前这 8 条会逐项检查：

| 检查 | 拦住什么 |
|---|---|
| `dsh-plugin` | 没有 `dsh.bundle.patch` → 装了不激活，只有一行 stderr 警告 |
| `patch-in-pack` | patch 文件没进 npm 包 → 同上，但更隐蔽 |
| `client-bundle` | `lib/client.js` 不是 factory 形态或 id 不匹配 → 浏览器报 `loaded without registering` |
| `main-entry` | 主入口没进包 |
| `deps` | 残留 `workspace:` 协议 → 用户装不上；`@deepseek-ai/dsh*` 写成 `0.0.x` → 装到旧 train |
| `pack-clean` | `.env` / `.npmrc` / 私钥 / `node_modules` 混进发布包 |
| `version-available` | 版本号已被占用 |
| `scan` | 如果你的仓里装了 [dsh-plugin-assistant](https://github.com/Octo-o-o-o/dsh-plugin-assistant)，顺带跑一遍它的规则扫描 |

**任何一条不过，`pack` 和 `npm` 都不执行**（fail closed）。

### 发布到 npm

```
你：把这个插件发布到 npm

Agent：[8 条校验全过] → [审批：即将发布 xxx@0.1.0 到公共仓库] → 你点「允许一次」→ 发布
```

npm 的 token 处理和别的工具不同——它**不读环境变量**。插件的做法是：临时 `.npmrc` 里只写 `${DSH_NPM_TOKEN}` 这个引用，真值经进程环境传给 npm，用完删除。**不碰你的 `~/.npmrc`，token 不落盘。**

> [!TIP]
> 如果你的 npm 账号开了 2FA，普通 token 会卡在 OTP 提示上。用 **automation token** 或勾了 "Bypass 2FA" 的 **granular token**，并建议设短过期、发完就撤销。

---

## 不想打字？会话标题旁有个按钮

装好后，会话标题旁边的动作栏会多出一个 **发布** 按钮（点开是两个选项）：

| 选项 | 等价于你手打 |
|---|---|
| 部署到 Cloudflare | 「把当前工作区部署到 Cloudflare」 |
| 检查插件发布 | 「检查当前工作区能否作为 dsh 插件发布」 |

> [!IMPORTANT]
> 按钮**不会**绕过 agent 直接执行。它做的是把这句话写进输入框并提交——之后一切照常：模型调工具、条款确认、审批、结果卡片、会话记录，一个不少。
>
> 这是刻意的。dsh 的 `approval.request()` 强制要求在**开启的 agent turn 内**调用（源码原文：`the approval/asked + approval/decided audit pair must be turn-enclosed`）。UI 直接触发的动作既拿不到审批，也不会留下会话记录——对不可逆的对外动作，那是不能接受的。

**它对哪个目录生效？** 按钮不硬编码路径，用的是**当前会话的工作区**。所以：

- 想让它直接可用 → 把会话工作区选成你的项目 / 插件仓
- 工作区是个容器目录（比如 `~/WorkSpace`）→ agent 会告诉你「这不是一个插件包」，这时直接打字说明目录即可

草稿里已经有内容时按钮会禁用（`setDraft` 是全量写入，避免冲掉你写了一半的话）；agent 正忙时也不会抢。

部署 / 校验的结果卡片上还有「重新部署」「重新校验」，走同一条路径。

---

## 配置凭据

进 **设置 → 插件 → 插件配置**，找到 **Cloudflare 部署** 卡片并展开（卡片与宿主自带的「终端 / Agent 循环 / 网页搜索」同构：默认收起，点标题展开）：

| 字段 | 填什么 | 说明 |
|---|---|---|
| API token 引用名 | 默认 `CLOUDFLARE_API_TOKEN` | 这里填的是**名字**，不是 token 本身 |
| npm token 引用名 | 默认 `NPM_TOKEN` | 同上 |
| 写入 token 值（只写） | 粘贴真实 token | 保存后输入框清空，**永不回填**；右侧胶囊显示「已配置 / 未配置」 |

改动会留在卡片里，点底部**保存**才写入；**放弃修改**退回上次保存的状态。卡片有未保存改动时，收起状态下标题旁也会显示「未保存」徽章。

设计上分成两层：**配置里只存引用名**，**值交给 dsh 凭据服务**（存在 `$DSH_HOME/.credentials.yaml`，权限 `0600`）。卡片只会告诉你「已配置 / 未配置」，任何界面、任何响应都拿不到值。

Cloudflare 的 token 需要 `Edit Cloudflare Workers` 权限；也可以不配 token，直接 `wrangler login` 走 OAuth。

---

## 它为什么会打断你

这个插件会在两个地方停下来问你。这是刻意设计，不是没做完：

**1. 服务条款**（仅临时预览）

创建临时账号等于接受 Cloudflare 的服务条款与隐私政策。wrangler 在非交互环境下会**自动替你接受**——插件不接受这种默认，会把两个链接原样摆出来让你确认。

**2. 发布审批**

部署到公网、发布到 npm 都是不可逆的对外动作。插件走 dsh 的 approval 通道申请一次性授权，**只有你点「允许一次」才继续**；拒绝、超时、审批服务不可用，一律中止（fail closed）。审批理由里不含任何凭据。

---

## 安全设计

| 措施 | 具体做法 |
|---|---|
| 凭据不进模型上下文 | 工具参数里**没有** token 字段，只有引用名；值经进程环境变量传给子进程 |
| 凭据不进日志 | dsh 的核心不变量是「模型可见 ⟺ 被记录」，所以 token 绝不进命令行、结果文本、审批理由 |
| 输出脱敏 | 命令输出返回前过滤 token / `_authToken` / `Bearer` 等形态 |
| 不污染你的环境 | 临时配置、tarball、npm cache 全部写系统临时目录；不改 `~/.wrangler`、不改 `~/.npmrc` |
| 临时预览用隔离环境 | 走独立 `HOME`，读不到你本机的 Cloudflare 凭据，也**不需要你登出** |
| 不可逆动作要审批 | 部署、发布都要一次性授权 |

---

## 已知限制

如实列出，不粉饰：

- **只支持 Cloudflare**。Vercel / Netlify / VPS / 自定义域 / 回滚 / Next.js SSR（OpenNext）都不在当前范围。
- **临时预览 60 分钟过期**，不认领就没了。这是 Cloudflare 的规则，插件只能提醒。
- **临时账号资产上限**：≤1,000 个文件、单文件 ≤5 MiB。
- **`account` 模式下 wrangler 会写 `~/.wrangler/logs`**，在 Workspace Write 沙箱下可能报 `EPERM`。实测不影响部署结果（退出码 0），属噪音。
- **stderr 有 64 KB 上限**（harness 未暴露 `stderrMaxBytes`），极端情况下诊断信息可能被截断。
- **发布只做 npm 和 tarball**。GitHub 直装、[dsh.pub](https://dsh.pub) 收录只在结果里给引导，不代你执行。
- **未在 TUI / headless profile 下验证**。无交互提供方时按 fail-closed 处理，但没有实跑证据。
- 需要 dsh **`0.1.0-rc.7`**。更早版本（如 rc.5）的 slot 语义不同，会加载失败。

---

## 常见问题

<details>
<summary><b>提示「本机已认证，无法使用临时预览」怎么办？</b></summary>

早期版本会这样。**现在不会了**：显式要求临时预览时，插件会用隔离 `HOME` 执行，读不到你本机凭据，因此**不需要 `wrangler logout`**。如果仍看到这个提示，说明装的是旧版本，升级即可。
</details>

<details>
<summary><b>临时预览的地址打不开（404）？</b></summary>

临时账号刚创建时边缘节点有传播延迟，等 10–20 秒重试即可。实测约 12 秒后返回 200。
</details>

<details>
<summary><b>我的项目里会被塞进奇怪的文件吗？</b></summary>

不会。临时 wrangler 配置、tarball、npm cache 都写在系统临时目录。早期版本曾把生成的配置写进项目根、结果被当成静态资源发到公网——这个问题已修复，并加了 `.assetsignore` 兜底。
</details>

<details>
<summary><b>发布到 npm 卡在 OTP？</b></summary>

你的账号开了 2FA。改用 **automation token**，或建 granular token 时勾选 "Bypass two-factor authentication"。建议配短过期时间，发完就撤销。
</details>

<details>
<summary><b>能部署 Next.js 吗？</b></summary>

静态导出可以。SSR 需要 [OpenNext 适配器](https://github.com/opennextjs/opennextjs-cloudflare)，当前版本不处理——插件会如实告诉你，不会假装成功。
</details>

<details>
<summary><b>凭据存在哪？会被上传吗？</b></summary>

存在 dsh 凭据服务（`$DSH_HOME/.credentials.yaml`，`0600`）。除了传给 wrangler / npm 子进程执行部署外，不会发送到任何地方。插件本身不联网上报。
</details>

---

## 从源码开发

```sh
git clone https://github.com/Octo-o-o-o/dsh-plugin-deploy.git
cd dsh-plugin-deploy
npm install
node build.mjs                      # 构建 lib/index.js 与 lib/client.js
node --test tests/*.test.js         # 106 个单元测试

# 装本地版本调试（路径必须绝对）
npx @deepseek-ai/dsh plugin --profile web add "$PWD"
```

结构：

```
src/
├── index.ts              # 插件入口：注册工具、命令、设置
├── deploy.ts             # 部署编排：检测 → 条款 → 审批 → 执行
├── mode.ts               # L1/L2 模式判定
├── isolated-home.ts      # 临时预览的隔离 HOME
├── publish.ts            # 发布编排
├── publish-checks.ts     # 8 条发布校验
├── redact.ts             # 输出脱敏
└── client/               # Web UI：设置卡片 + 两个结果卡片
```

浏览器侧产物必须是 dsh 的 lazy-CJS factory bundle（`window.__ModuleLoader__.load({id, factory})`），`build.mjs` 里已经配好 banner + intro + footer 三段——**三段缺一不可**，漏了 intro 会在浏览器里抛 `module is not defined`。

---

## 致谢与相关项目

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — 一切皆插件的 agent 底座
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — 临时预览账号（[官方设计说明](https://developers.cloudflare.com/workers/platform/claim-deployments/)）
- [dsh-plugin-assistant](https://github.com/Octo-o-o-o/dsh-plugin-assistant) — 本插件开发时用的规则包：钉版本的事实层 + Edit 时门禁
- [dsh.pub](https://dsh.pub) — 社区插件目录

本项目与 DeepSeek 官方无隶属关系。

## License

[MIT](LICENSE)
