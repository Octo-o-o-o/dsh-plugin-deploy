# AGENTS.md

本仓是 DeepSeek Harness 树外插件：一键把用户项目部署到 Cloudflare 等托管环境。

<!-- dsh-plugin-assistant:begin (managed by tools/install-into.sh) -->
## DeepSeek Harness 插件开发规范（引用规则包 dsh-plugin-assistant）

本仓是 DeepSeek Harness（dsh）树外插件。写任何插件代码前：

1. 读 `.agents/skills/dsh-plugin-dev/SKILL.md`（路由：轨道、读什么、红线、Definition of done）；涉及 Web UI 前端半再读 `.agents/skills/dsh-plugin-client/SKILL.md`。
2. 事实表在 `.dsh-assistant/reference/`（钉 harness **0.1.0-rc.7** @ `99f6f02fecdb`，2026-08-17；42 个 slot）。slot / 服务 / 事件 / 字段名只能来自事实表或该 commit 的源码，**禁止编造**；插件实际运行的 harness 版本若不同，以运行版本为准并重生成事实层（`bash ~/WorkSpace/DshPluginAssistant/tools/install-into.sh .` 刷新）。
3. 官方教程（Host 侧）：https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/ ；社区 agent 合同（非官方）：https://dsh.pub/develop-plugin.md 。不复述教程，直接读。

硬约束速览（扫描器 HIGH 会阻塞 Edit）：
- 函数插件 named-export `name/inject/Config/apply`，**不得** `export default`；`Config` 必须是 Schemastery schema。
- waterfall 事件监听器必须调 `next()`（名单：`.dsh-assistant/reference/events.md`）。
- package.json：`"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` 必须有且文件存在；不用 `workspace:`；`@deepseek-ai/dsh*` 钉 `next` 或精确 `0.1.0-rc.N`（latest 是旧 train）。
- Web UI：`lib/client.js` 必须是 `window.__ModuleLoader__.load({ id: <包名>, factory })` factory bundle；宿主平台模块全部 external；跨包 slot 用 `ctx.slots.inject`。
- patch 整体替换目标行 `config`（不深合并）；`--patch` 里插件路径必须绝对；CLI 是 `dsh plugin --profile <p> add <pkg|abs-path>`。
- 不把真凭据 / 本机家目录绝对路径写进仓。

门禁：Edit/Write 后自动运行 `.dsh-assistant/hooks/post-edit.sh`（HIGH → 阻塞并回喂）；发布前 `bash .dsh-assistant/hooks/lib/scan-dsh-plugin.sh --all .` 必须 exit 0；有意为之的命中在该行加 `dsh-scan-ignore: <RULE-ID>` 并说明理由。
<!-- dsh-plugin-assistant:end -->
