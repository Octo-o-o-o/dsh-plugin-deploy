---
name: dsh-plugin-dev
description: 开发 / 打包 / 安装 / 验证 DeepSeek Harness（dsh）树外插件的路由 skill。凡在独立仓库里写 dsh 插件（Host 侧工具 / 服务 / 事件监听 / LLM adapter，或 Web UI 前端半，或双半），或要发布、安装、排查「装了不激活」「loaded without registering」「dsh plugin install 不存在」类问题时使用。它不复述官方教程，只告诉你按什么顺序读什么、哪些名字禁止猜、完成的定义是什么。
---

# dsh 插件开发（路由）

## 0. 先确认三件事（不确认不要写代码）

1. **钉死的 harness 版本**：读 `.dsh-assistant/reference/pin.json`（本仓由 install-into 复制；没有则读规则包仓 `docs/reference/pin.json`）。取 `harness.version` 与 `harness.commit`。你写的每个 slot 名 / 服务名 / 字段名都只对这个 commit 负责；插件真正运行的 harness 版本若不同，以运行版本为准并重生成事实层。
2. **交付轨道**（在回复里明说）：
   | 轨道 | 何时 | 运行时文件 |
   |---|---|---|
   | Host | 工具、服务、事件监听、存储/策略、LLM adapter | `lib/index.js` |
   | Web UI | 只有浏览器面，用已有 Host 数据与客户端服务 | `lib/index.js`（可为空 apply）+ `lib/client.js` |
   | Host + Web UI | UI 要读写持久 / 领域数据 | Host 数据源 + 客户端视图 |
   Web UI / 双半 → 继续读 `dsh-plugin-client` skill。
3. **本仓约束**：读本仓 `AGENTS.md`（含 install-into 写入的托管块）。

## 1. 读什么（按轨道，链接指向钉死版本对应的官方文档；不要凭记忆写 API）

Host 侧（官方教程已足够，按序读完再动手）：
- 第一个插件 / 三种形态 / `ctx.effect()`：`https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/`（中文去掉 `/en`）
- Config：`…/en/develop/basic/config`（**Config 必须是 Schemastery schema，不能是普通对象**）
- 打包与安装 / bundle 契约 / 层序 / GitHub 安装陷阱：`…/en/develop/basic/publish`
- 生命周期 / 服务与 inject / 事件（含 waterfall 必须 `next()`）：`…/en/develop/framework/`、`…/framework/service`、`…/framework/events`
- 工具编写参考：`…/en/reference/cookbook/adding-a-tool`；扩展模式：`…/en/reference/cookbook/extension-cookbook`
- Cordis 语义：`…/en/reference/cordis-primer`；扩展点总表：`…/en/reference/`（architecture）

社区 agent 合同（非官方，钉 rc.5，三条轨 + Definition of done，读一遍校准思路）：`https://dsh.pub/develop-plugin.md`

事实表（本仓 `.dsh-assistant/reference/`，随 pin 生成）：
- `contract-anchors.md` — 19 条 AI 常踩的合同，带源码行号与原文
- `events.md` — 全部事件与 mode；**waterfall 列表**
- `cli.md` — `dsh` 真实动词；`dsh plugin` 是 pnpm 转发器
- `npm-dist-tags.md` — harness 子包 `latest` ≠ `next`，安装要钉版本
- `slots.md` / `client-externals.md` / `client-manifest.md` / `settings-namespaces.md` — 前端半（见 `dsh-plugin-client`）

会话内动态插件（不建仓、直接在 dsh 会话里 `cordis_define/run`）走官方内置 skill `cordis-plugin-development`，不归本 skill 管。

## 2. 红线（扫描器会拦的 + 拦不住但必须守的）

扫描器会拦（Edit 后自动跑；HIGH 阻塞）：
- 函数插件（named export `apply`）**不得**再 `export default`（`DSH-HOST-001`，postmortem 0001：Loader 用 `exports.default ?? exports`，裸 apply 没有 name/inject/Config）
- waterfall 监听器必须调 `next()`（`DSH-HOST-002`；名单见 `events.md`）
- `Config` 不能是普通对象（`DSH-HOST-003`）
- 独立仓 package.json 不得对 `@deepseek-ai/*` 用 `workspace:`（`DSH-PKG-001`）；`@deepseek-ai/dsh*` 不得写 `0.0.x`（`DSH-PKG-003`，npm latest 旧 train），要 `next` 或精确 `0.1.0-rc.N`
- 有 `cordis.patch.yml` 就必须声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，且文件存在（`DSH-PKG-002`）；`files` 白名单要含 patch 与 client bundle（`DSH-PKG-004`）
- 不存在 `dsh plugin install`；`dsh plugin --profile <name> add|remove|update`（`DSH-CLI-001`）
- 真凭据 / 本机家目录绝对路径不入仓（`DSH-SEC-001`）

拦不住、靠你守：
- **不编造名字**：slot / 服务 / 事件 / 字段名只来自事实表或钉死版本源码；本地有 harness clone 时用 `git -C <clone> grep` 核对
- patch **整体替换** 目标行的 `config`，不深合并——重述该行需要的每个键（`A-PATCH-REPLACE`）
- `--patch` 里本地插件路径必须**绝对**（`A-PATCH-ABS`）
- 可选服务用 `ctx.get(name)`，`ctx.<name>` 只给已声明的 inject（`A-CTX-GET-OPTIONAL`）
- 所有注册走 `ctx.effect()` / `ctx.on()`，插件卸载即清理；不要自己攒全局状态
- GitHub 安装只取源码：要么提交构建产物 `lib/`，要么提供自包含 `prepare` 并告知用户这是「安装期执行代码」授权（`A-GITHUB-BUILD-CATCH`）
- 不把 monorepo 贡献者规则（100% 覆盖、`./invariant`、双 tsconfig aggregate、Agent Note）搬进独立插件仓

## 3. 最小 Host bundle 长什么样（结构，不是可粘贴代码——代码去读 publish 教程）

```
my-plugin/
├── package.json        # name / type: module / main / exports / files / dsh.bundle.patch / 钉版本的 @deepseek-ai 依赖
├── cordis.patch.yml    # - insert: [{ id, name: <package name>, config? }]
├── src/index.ts        # export const name / inject / Config(schema) / function apply(ctx, config)
├── lib/index.js        # 构建产物（建议提交，避免 prepare）
└── README.md
```

## 4. 验证（每一步都要有真实输出，不许写「应该可以」）

```sh
bash .dsh-assistant/hooks/lib/scan-dsh-plugin.sh --all .            # 门禁：exit 0
dsh plugin --profile <p> add /abs/path/to/my-plugin                  # 安装（路径必须绝对，或已发布的包名）
dsh --profile <p> --dump-config | grep -n <package-name>             # 能看到 bundle 的行
dsh --profile <p> ...                                                # 真启动，观察 stderr 有无 warning: declares no dsh.bundle
```
Web UI 轨道再看 `dsh-plugin-client` 的验证段。发布前可另跑社区 doctor（zoahdev/dsh-plugin-doctor，按仓库 URL 装）与 iiwish/dsh-testkit（Docker 全生命周期）。

## 5. Definition of done（逐条打勾，写进 PR / 汇报）

- [ ] 明确写出轨道与钉死 harness commit
- [ ] 每个用到的扩展点（slot / 服务 / 事件 / 工具名）都在事实表或钉死源码里核对过，没有猜的
- [ ] `scan-dsh-plugin.sh --all .` exit 0（或每条抑制都有理由）
- [ ] `dsh plugin --profile <p> add` 成功且 `--dump-config` 出现本 bundle
- [ ] 真启动过一次，无 `declares no dsh.bundle` 警告，无 `loaded without registering`
- [ ] README 写明安装命令（带 `--profile`）、支持的 harness 版本、Web UI 需要 web-capable profile
- [ ] 没有声称做过没做的验证；未验证项明确标注
