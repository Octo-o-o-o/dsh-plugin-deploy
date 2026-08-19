# 正式端到端验证报告 — 2026-08-18

> 环境：owner 本机真实 DeepSeek Harness 实例（`dsh web` @ 127.0.0.1:3080，`0.1.0-rc.7`），装在 owner 的**生产 profile**（含 13 个既有第三方插件）。模型 **DeepSeek-V4-Flash（High）**，权限 Workspace Write。
> 测试项目：`~/WorkSpace/dsh-deploy-testsite`（单文件静态站，1.5 KB）。
> 本报告只记录本次会话内真实执行的命令与真实观察到的结果。

## 1. 结论

**两条部署路径都真实跑通了**，并在过程中发现并修复了 **4 个静态审阅没能发现的缺陷**（其中 3 个必须靠真实部署才能暴露）。全部修复均已在真实 UI 复验。

施工/修复由 Grok 4.6（`grok-4.6-build`，effort `xhigh`）执行，共 5 轮；对抗审阅同为 Grok 4.6（只读）；每轮修复由本会话独立核验，端到端验证全部在 owner 的真实 dsh 实例上完成。最终门禁：扫描器 exit 0、**48 单元测试全绿**。

| 路径 | 结果 | 线上地址 |
|---|---|---|
| **L1 临时预览** | ✅ 成功 | `https://dsh-deploy-testsite.breezy-broom.workers.dev`（HTTP 200，临时账号 Breezy Broom，60 分钟认领窗口） |
| **L2 自有账号** | ✅ 成功 | `https://dsh-deploy-testsite.wyxiao59.workers.dev`（HTTP 200，持久 URL，owner 账号子域） |

owner 的 `~/.wrangler/config/default.toml` 全程**未被改动**（时间戳保持 22:38）。测试目录**零残留**（只剩 `index.html`）。

## 2. 完整流程验证（真实 UI 操作）

| 环节 | 观察到的行为 | 判定 |
|---|---|---|
| 插件加载 | `/plugins/dsh-plugin-deploy/client.js` HTTP 200；`window.__DSH_BOOT__.entries` 含 `dsh-plugin-deploy`（50 个 entry，与 11 个既有第三方插件共存）；启动日志无 warning | ✅ |
| 设置卡片 | 设置 → Plugins 里「Cloudflare 部署」卡片渲染，显示「设置里的 token：未配置」「API token 引用名：CLOUDFLARE_API_TOKEN」，**不显示值** | ✅ |
| 模型驱动调用 | DeepSeek-V4-Flash 自主检查目录 → 判定 mode → 调用 `deploy` 工具 | ✅ |
| **条款同意** | 弹出问题卡片，**两个 URL 都在正文里**（服务条款 + 隐私政策），选项「同意并继续 / 不同意，中止」 | ✅ 合规设计在真实环境生效 |
| **审批 fail-closed** | 弹出「即将把当前项目发布到 Cloudflare（对外可见）。**本次申请不含任何凭据**。」→「拒绝 / 允许一次」 | ✅ |
| **L1/L2 冲突检测** | 检测到本机 wrangler 已登录，未硬来，给出三个选项让人决定 | ✅ |
| 结果卡片 | `tool.call.toolview` 渲染，含可点预览 URL、认领链接、剩余时间、删除警告 | ⚠️ 见缺陷 3/4 |

## 3. 真实验证发现的 4 个缺陷

### 缺陷 1（MAJOR）：L1 隔离用错环境变量，在真实机器上完全失效

- **现象**：`wrangler deploy --temporary` 报 `You're already authenticated with Cloudflare, so --temporary can't be used.`，即使插件已把 `XDG_CONFIG_HOME` 重定向到临时目录。
- **根因**（wrangler 4.112.0 dist 源码原文）：
  ```js
  const configDir = xdgAppPaths(dirName).config();
  if (useLegacyHomeDir) {
    const legacyConfigDir = path.join(os.homedir(), dirName);   // ~/.wrangler
    if (isDirectory(legacyConfigDir)) { return legacyConfigDir; }   // 存在就优先，绕过 XDG
  }
  ```
  `~/.wrangler` 只要存在就优先于 `XDG_CONFIG_HOME`；凭据实际在 `~/.wrangler/config/default.toml`（0600）。
- **修复**：改用隔离 **`HOME`**（`src/isolated-home.ts`），并显式传空的 `CLOUDFLARE_API_TOKEN`（该名字命中 harness 的 `SENSITIVE_ENV_PATTERN`，不显式传就会继承真值）。
- **验证**：同一台机器、同一登录态下，`env HOME=<隔离目录> CLOUDFLARE_API_TOKEN= wrangler deploy --temporary` 成功创建临时账号并部署；owner 凭据未被触碰。

### 缺陷 2（MAJOR）：插件内部文件被当作静态资产部署到公网

- **现象**：首次 L1 部署后，`curl https://<site>/.dsh-deploy.wrangler.jsonc` 返回 **HTTP 200**，内容是插件生成的配置。wrangler 上传日志显示 `Read 8 files`，包含 `.dsh-deploy.wrangler.jsonc` 与 `.wrangler/tmp/deploy-*/no-op-worker.js`（测试目录本身只有 1 个文件）。
- **修复**：生成的配置改写到项目**外**（`os.tmpdir()` 下，`--config <绝对路径>`，`assets.directory` 用绝对路径）；`workdir` 设为配置目录避免 `.wrangler/tmp` 落进站点；再叠加临时 `.assetsignore` 兜底旧残留。
- **验证**：修复后部署 `Read 1 file`，只上传 `/index.html`；三个内部路径全部 **404**。

### 缺陷 3（MAJOR）：结果卡片在嵌套调用下拿不到数据

- **现象**：部署成功但卡片显示「未能解析出预览 URL。」，而 agent 文字回复里 URL 齐全。
- **根因**（harness rc.7 `packages/core/tools/src/index.ts:1806`）：
  ```js
  if (exec.parent === undefined && tool.output.presentationMeta !== undefined) { ... }
  ```
  `presentationMeta` **只在顶层直接调用时**写入 `ToolResultNode.meta`；嵌套调用时 `meta` 为 undefined。这是 harness 的既有约束（`schema.ts:497` JSDoc：*for direct top-level calls*），插件前端必须自己兜住。
- **修复**：`parseDeployText` 与 `formatDeployText` 成对，`resolveDeployPresentation` 优先 meta、缺失时从 `block.content` 文本回落。
- **验证**：修复后真实 UI 里三张卡片全部渲染出可点 URL，L1 卡片含认领链接与剩余时间。

### 缺陷 4（MAJOR）：account 模式被误渲染成临时预览

- **现象**（DOM 实测）：L2 持久部署的卡片显示「临时预览地址」「必须认领，否则会被删除」「未能解析出认领链接」「不在认领窗口内完成认领，Cloudflare 会删除该临时账号及其资源」——**全部是错的且误导**。
- **根因**：文本回落时 `mode` 未被正确还原，落到默认的 temporary 分支。
- **实际根因**：`formatDeployText` 对 account 本来就有可判别首行（`已部署到你的 Cloudflare 账号。`），但 `parseDeployText` 用**全文** `/临时预览/` 抢先判 mode——而 account 卡片上那条「此前有一条未认领的**临时预览**」提醒正好命中，于是 mode 被写成 temporary。
- **修复**：成功文本加显式 `部署模式：account|temporary` 标记；解析按「显式标记 → 首行 → 全文特征句（排除提醒） → 有无 claim URL」逐级判定，**判不出就留空，不默认 temporary**；卡片标题按 mode 分三态（临时预览地址 / 持久 URL / 部署完成），认领区块只在 temporary 出现。
- **复验（真实 UI，DOM 抓取）**：
  - L1 卡片：`临时预览地址` + 预览链接 + `打开认领链接` + `剩余时间：60 minutes` + 删除警告 ✅
  - L2 卡片：`持久 URL` + Worker 名 + 保留「此前有一条未认领的临时预览」提醒；**误导文案全部消失** ✅

## 4. 顺带确认的环境事实

- **`~/.wrangler/logs` 的 EPERM 是无害噪音**：L2 路径不改 HOME，wrangler 仍写 owner 家目录的日志，沙箱下报 `EPERM`，但 `exitCode 0`，不影响部署结果。L1 因为隔离了 HOME 不受影响。
- **`--temporary` 是 hidden flag**：不在 `wrangler deploy --help` 里（4.112.0 与 4.123.0 均无），靠读 help 发现不了。
- **条款在非交互环境自动接受**：`ensureTemporaryTermsAccepted` 在 `isNonInteractiveOrCI()` 时打印通知并返回 true——所以插件必须在执行前用 `ctx.userQuestions.ask` 让人明确同意（本次已验证该设计在真实 UI 里生效）。

## 5. 未验证 / 遗留

- 4 个缺陷全部已修复并在真实 UI 复验通过。
- 未测：TUI / headless profile（无 user-questions provider 时的 fail-closed 只有源码层面正确性）、Linux 沙箱、Windows。
- 未测：临时账号的实际认领流程（需要在 Cloudflare 控制台完成）。
- L1 临时账号（Breezy Broom）**未认领**，60 分钟后由 Cloudflare 自动删除。
- L2 的 Worker `dsh-deploy-testsite` 留在 owner 账号里，可用 `wrangler delete --name dsh-deploy-testsite` 移除。

## 6. 清理方式

```sh
# 从 profile 移除插件
dsh plugin --profile web remove dsh-plugin-deploy
# 删除 L2 留下的 Worker
wrangler delete --name dsh-deploy-testsite
# 删除测试站点目录
rm -rf ~/WorkSpace/dsh-deploy-testsite
```
