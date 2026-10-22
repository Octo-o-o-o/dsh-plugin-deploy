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
  DeployCardController: () => DeployCardController,
  DeploySettingsCard: () => DeploySettingsCard,
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

// src/client/ActionButton.tsx
var import_react = require("react");

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
var rootStyle = {
  position: "relative"
};
var triggerStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  minHeight: 28,
  padding: "3px 4px",
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 12,
  lineHeight: "18px",
  cursor: "pointer"
};
var triggerDisabledStyle = {
  ...triggerStyle,
  cursor: "default",
  opacity: 0.45
};
var menuStyle = {
  position: "absolute",
  top: "calc(100% + 5px)",
  left: 0,
  zIndex: 100,
  boxSizing: "border-box",
  minWidth: 168,
  margin: 0,
  padding: 4,
  listStyle: "none",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 12,
  background: "var(--dsw-specific-menu, var(--dsw-alias-bg-elevated, var(--dsw-alias-bg-layer-3)))",
  boxShadow: "var(--dsw-shadow-lv3)"
};
var itemStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  textAlign: "left",
  minHeight: 32,
  padding: "6px 8px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  color: "var(--dsw-alias-label-primary)",
  fontSize: 13,
  lineHeight: "18px",
  cursor: "pointer"
};
function snapshotFromKit(props) {
  if (typeof props.useInput !== "function") return void 0;
  const state = props.useInput((current) => current);
  if (state === void 0) return void 0;
  const removed = typeof props.useSession === "function" && props.useSession((session) => session.removed) === true;
  return {
    draft: state.draft,
    phase: state.phase,
    sessionRemoved: removed
  };
}
function ComposerActionButton(props) {
  const [open, setOpen] = (0, import_react.useState)(false);
  const rootRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    if (!open) return;
    const closeOutside = (event) => {
      const root = rootRef.current;
      if (root !== null && event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);
  const hasSession = props.sessionId !== void 0 && typeof props.useInput === "function" && props.inputActions !== void 0;
  const input = snapshotFromKit(props);
  const actions = props.inputActions;
  const blocked = composerControlReason(input, actions);
  if (!hasSession || input?.sessionRemoved === true) return null;
  const title = blocked === void 0 ? "\u5199\u5165\u4E00\u53E5\u90E8\u7F72/\u6821\u9A8C\u6307\u4EE4\u5E76\u63D0\u4EA4\uFF0C\u8D70\u6B63\u5E38 agent turn" : REFUSE_TITLE[blocked];
  const disabled = blocked !== void 0;
  const pick = (prompt) => {
    setOpen(false);
    runComposerSubmit(prompt, input, actions);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      ref: rootRef,
      style: rootStyle,
      onKeyDown: (event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        setOpen(false);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            type: "button",
            "aria-haspopup": "menu",
            "aria-expanded": open,
            "aria-label": "\u90E8\u7F72\u6216\u68C0\u67E5\u53D1\u5E03",
            title,
            disabled,
            style: disabled ? triggerDisabledStyle : triggerStyle,
            onClick: () => {
              if (disabled) return;
              setOpen((current) => !current);
            },
            children: [
              "\u53D1\u5E03",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", style: { fontSize: 10, lineHeight: "18px", opacity: 0.7 }, children: open ? "\u25B4" : "\u25BE" })
            ]
          }
        ),
        open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", { role: "menu", "aria-label": "\u90E8\u7F72\u6216\u68C0\u67E5\u53D1\u5E03", style: menuStyle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              role: "menuitem",
              style: itemStyle,
              disabled: planComposerSubmit(DEPLOY_PROMPT, input, actions).action !== "submit",
              onClick: () => {
                pick(DEPLOY_PROMPT);
              },
              children: "\u90E8\u7F72\u5230 Cloudflare"
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              role: "menuitem",
              style: itemStyle,
              disabled: planComposerSubmit(PUBLISH_CHECK_PROMPT, input, actions).action !== "submit",
              onClick: () => {
                pick(PUBLISH_CHECK_PROMPT);
              },
              children: "\u68C0\u67E5\u63D2\u4EF6\u53D1\u5E03"
            }
          ) })
        ] }) : null
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
    this.unsubscribe = scope.subscribe(() => {
      this.syncScope();
      void this.readCredential();
    });
    this.syncScope();
    void this.readCredential();
  }
  state;
  listeners = /* @__PURE__ */ new Set();
  unsubscribe;
  disposed = false;
  credentialRead = 0;
  draftRevision;
  dispose() {
    this.disposed = true;
    this.credentialRead += 1;
    this.unsubscribe();
    this.listeners.clear();
  }
  blank() {
    return {
      tokenEnv: DEFAULT_REF,
      tokenEnvDraft: DEFAULT_REF,
      configured: false,
      writable: false,
      npmTokenEnv: DEFAULT_NPM_REF,
      npmTokenEnvDraft: DEFAULT_NPM_REF,
      npmConfigured: false,
      npmWritable: false,
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
      tokenEnvDraft: this.state.tokenEnvDraft === this.state.tokenEnv ? tokenEnv : this.state.tokenEnvDraft,
      npmTokenEnv,
      npmTokenEnvDraft: this.state.npmTokenEnvDraft === this.state.npmTokenEnv ? npmTokenEnv : this.state.npmTokenEnvDraft,
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
        this.captureRevision();
        this.state = { ...this.state, tokenEnvDraft: value };
        this.emit();
      },
      saveTokenEnv: async () => {
        const next = this.state.tokenEnvDraft.trim() || DEFAULT_REF;
        if (!await this.scope.set("apiTokenEnv", next)) throw new Error("\u8BBE\u7F6E\u4FDD\u5B58\u88AB\u62D2\u7EDD");
      },
      saveTokenValue: async (value) => {
        if (this.credentials === void 0) throw new Error("\u51ED\u636E\u670D\u52A1\u4E0D\u53EF\u7528");
        const ref = this.state.tokenEnv;
        if (!(await this.credentials.set(ref, value)).ok) throw new Error("\u51ED\u636E\u4FDD\u5B58\u88AB\u62D2\u7EDD");
        await this.readCredential();
      },
      setNpmTokenEnvDraft: (value) => {
        this.captureRevision();
        this.state = { ...this.state, npmTokenEnvDraft: value };
        this.emit();
      },
      saveNpmTokenEnv: async () => {
        const next = this.state.npmTokenEnvDraft.trim() || DEFAULT_NPM_REF;
        if (!await this.scope.set("npmTokenEnv", next)) throw new Error("\u8BBE\u7F6E\u4FDD\u5B58\u88AB\u62D2\u7EDD");
      },
      saveNpmTokenValue: async (value) => {
        if (this.credentials === void 0) throw new Error("\u51ED\u636E\u670D\u52A1\u4E0D\u53EF\u7528");
        const ref = this.state.npmTokenEnv;
        if (!(await this.credentials.set(ref, value)).ok) throw new Error("\u51ED\u636E\u4FDD\u5B58\u88AB\u62D2\u7EDD");
        await this.readCredential();
      },
      saveReferences: async () => {
        const apiTokenEnv = this.state.tokenEnvDraft.trim() || DEFAULT_REF;
        const npmTokenEnv = this.state.npmTokenEnvDraft.trim() || DEFAULT_NPM_REF;
        const ops = [];
        if (apiTokenEnv !== this.state.tokenEnv) ops.push({ op: "set", path: ["apiTokenEnv"], value: apiTokenEnv });
        if (npmTokenEnv !== this.state.npmTokenEnv) ops.push({ op: "set", path: ["npmTokenEnv"], value: npmTokenEnv });
        if (ops.length > 0 && !await this.scope.mutate(ops, this.draftRevision)) {
          throw new Error("\u8BBE\u7F6E\u5DF2\u53D8\u66F4\u6216\u4FDD\u5B58\u88AB\u62D2\u7EDD\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6\u540E\u91CD\u8BD5");
        }
        this.draftRevision = void 0;
        this.state = { ...this.state, tokenEnv: apiTokenEnv, tokenEnvDraft: apiTokenEnv, npmTokenEnv, npmTokenEnvDraft: npmTokenEnv };
        this.emit();
      }
    };
  }
  captureRevision() {
    if (this.state.tokenEnvDraft === this.state.tokenEnv && this.state.npmTokenEnvDraft === this.state.npmTokenEnv) {
      this.draftRevision = this.scope.getSnapshot().revision;
    }
  }
  refreshCredential(ref) {
    if (ref !== this.state.tokenEnv && ref !== this.state.npmTokenEnv) return;
    void this.readCredential();
  }
  async readCredential() {
    if (this.credentials === void 0) return;
    const read = ++this.credentialRead;
    const snapshot = this.scope.getSnapshot().value;
    const cfRef = snapshot?.apiTokenEnv?.trim() || DEFAULT_REF;
    const npmRef = snapshot?.npmTokenEnv?.trim() || DEFAULT_NPM_REF;
    const refs = cfRef === npmRef ? [cfRef] : [cfRef, npmRef];
    let response;
    try {
      response = await this.credentials.describe(refs);
    } catch {
      return;
    }
    if (this.disposed || read !== this.credentialRead || !response.ok) return;
    const creds = response.value ?? {};
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

// src/client/card-styles.ts
var PLUGIN_CSS = `
.dpd-card {
  list-style: none;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3);
  transition: border-color .16s, background .16s;
}
.dpd-card:hover {
  border-color: var(--dsw-alias-label-dimmed);
}
.dpd-card-open {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-label-dimmed);
}
.dpd-header {
  width: 100%;
  appearance: none;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
}
.dpd-header:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.dpd-head-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dpd-name {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary);
}
.dpd-description {
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}
.dpd-chevron {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  transition: transform .16s;
}
.dpd-chevron-open {
  transform: rotate(180deg);
}
.dpd-chevron-fallback {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid currentColor;
}
.dpd-body {
  border-top: 1px solid var(--dsw-alias-border-l2);
  margin: 0 16px;
  padding-bottom: 8px;
}
.dpd-readonly {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}
.dpd-pending {
  flex: none;
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 17px;
  font-weight: 500;
  white-space: nowrap;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
}
.dpd-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 4px;
  border-top: 1px solid var(--dsw-alias-border-l2);
}
.dpd-failed {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-error);
}
.dpd-discard,
.dpd-save {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 5px 14px;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}
.dpd-discard {
  border-color: var(--dsw-alias-border-l2);
  background: none;
  color: var(--dsw-alias-label-secondary);
}
.dpd-discard:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-label-dimmed);
}
.dpd-save {
  background: var(--dsw-alias-label-primary);
  color: var(--dsw-alias-bg-layer-3);
}
.dpd-discard:disabled,
.dpd-save:disabled {
  opacity: 0.4;
  cursor: default;
}
.dpd-discard:focus-visible,
.dpd-save:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dpd-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0;
}
.dpd-field + .dpd-field {
  border-top: 1px solid var(--dsw-alias-border-l2);
}
.dpd-field-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dpd-label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--dsw-alias-label-primary);
}
.dpd-badges {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.dpd-badge {
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 17px;
  white-space: nowrap;
  font-weight: 500;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
}
.dpd-badge-muted {
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 17px;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
}
.dpd-input {
  width: 100%;
  box-sizing: border-box;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-3);
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-primary);
}
.dpd-input:focus-visible {
  outline: none;
  border-color: var(--dsw-alias-brand-primary);
}
.dpd-input:disabled {
  color: var(--dsw-alias-label-tertiary);
  cursor: default;
}
.dpd-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}
.dpd-setup-note {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
}
.dpd-token-guide {
  margin-top: 4px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.65;
  color: var(--dsw-alias-label-secondary);
}
.dpd-token-guide > summary {
  cursor: pointer;
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.dpd-token-guide > summary:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 3px;
  border-radius: 2px;
}
.dpd-guide-body {
  padding-top: 6px;
}
.dpd-guide-body ol {
  margin: 0;
  padding-inline-start: 20px;
}
.dpd-guide-body li + li {
  margin-top: 6px;
}
.dpd-guide-body p {
  margin: 8px 0 0;
}
.dpd-guide-body code {
  font-size: inherit;
  overflow-wrap: anywhere;
}
.dpd-guide-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-top: 8px;
}
.dpd-guide-links a {
  color: var(--dsw-alias-brand-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
  overflow-wrap: anywhere;
}
`.trim();

// src/client/SettingsCard.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime2 = require("react/jsx-runtime");
var CARD_TITLE = "Cloudflare \u90E8\u7F72";
var CARD_DESCRIPTION = "\u90E8\u7F72\u4E0E\u53D1\u5E03\u7528\u7684 token \u53EA\u5B58\u5F15\u7528\u540D\uFF0C\u503C\u5199\u5165\u51ED\u636E\u670D\u52A1\u3002";
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
function Chevron(props) {
  const className = cx("dpd-chevron", props.open && "dpd-chevron-open");
  if (typeof import_dsh_client_ui_primitives.IconChevronDownOutlineMedium === "function") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.IconChevronDownOutlineMedium, { className });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: cx(className, "dpd-chevron-fallback"), "aria-hidden": "true" });
}
function Field(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dpd-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dpd-field-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { className: "dpd-label", htmlFor: props.id, children: props.label }),
      props.badge ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dpd-badges", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: props.badge.configured ? "dpd-badge" : "dpd-badge-muted", children: props.badge.configured ? "\u5DF2\u914D\u7F6E" : "\u672A\u914D\u7F6E" }) }) : null
    ] }),
    props.children,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dpd-hint", children: props.hint }),
    props.help
  ] });
}
function TokenGuide(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("details", { className: "dpd-token-guide", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("summary", { children: props.title }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dpd-guide-body", children: props.children })
  ] });
}
function CloudflareTokenGuide() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(TokenGuide, { title: "\u5982\u4F55\u83B7\u53D6 Cloudflare token", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("ol", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
        "\u6253\u5F00\u4E0B\u65B9\u7684 token \u7BA1\u7406\u9875\uFF0C\u767B\u5F55\u540E\u70B9\u51FB ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "Create Token" }),
        "\uFF0C \u9009\u62E9 ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "Edit Cloudflare Workers" }),
        " \u6A21\u677F\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
        "\u5C06 ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "Account Resources" }),
        " \u9650\u5B9A\u5230\u90E8\u7F72\u4F7F\u7528\u7684\u8D26\u53F7\u3002 \u9879\u76EE\u914D\u7F6E\u4E86\u81EA\u5B9A\u4E49\u57DF\u540D\u8DEF\u7531\u65F6\uFF0C\u5C06 ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "Zone Resources" }),
        " \u9650\u5B9A\u5230\u5BF9\u5E94\u7AD9\u70B9\uFF1B \u4E0D\u9700\u8981\u8DEF\u7531\u65F6\uFF0C\u79FB\u9664 ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "Workers Routes" }),
        " \u5199\u6743\u9650\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { children: "\u6309\u9879\u76EE\u5B9E\u9645\u4F7F\u7528\u7684\u670D\u52A1\u4FDD\u7559\u6743\u9650\uFF0C\u79FB\u9664\u672A\u4F7F\u7528\u7684 KV\u3001R2\u3001Tail \u7B49\u6743\u9650\u3002 \u8BBE\u7F6E\u8F83\u77ED\u6709\u6548\u671F\uFF0C\u68C0\u67E5\u6743\u9650\u4E0E\u8D44\u6E90\u6458\u8981\u540E\u521B\u5EFA token\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
        "\u590D\u5236\u521B\u5EFA\u540E\u4EC5\u663E\u793A\u4E00\u6B21\u7684 token\uFF0C\u7C98\u8D34\u5230\u4E0A\u65B9\u7684\u300C\u5199\u5165 Cloudflare token\u300D\uFF0C\u518D\u70B9\u51FB\u5361\u7247\u5E95\u90E8\u7684\u300C\u4FDD\u5B58\u300D\u3002 \u5F15\u7528\u540D\u901A\u5E38\u4FDD\u7559 ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { children: "CLOUDFLARE_API_TOKEN" }),
        "\u3002"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { children: [
      "\u63A8\u8350\u5728\u6B64\u914D\u7F6E API token\u3002\u672C\u673A\u7EC8\u7AEF\u7684 ",
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { children: "wrangler login" }),
      " \u767B\u5F55\u72B6\u6001\u5728\u9ED8\u8BA4",
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { children: " workspace-write " }),
      " \u6C99\u7BB1\u4E2D\u53EF\u80FD\u65E0\u6CD5\u8BFB\u53D6\uFF1B\u4F7F\u7528\u8BE5\u65B9\u5F0F\u524D\u9700\u786E\u8BA4\u5F53\u524D\u6743\u9650\u5141\u8BB8\u8BFB\u53D6\u767B\u5F55\u72B6\u6001\u3002 \u4E34\u65F6\u9884\u89C8\u53EF\u5148\u4E0D\u914D\u7F6E token\u3002"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dpd-guide-links", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { href: "https://dash.cloudflare.com/profile/api-tokens/", target: "_blank", rel: "noopener noreferrer", children: "\u6253\u5F00 Cloudflare token \u7BA1\u7406 \u2197" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { href: "https://developers.cloudflare.com/fundamentals/api/get-started/create-token/", target: "_blank", rel: "noopener noreferrer", children: "\u5B98\u65B9\u521B\u5EFA\u8BF4\u660E \u2197" })
    ] })
  ] });
}
function NpmTokenGuide() {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(TokenGuide, { title: "\u5982\u4F55\u83B7\u53D6 npm token", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("ol", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
        "\u767B\u5F55 npm \u5B98\u7F51\uFF0C\u70B9\u51FB\u5934\u50CF \u2192 ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "Access Tokens" }),
        " \u2192 ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "Generate New Token" }),
        "\uFF0C \u521B\u5EFA granular token\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
        "\u5728 ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "Packages and scopes" }),
        " \u4E2D\u9009\u62E9\u8981\u53D1\u5E03\u7684\u5305\u6216\u4F5C\u7528\u57DF\uFF0C\u6743\u9650\u9009",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: " Read and write (publish and stage)" }),
        "\u3002\u5F53\u524D\u63D2\u4EF6\u4F7F\u7528\u76F4\u63A5\u53D1\u5E03\uFF0Cstage only \u6743\u9650\u65E0\u6CD5\u5B8C\u6210\u6B64\u64CD\u4F5C\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
        "\u672C\u63D2\u4EF6\u4EE5\u975E\u4EA4\u4E92\u65B9\u5F0F\u76F4\u63A5\u53D1\u5E03\uFF0Ctoken \u5FC5\u987B\u5F00\u542F ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "Bypass 2FA" }),
        "\uFF0C \u4E14\u8D26\u53F7\u3001\u7EC4\u7EC7\u548C\u5305\u7684\u7B56\u7565\u5141\u8BB8\u4F7F\u7528\u6B64\u7C7B token\u3002\u8BBE\u7F6E\u8F83\u77ED\u7684\u6709\u6548\u671F\u3002 \u82E5\u7B56\u7565\u7981\u6B62\u7ED5\u8FC7\u4E8C\u6B21\u9A8C\u8BC1\uFF0C\u8BF7\u5728\u7EC8\u7AEF\u4EA4\u4E92\u5F0F\u53D1\u5E03\uFF0C\u6216\u4F7F\u7528 npm \u5B98\u65B9\u7684 staging \u6D41\u7A0B\uFF1B \u5F53\u524D\u63D2\u4EF6\u4E0D\u652F\u6301 staging\u3002"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
        "\u590D\u5236\u65B0 token\uFF0C\u7C98\u8D34\u5230\u4E0A\u65B9\u7684\u300C\u5199\u5165 npm token\u300D\u5E76\u4FDD\u5B58\u3002\u5F15\u7528\u540D\u901A\u5E38\u4FDD\u7559 ",
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { children: "NPM_TOKEN" }),
        "\u3002"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dpd-guide-links", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { href: "https://www.npmjs.com/", target: "_blank", rel: "noopener noreferrer", children: "\u6253\u5F00 npm \u5B98\u7F51 \u2197" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("a", { href: "https://docs.npmjs.com/creating-and-viewing-access-tokens/", target: "_blank", rel: "noopener noreferrer", children: "\u5B98\u65B9 token \u521B\u5EFA\u8BF4\u660E \u2197" })
    ] })
  ] });
}
function DeploySettingsCard(props) {
  const state = props.useDeployCard((snapshot) => snapshot);
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [tokenDraft, setTokenDraft] = (0, import_react2.useState)("");
  const [npmTokenDraft, setNpmTokenDraft] = (0, import_react2.useState)("");
  const [saving, setSaving] = (0, import_react2.useState)(false);
  const [failed, setFailed] = (0, import_react2.useState)(false);
  const dirty = state.tokenEnvDraft !== state.tokenEnv || state.npmTokenEnvDraft !== state.npmTokenEnv || tokenDraft.length > 0 || npmTokenDraft.length > 0;
  const blocked = !dirty || saving;
  const discard = () => {
    if (!dirty || saving) return;
    props.setTokenEnvDraft(state.tokenEnv);
    props.setNpmTokenEnvDraft(state.npmTokenEnv);
    setTokenDraft("");
    setNpmTokenDraft("");
    setFailed(false);
  };
  const save = async () => {
    if (blocked) return;
    setSaving(true);
    setFailed(false);
    try {
      if (props.saveReferences !== void 0) await props.saveReferences();
      else {
        if (state.tokenEnvDraft !== state.tokenEnv) await props.saveTokenEnv();
        if (state.npmTokenEnvDraft !== state.npmTokenEnv) await props.saveNpmTokenEnv();
      }
      if (tokenDraft.length > 0) {
        const value = tokenDraft;
        await props.saveTokenValue(value);
        setTokenDraft("");
      }
      if (npmTokenDraft.length > 0) {
        const value = npmTokenDraft;
        await props.saveNpmTokenValue(value);
        setNpmTokenDraft("");
      }
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("article", { className: cx("dpd-card", open && "dpd-card-open"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "button",
      {
        type: "button",
        className: "dpd-header",
        "aria-expanded": open,
        "aria-label": `${open ? "\u6536\u8D77" : "\u5C55\u5F00"}: ${CARD_TITLE}`,
        onClick: () => {
          setOpen(!open);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dpd-head-text", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dpd-name", children: CARD_TITLE }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dpd-description", children: CARD_DESCRIPTION })
          ] }),
          dirty ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dpd-pending", children: "\u672A\u4FDD\u5B58" }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Chevron, { open })
        ]
      }
    ),
    open ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dpd-body", children: [
      !state.scopeWritable ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dpd-readonly", role: "status", children: "\u672C\u90E8\u7F72\u7684\u8BBE\u7F6E\u4E3A\u53EA\u8BFB\u3002" }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dpd-setup-note", children: "Cloudflare token \u7528\u4E8E\u90E8\u7F72\u5230\u81EA\u5DF1\u7684\u8D26\u53F7\uFF1Bnpm token \u7528\u4E8E\u53D1\u5E03\u63D2\u4EF6\u3002 \u4EC5\u4F7F\u7528\u4E34\u65F6\u9884\u89C8\u3001\u68C0\u67E5\u6216\u6253\u5305\u65F6\uFF0C\u53EF\u5148\u4E0D\u586B\u5199\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Field,
        {
          id: "dpd-api-token-env",
          label: "Cloudflare API token \u5F15\u7528\u540D",
          hint: "\u9ED8\u8BA4 CLOUDFLARE_API_TOKEN\uFF0C\u901A\u5E38\u65E0\u9700\u6539\u52A8\u3002\u83B7\u53D6\u5230\u7684 token \u586B\u5728\u4E0B\u4E00\u9879\u3002",
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              id: "dpd-api-token-env",
              className: "dpd-input",
              value: state.tokenEnvDraft,
              disabled: !state.scopeWritable || saving,
              onChange: (event) => props.setTokenEnvDraft(event.target.value),
              spellCheck: false
            }
          )
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Field,
        {
          id: "dpd-api-token-value",
          label: "\u5199\u5165 Cloudflare token",
          hint: "\u4E0D\u4F1A\u56DE\u586B\u5DF2\u6709\u503C\u3002\u4FDD\u5B58\u540E\u6E05\u7A7A\uFF0C\u53EA\u66F4\u65B0\u914D\u7F6E\u72B6\u6001\u3002",
          badge: { configured: state.configured },
          help: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CloudflareTokenGuide, {}),
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              id: "dpd-api-token-value",
              className: "dpd-input",
              type: "password",
              autoComplete: "off",
              disabled: !state.writable || saving,
              value: tokenDraft,
              placeholder: "\u7C98\u8D34 token\uFF0C\u4FDD\u5B58\u540E\u6E05\u7A7A",
              onChange: (event) => setTokenDraft(event.target.value)
            }
          )
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Field,
        {
          id: "dpd-npm-token-env",
          label: "npm token \u5F15\u7528\u540D",
          hint: "\u9ED8\u8BA4 NPM_TOKEN\uFF0C\u901A\u5E38\u65E0\u9700\u6539\u52A8\u3002\u4EC5\u53D1\u5E03\u5230 npm \u65F6\u9700\u8981\u914D\u7F6E\u3002",
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              id: "dpd-npm-token-env",
              className: "dpd-input",
              value: state.npmTokenEnvDraft,
              disabled: !state.scopeWritable || saving,
              onChange: (event) => props.setNpmTokenEnvDraft(event.target.value),
              spellCheck: false
            }
          )
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        Field,
        {
          id: "dpd-npm-token-value",
          label: "\u5199\u5165 npm token",
          hint: "\u4E0D\u4F1A\u56DE\u586B\u5DF2\u6709\u503C\u3002\u4FDD\u5B58\u540E\u6E05\u7A7A\u3002\u53D1\u5E03\u9700\u5BA1\u6279\u4E14\u4E0D\u53EF\u9006\uFF1B\u4E0D\u63A8 GitHub\u3001\u4E0D\u4EE3\u63D0 dsh.pub \u6536\u5F55\u3002",
          badge: { configured: state.npmConfigured },
          help: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NpmTokenGuide, {}),
          children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              id: "dpd-npm-token-value",
              className: "dpd-input",
              type: "password",
              autoComplete: "off",
              disabled: !state.npmWritable || saving,
              value: npmTokenDraft,
              placeholder: "\u7C98\u8D34 token\uFF0C\u4FDD\u5B58\u540E\u6E05\u7A7A",
              onChange: (event) => setNpmTokenDraft(event.target.value)
            }
          )
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dpd-footer", children: [
        failed ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dpd-failed", role: "status", children: "\u672C\u90E8\u7F72\u6CA1\u6709\u63A5\u53D7\u8FD9\u4E9B\u503C\uFF0C\u5DF2\u4FDD\u7559\u4F9B\u4F60\u4FEE\u6539\u3002" }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: "dpd-discard",
            disabled: !dirty || saving,
            onClick: discard,
            children: "\u653E\u5F03\u4FEE\u6539"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "button",
          {
            type: "button",
            className: "dpd-save",
            disabled: blocked,
            onClick: save,
            children: saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58"
          }
        )
      ] })
    ] }) : null
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
var inject = ["slots", "remote", "remote.credentials", "configForms"];
function apply(ctx) {
  ctx.effect(() => {
    if (typeof document === "undefined") return () => {
    };
    const tag = document.createElement("style");
    tag.dataset.pluginCss = name;
    tag.textContent = PLUGIN_CSS;
    document.head.appendChild(tag);
    return () => tag.remove();
  });
  const card = new DeployCardController(ctx.configForms.get("dsh-plugin-deploy"), ctx.remote.credentials);
  ctx.effect(() => () => card.dispose());
  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: name,
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
  ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
    name: "conversation.session.header.actions",
    id: "dsh-plugin-deploy",
    order: 100,
    label: "\u53D1\u5E03"
  }, ComposerActionButton));
  ctx.effect(() => ctx.remote.$on("credentials/reference-updated", (ref) => card.refreshCredential(ref)));
}
return module.exports; } });
