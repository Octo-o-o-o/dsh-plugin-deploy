---
name: dsh-plugin-client
description: DeepSeek Harness（dsh）树外插件的 Web UI 前端半（浏览器 client bundle）专用 skill。凡要在独立插件仓里往 dsh Web UI 加界面——注册 slot、加设置卡片、加侧栏 / 输入区 / 会话节点 / 工具视图、写 src/client/、配置 lib/client.js 构建、声明 package.json dsh.client、排查「loaded without registering」「slot 未声明加载失败」「设置页不显示」时使用。前提是先读过 dsh-plugin-dev。
---

# dsh 插件 · Web UI 前端半

官方对前端半没有独立教程；权威分散在 `docs/cookbook/adding-a-settings-card`（最新、最像树外形态）、`adding-a-conversation-node`、`reference/subsystems/client-modules`，以及只写给仓内的 `packages/client/AGENTS.md`（**它的「三个注册面」是改 harness 源码树，树外插件不要照抄**）。本 skill 把树外插件真正需要的部分收拢，具体名字一律查事实表。

## 0. 事实表（`.dsh-assistant/reference/`，随 pin 生成；先读 `pin.json` 确认版本）

| 文件 | 用途 |
|---|---|
| `slots.md` | 全部 slot：名 / `kind` / `scope` / owner props / 声明包与行号。**只能用表里有的名字；kind/scope 会随版本变** |
| `client-externals.md` | bundle 必须 external 的宿主模块（React 等 10 个 + `dsh-client-runtime/client`）+ factory banner/intro/footer 三段原文 |
| `client-manifest.md` | `dsh.client` 字段（`platform` 必填 / `inject` 仅信息性 / `immediately`）与宿主报错原文；`exports["./client"]` 规则；`/plugins/<id>/client.js` 路由 |
| `settings-namespaces.md` | 该 commit 下设置页是否还有白名单（rc.7 起已无；更早 rc 有 → 树外插件配置暴露不到设置页） |

## 1. 一个前端半插件的组成（结构；代码去读 cookbook 与事实表）

```
my-plugin/
├── package.json         # 见 §2
├── cordis.patch.yml     # Host 行照常 insert；Web 侧不需要单独 patch 行
├── src/index.ts         # Host 半（可以只有 export function apply() {}）
├── src/client/index.tsx # 浏览器半：export const name / inject / apply(ctx: ClientContext)
├── tsdown.config.mjs    # 或 esbuild/rollup：产出 lib/client.js 的 factory bundle（§3）
└── lib/{index.js,client.js}
```

浏览器半模块的形状（来自 cookbook adding-a-settings-card）：
- `import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'`
- `export const inject = ['slots', ...]`：只列你真的读的**客户端服务**（`slots` / `locale` / `connection` / `remote` / `settingsScope` …，名字查钉死源码）
- `export function apply(ctx: ClientContext)`：所有注册走 `ctx.slots.register(...)`；**注册到别的包声明的 slot 必须包在 `ctx.slots.inject(name, () => ctx.slots.register(...))` 里**——它等待声明出现、声明消失时撤回；裸 `slots.register` 到未声明 slot 是加载期错误
- 别的插件的 slot 声明只能 **type-only** import（`import type {} from '<pkg>/client'`）；跨插件 value import 会被 bundle 纯度门禁拒绝，跨插件协作走 cordis 服务
- `root` 禁止注册（single slot，后注册者遮蔽整个 AppFrame）；要浮层用 `shell.overlay`（list）

## 2. package.json 必须有的三样

```jsonc
{
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js",          // 缺 → 宿主报 declares dsh.client but exports no "./client" bundle
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "files": ["lib/index.js", "lib/client.js", "cordis.patch.yml"],   // 漏 client.js → npm 发布丢文件（DSH-PKG-004）
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-runtime"] }   // inject 仅信息性，不排序、不等于服务级 inject
  }
}
```
依赖里的 `@deepseek-ai/dsh-client-*` 要钉 `next` 或精确 `0.1.0-rc.N`（`latest` 是旧 train，见 `npm-dist-tags.md`）。

## 3. lib/client.js 必须是 factory bundle（不是 ESM）

宿主把 `lib/client.js` 当 classic script 拉取，要求它调用 `window.__ModuleLoader__.load({ id: "<package name>", factory: (require) => { ...; return module.exports } })`。仓内用 `clientBundle()` tsdown preset 注入 banner/footer；**这个 preset 没有发布**，树外插件要自己配：
- 输出 CJS，`external` = `client-externals.md` 里的全部模块（缺一项就把第二份 React / slots 运行时打进 bundle，静默出错）
- 🔴 **banner + intro + footer 三段缺一不可**，逐字对照 `client-externals.md`：`intro` 是 `var module = { exports: {} }; var exports = module.exports;`，浏览器全局没有 `module`，漏了它 factory 物化时抛 `ReferenceError: module is not defined`。**esbuild / tsup 没有 `intro` 选项，必须把它并进 `banner`（换行分隔）**；扫描器 `DSH-CLIENT-003` 会拦
- `id` = package.json `name`
- 参考样例：规则包仓 `tools/hooks/test-fixtures/good-client-bundle/tsdown.config.mjs`（结构示意，不保证任何构建工具版本）
- 交 ESM 的症状：浏览器控制台 `client-modules: bundle /plugins/<id>/client.js loaded without registering "<id>" via __ModuleLoader__.load`

扫描器：`DSH-CLIENT-001`（bundle 形态 / id）、`DSH-CLIENT-002`（源码 import 了宿主模块但构建配置没 external）、`DSH-CLIENT-003`（缺 intro 段的 module/exports 声明）。

## 4. 常见任务 → 去哪查

| 任务 | slot（以 `slots.md` 为准） | 说明 |
|---|---|---|
| 设置页里给插件加配置卡片 | `settings.plugin.item`（keyed，key = Host 注册的 settings 命名空间） | Host 半 `installSettingsSection` + 浏览器半 `ctx.settingsScope.bind({ namespace })`；cookbook adding-a-settings-card |
| 会话里加一种业务节点 | `conversation.chat.node`（keyed，按 node kind） | cookbook adding-a-conversation-node |
| 某个工具的专属渲染 | `tool.call.toolview`（keyed，按工具名） | 只渲染你的工具，不要占 `conversation.details.tool`（那是整个面板） |
| 输入区加按钮 / 一行 | `conversation.input.left|right`（list）/ `conversation.input.dock`（list，整行） | 不要替换 `conversation.composer` 除非你要接管整个输入框 |
| 侧栏底部动作 / 会话头部动作 | `sidebar.footer.action` / `conversation.session.header.actions`（list，按 order） | — |
| 全局浮层 | `shell.overlay`（list，root） | 默认 click-through |

选 slot 前把它的 JSDoc 读一遍（`slots.md` 给了文件:行号）：single 意味着替换而非追加，keyed 需要 key，list 用 order。

## 5. 验证（要真实输出）

```sh
bash .dsh-assistant/hooks/lib/scan-dsh-plugin.sh --all .                       # DSH-CLIENT-001/002 无命中
dsh plugin --profile web add /abs/path/to/my-plugin && dsh web                  # 必须是 web-capable profile
curl -s http://127.0.0.1:<port>/plugins/<package-name>/client.js | head -c 200  # 应以 window.__ModuleLoader__.load 开头
```
浏览器控制台无 `loaded without registering` / 无 slot 声明错误；界面上真的出现你的元素（截图或描述具体位置）。headless profile 安装成功**不能**证明 UI 加载过。

## 6. 不要做的事

- 不改 harness 源码树（`tsconfig.client.json`、`packages/bundle/web-app/*`）——那是仓内包的注册面
- 不凭名字猜 slot；不因为「模板里有」就照抄某个 slot 名
- 不在浏览器里保存持久 / 特权状态：真源放 Host，走 Host→client 的 Remote 桥；浏览器只留展示态
- 不把 API key、token 放进客户端 bundle
