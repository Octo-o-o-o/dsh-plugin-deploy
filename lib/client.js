window.__ModuleLoader__.load({ id: "dsh-plugin-deploy", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  ComposerActionButton: () => ComposerActionButton,
  DEPLOY_PROMPT: () => DEPLOY_PROMPT,
  DeployToolView: () => DeployToolView,
  PUBLISH_CHECK_PROMPT: () => PUBLISH_CHECK_PROMPT,
  PublishToolView: () => PublishToolView,
  apply: () => apply,
  inject: () => inject,
  name: () => name,
  planComposerSubmit: () => planComposerSubmit,
  runComposerSubmit: () => runComposerSubmit
});
module.exports = __toCommonJS(index_exports);

// src/client/composer-submit.ts
var DEPLOY_PROMPT = "\u628A\u5F53\u524D\u5DE5\u4F5C\u533A\u90E8\u7F72\u5230 Cloudflare\uFF08\u7528 deploy \u5DE5\u5177\uFF09";
var PUBLISH_CHECK_PROMPT = "\u68C0\u67E5\u5F53\u524D\u5DE5\u4F5C\u533A\u80FD\u5426\u4F5C\u4E3A dsh \u63D2\u4EF6\u53D1\u5E03\uFF08\u7528 publish_plugin \u5DE5\u5177\uFF0Cmode \u7528 check\uFF09";
var COMPOSER_PROMPTS = [DEPLOY_PROMPT, PUBLISH_CHECK_PROMPT];
var REFUSE_TITLE = {
  busy: "\u8F93\u5165\u533A\u6B63\u5728\u5904\u7406\uFF0C\u8BF7\u7B49\u5F53\u524D\u63D0\u4EA4\u7ED3\u675F",
  occupied: "\u8F93\u5165\u6846\u91CC\u5DF2\u6709\u5185\u5BB9\u3002\u5148\u53D1\u51FA\u53BB\u6216\u6E05\u7A7A\uFF0C\u518D\u70B9\u8FD9\u91CC\uFF0C\u4EE5\u514D\u8986\u76D6\u4F60\u6B63\u5728\u5199\u7684\u5B57",
  unavailable: "\u5F53\u524D\u6CA1\u6709\u53EF\u63D0\u4EA4\u7684\u4F1A\u8BDD"
};
function planComposerSubmit(prompt, input, actions) {
  if (actions === void 0 || typeof actions.setDraft !== "function" || typeof actions.submit !== "function") {
    return { action: "refuse", reason: "unavailable" };
  }
  if (input === void 0 || input.sessionRemoved === true) {
    return { action: "refuse", reason: "unavailable" };
  }
  if (input.phase !== "plain") {
    return { action: "refuse", reason: "busy" };
  }
  const draft = input.draft.trim();
  if (draft !== "" && draft !== prompt) {
    return { action: "refuse", reason: "occupied" };
  }
  return { action: "submit", text: prompt };
}
function runComposerSubmit(prompt, input, actions) {
  const plan = planComposerSubmit(prompt, input, actions);
  if (plan.action === "submit" && actions !== void 0) {
    actions.setDraft(plan.text);
    actions.submit();
  }
  return plan;
}
function composerControlReason(input, actions, prompts = COMPOSER_PROMPTS) {
  if (actions === void 0 || typeof actions.setDraft !== "function" || typeof actions.submit !== "function" || input === void 0 || input.sessionRemoved === true) {
    return "unavailable";
  }
  if (input.phase !== "plain") return "busy";
  const draft = input.draft.trim();
  if (draft !== "" && !prompts.includes(draft)) return "occupied";
  return void 0;
}

// src/client/ActionButton.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var selectStyle = {
  fontSize: 12,
  lineHeight: "20px",
  height: 24,
  maxWidth: 112
};
function snapshotFromZone(props) {
  if (props.input === void 0) return void 0;
  return {
    draft: props.input.draft,
    phase: props.input.phase,
    sessionRemoved: props.session?.removed === true || props.input.sessionRemoved === true
  };
}
function ComposerActionButton(props) {
  const input = snapshotFromZone(props);
  const actions = props.inputActions;
  const blocked = composerControlReason(input, actions);
  const title = blocked === void 0 ? "\u5199\u5165\u4E00\u53E5\u90E8\u7F72/\u6821\u9A8C\u6307\u4EE4\u5E76\u63D0\u4EA4\uFF0C\u8D70\u6B63\u5E38 agent turn" : REFUSE_TITLE[blocked];
  const onChange = (event) => {
    const target = event.currentTarget ?? event.target;
    const value = target.value;
    target.value = "";
    if (value === "deploy") runComposerSubmit(DEPLOY_PROMPT, input, actions);
    if (value === "publish") runComposerSubmit(PUBLISH_CHECK_PROMPT, input, actions);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "select",
    {
      "aria-label": "\u90E8\u7F72\u6216\u68C0\u67E5\u53D1\u5E03",
      title,
      disabled: blocked !== void 0,
      defaultValue: "",
      onChange,
      style: selectStyle,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", disabled: true, hidden: true, children: "\u53D1\u5E03" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "option",
          {
            value: "deploy",
            disabled: planComposerSubmit(DEPLOY_PROMPT, input, actions).action !== "submit",
            children: "\u90E8\u7F72\u5230 Cloudflare"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "option",
          {
            value: "publish",
            disabled: planComposerSubmit(PUBLISH_CHECK_PROMPT, input, actions).action !== "submit",
            children: "\u68C0\u67E5\u63D2\u4EF6\u53D1\u5E03"
          }
        )
      ]
    }
  );
}
function ComposerRetryButton(props) {
  const input = props.useInput((state) => state);
  const plan = planComposerSubmit(props.prompt, input, props.inputActions);
  const disabled = plan.action !== "submit";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      disabled,
      title: disabled && plan.action === "refuse" ? REFUSE_TITLE[plan.reason] : void 0,
      onClick: () => {
        runComposerSubmit(props.prompt, input, props.inputActions);
      },
      children: props.label
    }
  );
}
function maybeComposerRetry(props, prompt, label) {
  if (props.inputActions === void 0 || typeof props.useInput !== "function") return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    ComposerRetryButton,
    {
      prompt,
      label,
      useInput: props.useInput,
      inputActions: props.inputActions
    }
  );
}

// src/client/card-controller.ts
var DEFAULT_REF = "CLOUDFLARE_API_TOKEN";
var DEFAULT_NPM_REF = "NPM_TOKEN";
var DeployCardController = class {
  constructor(scope, credentials) {
    this.scope = scope;
    this.credentials = credentials;
    this.state = this.blank();
    scope.subscribe(() => {
      this.syncScope();
      void this.readCredential();
    });
    this.syncScope();
    void this.readCredential();
  }
  state;
  listeners = /* @__PURE__ */ new Set();
  blank() {
    return {
      tokenEnv: DEFAULT_REF,
      tokenEnvDraft: DEFAULT_REF,
      configured: false,
      writable: true,
      npmTokenEnv: DEFAULT_NPM_REF,
      npmTokenEnvDraft: DEFAULT_NPM_REF,
      npmConfigured: false,
      npmWritable: true,
      status: "loading",
      scopeWritable: false
    };
  }
  emit() {
    for (const listener of this.listeners) listener();
  }
  syncScope() {
    const snapshot = this.scope.getSnapshot();
    const tokenEnv = snapshot.value?.apiTokenEnv?.trim() || DEFAULT_REF;
    const npmTokenEnv = snapshot.value?.npmTokenEnv?.trim() || DEFAULT_NPM_REF;
    this.state = {
      ...this.state,
      tokenEnv,
      tokenEnvDraft: tokenEnv,
      npmTokenEnv,
      npmTokenEnvDraft: npmTokenEnv,
      status: snapshot.status,
      scopeWritable: snapshot.writable
    };
    this.emit();
  }
  getSnapshot() {
    return this.state;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  inject() {
    return {
      hooks: { deployCard: this },
      setTokenEnvDraft: (value) => {
        this.state = { ...this.state, tokenEnvDraft: value };
        this.emit();
      },
      saveTokenEnv: async () => {
        const next = this.state.tokenEnvDraft.trim() || DEFAULT_REF;
        await this.scope.set("apiTokenEnv", next);
      },
      saveTokenValue: async (value) => {
        if (this.credentials === void 0) return;
        const ref = this.state.tokenEnv;
        await this.credentials.set({ ref, value });
        await this.readCredential();
      },
      setNpmTokenEnvDraft: (value) => {
        this.state = { ...this.state, npmTokenEnvDraft: value };
        this.emit();
      },
      saveNpmTokenEnv: async () => {
        const next = this.state.npmTokenEnvDraft.trim() || DEFAULT_NPM_REF;
        await this.scope.set("npmTokenEnv", next);
      },
      saveNpmTokenValue: async (value) => {
        if (this.credentials === void 0) return;
        const ref = this.state.npmTokenEnv;
        await this.credentials.set({ ref, value });
        await this.readCredential();
      }
    };
  }
  refreshCredential(ref) {
    if (ref !== this.state.tokenEnv && ref !== this.state.npmTokenEnv) return;
    void this.readCredential();
  }
  async readCredential() {
    if (this.credentials === void 0) return;
    const snapshot = this.scope.getSnapshot().value;
    const cfRef = snapshot?.apiTokenEnv?.trim() || DEFAULT_REF;
    const npmRef = snapshot?.npmTokenEnv?.trim() || DEFAULT_NPM_REF;
    const refs = cfRef === npmRef ? [cfRef] : [cfRef, npmRef];
    let response;
    try {
      response = await this.credentials.describe({ refs });
    } catch {
      return;
    }
    if (!response.result.ok) return;
    const creds = response.result.value?.credentials ?? {};
    const cfView = creds[cfRef];
    const npmView = creds[npmRef];
    const next = {
      configured: cfView?.configured ?? false,
      writable: cfView?.writable ?? true,
      npmConfigured: npmView?.configured ?? false,
      npmWritable: npmView?.writable ?? true
    };
    if (next.configured === this.state.configured && next.writable === this.state.writable && next.npmConfigured === this.state.npmConfigured && next.npmWritable === this.state.npmWritable) return;
    this.state = { ...this.state, ...next };
    this.emit();
  }
};

// src/client/SettingsCard.tsx
var import_react = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
function FieldLabel(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 4 }, children: props.children });
}
function Hint(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 12, opacity: 0.75, marginTop: 4, lineHeight: 1.45 }, children: props.children });
}
function DeploySettingsCard(props) {
  const state = props.useDeployCard((snapshot) => snapshot);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { style: { display: "flex", flexDirection: "column", gap: 16, padding: 12 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 16, fontWeight: 650 }, children: "Cloudflare \u90E8\u7F72" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Hint, { children: "token \u5B58\u5728 dsh \u51ED\u636E\u670D\u52A1\u91CC\uFF0C\u6A21\u578B\u770B\u4E0D\u5230\u503C\u3002\u8BBE\u7F6E\u91CC\u53EA\u4FDD\u5B58\u5F15\u7528\u540D\u3002auto \u6309\u8BA4\u8BC1\u72B6\u6001\u9009\u62E9\uFF1B\u663E\u5F0F\u4E34\u65F6\u9884\u89C8\u8D70\u9694\u79BB\u73AF\u5883\uFF0C\u4E0D\u5FC5\u767B\u51FA wrangler\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FieldLabel, { children: "\u8BBE\u7F6E\u91CC\u7684 token" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: state.configured ? "\u5DF2\u914D\u7F6E" : "\u672A\u914D\u7F6E" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FieldLabel, { children: "API token \u5F15\u7528\u540D" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          value: state.tokenEnvDraft,
          disabled: !state.scopeWritable,
          onChange: (event) => props.setTokenEnvDraft(event.target.value),
          onBlur: () => {
            void props.saveTokenEnv();
          },
          spellCheck: false,
          style: { width: "100%", boxSizing: "border-box" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Hint, { children: "\u9ED8\u8BA4 CLOUDFLARE_API_TOKEN\u3002\u8FD9\u91CC\u6539\u7684\u662F\u5F15\u7528\u540D\uFF0C\u4E0D\u662F token \u672C\u8EAB\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FieldLabel, { children: "\u51ED\u636E\u662F\u5426\u5DF2\u914D\u7F6E" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: state.configured ? "\u5DF2\u914D\u7F6E\uFF08\u503C\u4E0D\u4F1A\u663E\u793A\uFF09" : "\u672A\u914D\u7F6E" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FieldLabel, { children: "\u5199\u5165 token \u503C\uFF08\u53EA\u5199\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        TokenWriteField,
        {
          disabled: !state.writable,
          onSave: (value) => props.saveTokenValue(value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Hint, { children: "\u8F93\u5165\u6846\u4E0D\u4F1A\u56DE\u586B\u5DF2\u6709\u503C\u3002\u4FDD\u5B58\u540E\u53EA\u66F4\u65B0\u300C\u662F\u5426\u5DF2\u914D\u7F6E\u300D\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 16, fontWeight: 650 }, children: "\u53D1\u5E03 dsh \u63D2\u4EF6" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Hint, { children: "npm token \u540C\u6837\u53EA\u5B58\u5F15\u7528\u540D\u3002\u53D1\u5E03\u5230 npm \u9700\u8981\u5BA1\u6279\uFF0C\u4E14\u4E0D\u53EF\u9006\u3002\u672C\u5DE5\u5177\u4E0D\u63A8 GitHub\u3001\u4E0D\u4EE3\u63D0 dsh.pub \u6536\u5F55 PR\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FieldLabel, { children: "\u8BBE\u7F6E\u91CC\u7684 npm token" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: state.npmConfigured ? "\u5DF2\u914D\u7F6E" : "\u672A\u914D\u7F6E" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FieldLabel, { children: "npm token \u5F15\u7528\u540D" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          value: state.npmTokenEnvDraft,
          disabled: !state.scopeWritable,
          onChange: (event) => props.setNpmTokenEnvDraft(event.target.value),
          onBlur: () => {
            void props.saveNpmTokenEnv();
          },
          spellCheck: false,
          style: { width: "100%", boxSizing: "border-box" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Hint, { children: "\u9ED8\u8BA4 NPM_TOKEN\u3002\u8FD9\u91CC\u6539\u7684\u662F\u5F15\u7528\u540D\uFF0C\u4E0D\u662F token \u672C\u8EAB\u3002\u53D1\u5E03\u8BF7\u7528 automation token\uFF0C\u907F\u514D OTP/2FA \u5361\u4F4F\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FieldLabel, { children: "npm \u51ED\u636E\u662F\u5426\u5DF2\u914D\u7F6E" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: state.npmConfigured ? "\u5DF2\u914D\u7F6E\uFF08\u503C\u4E0D\u4F1A\u663E\u793A\uFF09" : "\u672A\u914D\u7F6E" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(FieldLabel, { children: "\u5199\u5165 npm token \u503C\uFF08\u53EA\u5199\uFF09" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        TokenWriteField,
        {
          disabled: !state.npmWritable,
          onSave: (value) => props.saveNpmTokenValue(value)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Hint, { children: "\u8F93\u5165\u6846\u4E0D\u4F1A\u56DE\u586B\u5DF2\u6709\u503C\u3002\u4FDD\u5B58\u540E\u53EA\u66F4\u65B0\u300C\u662F\u5426\u5DF2\u914D\u7F6E\u300D\u3002" })
    ] })
  ] });
}
function TokenWriteField(props) {
  const [draft, setDraft] = (0, import_react.useState)("");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "input",
      {
        type: "password",
        autoComplete: "off",
        disabled: props.disabled,
        value: draft,
        placeholder: "\u7C98\u8D34 token\uFF0C\u4FDD\u5B58\u540E\u6E05\u7A7A",
        onChange: (event) => setDraft(event.target.value),
        style: { flex: 1, boxSizing: "border-box" }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "button",
      {
        type: "button",
        disabled: props.disabled || draft.length === 0,
        onClick: () => {
          const value = draft;
          setDraft("");
          void props.onSave(value);
        },
        children: "\u4FDD\u5B58"
      }
    )
  ] });
}

// src/format.ts
var UNSTRUCTURED_RESULT_NOTICE = "\u672C\u6B21\u8C03\u7528\u672A\u63D0\u4F9B\u7ED3\u6784\u5316\u7ED3\u679C\uFF0C\u65E0\u6CD5\u5C55\u793A\u9884\u89C8\u94FE\u63A5\u3002\u4E0B\u9762\u662F\u539F\u59CB\u8F93\u51FA\u3002";
var META_KEYS = [
  "ok",
  "mode",
  "previewUrl",
  "claimUrl",
  "claimWithin",
  "workerName",
  "warnings",
  "error",
  "hint"
];
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function sanitizeUrl(url) {
  return url.replace(/[)\]>'"，。；：、.,;:!?]+$/u, "");
}
function extractUrl(text) {
  const markdown = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/.exec(text);
  if (markdown) return sanitizeUrl(markdown[2]);
  const bare = /https?:\/\/[^\s]+/.exec(text);
  if (bare) return sanitizeUrl(bare[0]);
  return void 0;
}
function isClaimUrl(url) {
  return /claim-preview|claimToken=/i.test(url);
}
function isIgnoredUrl(url) {
  return /cloudflare\.com\/(terms|privacypolicy)/i.test(url);
}
function labeledValue(line, labels) {
  const match = labels.exec(line);
  if (match === null) return void 0;
  const rest = line.slice(match.index + match[0].length).trim();
  return rest.length > 0 ? rest : void 0;
}
var EXPLICIT_MODE = /(?:部署模式[：:]\s*|mode\s*=\s*)(account|temporary)\b/i;
function inferModeFromText(text, clues) {
  const explicit = EXPLICIT_MODE.exec(text);
  if (explicit) {
    return explicit[1].toLowerCase() === "account" ? "account" : "temporary";
  }
  const first = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0) ?? "";
  if (/已部署到你的 Cloudflare/.test(first)) return "account";
  if (/临时预览地址已生成/.test(first)) return "temporary";
  if (/已部署到你的 Cloudflare/.test(text)) return "account";
  if (/临时预览地址已生成/.test(text)) return "temporary";
  if (clues.claimUrl !== void 0 || clues.claimWithin !== void 0) return "temporary";
  return void 0;
}
function parseDeployText(text) {
  const parsed = { warnings: [] };
  if (text.length === 0) return parsed;
  if (/部署未完成/.test(text) || /ok\s*=\s*false/.test(text)) parsed.ok = false;
  else if (/临时预览地址已生成|已部署到你的 Cloudflare|部署完成|部署模式[：:]|ok\s*=\s*true/.test(text)) {
    parsed.ok = true;
  }
  const lines = text.split(/\r?\n/);
  let inWarnings = false;
  for (const line of lines) {
    if (/^提醒：/.test(line)) {
      inWarnings = true;
      continue;
    }
    if (inWarnings) {
      const item = /^-\s+(.+)$/.exec(line);
      if (item) parsed.warnings.push(item[1]);
      else if (line.trim().length === 0) inWarnings = false;
      continue;
    }
    const fail = /^部署未完成[：:]\s*(.*)$/.exec(line);
    if (fail) {
      const message = fail[1].trim();
      if (message.length > 0) parsed.error = message;
      continue;
    }
    const windowValue = labeledValue(line, /认领窗口[：:]/);
    if (windowValue !== void 0) parsed.claimWithin = windowValue;
    const claimParen = /认领链接[（(]([^）)]+)[）)]/.exec(line);
    if (claimParen) parsed.claimWithin = claimParen[1].trim();
    const worker = labeledValue(line, /Worker(?:\s*名)?[：:]/);
    if (worker !== void 0) {
      const name2 = /^([A-Za-z0-9][A-Za-z0-9_-]*)/.exec(worker);
      if (name2) parsed.workerName = name2[1];
    }
    const url = extractUrl(line);
    if (url === void 0 || isIgnoredUrl(url)) continue;
    if (isClaimUrl(url) || /认领\s*(URL|链接|地址)/.test(line)) {
      parsed.claimUrl = url;
      continue;
    }
    if (/预览\s*(URL|地址|链接)|访问\s*URL/.test(line) || /\.workers\.dev(?:[/?#]|$)/i.test(url)) {
      parsed.previewUrl = url;
    }
  }
  if (parsed.previewUrl === void 0 || parsed.claimUrl === void 0) {
    const urls = [...text.matchAll(/https?:\/\/[^\s]+/g)].map((item) => sanitizeUrl(item[0]));
    if (parsed.claimUrl === void 0) {
      const claim = urls.find((item) => isClaimUrl(item));
      if (claim !== void 0) parsed.claimUrl = claim;
    }
    if (parsed.previewUrl === void 0) {
      const preview = urls.find((item) => !isClaimUrl(item) && !isIgnoredUrl(item) && /\.workers\.dev/i.test(item));
      if (preview !== void 0) parsed.previewUrl = preview;
    }
  }
  const mode = inferModeFromText(text, parsed);
  if (mode !== void 0) parsed.mode = mode;
  return parsed;
}
function readPresentationMeta(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
  const record = value;
  if (!META_KEYS.some((key) => key in record)) return void 0;
  return record;
}
function pickString(preferred, fallback) {
  if (isNonEmptyString(preferred)) return preferred.trim();
  if (isNonEmptyString(fallback)) return fallback;
  return void 0;
}
function resolveDeployPresentation(input) {
  const meta = readPresentationMeta(input.meta);
  const parsed = parseDeployText(input.text);
  const previewUrl = pickString(meta?.previewUrl, parsed.previewUrl);
  const claimUrl = pickString(meta?.claimUrl, parsed.claimUrl);
  const claimWithin = pickString(meta?.claimWithin, parsed.claimWithin);
  const workerName = pickString(meta?.workerName, parsed.workerName);
  const mode = pickString(meta?.mode, parsed.mode);
  const error = pickString(meta?.error, parsed.error);
  const hint = pickString(meta?.hint, parsed.hint);
  const warnings = Array.isArray(meta?.warnings) ? meta.warnings : parsed.warnings;
  let ok;
  if (input.isError === true) ok = false;
  else if (typeof meta?.ok === "boolean") ok = meta.ok;
  else if (typeof parsed.ok === "boolean") ok = parsed.ok;
  else ok = true;
  let source;
  if (meta !== void 0) source = "meta";
  else if (parsed.previewUrl !== void 0 || parsed.claimUrl !== void 0 || parsed.workerName !== void 0 || parsed.ok !== void 0 || parsed.mode !== void 0) {
    source = "text";
  } else {
    source = "none";
  }
  return {
    source,
    ok,
    warnings,
    rawText: input.text,
    ...mode === void 0 ? {} : { mode },
    ...previewUrl === void 0 ? {} : { previewUrl },
    ...claimUrl === void 0 ? {} : { claimUrl },
    ...claimWithin === void 0 ? {} : { claimWithin },
    ...workerName === void 0 ? {} : { workerName },
    ...error === void 0 ? {} : { error },
    ...hint === void 0 ? {} : { hint }
  };
}

// src/client/DeployView.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function contentText(block) {
  return (block.content ?? []).filter((item) => item.type === "text" && typeof item.text === "string").map((item) => item.text ?? "").join("\n");
}
function DeployToolView(props) {
  const settled = props.block.kind === "tool-result";
  const retry = maybeComposerRetry(props, DEPLOY_PROMPT, "\u91CD\u65B0\u90E8\u7F72");
  if (!settled) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("article", { style: { padding: 12 }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u6B63\u5728\u90E8\u7F72\u5230 Cloudflare\u2026" }) });
  }
  const rawText = contentText(props.block);
  const resolved = resolveDeployPresentation({
    meta: props.block.meta,
    text: rawText,
    isError: props.block.isError
  });
  const raw = /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("pre", { style: { whiteSpace: "pre-wrap", fontSize: 12 }, children: rawText });
  if (!resolved.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("article", { style: { padding: 12, display: "flex", flexDirection: "column", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u90E8\u7F72\u5931\u8D25" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: resolved.error ?? "wrangler \u672A\u6210\u529F\u5B8C\u6210\u90E8\u7F72\u3002" }),
      resolved.hint ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: resolved.hint }) : null,
      raw,
      retry
    ] });
  }
  const temporary = resolved.mode === "temporary";
  const title = temporary ? "\u4E34\u65F6\u9884\u89C8\u5730\u5740" : resolved.mode === "account" ? "\u6301\u4E45 URL" : "\u90E8\u7F72\u5B8C\u6210";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("article", { style: { padding: 12, display: "flex", flexDirection: "column", gap: 10 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: title }),
    resolved.previewUrl ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("a", { href: resolved.previewUrl, target: "_blank", rel: "noreferrer", children: resolved.previewUrl }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: UNSTRUCTURED_RESULT_NOTICE }),
      raw
    ] }),
    resolved.workerName ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
      "Worker \u540D\uFF1A",
      resolved.workerName
    ] }) : null,
    temporary && (resolved.previewUrl !== void 0 || resolved.claimUrl !== void 0) ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "section",
      {
        style: {
          border: "1px solid currentColor",
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 6
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u5FC5\u987B\u8BA4\u9886\uFF0C\u5426\u5219\u4F1A\u88AB\u5220\u9664" }),
          resolved.claimWithin ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
            "\u5269\u4F59\u65F6\u95F4\uFF1A",
            resolved.claimWithin
          ] }) : null,
          resolved.claimUrl ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("a", { href: resolved.claimUrl, target: "_blank", rel: "noreferrer", children: "\u6253\u5F00\u8BA4\u9886\u94FE\u63A5" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: "\u672A\u80FD\u89E3\u6790\u51FA\u8BA4\u9886\u94FE\u63A5\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: "\u8FD9\u662F\u4E34\u65F6\u9884\u89C8\uFF0C\u4E0D\u662F\u6B63\u5F0F\u4E0A\u7EBF\u3002\u4E0D\u5728\u8BA4\u9886\u7A97\u53E3\u5185\u5B8C\u6210\u8BA4\u9886\uFF0CCloudflare \u4F1A\u5220\u9664\u8BE5\u4E34\u65F6\u8D26\u53F7\u53CA\u5176\u8D44\u6E90\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: "\u8BE5\u8BA4\u9886\u94FE\u63A5\u4F1A\u8BB0\u5F55\u5728\u4F1A\u8BDD\u65E5\u5FD7\u4E2D\uFF0C\u8BF7\u52FF\u5206\u4EAB\u6B64\u4F1A\u8BDD\u3002" })
        ]
      }
    ) : null,
    resolved.warnings.map((warning) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: warning }, warning)),
    retry
  ] });
}

// src/publish-format.ts
var PUBLISH_NEXT_STEPS = [
  "\u672C\u5DE5\u5177\u4E0D\u63A8 GitHub\u3001\u4E0D\u4EE3\u63D0 dsh.pub \u6536\u5F55 PR\u3002",
  "GitHub \u76F4\u88C5\u53EA\u53D6\u6E90\u7801\uFF0C\u9700\u8981\u81EA\u5305\u542B prepare\uFF0C\u7528\u6237\u8FD8\u8981\u628A\u5305\u52A0\u5165 profile \u7684 pnpm-workspace.yaml allowBuilds\u3002\u89C1 https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish",
  "\u60F3\u6536\u5F55\u5230\u793E\u533A\u76EE\u5F55 dsh.pub\uFF0C\u8BF7\u6309\u8BE5\u7AD9\u8BF4\u660E\u81EA\u884C\u63D0\u4EA4\u3002"
].join("\n");
var UNSTRUCTURED_PUBLISH_NOTICE = "\u672C\u6B21\u8C03\u7528\u672A\u63D0\u4F9B\u7ED3\u6784\u5316\u7ED3\u679C\uFF0C\u65E0\u6CD5\u5C55\u793A\u6821\u9A8C\u6E05\u5355\u3002\u4E0B\u9762\u662F\u539F\u59CB\u8F93\u51FA\u3002";
var TARBALL_TMP_NOTICE = "tarball \u653E\u5728\u4E34\u65F6\u76EE\u5F55\uFF0C\u8BF7\u81EA\u884C\u62F7\u8D70\u6216\u5C3D\u5FEB\u4F7F\u7528\u3002";
var META_KEYS2 = [
  "ok",
  "mode",
  "packageName",
  "version",
  "access",
  "tag",
  "tarballPath",
  "installCommand",
  "filename",
  "fileCount",
  "packedSize",
  "unpackedSize",
  "checks",
  "warnings",
  "error",
  "hint"
];
function isNonEmptyString2(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function labeledValue2(line, labels) {
  const match = labels.exec(line);
  if (match === null) return void 0;
  const rest = line.slice(match.index + match[0].length).trim();
  return rest.length > 0 ? rest : void 0;
}
function parseCheckLine(line) {
  const match = /^-\s+\[(通过|失败)\]\s+([a-z0-9-]+)((?:（不阻止 pack）)?)\s*：\s*(.*)$/.exec(line);
  if (match === null) return void 0;
  const ok = match[1] === "\u901A\u8FC7";
  const blocking = match[3].length === 0;
  return { id: match[2], ok, blocking, detail: match[4] };
}
function parsePublishText(text) {
  const parsed = { checks: [], warnings: [] };
  if (text.length === 0) return parsed;
  if (/发布未完成/.test(text) || /ok\s*=\s*false/.test(text)) parsed.ok = false;
  else if (/校验完成|打包完成|已发布到 npm|发布模式[：:]|ok\s*=\s*true/.test(text)) {
    parsed.ok = true;
  }
  const lines = text.split(/\r?\n/);
  let section = "none";
  const hintLines = [];
  for (const [index, line] of lines.entries()) {
    if (/^校验：/.test(line)) {
      section = "checks";
      continue;
    }
    if (/^提醒：/.test(line)) {
      section = "warnings";
      continue;
    }
    if (/^下一步：/.test(line)) {
      section = "next";
      continue;
    }
    if (section === "checks") {
      const item = parseCheckLine(line);
      if (item) {
        parsed.checks.push(item);
        continue;
      }
      if (line.trim().length === 0) section = "none";
      continue;
    }
    if (section === "warnings") {
      const item = /^-\s+(.+)$/.exec(line);
      if (item) parsed.warnings.push(item[1]);
      else if (line.trim().length === 0) section = "none";
      continue;
    }
    if (section === "next") continue;
    const fail = /^发布未完成[：:]\s*(.*)$/.exec(line);
    if (fail) {
      const message = fail[1].trim();
      if (message.length > 0) parsed.error = message;
      continue;
    }
    const mode = labeledValue2(line, /发布模式[：:]/);
    if (mode === "check" || mode === "pack" || mode === "npm") parsed.mode = mode;
    const name2 = labeledValue2(line, /包名[：:]/);
    if (name2 !== void 0) parsed.packageName = name2;
    const version = labeledValue2(line, /版本[：:]/);
    if (version !== void 0) parsed.version = version;
    const access = labeledValue2(line, /访问[：:]/);
    if (access === "public" || access === "restricted") parsed.access = access;
    const tag = labeledValue2(line, /dist-tag[：:]/);
    if (tag !== void 0) parsed.tag = tag;
    const tarball = labeledValue2(line, /tarball[：:]/);
    if (tarball !== void 0) parsed.tarballPath = tarball;
    const install = labeledValue2(line, /安装[：:]/);
    if (install !== void 0) parsed.installCommand = install;
    const summary = labeledValue2(line, /清单[：:]/);
    if (summary !== void 0) {
      const count = /(\d+)\s*个文件/.exec(summary);
      if (count) parsed.fileCount = Number(count[1]);
      const packed = /打包\s+(\d+)\s*字节/.exec(summary);
      if (packed) parsed.packedSize = Number(packed[1]);
      const unpacked = /解压\s+(\d+)\s*字节/.exec(summary);
      if (unpacked) parsed.unpackedSize = Number(unpacked[1]);
    }
    if (index === 1 && parsed.ok === false && parsed.error !== void 0 && line.trim().length > 0 && !/发布模式|包名|版本|访问|dist-tag|tarball|安装|清单/.test(line)) {
      hintLines.push(line.trim());
    }
  }
  if (hintLines.length > 0 && parsed.hint === void 0) parsed.hint = hintLines.join("\n");
  return parsed;
}
function readPublishPresentationMeta(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
  const record = value;
  if (!META_KEYS2.some((key) => key in record)) return void 0;
  return record;
}
function pickString2(preferred, fallback) {
  if (isNonEmptyString2(preferred)) return preferred.trim();
  if (isNonEmptyString2(fallback)) return fallback;
  return void 0;
}
function pickNumber(preferred, fallback) {
  if (typeof preferred === "number" && Number.isFinite(preferred)) return preferred;
  return fallback;
}
function asChecks(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const checks = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item;
    if (typeof rec.id !== "string" || typeof rec.ok !== "boolean" || typeof rec.detail !== "string") {
      continue;
    }
    checks.push({
      id: rec.id,
      ok: rec.ok,
      detail: rec.detail,
      blocking: typeof rec.blocking === "boolean" ? rec.blocking : true
    });
  }
  return checks.length > 0 ? checks : fallback;
}
function resolvePublishPresentation(input) {
  const meta = readPublishPresentationMeta(input.meta);
  const parsed = parsePublishText(input.text);
  const packageName = pickString2(meta?.packageName, parsed.packageName);
  const version = pickString2(meta?.version, parsed.version);
  const mode = pickString2(meta?.mode, parsed.mode);
  const access = pickString2(meta?.access, parsed.access);
  const tag = pickString2(meta?.tag, parsed.tag);
  const tarballPath = pickString2(meta?.tarballPath, parsed.tarballPath);
  const installCommand = pickString2(meta?.installCommand, parsed.installCommand);
  const filename = pickString2(meta?.filename, void 0);
  const error = pickString2(meta?.error, parsed.error);
  const hint = pickString2(meta?.hint, parsed.hint);
  const nextSteps = pickString2(meta?.nextSteps, void 0);
  const fileCount = pickNumber(meta?.fileCount, parsed.fileCount);
  const packedSize = pickNumber(meta?.packedSize, parsed.packedSize);
  const unpackedSize = pickNumber(meta?.unpackedSize, parsed.unpackedSize);
  const checks = asChecks(meta?.checks, parsed.checks);
  const warnings = Array.isArray(meta?.warnings) ? meta.warnings : parsed.warnings;
  let ok;
  if (input.isError === true) ok = false;
  else if (typeof meta?.ok === "boolean") ok = meta.ok;
  else if (typeof parsed.ok === "boolean") ok = parsed.ok;
  else ok = true;
  let source;
  if (meta !== void 0) source = "meta";
  else if (parsed.packageName !== void 0 || parsed.tarballPath !== void 0 || parsed.mode !== void 0 || parsed.ok !== void 0 || parsed.checks.length > 0) {
    source = "text";
  } else {
    source = "none";
  }
  return {
    source,
    ok,
    checks,
    warnings,
    rawText: input.text,
    ...mode === void 0 ? {} : { mode },
    ...packageName === void 0 ? {} : { packageName },
    ...version === void 0 ? {} : { version },
    ...access === void 0 ? {} : { access },
    ...tag === void 0 ? {} : { tag },
    ...tarballPath === void 0 ? {} : { tarballPath },
    ...installCommand === void 0 ? {} : { installCommand },
    ...filename === void 0 ? {} : { filename },
    ...fileCount === void 0 ? {} : { fileCount },
    ...packedSize === void 0 ? {} : { packedSize },
    ...unpackedSize === void 0 ? {} : { unpackedSize },
    ...error === void 0 ? {} : { error },
    ...hint === void 0 ? {} : { hint },
    ...nextSteps === void 0 ? {} : { nextSteps }
  };
}

// src/client/PublishView.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function contentText2(block) {
  return (block.content ?? []).filter((item) => item.type === "text" && typeof item.text === "string").map((item) => item.text ?? "").join("\n");
}
function PublishToolView(props) {
  const settled = props.block.kind === "tool-result";
  const retry = maybeComposerRetry(props, PUBLISH_CHECK_PROMPT, "\u91CD\u65B0\u6821\u9A8C");
  if (!settled) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("article", { style: { padding: 12 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "\u6B63\u5728\u5904\u7406\u63D2\u4EF6\u53D1\u5E03\u2026" }) });
  }
  const rawText = contentText2(props.block);
  const resolved = resolvePublishPresentation({
    meta: props.block.meta,
    text: rawText,
    isError: props.block.isError
  });
  const raw = /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pre", { style: { whiteSpace: "pre-wrap", fontSize: 12 }, children: rawText });
  if (resolved.source === "none" && resolved.checks.length === 0 && resolved.packageName === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("article", { style: { padding: 12, display: "flex", flexDirection: "column", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "\u53D1\u5E03\u7ED3\u679C" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: UNSTRUCTURED_PUBLISH_NOTICE }),
      raw,
      retry
    ] });
  }
  const title = !resolved.ok ? "\u53D1\u5E03\u672A\u5B8C\u6210" : resolved.mode === "npm" ? "\u5DF2\u53D1\u5E03\u5230 npm" : resolved.mode === "pack" ? "\u6253\u5305\u5B8C\u6210" : "\u6821\u9A8C\u5B8C\u6210";
  const identity = resolved.packageName !== void 0 && resolved.version !== void 0 ? `${resolved.packageName}@${resolved.version}` : resolved.packageName ?? resolved.version;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("article", { style: { padding: 12, display: "flex", flexDirection: "column", gap: 10 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: title }),
    identity ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: identity }) : null,
    resolved.fileCount !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: `\u6E05\u5355\uFF1A${resolved.fileCount} \u4E2A\u6587\u4EF6${resolved.packedSize !== void 0 ? `\uFF0C\u6253\u5305 ${resolved.packedSize} \u5B57\u8282` : ""}${resolved.unpackedSize !== void 0 ? `\uFF0C\u89E3\u538B ${resolved.unpackedSize} \u5B57\u8282` : ""}` }) : null,
    resolved.tarballPath ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
      "tarball\uFF1A",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: resolved.tarballPath })
    ] }) : null,
    resolved.tarballPath ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: TARBALL_TMP_NOTICE }) : null,
    resolved.installCommand ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
      "\u5B89\u88C5\uFF1A",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: resolved.installCommand })
    ] }) : null,
    resolved.checks.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("section", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "\u6821\u9A8C\u6E05\u5355" }),
      resolved.checks.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        item.ok ? "\u901A\u8FC7" : item.blocking ? "\u5931\u8D25" : "\u6CE8\u610F",
        " \xB7 ",
        item.id,
        "\uFF1A",
        item.detail
      ] }, item.id))
    ] }) : null,
    !resolved.ok ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: resolved.error ?? "\u53D1\u5E03\u672A\u6210\u529F\u5B8C\u6210\u3002" }),
      resolved.hint ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: resolved.hint }) : null
    ] }) : null,
    resolved.warnings.map((warning) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: warning }, warning)),
    retry
  ] });
}

// src/client/index.tsx
var name = "dsh-plugin-deploy";
var inject = ["slots", "connection", "remote", "settingsScope"];
function apply(ctx) {
  const connection = ctx.get("connection");
  const scope = ctx.settingsScope.bind({ namespace: "deploy" });
  const card = new DeployCardController(scope, connection?.api?.credentials);
  ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
    name: "settings.plugin.item",
    key: "deploy",
    inject: () => card.inject()
  }, DeploySettingsCard));
  ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
    name: "tool.call.toolview",
    key: "deploy"
  }, DeployToolView));
  ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
    name: "tool.call.toolview",
    key: "publish_plugin"
  }, PublishToolView));
  ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
    name: "conversation.input.left",
    id: "dsh-plugin-deploy",
    order: 100,
    label: "\u53D1\u5E03"
  }, ComposerActionButton));
  const remote = ctx.get("remote");
  if (remote?.$on !== void 0) {
    ctx.effect(() => remote.$on("credentials/updated", (ref) => {
      card.refreshCredential(ref);
    }));
  }
}
return module.exports; } });
