// src/index.ts
import { installSettingsSection } from "@deepseek-ai/dsh-settings";

// src/config.ts
import z from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
var DEFAULT_API_TOKEN_ENV = "CLOUDFLARE_API_TOKEN";
var DEFAULT_NPM_TOKEN_ENV = "NPM_TOKEN";
var DEPLOY_SETTINGS_NS = settingsNamespace("deploy");
var Config = z.object({
  apiTokenEnv: z.string().role("credential-ref").default(DEFAULT_API_TOKEN_ENV),
  npmTokenEnv: z.string().role("credential-ref").default(DEFAULT_NPM_TOKEN_ENV)
});

// src/publish-tool.ts
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/publish-format.ts
var PUBLISH_NEXT_STEPS = [
  "\u672C\u5DE5\u5177\u4E0D\u63A8 GitHub\u3001\u4E0D\u4EE3\u63D0 dsh.pub \u6536\u5F55 PR\u3002",
  "GitHub \u76F4\u88C5\u53EA\u53D6\u6E90\u7801\uFF0C\u9700\u8981\u81EA\u5305\u542B prepare\uFF0C\u7528\u6237\u8FD8\u8981\u628A\u5305\u52A0\u5165 profile \u7684 pnpm-workspace.yaml allowBuilds\u3002\u89C1 https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish",
  "\u60F3\u6536\u5F55\u5230\u793E\u533A\u76EE\u5F55 dsh.pub\uFF0C\u8BF7\u6309\u8BE5\u7AD9\u8BF4\u660E\u81EA\u884C\u63D0\u4EA4\u3002"
].join("\n");
var UNSTRUCTURED_PUBLISH_NOTICE = "\u672C\u6B21\u8C03\u7528\u672A\u63D0\u4F9B\u7ED3\u6784\u5316\u7ED3\u679C\uFF0C\u65E0\u6CD5\u5C55\u793A\u6821\u9A8C\u6E05\u5355\u3002\u4E0B\u9762\u662F\u539F\u59CB\u8F93\u51FA\u3002";
var TARBALL_TMP_NOTICE = "tarball \u653E\u5728\u4E34\u65F6\u76EE\u5F55\uFF0C\u8BF7\u81EA\u884C\u62F7\u8D70\u6216\u5C3D\u5FEB\u4F7F\u7528\u3002";
function formatPublishText(result) {
  const lines = [];
  if (!result.ok) {
    lines.push(`\u53D1\u5E03\u672A\u5B8C\u6210\uFF1A${result.error ?? "\u672A\u77E5\u9519\u8BEF"}`);
    if (result.hint) lines.push(result.hint);
  } else if (result.mode === "pack") {
    lines.push("\u6253\u5305\u5B8C\u6210\u3002");
  } else if (result.mode === "npm") {
    lines.push("\u5DF2\u53D1\u5E03\u5230 npm\u3002");
  } else {
    lines.push("\u6821\u9A8C\u5B8C\u6210\u3002");
  }
  lines.push(`\u53D1\u5E03\u6A21\u5F0F\uFF1A${result.mode}`);
  if (result.packageName) lines.push(`\u5305\u540D\uFF1A${result.packageName}`);
  if (result.version) lines.push(`\u7248\u672C\uFF1A${result.version}`);
  if (result.access) lines.push(`\u8BBF\u95EE\uFF1A${result.access}`);
  if (result.tag) lines.push(`dist-tag\uFF1A${result.tag}`);
  if (result.tarballPath) {
    lines.push(`tarball\uFF1A${result.tarballPath}`);
    lines.push(TARBALL_TMP_NOTICE);
  }
  if (result.installCommand) lines.push(`\u5B89\u88C5\uFF1A${result.installCommand}`);
  if (result.fileCount !== void 0) {
    const packed = result.packedSize === void 0 ? "" : `\uFF0C\u6253\u5305 ${result.packedSize} \u5B57\u8282`;
    const unpacked = result.unpackedSize === void 0 ? "" : `\uFF0C\u89E3\u538B ${result.unpackedSize} \u5B57\u8282`;
    lines.push(`\u6E05\u5355\uFF1A${result.fileCount} \u4E2A\u6587\u4EF6${packed}${unpacked}`);
  }
  if (result.checks.length > 0) {
    lines.push("\u6821\u9A8C\uFF1A");
    for (const item of result.checks) {
      const mark = item.ok ? "\u901A\u8FC7" : "\u5931\u8D25";
      const extra = !item.ok && !item.blocking ? "\uFF08\u4E0D\u963B\u6B62 pack\uFF09" : "";
      lines.push(`- [${mark}] ${item.id}${extra}\uFF1A${item.detail}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push("", "\u63D0\u9192\uFF1A");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }
  const next = result.nextSteps ?? PUBLISH_NEXT_STEPS;
  lines.push("", "\u4E0B\u4E00\u6B65\uFF1A", next);
  if (!result.ok && result.stdout) {
    lines.push("", result.stdout);
  }
  return lines.join("\n");
}
function formatPublishTerminalOutput(result) {
  return formatPublishText(result);
}
var META_KEYS = [
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
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function labeledValue(line, labels) {
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
    const fail3 = /^发布未完成[：:]\s*(.*)$/.exec(line);
    if (fail3) {
      const message = fail3[1].trim();
      if (message.length > 0) parsed.error = message;
      continue;
    }
    const mode = labeledValue(line, /发布模式[：:]/);
    if (mode === "check" || mode === "pack" || mode === "npm") parsed.mode = mode;
    const name2 = labeledValue(line, /包名[：:]/);
    if (name2 !== void 0) parsed.packageName = name2;
    const version = labeledValue(line, /版本[：:]/);
    if (version !== void 0) parsed.version = version;
    const access = labeledValue(line, /访问[：:]/);
    if (access === "public" || access === "restricted") parsed.access = access;
    const tag = labeledValue(line, /dist-tag[：:]/);
    if (tag !== void 0) parsed.tag = tag;
    const tarball = labeledValue(line, /tarball[：:]/);
    if (tarball !== void 0) parsed.tarballPath = tarball;
    const install = labeledValue(line, /安装[：:]/);
    if (install !== void 0) parsed.installCommand = install;
    const summary = labeledValue(line, /清单[：:]/);
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
  if (!META_KEYS.some((key) => key in record)) return void 0;
  return record;
}
function pickString(preferred, fallback) {
  if (isNonEmptyString(preferred)) return preferred.trim();
  if (isNonEmptyString(fallback)) return fallback;
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
  const packageName = pickString(meta?.packageName, parsed.packageName);
  const version = pickString(meta?.version, parsed.version);
  const mode = pickString(meta?.mode, parsed.mode);
  const access = pickString(meta?.access, parsed.access);
  const tag = pickString(meta?.tag, parsed.tag);
  const tarballPath = pickString(meta?.tarballPath, parsed.tarballPath);
  const installCommand = pickString(meta?.installCommand, parsed.installCommand);
  const filename = pickString(meta?.filename, void 0);
  const error = pickString(meta?.error, parsed.error);
  const hint = pickString(meta?.hint, parsed.hint);
  const nextSteps = pickString(meta?.nextSteps, void 0);
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

// src/publish.ts
import { mkdir as mkdir2, mkdtemp, readFile as readFile2, rm, stat, writeFile as writeFile2 } from "node:fs/promises";
import { basename, isAbsolute, join as join2, resolve as resolve2 } from "node:path";
import { tmpdir as tmpdir2 } from "node:os";
import { credentialRef } from "@deepseek-ai/dsh-credentials";

// src/generated-config.ts
import { createHash } from "node:crypto";
import { readFile, unlink, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
var LEGACY_IN_PROJECT_CONFIG_NAME = ".dsh-deploy.wrangler.jsonc";
var ASSET_IGNORE_PATTERNS = [".wrangler", LEGACY_IN_PROJECT_CONFIG_NAME];
var GENERATED_CONFIG_ROOT = join(tmpdir(), "dsh-plugin-deploy", "generated");
var GENERATED_CONFIG_BASENAME = "wrangler.jsonc";
function generatedConfigPath(projectDirectory) {
  const id = createHash("sha256").update(resolve(projectDirectory)).digest("hex").slice(0, 16);
  return join(GENERATED_CONFIG_ROOT, id, GENERATED_CONFIG_BASENAME);
}
function generatedWranglerConfigBody(name2, assetsDirectory, compatibilityDate) {
  return `${JSON.stringify({
    name: name2,
    compatibility_date: compatibilityDate,
    assets: { directory: resolve(assetsDirectory) }
  }, null, 2)}
`;
}
function shellSingleQuote(value) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
async function withAssetsIgnore(assetsRoot, fn) {
  const ignorePath = join(assetsRoot, ".assetsignore");
  let previous;
  try {
    previous = await readFile(ignorePath, "utf8");
  } catch {
    previous = void 0;
  }
  const existing = new Set(
    (previous ?? "").split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0)
  );
  const missing = ASSET_IGNORE_PATTERNS.filter(
    (pattern) => !existing.has(pattern) && !existing.has(`/${pattern}`) && !existing.has(`${pattern}/`) && !existing.has(`/${pattern}/`)
  );
  if (missing.length > 0) {
    await mkdir(assetsRoot, { recursive: true });
    const prefix = previous === void 0 ? "" : previous.endsWith("\n") || previous.length === 0 ? previous : `${previous}
`;
    await writeFile(ignorePath, `${prefix}${missing.join("\n")}
`, "utf8");
  }
  try {
    return await fn();
  } finally {
    if (previous === void 0) {
      try {
        await unlink(ignorePath);
      } catch {
      }
    } else if (missing.length > 0) {
      try {
        await writeFile(ignorePath, previous, "utf8");
      } catch {
      }
    }
  }
}

// src/publish-checks.ts
function normalizePackPath(path) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
function packPathSet(files) {
  return new Set(files.map((file) => normalizePackPath(file.path)));
}
function inPack(paths, target) {
  return paths.has(normalizePackPath(target));
}
function isScopedPackageName(name2) {
  return name2.startsWith("@") && name2.includes("/");
}
function exportEntryPath(exportsField, key) {
  if (typeof exportsField === "string") return key === "." ? exportsField : void 0;
  if (exportsField === null || typeof exportsField !== "object" || Array.isArray(exportsField)) {
    return void 0;
  }
  const value = exportsField[key];
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
  const rec = value;
  if (typeof rec.default === "string") return rec.default;
  if (typeof rec.import === "string") return rec.import;
  if (typeof rec.require === "string") return rec.require;
}
function dshBundlePatch(pkg) {
  if (pkg.dsh === null || typeof pkg.dsh !== "object" || Array.isArray(pkg.dsh)) return void 0;
  const bundle = pkg.dsh.bundle;
  if (bundle === null || typeof bundle !== "object" || Array.isArray(bundle)) return void 0;
  const patch = bundle.patch;
  return typeof patch === "string" && patch.trim().length > 0 ? patch.trim() : void 0;
}
function hasDshClient(pkg) {
  if (pkg.dsh === null || typeof pkg.dsh !== "object" || Array.isArray(pkg.dsh)) return false;
  return pkg.dsh.client !== void 0;
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function inspectClientBundle(source, packageName) {
  const reasons = [];
  if (!source.includes("window.__ModuleLoader__.load")) {
    reasons.push("\u7F3A\u5C11 window.__ModuleLoader__.load\uFF08\u4E0D\u662F factory bundle\uFF09");
  }
  const quoted = JSON.stringify(packageName);
  const idRe = new RegExp(`id\\s*:\\s*(?:${escapeRegExp(quoted)}|'${escapeRegExp(packageName)}')`);
  if (!idRe.test(source)) {
    reasons.push(`factory id \u4E0D\u662F\u5305\u540D ${packageName}`);
  }
  if (!/(?:^|[^\w$])(?:var|let|const)\s+module\s*=/.test(source)) {
    reasons.push("\u7F3A\u5C11 module \u58F0\u660E\uFF08\u5B98\u65B9 intro\uFF1Avar module = { exports: {} }\uFF09");
  }
  return { ok: reasons.length === 0, reasons };
}
function forbiddenPackReason(path) {
  const normalized = normalizePackPath(path);
  const base = normalized.split("/").pop() ?? normalized;
  if (base === ".npmrc" || normalized === ".npmrc") return ".npmrc";
  if (base.startsWith(".env") || /(^|\/)\.env(\.|$)/.test(normalized)) return ".env*";
  if (/\.(pem|key)$/i.test(base)) return "*.pem/*.key";
  if (normalized === "node_modules" || normalized.startsWith("node_modules/")) return "node_modules/";
  if (normalized === ".git" || normalized.startsWith(".git/")) return ".git/";
  if (normalized === ".dsh-assistant" || normalized.startsWith(".dsh-assistant/")) {
    return ".dsh-assistant/";
  }
  if (base === "IMPL-PROMPT.md") return "IMPL-PROMPT.md";
}
function collectDeps(pkg) {
  const out = [];
  for (const field of [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies
  ]) {
    if (field === null || typeof field !== "object" || Array.isArray(field)) continue;
    for (const [name2, spec] of Object.entries(field)) {
      if (typeof spec === "string") out.push({ name: name2, spec });
    }
  }
  return out;
}
function isDshHarnessPackage(name2) {
  return name2 === "@deepseek-ai/dsh" || name2.startsWith("@deepseek-ai/dsh-");
}
function isOldDshTrain(spec) {
  const trimmed = spec.trim().replace(/^['"]|['"]$/g, "");
  return /^(?:[~^]=?|=)?0\.0\./.test(trimmed);
}
function isBlockingCheck(id, mode) {
  if (id === "version-available") return mode === "npm";
  return true;
}
function check(id, ok, detail, mode) {
  return { id, ok, detail, blocking: isBlockingCheck(id, mode) };
}
function evaluateChecks(input) {
  const { pkg, pack, mode } = input;
  const name2 = typeof pkg.name === "string" ? pkg.name : "";
  const version = typeof pkg.version === "string" ? pkg.version : "";
  const paths = packPathSet(pack.files);
  const checks = [];
  const patch = dshBundlePatch(pkg);
  if (patch === void 0) {
    checks.push(check(
      "dsh-plugin",
      false,
      "package.json \u6CA1\u6709 dsh.bundle.patch\uFF0C\u88C5\u4E0A\u4E0D\u4F1A\u6FC0\u6D3B\u4E3A dsh \u63D2\u4EF6\u3002",
      mode
    ));
  } else if (!input.patchExists) {
    checks.push(check(
      "dsh-plugin",
      false,
      `dsh.bundle.patch \u6307\u5411 ${patch}\uFF0C\u4F46\u6587\u4EF6\u4E0D\u5B58\u5728\u3002`,
      mode
    ));
  } else {
    checks.push(check(
      "dsh-plugin",
      true,
      `dsh.bundle.patch \u6307\u5411 ${patch}\uFF0C\u6587\u4EF6\u5B58\u5728\u3002`,
      mode
    ));
  }
  if (patch === void 0) {
    checks.push(check("patch-in-pack", false, "\u6CA1\u6709 patch \u8DEF\u5F84\u53EF\u6838\u5BF9\u6253\u5305\u6E05\u5355\u3002", mode));
  } else if (!inPack(paths, patch)) {
    checks.push(check(
      "patch-in-pack",
      false,
      `${normalizePackPath(patch)} \u4E0D\u5728 npm pack \u6E05\u5355\u91CC\uFF0C\u88C5\u4E0A\u4E0D\u4F1A\u6FC0\u6D3B\u3002`,
      mode
    ));
  } else {
    checks.push(check(
      "patch-in-pack",
      true,
      `${normalizePackPath(patch)} \u5728\u6253\u5305\u6E05\u5355\u91CC\u3002`,
      mode
    ));
  }
  if (!hasDshClient(pkg)) {
    checks.push(check("client-bundle", true, "\u672A\u58F0\u660E dsh.client\uFF0C\u5DF2\u8DF3\u8FC7\u3002", mode));
  } else {
    const clientExport = exportEntryPath(pkg.exports, "./client");
    if (clientExport === void 0) {
      checks.push(check(
        "client-bundle",
        false,
        '\u58F0\u660E\u4E86 dsh.client \u4F46\u6CA1\u6709 exports["./client"]\u3002',
        mode
      ));
    } else if (!inPack(paths, clientExport)) {
      checks.push(check(
        "client-bundle",
        false,
        `exports["./client"] \u6307\u5411 ${normalizePackPath(clientExport)}\uFF0C\u4F46\u4E0D\u5728\u6253\u5305\u6E05\u5355\u91CC\u3002`,
        mode
      ));
    } else if (input.clientSource === void 0) {
      checks.push(check(
        "client-bundle",
        false,
        `${normalizePackPath(clientExport)} \u5728\u6E05\u5355\u91CC\uFF0C\u4F46\u78C1\u76D8\u4E0A\u8BFB\u4E0D\u5230\uFF08${input.clientPath ?? clientExport}\uFF09\u3002`,
        mode
      ));
    } else if (name2.length === 0) {
      checks.push(check("client-bundle", false, "package.json \u6CA1\u6709 name\uFF0C\u65E0\u6CD5\u6838\u5BF9 factory id\u3002", mode));
    } else {
      const inspected = inspectClientBundle(input.clientSource, name2);
      checks.push(check(
        "client-bundle",
        inspected.ok,
        inspected.ok ? `${normalizePackPath(clientExport)} \u662F\u5408\u89C4 factory bundle\uFF08id=${name2}\uFF09\u3002` : inspected.reasons.join("\uFF1B"),
        mode
      ));
    }
  }
  const mainPath = exportEntryPath(pkg.exports, ".") ?? (typeof pkg.main === "string" ? pkg.main : void 0);
  if (mainPath === void 0) {
    checks.push(check("main-entry", false, '\u6CA1\u6709 main / exports["."]\u3002', mode));
  } else if (!inPack(paths, mainPath)) {
    checks.push(check(
      "main-entry",
      false,
      `\u4E3B\u5165\u53E3 ${normalizePackPath(mainPath)} \u4E0D\u5728\u6253\u5305\u6E05\u5355\u91CC\u3002`,
      mode
    ));
  } else {
    checks.push(check(
      "main-entry",
      true,
      `\u4E3B\u5165\u53E3 ${normalizePackPath(mainPath)} \u5728\u6253\u5305\u6E05\u5355\u91CC\u3002`,
      mode
    ));
  }
  const deps = collectDeps(pkg);
  const workspace = deps.filter((dep) => dep.spec.includes("workspace:"));
  const oldTrain = deps.filter((dep) => isDshHarnessPackage(dep.name) && isOldDshTrain(dep.spec));
  if (workspace.length > 0 || oldTrain.length > 0) {
    const bits = [
      ...workspace.map((dep) => `${dep.name} \u4F7F\u7528 workspace: \u534F\u8BAE`),
      ...oldTrain.map((dep) => `${dep.name}@${dep.spec} \u662F 0.0.x \u65E7 train`)
    ];
    checks.push(check("deps", false, bits.join("\uFF1B"), mode));
  } else {
    checks.push(check("deps", true, "\u6CA1\u6709 workspace: \u534F\u8BAE\uFF0C\u4E5F\u6CA1\u6709 @deepseek-ai/dsh* \u7684 0.0.x\u3002", mode));
  }
  const dirty = pack.files.map((file) => {
    const reason = forbiddenPackReason(file.path);
    return reason === void 0 ? void 0 : `${normalizePackPath(file.path)}\uFF08${reason}\uFF09`;
  }).filter((item) => item !== void 0);
  if (dirty.length > 0) {
    checks.push(check("pack-clean", false, `\u6E05\u5355\u542B\u4E0D\u5E94\u53D1\u5E03\u7684\u6587\u4EF6\uFF1A${dirty.join("\uFF0C")}`, mode));
  } else {
    checks.push(check("pack-clean", true, "\u6E05\u5355\u91CC\u6CA1\u6709 .env / .npmrc / \u5BC6\u94A5 / node_modules / .git / .dsh-assistant / IMPL-PROMPT.md\u3002", mode));
  }
  if (version.length === 0) {
    checks.push(check("version-available", false, "package.json \u6CA1\u6709 version\u3002", mode));
  } else if (input.versionQuery.status === "unpublished") {
    checks.push(check("version-available", true, `${name2 || "\u8BE5\u5305"} \u5C1A\u672A\u53D1\u5E03\u8FC7\uFF0C\u5F53\u524D\u7248\u672C ${version} \u53EF\u7528\u3002`, mode));
  } else if (input.versionQuery.status === "available") {
    checks.push(check(
      "version-available",
      true,
      `registry \u4E0A\u5DF2\u6709\u5176\u4ED6\u7248\u672C\uFF0C\u5F53\u524D ${version} \u672A\u88AB\u5360\u7528\u3002`,
      mode
    ));
  } else if (input.versionQuery.status === "occupied") {
    checks.push(check(
      "version-available",
      false,
      `${name2}@${version} \u5DF2\u5728 npm \u4E0A\u3002`,
      mode
    ));
  } else {
    checks.push(check("version-available", false, input.versionQuery.detail, mode));
  }
  if (input.scan.skipped) {
    checks.push(check(
      "scan",
      true,
      "\u672A\u627E\u5230 .dsh-assistant/hooks/lib/scan-dsh-plugin.sh\uFF0C\u5DF2\u8DF3\u8FC7\u3002",
      mode
    ));
  } else if (input.scan.error !== void 0) {
    checks.push(check("scan", false, input.scan.error, mode));
  } else {
    const highs = input.scan.findings.filter((item) => item.severity === "HIGH");
    if (highs.length > 0) {
      const preview = highs.slice(0, 10).map((item) => `${item.rule}${item.file ? ` ${item.file}` : ""}${item.message ? ` ${item.message}` : ""}`).join("\uFF1B");
      const extra = highs.length > 10 ? `\uFF08\u53E6\u6709 ${highs.length - 10} \u6761\uFF09` : "";
      checks.push(check("scan", false, `\u626B\u63CF HIGH ${highs.length} \u6761\uFF0C\u963B\u6B62\u53D1\u5E03\uFF1A${preview}${extra}`, mode));
    } else {
      const other = input.scan.findings.length;
      checks.push(check(
        "scan",
        true,
        other === 0 ? "\u626B\u63CF\u901A\u8FC7\uFF08\u65E0 HIGH\uFF09\u3002" : `\u626B\u63CF\u901A\u8FC7\uFF08\u65E0 HIGH\uFF1B\u53E6\u6709 ${other} \u6761 MEDIUM/LOW\uFF0C\u4E0D\u963B\u6B62\u53D1\u5E03\uFF09\u3002`,
        mode
      ));
    }
  }
  return checks;
}
function blockingFailures(checks) {
  return checks.filter((item) => !item.ok && item.blocking);
}
function resolvePublishAccess(name2, requested) {
  if (!isScopedPackageName(name2) && requested === "restricted") {
    return { ok: false, error: "unscoped \u5305\u4E0D\u80FD\u8BBE restricted\uFF08npm \u53EA\u5141\u8BB8 public\uFF09\u3002" };
  }
  if (requested !== void 0) return { ok: true, access: requested };
  return { ok: true, access: "public" };
}
function extractJsonValue(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new Error("\u8F93\u51FA\u4E3A\u7A7A\uFF0C\u4E0D\u662F JSON\u3002");
  try {
    return JSON.parse(trimmed);
  } catch {
  }
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === "{" || ch === "[" || ch === '"') {
      try {
        return JSON.parse(trimmed.slice(i));
      } catch {
      }
    }
  }
  throw new Error("\u8F93\u51FA\u91CC\u89E3\u6790\u4E0D\u5230 JSON\u3002");
}
function extractJson(stdout, combined = stdout) {
  try {
    return extractJsonValue(stdout);
  } catch (stdoutError) {
    if (combined === stdout) throw stdoutError;
    return extractJsonValue(combined);
  }
}
function asPackManifest(value) {
  const item = Array.isArray(value) ? value[0] : value;
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    throw new Error("npm pack --json \u9876\u5C42\u4E0D\u662F\u5BF9\u8C61\u6216\u6570\u7EC4\u3002");
  }
  const rec = item;
  if (typeof rec.filename !== "string" || rec.filename.length === 0) {
    throw new Error("npm pack --json \u7F3A\u5C11 filename\u3002");
  }
  const files = Array.isArray(rec.files) ? rec.files.flatMap((file) => {
    if (file === null || typeof file !== "object" || Array.isArray(file)) return [];
    const path = file.path;
    return typeof path === "string" ? [{ path }] : [];
  }) : [];
  const size = typeof rec.size === "number" ? rec.size : 0;
  const unpackedSize = typeof rec.unpackedSize === "number" ? rec.unpackedSize : 0;
  const entryCount = typeof rec.entryCount === "number" ? rec.entryCount : files.length;
  return {
    filename: rec.filename,
    size,
    unpackedSize,
    entryCount,
    files,
    ...typeof rec.name === "string" ? { name: rec.name } : {},
    ...typeof rec.version === "string" ? { version: rec.version } : {}
  };
}
function parseNpmPackJson(stdout, combined = stdout) {
  return asPackManifest(extractJson(stdout, combined));
}
function isNpmErrorCode(value, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const error = value.error;
  if (error === null || typeof error !== "object" || Array.isArray(error)) return false;
  return error.code === code;
}
function asVersionList(json) {
  if (typeof json === "string") return [json];
  if (Array.isArray(json) && json.every((item) => typeof item === "string")) return json;
}
function parseNpmViewVersions(stdout, combined, exitCode, version) {
  let json;
  try {
    json = extractJson(stdout, combined);
  } catch {
    if (exitCode !== 0 && /E404|404 Not Found|is not in this registry/i.test(combined)) {
      return { status: "unpublished" };
    }
    return {
      status: "error",
      detail: exitCode === 0 ? "npm view --json \u8F93\u51FA\u65E0\u6CD5\u89E3\u6790\u3002" : `npm view \u5931\u8D25\uFF08\u9000\u51FA\u7801 ${String(exitCode)}\uFF09\u3002`
    };
  }
  if (isNpmErrorCode(json, "E404")) return { status: "unpublished" };
  if (json !== null && typeof json === "object" && !Array.isArray(json) && "error" in json) {
    const error = json.error;
    const code = typeof error?.code === "string" ? error.code : "unknown";
    const summary = typeof error?.summary === "string" ? error.summary : "";
    return { status: "error", detail: `npm view \u62A5\u9519 ${code}${summary ? `\uFF1A${summary}` : ""}` };
  }
  const versions = asVersionList(json);
  if (versions === void 0) {
    return { status: "error", detail: "npm view versions \u4E0D\u662F\u5B57\u7B26\u4E32\u6216\u5B57\u7B26\u4E32\u6570\u7EC4\u3002" };
  }
  if (versions.includes(version)) return { status: "occupied", versions };
  return { status: "available" };
}
function parseScanJson(stdout, combined = stdout) {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    const fallback = combined.trim();
    if (fallback.length === 0) return [];
    return parseScanJson(fallback, fallback);
  }
  const json = extractJson(stdout, combined);
  if (!Array.isArray(json)) throw new Error("\u626B\u63CF\u5668 --json \u8F93\u51FA\u4E0D\u662F\u6570\u7EC4\u3002");
  const findings = [];
  for (const item of json) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item;
    if (typeof rec.rule !== "string" || typeof rec.severity !== "string") continue;
    findings.push({
      rule: rec.rule,
      severity: rec.severity,
      ...typeof rec.file === "string" ? { file: rec.file } : {},
      ...typeof rec.line === "number" ? { line: rec.line } : {},
      ...typeof rec.message === "string" ? { message: rec.message } : {}
    });
  }
  return findings;
}
function isNpmOtpChallenge(text, json) {
  if (isNpmErrorCode(json, "EOTP")) return true;
  return /one-time password|EOTP|\bOTP\b|two-factor|2FA|authenticator app|enter otp|npm error code EOTP/i.test(text);
}
function isNpmAuthFailure(text, json) {
  if (isNpmErrorCode(json, "E401") || isNpmErrorCode(json, "ENEEDAUTH")) return true;
  return /npm error code E401|ENEEDAUTH|not authorized|you must be logged in|unable to authenticate|401 Unauthorized/i.test(text);
}

// src/redact.ts
var TOKEN_ASSIGN = /(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN|API_TOKEN|NPM_TOKEN|DSH_NPM_TOKEN|_authToken)\s*[=:]\s*\S+/gi;
var NPM_TOKEN_VALUE = /\bnpm_[A-Za-z0-9]{8,}/g;
var BEARER = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
function redactSecrets(text, extraSecrets = []) {
  let out = text;
  for (const secret of extraSecrets) {
    if (secret.length >= 4) out = out.split(secret).join("***");
  }
  out = out.replace(TOKEN_ASSIGN, (match) => match.replace(/[=:]\s*\S+/, "=***"));
  out = out.replace(BEARER, "Bearer ***");
  out = out.replace(NPM_TOKEN_VALUE, "npm_***");
  return out;
}

// src/publish.ts
var PROBE_TIMEOUT_MS = 45e3;
var SCAN_TIMEOUT_MS = 9e4;
var PUBLISH_TIMEOUT_MS = 18e4;
var SCAN_SCRIPT = join2(".dsh-assistant", "hooks", "lib", "scan-dsh-plugin.sh");
var NPMRC_BODY = "//registry.npmjs.org/:_authToken=${DSH_NPM_TOKEN}\n";
var NPM_CACHE_DIR = join2(tmpdir2(), "dsh-plugin-deploy", "npm-cache");
var PACK_DEST_DIR = join2(tmpdir2(), "dsh-plugin-deploy", "packed");
var NPMRC_ROOT = join2(tmpdir2(), "dsh-plugin-deploy", "npmrc");
function packedTarballPath(filename) {
  return join2(PACK_DEST_DIR, basename(filename));
}
function installCommandFor(packageName, tarballPath) {
  const target = tarballPath ?? packageName;
  return `dsh plugin --profile <p> add ${target}`;
}
function parsePublishCommandInput(raw) {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return {};
  const parts = trimmed.split(/\s+/).filter((part) => part.length > 0);
  const modes = /* @__PURE__ */ new Set(["check", "pack", "npm"]);
  if (modes.has(parts[0])) {
    return {
      mode: parts[0],
      ...parts.length > 1 ? { directory: parts.slice(1).join(" ") } : {}
    };
  }
  if (parts.length >= 2 && modes.has(parts[parts.length - 1])) {
    return {
      mode: parts[parts.length - 1],
      directory: parts.slice(0, -1).join(" ")
    };
  }
  return { directory: trimmed };
}
function fail(partial) {
  return {
    ok: false,
    warnings: [],
    checks: [],
    nextSteps: PUBLISH_NEXT_STEPS,
    ...partial
  };
}
function combineOutput(result) {
  return [result.stdout.text, result.stderr.text].filter((text) => text.length > 0).join("\n");
}
function sessionCwd(exec) {
  const agent = exec.agent;
  const cwd = agent?.session?.header?.cwd;
  return typeof cwd === "string" && cwd.length > 0 ? cwd : void 0;
}
function resolveDirectory(args, exec) {
  const requested = args.directory?.trim();
  const base = sessionCwd(exec) ?? process.cwd();
  if (requested === void 0 || requested.length === 0) return base;
  return isAbsolute(requested) ? requested : join2(base, requested);
}
async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
function npmCacheFlag(cacheDir) {
  return `--cache ${shellSingleQuote(cacheDir)}`;
}
async function runPublish(ctx, args, exec, config) {
  const mode = args.mode ?? "check";
  const tag = args.tag?.trim() || "latest";
  if (mode !== "check" && mode !== "pack" && mode !== "npm") {
    return fail({ mode: "check", error: `\u4E0D\u652F\u6301\u7684 mode=${String(mode)}\u3002` });
  }
  const directory = resolveDirectory(args, exec);
  try {
    await ctx.subprocess.resolveExecutable("npm", void 0, exec.signal);
  } catch {
    return fail({
      mode,
      error: "\u672A\u627E\u5230 npm \u53EF\u6267\u884C\u6587\u4EF6\u3002",
      hint: "\u8BF7\u5148\u5B89\u88C5 Node.js / npm\u3002\u672C\u63D2\u4EF6\u4E0D\u4F1A\u81EA\u52A8\u5B89\u88C5\u3002"
    });
  }
  const pkgPath = join2(directory, "package.json");
  let pkgRaw;
  try {
    pkgRaw = await readFile2(pkgPath, "utf8");
  } catch {
    return fail({ mode, error: `\u76EE\u5F55\u91CC\u6CA1\u6709 package.json\uFF1A${directory}` });
  }
  let pkg;
  try {
    pkg = JSON.parse(pkgRaw);
  } catch (error) {
    return fail({
      mode,
      error: "package.json \u4E0D\u662F\u5408\u6CD5 JSON\u3002",
      hint: error instanceof Error ? error.message : void 0
    });
  }
  const packageName = typeof pkg.name === "string" ? pkg.name : void 0;
  const version = typeof pkg.version === "string" ? pkg.version : void 0;
  if (packageName === void 0 || version === void 0) {
    return fail({ mode, error: "package.json \u7F3A\u5C11 name \u6216 version\u3002" });
  }
  try {
    await mkdir2(NPM_CACHE_DIR, { recursive: true });
  } catch (error) {
    return fail({
      mode,
      error: "\u65E0\u6CD5\u521B\u5EFA\u9694\u79BB npm cache\u3002",
      hint: error instanceof Error ? error.message : void 0
    });
  }
  const cacheFlag = npmCacheFlag(NPM_CACHE_DIR);
  const dryRun = await ctx.shell.run(ctx.shell.resolve({
    command: `npm pack --dry-run --json ${cacheFlag}`,
    workdir: directory,
    timeoutMs: PROBE_TIMEOUT_MS,
    signal: exec.signal,
    stdoutMaxBytes: 2e6
  }));
  const dryCombined = combineOutput(dryRun);
  if (dryRun.timedOut || dryRun.aborted || dryRun.exitCode !== 0) {
    return fail({
      mode,
      packageName,
      version,
      error: dryRun.timedOut ? "npm pack --dry-run \u8D85\u65F6\u3002" : dryRun.aborted ? "npm pack --dry-run \u5DF2\u53D6\u6D88\u3002" : `npm pack --dry-run \u9000\u51FA\u7801 ${String(dryRun.exitCode)}\u3002`,
      stdout: redactSecrets(dryCombined),
      ...dryRun.exitCode === null ? {} : { exitCode: dryRun.exitCode }
    });
  }
  let pack;
  try {
    pack = parseNpmPackJson(dryRun.stdout.text, dryCombined);
  } catch (error) {
    return fail({
      mode,
      packageName,
      version,
      error: "\u65E0\u6CD5\u89E3\u6790 npm pack --dry-run --json\u3002",
      hint: error instanceof Error ? error.message : void 0,
      stdout: redactSecrets(dryCombined)
    });
  }
  const patch = dshBundlePatch(pkg);
  const patchExists = patch === void 0 ? false : await pathExists(join2(directory, patch));
  let clientSource;
  let clientPath;
  if (hasDshClient(pkg)) {
    const clientExport = exportEntryPath(pkg.exports, "./client");
    if (clientExport !== void 0) {
      clientPath = resolve2(directory, clientExport);
      try {
        clientSource = await readFile2(clientPath, "utf8");
      } catch {
        clientSource = void 0;
      }
    }
  }
  const view = await ctx.shell.run(ctx.shell.resolve({
    command: `npm view ${shellSingleQuote(packageName)} versions --json ${cacheFlag}`,
    workdir: directory,
    timeoutMs: PROBE_TIMEOUT_MS,
    signal: exec.signal,
    stdoutMaxBytes: 2e6
  }));
  const viewCombined = combineOutput(view);
  const versionQuery = view.timedOut ? { status: "error", detail: "npm view \u8D85\u65F6\u3002" } : view.aborted ? { status: "error", detail: "npm view \u5DF2\u53D6\u6D88\u3002" } : parseNpmViewVersions(view.stdout.text, viewCombined, view.exitCode, version);
  const scanScript = join2(directory, SCAN_SCRIPT);
  let scan;
  if (!await pathExists(scanScript)) {
    scan = { skipped: true };
  } else {
    const scanned = await ctx.shell.run(ctx.shell.resolve({
      command: `bash ${shellSingleQuote(scanScript)} --json --all .`,
      workdir: directory,
      timeoutMs: SCAN_TIMEOUT_MS,
      signal: exec.signal,
      stdoutMaxBytes: 2e6
    }));
    const scannedText = combineOutput(scanned);
    if (scanned.timedOut) {
      scan = { skipped: false, findings: [], error: "\u626B\u63CF\u5668\u8D85\u65F6\u3002" };
    } else if (scanned.aborted) {
      scan = { skipped: false, findings: [], error: "\u626B\u63CF\u5DF2\u53D6\u6D88\u3002" };
    } else {
      try {
        scan = {
          skipped: false,
          findings: parseScanJson(scanned.stdout.text, scannedText)
        };
      } catch (error) {
        scan = {
          skipped: false,
          findings: [],
          error: error instanceof Error ? `\u65E0\u6CD5\u89E3\u6790\u626B\u63CF\u5668 JSON\uFF1A${error.message}` : "\u65E0\u6CD5\u89E3\u6790\u626B\u63CF\u5668 JSON\u3002"
        };
      }
    }
  }
  const checks = evaluateChecks({
    pkg,
    patchExists,
    pack,
    versionQuery,
    scan,
    mode,
    ...clientSource === void 0 ? {} : { clientSource },
    ...clientPath === void 0 ? {} : { clientPath }
  });
  const warnings = [];
  if (versionQuery.status === "occupied" && mode !== "npm") {
    warnings.push(`${packageName}@${version} \u5DF2\u5728 npm \u4E0A\uFF0Cmode=npm \u4F1A\u88AB\u62D2\u7EDD\u3002`);
  }
  const accessDecision = resolvePublishAccess(packageName, args.access);
  const access = accessDecision.ok ? accessDecision.access : void 0;
  const base = {
    mode,
    packageName,
    version,
    checks,
    warnings,
    tag,
    nextSteps: PUBLISH_NEXT_STEPS,
    filename: pack.filename,
    fileCount: pack.entryCount,
    packedSize: pack.size,
    unpackedSize: pack.unpackedSize,
    ...access === void 0 ? {} : { access }
  };
  const blockers = blockingFailures(checks);
  if (blockers.length > 0) {
    return fail({
      ...base,
      error: mode === "check" ? "\u6821\u9A8C\u672A\u901A\u8FC7\u3002" : `\u6821\u9A8C\u672A\u901A\u8FC7\uFF0C\u5DF2\u4E2D\u6B62${mode === "pack" ? "\u6253\u5305" : "\u53D1\u5E03"}\u3002`,
      hint: blockers.map((item) => `${item.id}\uFF1A${item.detail}`).join("\uFF1B")
    });
  }
  if (mode === "check") {
    return { ok: true, ...base };
  }
  if (mode === "pack") {
    try {
      await mkdir2(PACK_DEST_DIR, { recursive: true });
      await rm(packedTarballPath(pack.filename), { force: true });
    } catch (error) {
      return fail({
        ...base,
        error: "\u65E0\u6CD5\u51C6\u5907\u9694\u79BB\u6253\u5305\u76EE\u5F55\u3002",
        hint: error instanceof Error ? error.message : void 0
      });
    }
    const destFlag = `--pack-destination ${shellSingleQuote(PACK_DEST_DIR)}`;
    const packed = await ctx.shell.run(ctx.shell.resolve({
      command: `npm pack --json ${destFlag} ${cacheFlag}`,
      workdir: directory,
      timeoutMs: PROBE_TIMEOUT_MS,
      signal: exec.signal,
      stdoutMaxBytes: 2e6
    }));
    const packedText = redactSecrets(combineOutput(packed));
    if (packed.timedOut || packed.aborted || packed.exitCode !== 0) {
      return fail({
        ...base,
        error: packed.timedOut ? "npm pack \u8D85\u65F6\u3002" : packed.aborted ? "npm pack \u5DF2\u53D6\u6D88\u3002" : `npm pack \u9000\u51FA\u7801 ${String(packed.exitCode)}\u3002`,
        stdout: packedText,
        ...packed.exitCode === null ? {} : { exitCode: packed.exitCode }
      });
    }
    let filename = pack.filename;
    try {
      filename = parseNpmPackJson(packed.stdout.text, combineOutput(packed)).filename;
    } catch {
    }
    const tarballPath = packedTarballPath(filename);
    return {
      ok: true,
      ...base,
      filename,
      tarballPath,
      installCommand: installCommandFor(packageName, tarballPath),
      stdout: packedText,
      exitCode: 0
    };
  }
  if (pkg.private === true) {
    return fail({
      ...base,
      error: "package.json \u58F0\u660E\u4E86 private=true\uFF0Cnpm \u4F1A\u62D2\u7EDD\u53D1\u5E03\u3002"
    });
  }
  if (!accessDecision.ok) {
    return fail({ ...base, error: accessDecision.error });
  }
  const refName = config.npmTokenEnv?.trim() || DEFAULT_NPM_TOKEN_ENV;
  const credentials = ctx.get("credentials");
  if (credentials === void 0) {
    return fail({
      ...base,
      error: "\u51ED\u636E\u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u8BFB\u53D6 npm token\u3002",
      hint: `\u8BF7\u5728\u8BBE\u7F6E\u91CC\u914D\u7F6E\u5F15\u7528\u540D ${refName}\uFF0C\u6216\u786E\u8BA4\u51ED\u636E\u670D\u52A1\u5DF2\u52A0\u8F7D\u3002`
    });
  }
  let tokenConfigured = false;
  try {
    const info = await credentials.describe(credentialRef(refName));
    tokenConfigured = info.configured;
  } catch (error) {
    return fail({
      ...base,
      error: `\u51ED\u636E\u5F15\u7528\u540D\u65E0\u6548\uFF1A${refName}`,
      hint: error instanceof Error ? error.message : void 0
    });
  }
  if (!tokenConfigured) {
    return fail({
      ...base,
      error: `\u672A\u914D\u7F6E npm token \u5F15\u7528 ${refName}\u3002`,
      hint: "\u5728\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u5199\u5165 token\uFF08\u53EA\u5B58\u5F15\u7528\u540D\uFF1B\u503C\u8D70\u51ED\u636E\u670D\u52A1\uFF09\u3002\u8BF7\u4F7F\u7528 automation token\uFF0C\u907F\u514D 2FA/OTP \u6311\u6218\u3002"
    });
  }
  if (exec.agent === void 0) {
    return fail({ ...base, error: "\u7F3A\u5C11 agent \u4E0A\u4E0B\u6587\uFF0C\u65E0\u6CD5\u7533\u8BF7\u53D1\u5E03\u5BA1\u6279\u3002" });
  }
  const accessLabel = accessDecision.access === "restricted" ? "restricted\uFF08\u79C1\u6709\uFF09" : "public\uFF08\u516C\u5F00\uFF09";
  let outcome;
  try {
    outcome = await ctx.approval.request({
      agent: exec.agent,
      toolName: "publish_plugin",
      ...exec.callId === void 0 ? {} : { callId: exec.callId },
      reason: `\u5373\u5C06\u53D1\u5E03 ${packageName}@${version} \u5230 npm\u3002dist-tag=${tag}\u3002\u8BBF\u95EE\uFF1A${accessLabel}\u3002\u6B64\u64CD\u4F5C\u4E0D\u53EF\u9006\u3002\u672C\u6B21\u7533\u8BF7\u4E0D\u542B\u4EFB\u4F55\u51ED\u636E\u3002`,
      signal: exec.signal
    });
  } catch (error) {
    return fail({
      ...base,
      error: "\u7533\u8BF7\u53D1\u5E03\u5BA1\u6279\u5931\u8D25\u3002",
      hint: error instanceof Error ? error.message : void 0
    });
  }
  if (outcome !== "allowed-once") {
    return fail({ ...base, error: `\u53D1\u5E03\u672A\u83B7\u6279\u51C6\uFF08${outcome}\uFF09\u3002` });
  }
  let token;
  try {
    const hit = await credentials.resolve(credentialRef(refName));
    if (hit !== void 0 && hit.value.length > 0) token = hit.value;
  } catch (error) {
    return fail({
      ...base,
      error: `\u8BFB\u53D6\u51ED\u636E\u5931\u8D25\uFF1A${refName}`,
      hint: error instanceof Error ? error.message : void 0
    });
  }
  if (token === void 0) {
    return fail({
      ...base,
      error: "\u51ED\u636E\u5F15\u7528\u5DF2\u914D\u7F6E\uFF0C\u4F46\u672A\u80FD\u8BFB\u5230\u503C\u3002",
      hint: "\u8BF7\u91CD\u65B0\u5199\u5165 npm token\uFF08\u5EFA\u8BAE automation token\uFF09\u3002"
    });
  }
  let npmrcDir;
  try {
    await mkdir2(NPMRC_ROOT, { recursive: true });
    npmrcDir = await mkdtemp(join2(NPMRC_ROOT, "run-"));
    const npmrcPath = join2(npmrcDir, ".npmrc");
    await writeFile2(npmrcPath, NPMRC_BODY, "utf8");
    const accessFlag = isScopedPackageName(packageName) || args.access !== void 0 ? ` --access ${accessDecision.access}` : "";
    const command = [
      "npm publish",
      `--userconfig ${shellSingleQuote(npmrcPath)}`,
      cacheFlag,
      `--tag ${shellSingleQuote(tag)}`
    ].join(" ") + accessFlag;
    const published = await ctx.shell.run(ctx.shell.resolve({
      command,
      workdir: directory,
      timeoutMs: PUBLISH_TIMEOUT_MS,
      signal: exec.signal,
      stdoutMaxBytes: 2e6,
      env: { DSH_NPM_TOKEN: token }
    }));
    const publishedText = redactSecrets(combineOutput(published), [token]);
    let publishedJson;
    try {
      publishedJson = JSON.parse(published.stdout.text.trim());
    } catch {
      publishedJson = void 0;
    }
    if (published.timedOut) {
      return fail({
        ...base,
        error: "npm publish \u8D85\u65F6\u3002",
        stdout: publishedText,
        ...published.exitCode === null ? {} : { exitCode: published.exitCode }
      });
    }
    if (published.aborted) {
      return fail({ ...base, error: "npm publish \u5DF2\u53D6\u6D88\u3002", stdout: publishedText });
    }
    if (published.exitCode !== 0) {
      if (isNpmOtpChallenge(publishedText, publishedJson)) {
        return fail({
          ...base,
          error: "npm \u8981\u6C42\u4E00\u6B21\u6027\u5BC6\u7801\uFF08OTP / 2FA\uFF09\uFF0C\u975E\u4EA4\u4E92\u73AF\u5883\u4E0D\u80FD\u7EE7\u7EED\u3002",
          hint: "\u8BF7\u6539\u7528 automation token\uFF08\u4E0D\u53D7 2FA \u6311\u6218\uFF09\uFF0C\u4E0D\u8981\u5728\u5BF9\u8BDD\u6216\u5DE5\u5177\u53C2\u6570\u91CC\u7C98\u8D34 token\u3002",
          stdout: publishedText,
          ...published.exitCode === null ? {} : { exitCode: published.exitCode }
        });
      }
      if (isNpmAuthFailure(publishedText, publishedJson)) {
        return fail({
          ...base,
          error: "npm \u672A\u8BA4\u8BC1\uFF08E401\uFF09\u3002",
          hint: "\u8BF7\u68C0\u67E5\u8BBE\u7F6E\u91CC\u7684 npm token \u5F15\u7528\u662F\u5426\u6307\u5411\u6709\u6548\u7684 automation token\u3002",
          stdout: publishedText,
          ...published.exitCode === null ? {} : { exitCode: published.exitCode }
        });
      }
      return fail({
        ...base,
        error: `npm publish \u9000\u51FA\u7801 ${String(published.exitCode)}\u3002`,
        stdout: publishedText,
        ...published.exitCode === null ? {} : { exitCode: published.exitCode }
      });
    }
    return {
      ok: true,
      ...base,
      access: accessDecision.access,
      installCommand: installCommandFor(packageName),
      stdout: publishedText,
      exitCode: 0
    };
  } finally {
    if (npmrcDir !== void 0) {
      try {
        await rm(npmrcDir, { recursive: true, force: true });
      } catch {
      }
    }
  }
}

// src/publish-tool.ts
function textFromContent(content) {
  return content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text ?? "").join("\n");
}
function asMeta(value) {
  if (value === null || typeof value !== "object") return void 0;
  const record = value;
  if (typeof record.ok !== "boolean" || !Array.isArray(record.checks) || !Array.isArray(record.warnings)) {
    return void 0;
  }
  return record;
}
function createPublishTool(ctx, getConfig) {
  const host = ctx;
  return defineTool({
    name: "publish_plugin",
    description: "\u6821\u9A8C\u3001\u6253\u5305\u6216\u628A\u4E00\u4E2A dsh \u63D2\u4EF6\u53D1\u5E03\u5230 npm\u3002\u9ED8\u8BA4 mode=check\uFF0C\u53EA\u505A\u6821\u9A8C\uFF0C\u96F6\u5BF9\u5916\u526F\u4F5C\u7528\u3002pack \u5728\u6821\u9A8C\u901A\u8FC7\u540E\u628A .tgz \u5199\u5230\u4E34\u65F6\u76EE\u5F55\uFF08\u4E0D\u5199\u8FDB\u63D2\u4EF6\u4ED3\uFF09\uFF1Bnpm \u8FD8\u8981\u5BA1\u6279\u548C\u51ED\u636E\u670D\u52A1\u91CC\u7684 token \u5F15\u7528\uFF08\u4E0D\u8981\u628A token \u653E\u8FDB\u53C2\u6570\uFF09\u3002\u4E0D\u63A8 GitHub\uFF0C\u4E0D\u4EE3\u63D0 dsh.pub \u6536\u5F55 PR\u3002directory \u53EF\u7701\u7565\uFF08\u9ED8\u8BA4\u5F53\u524D\u5DE5\u4F5C\u533A\uFF09\u3002",
    parameters: {
      directory: {
        type: "string",
        description: "\u63D2\u4EF6\u4ED3\u76EE\u5F55\u3002\u7701\u7565\u5219\u4F7F\u7528\u5F53\u524D\u4F1A\u8BDD\u5DE5\u4F5C\u533A\u3002"
      },
      mode: {
        type: "string",
        enum: ["check", "pack", "npm"],
        description: "check \u53EA\u6821\u9A8C\u3001\u4E0D\u5199\u6587\u4EF6\uFF1Bpack \u6821\u9A8C\u540E\u628A tarball \u5199\u5230\u4E34\u65F6\u76EE\u5F55\uFF08\u4E0D\u5199\u8FDB\u63D2\u4EF6\u4ED3\uFF09\uFF1Bnpm \u6821\u9A8C\u4E14\u7248\u672C\u672A\u5360\u7528\u540E\u518D\u53D1\u5E03\uFF08\u9700\u5BA1\u6279\uFF09\u3002\u9ED8\u8BA4 check\u3002"
      },
      tag: {
        type: "string",
        description: "npm dist-tag\uFF0C\u4EC5 mode=npm \u4F7F\u7528\u3002\u9ED8\u8BA4 latest\u3002"
      },
      access: {
        type: "string",
        enum: ["public", "restricted"],
        description: "npm access\u3002scoped \u5305\u9ED8\u8BA4 public\uFF1Bunscoped \u4E0D\u80FD\u8BBE restricted\u3002"
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          mode: { type: "string", enum: ["check", "pack", "npm"], required: true },
          packageName: { type: "string" },
          version: { type: "string" },
          access: { type: "string", enum: ["public", "restricted"] },
          tag: { type: "string" },
          tarballPath: { type: "string" },
          installCommand: { type: "string" },
          filename: { type: "string" },
          fileCount: { type: "integer" },
          packedSize: { type: "integer" },
          unpackedSize: { type: "integer" },
          checks: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string", required: true },
                ok: { type: "boolean", required: true },
                detail: { type: "string", required: true },
                blocking: { type: "boolean", required: true }
              }
            }
          },
          warnings: { type: "array", items: { type: "string" }, required: true },
          error: { type: "string" },
          hint: { type: "string" },
          stdout: { type: "string" },
          exitCode: { type: "integer" },
          nextSteps: { type: "string" }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatPublishText(value) }],
      presentationMeta: (_args, value) => value
    },
    timeoutMs: 24e4,
    isConcurrencySafe: (args) => (args.mode ?? "check") === "check",
    presentCall: (args) => ({
      card: "terminal",
      title: "publish_plugin",
      description: args.mode === "npm" ? "\u53D1\u5E03\u5230 npm" : args.mode === "pack" ? "\u6253\u5305 dsh \u63D2\u4EF6" : "\u6821\u9A8C dsh \u63D2\u4EF6",
      ...args.directory === void 0 ? {} : { cwd: args.directory }
    }),
    presentResult: (_args, result) => {
      if (result.isError) {
        return {
          card: "terminal",
          title: "\u53D1\u5E03\u5931\u8D25",
          output: textFromContent(result.content),
          exitCode: 1
        };
      }
      const meta = asMeta(result.meta);
      if (meta === void 0) {
        return {
          card: "terminal",
          title: "publish_plugin",
          output: textFromContent(result.content)
        };
      }
      const title = !meta.ok ? "\u53D1\u5E03\u672A\u5B8C\u6210" : meta.mode === "npm" ? "\u5DF2\u53D1\u5E03\u5230 npm" : meta.mode === "pack" ? "\u6253\u5305\u5B8C\u6210" : "\u6821\u9A8C\u5B8C\u6210";
      return {
        card: "terminal",
        title,
        output: formatPublishTerminalOutput(meta),
        ...meta.exitCode === void 0 ? {} : { exitCode: meta.exitCode }
      };
    },
    async execute(args, exec) {
      return runPublish(host, args, {
        signal: exec.signal,
        ...exec.agent === void 0 ? {} : { agent: exec.agent },
        ...exec.callId === void 0 ? {} : { callId: String(exec.callId) }
      }, getConfig());
    }
  });
}
function createPublishCommand(ctx, getConfig) {
  const host = ctx;
  return {
    name: "publish-plugin",
    description: "\u6821\u9A8C\u6216\u6253\u5305\u5F53\u524D\u76EE\u5F55\u7684 dsh \u63D2\u4EF6\uFF08\u9ED8\u8BA4\u53EA\u6821\u9A8C\uFF1B\u53EF\u5199 pack / npm\uFF09",
    input: { hint: "\u53EF\u9009\uFF1Acheck|pack|npm\uFF0C\u4EE5\u53CA\u63D2\u4EF6\u76EE\u5F55" },
    async handler(invocation) {
      const parsed = parsePublishCommandInput(invocation.rawInput);
      const args = {
        mode: parsed.mode ?? "check",
        ...parsed.directory === void 0 ? {} : { directory: parsed.directory }
      };
      const value = await runPublish(host, args, {
        agent: invocation.agent,
        signal: invocation.signal
      }, getConfig());
      const text = formatPublishText(value);
      return value.ok ? { kind: "success", text } : { kind: "error", text };
    }
  };
}

// src/tool.ts
import { defineTool as defineTool2 } from "@deepseek-ai/dsh-tools";

// src/deploy.ts
import { mkdir as mkdir5, unlink as unlink2, writeFile as writeFile4 } from "node:fs/promises";
import { dirname, isAbsolute as isAbsolute3, join as join8, resolve as resolve3 } from "node:path";
import { credentialRef as credentialRef2 } from "@deepseek-ai/dsh-credentials";

// src/assets.ts
import { readdirSync, statSync } from "node:fs";
import { join as join3 } from "node:path";
var MAX_TEMPORARY_FILES = 1e3;
var MAX_TEMPORARY_FILE_BYTES = 5 * 1024 * 1024;
var SKIP_DIRS = /* @__PURE__ */ new Set([".git", "node_modules", ".wrangler"]);
function checkTemporaryAssetLimits(root) {
  let fileCount = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === void 0) break;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join3(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      fileCount += 1;
      if (fileCount > MAX_TEMPORARY_FILES) {
        return {
          ok: false,
          error: `\u9759\u6001\u8D44\u6E90\u8D85\u8FC7\u4E34\u65F6\u8D26\u53F7\u4E0A\u9650\uFF08${MAX_TEMPORARY_FILES} \u4E2A\u6587\u4EF6\uFF09\u3002`,
          hint: "\u8BF7\u7F29\u5C0F\u90E8\u7F72\u76EE\u5F55\uFF0C\u6216\u6539\u7528\u81EA\u5DF1\u7684 Cloudflare \u8D26\u53F7\uFF08L2\uFF09\u3002"
        };
      }
      let size = 0;
      try {
        size = statSync(full).size;
      } catch {
        continue;
      }
      if (size > MAX_TEMPORARY_FILE_BYTES) {
        return {
          ok: false,
          error: `\u5B58\u5728\u8D85\u8FC7 5 MiB \u7684\u6587\u4EF6\uFF0C\u4E34\u65F6\u8D26\u53F7\u65E0\u6CD5\u4E0A\u4F20\u3002`,
          hint: "\u8BF7\u53BB\u6389\u5927\u6587\u4EF6\uFF0C\u6216\u6539\u7528\u81EA\u5DF1\u7684 Cloudflare \u8D26\u53F7\uFF08L2\uFF09\u3002"
        };
      }
    }
  }
  return { ok: true, fileCount };
}

// src/detect.ts
import { existsSync } from "node:fs";
import { join as join4 } from "node:path";
var WRANGLER_CONFIGS = ["wrangler.jsonc", "wrangler.toml", "wrangler.json"];
function findWranglerConfig(directory) {
  for (const name2 of WRANGLER_CONFIGS) {
    if (existsSync(join4(directory, name2))) return name2;
  }
}
function detectProject(directory) {
  const wranglerConfigName = findWranglerConfig(directory);
  if (wranglerConfigName !== void 0) {
    return {
      kind: "worker",
      directory,
      hasWranglerConfig: true,
      wranglerConfigName
    };
  }
  if (existsSync(join4(directory, "dist", "index.html"))) {
    return {
      kind: "static-dist",
      directory,
      assetsDir: join4(directory, "dist"),
      hasWranglerConfig: false
    };
  }
  if (existsSync(join4(directory, "index.html"))) {
    return {
      kind: "static-root",
      directory,
      assetsDir: directory,
      hasWranglerConfig: false
    };
  }
}
function projectFromChoice(directory, choice) {
  const wranglerConfigName = findWranglerConfig(directory);
  if (choice === "worker") {
    return {
      kind: "worker",
      directory,
      hasWranglerConfig: wranglerConfigName !== void 0,
      ...wranglerConfigName === void 0 ? {} : { wranglerConfigName }
    };
  }
  if (choice === "static-dist") {
    return {
      kind: "static-dist",
      directory,
      assetsDir: join4(directory, "dist"),
      hasWranglerConfig: wranglerConfigName !== void 0,
      ...wranglerConfigName === void 0 ? {} : { wranglerConfigName }
    };
  }
  return {
    kind: "static-root",
    directory,
    assetsDir: directory,
    hasWranglerConfig: wranglerConfigName !== void 0,
    ...wranglerConfigName === void 0 ? {} : { wranglerConfigName }
  };
}

// src/isolated-home.ts
import { mkdir as mkdir3 } from "node:fs/promises";
import { tmpdir as tmpdir3 } from "node:os";
import { join as join5 } from "node:path";
var L1_ISOLATED_HOME = join5(tmpdir3(), "dsh-plugin-deploy", "home");
async function ensureL1IsolatedHome() {
  await mkdir3(L1_ISOLATED_HOME, { recursive: true });
  return L1_ISOLATED_HOME;
}

// src/mode.ts
function hasCloudflareAccount(input) {
  return input.authenticated || input.tokenConfigured;
}
var AUTO_ACCOUNT_TEMPORARY_HINT = "\u4E5F\u53EF\u4EE5\u663E\u5F0F\u6307\u5B9A mode=temporary\uFF0C\u4F1A\u5728\u9694\u79BB HOME \u4E0B\u8D70\u4E34\u65F6\u9884\u89C8\uFF0C\u65E0\u9700\u767B\u51FA\u672C\u673A wrangler\u3002";
function selectMode(input) {
  const hasAccount = hasCloudflareAccount(input);
  if (input.requested === "temporary") {
    if (!input.wranglerSupportsTemporary) {
      return {
        ok: false,
        error: "\u5F53\u524D wrangler \u4F4E\u4E8E 4.102.0\uFF0C\u4E0D\u652F\u6301\u4E34\u65F6\u9884\u89C8\u8D26\u53F7\u3002",
        hint: "\u8BF7\u5347\u7EA7 wrangler\uFF08npm i -g wrangler\uFF09\uFF0C\u6216\u5728\u8BBE\u7F6E\u91CC\u914D\u7F6E\u8D26\u53F7 token \u8D70 L2\u3002"
      };
    }
    const warnings = [];
    if (hasAccount) {
      warnings.push(explicitTemporaryWhileAuthenticatedWarning(input.tokenConfigured));
    }
    return { ok: true, mode: "temporary", warnings };
  }
  if (input.requested === "account") {
    if (!hasAccount) {
      return {
        ok: false,
        error: "\u672A\u68C0\u6D4B\u5230 Cloudflare \u8BA4\u8BC1\uFF0C\u65E0\u6CD5\u90E8\u7F72\u5230\u4F60\u7684\u8D26\u53F7\u3002",
        hint: "\u5728\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u586B\u5199 token \u5F15\u7528\u540D\uFF0C\u5E76\u628A\u503C\u5199\u5165 dsh \u51ED\u636E\u670D\u52A1\uFF1B\u6216\u5148\u5728\u672C\u673A wrangler login\u3002"
      };
    }
    return { ok: true, mode: "account", warnings: [] };
  }
  if (hasAccount) {
    return { ok: true, mode: "account", warnings: [AUTO_ACCOUNT_TEMPORARY_HINT] };
  }
  if (!input.wranglerSupportsTemporary) {
    return {
      ok: false,
      error: "\u672A\u8BA4\u8BC1\uFF0C\u4E14 wrangler \u4F4E\u4E8E 4.102.0\uFF0C\u65E0\u6CD5\u4F7F\u7528\u4E34\u65F6\u9884\u89C8\u3002",
      hint: "\u8BF7\u5347\u7EA7 wrangler\uFF0C\u6216\u914D\u7F6E CLOUDFLARE_API_TOKEN \u5F15\u7528\u540E\u8D70\u8D26\u53F7\u90E8\u7F72\u3002"
    };
  }
  return { ok: true, mode: "temporary", warnings: [] };
}
function explicitTemporaryWhileAuthenticatedWarning(tokenConfigured) {
  if (tokenConfigured) {
    return "\u672C\u673A\u5DF2\u767B\u5F55 wrangler \u6216\u5DF2\u914D\u7F6E API token\u3002\u4F60\u663E\u5F0F\u8981\u6C42\u4E34\u65F6\u9884\u89C8\uFF1A\u6267\u884C\u4F1A\u4F7F\u7528\u9694\u79BB HOME\uFF0C\u5E76\u628A CLOUDFLARE_API_TOKEN \u8BBE\u4E3A\u7A7A\uFF08\u5FFD\u7565\u8BE5 token\uFF09\uFF0C\u4E0D\u4F1A\u6539\u52A8\u672C\u673A\u767B\u5F55\u6001\u3002";
  }
  return "\u672C\u673A wrangler \u5DF2\u767B\u5F55\u3002\u4F60\u663E\u5F0F\u8981\u6C42\u4E34\u65F6\u9884\u89C8\uFF1A\u6267\u884C\u4F1A\u4F7F\u7528\u9694\u79BB HOME\uFF0C\u8BFB\u4E0D\u5230\u672C\u673A\u51ED\u636E\uFF0C\u65E0\u9700\u767B\u51FA\u3002";
}

// src/parse.ts
function valueAfterPrefix(text, prefix) {
  const needle = prefix.toLowerCase();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.toLowerCase().startsWith(needle)) return line.slice(prefix.length).trim();
  }
}
function parseWranglerOutput(text) {
  const result = {};
  const urlMatch = text.match(/https:\/\/[A-Za-z0-9._-]+\.(?:workers|pages)\.dev[^\s]*/);
  if (urlMatch) result.previewUrl = urlMatch[0].replace(/[).,;]+$/, "");
  const claimUrl = valueAfterPrefix(text, "Claim URL:");
  const claimWithin = valueAfterPrefix(text, "Claim within:");
  const accountLine = valueAfterPrefix(text, "Account:");
  if (claimUrl === void 0 && claimWithin === void 0 && accountLine === void 0) return result;
  const temporary = {};
  if (accountLine !== void 0) {
    temporary.account = accountLine.replace(/\s*\((?:created|reused)\)\s*$/i, "").trim();
    temporary.reused = /\(reused\)/i.test(accountLine);
  }
  if (claimWithin !== void 0) temporary.claimWithin = claimWithin;
  if (claimUrl !== void 0) temporary.claimUrl = claimUrl;
  result.temporary = temporary;
  return result;
}

// src/unclaimed.ts
import { createHash as createHash2 } from "node:crypto";
import { mkdir as mkdir4, readFile as readFile3, writeFile as writeFile3 } from "node:fs/promises";
import { tmpdir as tmpdir4 } from "node:os";
import { join as join6 } from "node:path";
function recordPath(directory) {
  const id = createHash2("sha256").update(directory).digest("hex").slice(0, 16);
  return join6(tmpdir4(), "dsh-plugin-deploy", `${id}.json`);
}
async function persistUnclaimed(record) {
  const path = recordPath(record.directory);
  await mkdir4(join6(path, ".."), { recursive: true });
  const body = { createdAt: record.createdAt };
  if (record.previewUrl !== void 0) body.previewUrl = record.previewUrl;
  if (record.workerName !== void 0) body.workerName = record.workerName;
  await writeFile3(path, `${JSON.stringify(body)}
`, "utf8");
}
async function loadUnclaimed(directory) {
  try {
    const raw = await readFile3(recordPath(directory), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return void 0;
    const value = parsed;
    if (typeof value.createdAt !== "string") return void 0;
    return {
      createdAt: value.createdAt,
      directory,
      ...typeof value.previewUrl === "string" ? { previewUrl: value.previewUrl } : {},
      ...typeof value.workerName === "string" ? { workerName: value.workerName } : {}
    };
  } catch {
    return void 0;
  }
}

// src/version.ts
var MIN_TEMPORARY_WRANGLER = { major: 4, minor: 102, patch: 0 };
function parseWranglerVersion(text) {
  const match = text.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return void 0;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}
function isWranglerVersionAtLeast(version, minimum) {
  if (version.major !== minimum.major) return version.major > minimum.major;
  if (version.minor !== minimum.minor) return version.minor > minimum.minor;
  return version.patch >= minimum.patch;
}
function formatSemVer(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

// src/whoami.ts
function isAuthenticatedWhoami(exitCode, output) {
  const text = output.toLowerCase();
  if (/not authenticated|not logged in|you are not authenticated|haven't logged in|has not logged in/.test(text)) {
    return false;
  }
  if (exitCode !== 0) return false;
  return /@|account name|account id|logged in|authenticated as/.test(text);
}

// src/worker-name.ts
import { basename as basename2 } from "node:path";
var FALLBACK_WORKER_NAME = "dsh-preview";
var MAX_WORKER_NAME_LENGTH = 63;
function deriveWorkerName(directory) {
  const raw = basename2(directory).toLowerCase();
  let cleaned = raw.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (cleaned === "" || !/^[a-z]/.test(cleaned)) {
    cleaned = `dsh-${cleaned}`.replace(/-+/g, "-").replace(/-+$/g, "");
  }
  if (cleaned === "" || cleaned === "dsh") return FALLBACK_WORKER_NAME;
  if (cleaned.length > MAX_WORKER_NAME_LENGTH) {
    cleaned = cleaned.slice(0, MAX_WORKER_NAME_LENGTH).replace(/-+$/g, "");
  }
  if (cleaned === "" || !/^[a-z]/.test(cleaned)) return FALLBACK_WORKER_NAME;
  return cleaned;
}
function workerNameFromPreviewUrl(url) {
  try {
    const first = new URL(url).hostname.split(".")[0];
    if (first !== void 0 && /^[a-z][a-z0-9-]*$/.test(first)) return first;
  } catch {
    return void 0;
  }
}

// src/wrangler-config.ts
import { readFileSync } from "node:fs";
import { isAbsolute as isAbsolute2, join as join7 } from "node:path";
function readTextFile(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return void 0;
  }
}
function parseJsoncObject(text) {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/,\s*([}\]])/g, "$1");
  try {
    const value = JSON.parse(stripped);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
    return value;
  } catch {
    return void 0;
  }
}
function parseTomlWorkerName(text) {
  const match = text.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
  const name2 = match?.[1]?.trim();
  return name2 === void 0 || name2.length === 0 ? void 0 : name2;
}
function parseTomlAssetsDirectory(text) {
  const table = text.match(/\[assets\][^\[]*?^\s*directory\s*=\s*["']([^"']+)["']/m);
  if (table?.[1] !== void 0 && table[1].trim().length > 0) return table[1].trim();
  const inline = text.match(/^\s*assets\s*=\s*\{[^}\n]*directory\s*=\s*["']([^"']+)["']/m);
  if (inline?.[1] !== void 0 && inline[1].trim().length > 0) return inline[1].trim();
}
function assetsDirectoryFromObject(obj) {
  const assets = obj.assets;
  if (assets === null || typeof assets !== "object" || Array.isArray(assets)) return void 0;
  const directory = assets.directory;
  return typeof directory === "string" && directory.trim().length > 0 ? directory.trim() : void 0;
}
function parseWranglerWorkerName(text, filename) {
  if (filename.endsWith(".toml")) return parseTomlWorkerName(text);
  const obj = parseJsoncObject(text);
  if (obj === void 0) return void 0;
  return typeof obj.name === "string" && obj.name.trim().length > 0 ? obj.name.trim() : void 0;
}
function parseWranglerAssetsDirectory(text, filename) {
  if (filename.endsWith(".toml")) return parseTomlAssetsDirectory(text);
  const obj = parseJsoncObject(text);
  if (obj === void 0) return void 0;
  return assetsDirectoryFromObject(obj);
}
function readWranglerWorkerName(directory, filename) {
  const text = readTextFile(join7(directory, filename));
  if (text === void 0) return void 0;
  return parseWranglerWorkerName(text, filename);
}
function resolveWranglerAssetsRoot(directory, filename) {
  const text = readTextFile(join7(directory, filename));
  if (text === void 0) return void 0;
  const rel = parseWranglerAssetsDirectory(text, filename);
  if (rel === void 0) return void 0;
  return isAbsolute2(rel) ? rel : join7(directory, rel);
}

// src/deploy.ts
var DEPLOY_TIMEOUT_MS = 3e5;
var PROBE_TIMEOUT_MS2 = 3e4;
var COMPATIBILITY_DATE = "2026-08-18";
var TERMS_URLS = [
  "https://www.cloudflare.com/terms/",
  "https://www.cloudflare.com/privacypolicy/"
];
var L2_LOGIN_SANDBOX_HINT = "\u9ED8\u8BA4 workspace-write \u6C99\u7BB1\u53EF\u80FD\u8BFB\u4E0D\u5230\u672C\u673A wrangler login\u3002\u8BF7\u5728\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u914D\u7F6E API token\uFF08\u63A8\u8350\uFF09\uFF0C\u6216\u5728\u66F4\u5BBD\u7684\u6743\u9650\u6A21\u5F0F\u4E0B\u8FD0\u884C\u3002";
function fail2(partial) {
  return { ok: false, warnings: [], ...partial };
}
function combineOutput2(result) {
  return [result.stdout.text, result.stderr.text].filter((text) => text.length > 0).join("\n");
}
function sessionCwd2(exec) {
  const agent = exec.agent;
  const cwd = agent?.session?.header?.cwd;
  return typeof cwd === "string" && cwd.length > 0 ? cwd : void 0;
}
function resolveDirectory2(args, exec) {
  const requested = args.directory?.trim();
  const base = sessionCwd2(exec) ?? process.cwd();
  if (requested === void 0 || requested.length === 0) return base;
  return isAbsolute3(requested) ? requested : join8(base, requested);
}
function selectedLabel(answers, id) {
  const hit = answers.find((item) => item.id === id);
  if (hit === void 0) return void 0;
  if (hit.custom !== void 0 && hit.custom.trim().length > 0) return hit.custom.trim();
  return hit.selected[0];
}
function buildDeployCommand(project, temporary, configPath, workerName) {
  const flag = temporary ? " --temporary" : "";
  if (configPath !== void 0) {
    return `wrangler deploy --config ${shellSingleQuote(configPath)}${flag}`;
  }
  if (project.hasWranglerConfig) return `wrangler deploy${flag}`;
  if (project.kind === "static-dist") {
    return `wrangler deploy --assets=./dist --name=${workerName} --compatibility-date=${COMPATIBILITY_DATE}${flag}`;
  }
  return `wrangler deploy --assets=. --name=${workerName} --compatibility-date=${COMPATIBILITY_DATE}${flag}`;
}
function generatedAssetsDirectory(project) {
  if (project.assetsDir !== void 0) return resolve3(project.assetsDir);
  if (project.kind === "static-dist") return resolve3(project.directory, "dist");
  return resolve3(project.directory);
}
function hintFromOutput(output) {
  if (/already authenticated.*--temporary/i.test(output)) {
    return "\u9694\u79BB\u73AF\u5883\u91CC wrangler \u4ECD\u5224\u5B9A\u5DF2\u8BA4\u8BC1\u3002\u4E0D\u8981\u5BF9\u672C\u673A\u6267\u884C wrangler logout\u3002\u8BF7\u6539\u8D70\u8D26\u53F7\u90E8\u7F72\uFF0C\u6216\u786E\u8BA4\u672C\u6B21\u547D\u4EE4\u5E26\u4E86\u9694\u79BB HOME \u4E0E\u7A7A\u7684 CLOUDFLARE_API_TOKEN\u3002";
  }
  if (/too many assets|more than 1000|maximum of 1000|exceed(?:s|ed).{0,80}(1000|assets|files)|1000 (?:static )?files/i.test(output)) {
    return "\u4E34\u65F6\u8D26\u53F7\u6700\u591A 1000 \u4E2A\u9759\u6001\u6587\u4EF6\u3002";
  }
  if (/exceeds the maximum.*5\s*MiB|larger than 5|5\s*MiB|maximum file size|file (?:is )?too large|asset.{0,40}(too large|exceeds)/i.test(output)) {
    return "\u4E34\u65F6\u8D26\u53F7\u5355\u6587\u4EF6\u4E0D\u80FD\u8D85\u8FC7 5 MiB\u3002";
  }
  if (/unknown argument.*temporary/i.test(output)) {
    return "\u5F53\u524D wrangler \u4E0D\u8BA4\u8BC6 --temporary\uFF0C\u8BF7\u5347\u7EA7\u5230 4.102.0 \u6216\u66F4\u9AD8\u3002";
  }
}
function resolveWorkerName(project) {
  if (project.hasWranglerConfig && project.wranglerConfigName !== void 0) {
    return readWranglerWorkerName(project.directory, project.wranglerConfigName);
  }
  return deriveWorkerName(project.directory);
}
function assetPrecheckRoot(project) {
  if (project.hasWranglerConfig && project.wranglerConfigName !== void 0) {
    return resolveWranglerAssetsRoot(project.directory, project.wranglerConfigName);
  }
  return project.assetsDir ?? project.directory;
}
async function runDeploy(ctx, args, exec, config) {
  if (args.target !== void 0 && args.target !== "auto" && args.target !== "cloudflare") {
    return fail2({ mode: "none", error: `P0 \u53EA\u652F\u6301 Cloudflare\uFF0C\u4E0D\u652F\u6301 target=${String(args.target)}\u3002` });
  }
  try {
    await ctx.subprocess.resolveExecutable("wrangler", void 0, exec.signal);
  } catch {
    return fail2({
      mode: "none",
      error: "\u672A\u627E\u5230 wrangler \u53EF\u6267\u884C\u6587\u4EF6\u3002",
      hint: "\u8BF7\u5148\u5B89\u88C5\uFF1Anpm i -g wrangler\uFF0C\u6216\u786E\u4FDD npx \u80FD\u89E3\u6790\u5230 wrangler\u3002\u672C\u63D2\u4EF6\u4E0D\u4F1A\u81EA\u52A8\u5B89\u88C5\u3002"
    });
  }
  const versionRun = await ctx.shell.run(ctx.shell.resolve({
    command: "wrangler --version",
    timeoutMs: PROBE_TIMEOUT_MS2,
    signal: exec.signal
  }));
  const version = parseWranglerVersion(combineOutput2(versionRun));
  const wranglerSupportsTemporary = version !== void 0 && isWranglerVersionAtLeast(version, MIN_TEMPORARY_WRANGLER);
  const whoRun = await ctx.shell.run(ctx.shell.resolve({
    command: "wrangler whoami",
    timeoutMs: PROBE_TIMEOUT_MS2,
    signal: exec.signal
  }));
  const authenticated = isAuthenticatedWhoami(whoRun.exitCode, combineOutput2(whoRun));
  const refName = config.apiTokenEnv?.trim() || DEFAULT_API_TOKEN_ENV;
  const credentials = ctx.get("credentials");
  let tokenConfigured = false;
  if (credentials !== void 0) {
    try {
      const info = await credentials.describe(credentialRef2(refName));
      tokenConfigured = info.configured;
    } catch (error) {
      return fail2({
        mode: "none",
        error: `\u51ED\u636E\u5F15\u7528\u540D\u65E0\u6548\uFF1A${refName}`,
        hint: error instanceof Error ? error.message : void 0
      });
    }
  }
  const decision = selectMode({
    requested: args.mode ?? "auto",
    authenticated,
    tokenConfigured,
    wranglerSupportsTemporary
  });
  if (!decision.ok) {
    const extra = version === void 0 ? void 0 : `\u5F53\u524D wrangler ${formatSemVer(version)}\uFF08\u4E34\u65F6\u9884\u89C8\u9700\u8981 ${formatSemVer(MIN_TEMPORARY_WRANGLER)}+\uFF09\u3002`;
    return fail2({
      mode: "none",
      error: decision.error,
      hint: [decision.hint, extra].filter(Boolean).join(" ")
    });
  }
  const directory = resolveDirectory2(args, exec);
  let project = detectProject(directory);
  if (project === void 0) {
    let answers;
    try {
      answers = await ctx.userQuestions.ask({
        questions: [{
          id: "project-kind",
          header: "\u9879\u76EE\u5F62\u6001",
          question: `\u65E0\u6CD5\u4ECE ${directory} \u81EA\u52A8\u5224\u65AD\u9879\u76EE\u5F62\u6001\u3002\u8BF7\u9009\u62E9\u8981\u90E8\u7F72\u7684\u5185\u5BB9\u3002`,
          options: [
            { label: "static-root", description: "\u5F53\u524D\u76EE\u5F55\u662F\u9759\u6001\u7AD9\u70B9\uFF08\u542B index.html\uFF09" },
            { label: "static-dist", description: "\u6784\u5EFA\u4EA7\u7269\u5728 dist/" },
            { label: "worker", description: "\u8FD9\u662F\u5DF2\u6709 wrangler \u914D\u7F6E\u7684 Worker \u9879\u76EE" },
            { label: "cancel", description: "\u53D6\u6D88\u90E8\u7F72" }
          ]
        }],
        ...exec.agent === void 0 ? {} : { agent: exec.agent },
        signal: exec.signal
      });
    } catch (error) {
      return fail2({
        mode: decision.mode,
        error: "\u65E0\u6CD5\u8BE2\u95EE\u9879\u76EE\u5F62\u6001\uFF08\u9700\u8981\u4EA4\u4E92\u5F0F\u754C\u9762\uFF09\u3002",
        hint: error instanceof Error ? error.message : void 0
      });
    }
    const choice = selectedLabel(answers.answers, "project-kind");
    if (choice === void 0 || choice === "cancel") {
      return fail2({ mode: decision.mode, error: "\u7528\u6237\u53D6\u6D88\u4E86\u90E8\u7F72\u3002" });
    }
    if (choice !== "static-root" && choice !== "static-dist" && choice !== "worker") {
      return fail2({ mode: decision.mode, error: "\u672A\u8BC6\u522B\u7684\u9879\u76EE\u5F62\u6001\u9009\u9879\uFF0C\u5DF2\u4E2D\u6B62\u3002" });
    }
    project = projectFromChoice(directory, choice);
  }
  if (decision.mode === "temporary") {
    let answers;
    try {
      answers = await ctx.userQuestions.ask({
        questions: [{
          id: "cf-terms",
          header: "Cloudflare \u670D\u52A1\u6761\u6B3E",
          question: [
            "\u4E34\u65F6\u9884\u89C8\u4F1A\u521B\u5EFA\u4E00\u4E2A Cloudflare \u4E34\u65F6\u8D26\u53F7\u3002\u7EE7\u7EED\u5373\u8868\u793A\u4F60\u540C\u610F Cloudflare \u7684\u670D\u52A1\u6761\u6B3E\u4E0E\u9690\u79C1\u653F\u7B56\u3002\u4E0D\u540C\u610F\u5C06\u4E2D\u6B62\u90E8\u7F72\u3002",
            `\u670D\u52A1\u6761\u6B3E\uFF1A${TERMS_URLS[0]}`,
            `\u9690\u79C1\u653F\u7B56\uFF1A${TERMS_URLS[1]}`
          ].join("\n"),
          detail: TERMS_URLS.join("\n"),
          options: [
            { label: "\u540C\u610F\u5E76\u7EE7\u7EED", description: "\u6211\u5DF2\u9605\u8BFB\u5E76\u540C\u610F\u4E0A\u8FF0\u6761\u6B3E" },
            { label: "\u4E0D\u540C\u610F\uFF0C\u4E2D\u6B62", description: "\u4E0D\u90E8\u7F72" }
          ]
        }],
        ...exec.agent === void 0 ? {} : { agent: exec.agent },
        signal: exec.signal
      });
    } catch (error) {
      return fail2({
        mode: decision.mode,
        error: "\u65E0\u6CD5\u786E\u8BA4\u670D\u52A1\u6761\u6B3E\uFF08\u9700\u8981\u4EA4\u4E92\u5F0F\u754C\u9762\uFF09\u3002",
        hint: error instanceof Error ? error.message : void 0
      });
    }
    if (selectedLabel(answers.answers, "cf-terms") !== "\u540C\u610F\u5E76\u7EE7\u7EED") {
      return fail2({ mode: decision.mode, error: "\u7528\u6237\u672A\u540C\u610F Cloudflare \u670D\u52A1\u6761\u6B3E\uFF0C\u5DF2\u4E2D\u6B62\u3002" });
    }
  }
  if (exec.agent === void 0) {
    return fail2({ mode: decision.mode, error: "\u7F3A\u5C11 agent \u4E0A\u4E0B\u6587\uFF0C\u65E0\u6CD5\u7533\u8BF7\u90E8\u7F72\u5BA1\u6279\u3002" });
  }
  let outcome;
  try {
    outcome = await ctx.approval.request({
      agent: exec.agent,
      toolName: "deploy",
      ...exec.callId === void 0 ? {} : { callId: exec.callId },
      reason: "\u5373\u5C06\u628A\u5F53\u524D\u9879\u76EE\u53D1\u5E03\u5230 Cloudflare\uFF08\u5BF9\u5916\u53EF\u89C1\uFF09\u3002\u672C\u6B21\u7533\u8BF7\u4E0D\u542B\u4EFB\u4F55\u51ED\u636E\u3002",
      signal: exec.signal
    });
  } catch (error) {
    return fail2({
      mode: decision.mode,
      error: "\u7533\u8BF7\u90E8\u7F72\u5BA1\u6279\u5931\u8D25\u3002",
      hint: error instanceof Error ? error.message : void 0
    });
  }
  if (outcome !== "allowed-once") {
    return fail2({ mode: decision.mode, error: `\u90E8\u7F72\u672A\u83B7\u6279\u51C6\uFF08${outcome}\uFF09\u3002` });
  }
  let token;
  if (decision.mode === "account" && tokenConfigured) {
    if (credentials === void 0) {
      return fail2({
        mode: decision.mode,
        error: "\u51ED\u636E\u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u8BFB\u53D6 API token\u3002",
        hint: "\u8BF7\u914D\u7F6E API token\uFF0C\u6216\u786E\u8BA4\u51ED\u636E\u670D\u52A1\u5DF2\u52A0\u8F7D\u3002"
      });
    }
    try {
      const hit = await credentials.resolve(credentialRef2(refName));
      if (hit !== void 0 && hit.value.length > 0) token = hit.value;
    } catch (error) {
      return fail2({
        mode: decision.mode,
        error: `\u8BFB\u53D6\u51ED\u636E\u5931\u8D25\uFF1A${refName}`,
        hint: error instanceof Error ? error.message : void 0
      });
    }
    if (token === void 0) {
      return fail2({
        mode: decision.mode,
        error: "\u51ED\u636E\u5F15\u7528\u5DF2\u914D\u7F6E\uFF0C\u4F46\u672A\u80FD\u8BFB\u5230\u503C\u3002",
        hint: "\u8BF7\u91CD\u65B0\u5199\u5165 token\uFF0C\u6216\u4F7F\u7528 wrangler login\u3002"
      });
    }
  }
  if (decision.mode === "temporary") {
    const precheckRoot = assetPrecheckRoot(project);
    if (precheckRoot !== void 0) {
      const limits = checkTemporaryAssetLimits(precheckRoot);
      if (!limits.ok) return fail2({ mode: decision.mode, error: limits.error, hint: limits.hint });
    }
  }
  const previous = await loadUnclaimed(directory);
  const warnings = [...decision.warnings];
  if (previous?.previewUrl) {
    warnings.push(`\u6B64\u524D\u6709\u4E00\u6761\u672A\u8BA4\u9886\u7684\u4E34\u65F6\u9884\u89C8\uFF08${previous.createdAt}\uFF09\u3002\u82E5\u4E0D\u8BA4\u9886\uFF0CCloudflare \u4F1A\u5220\u9664\u4E34\u65F6\u8D26\u53F7\u53CA\u5176\u8D44\u6E90\u3002`);
  }
  if (project.kind === "worker" && !project.hasWranglerConfig) {
    return fail2({
      mode: decision.mode,
      error: "\u4F60\u9009\u62E9\u4E86 Worker \u9879\u76EE\uFF0C\u4F46\u76EE\u5F55\u91CC\u6CA1\u6709 wrangler.jsonc / wrangler.toml\u3002",
      hint: "\u8BF7\u5148\u8865\u4E0A wrangler \u914D\u7F6E\uFF0C\u6216\u6539\u9009\u9759\u6001\u76EE\u5F55 / dist\u3002"
    });
  }
  const workerName = resolveWorkerName(project);
  const wroteTempConfig = !project.hasWranglerConfig;
  const generatedName = workerName ?? deriveWorkerName(project.directory);
  const configPath = wroteTempConfig ? generatedConfigPath(project.directory) : void 0;
  const command = buildDeployCommand(project, decision.mode === "temporary", configPath, generatedName);
  const extraSecrets = token === void 0 ? [] : [token];
  const env = {};
  if (decision.mode === "temporary") {
    try {
      env.HOME = await ensureL1IsolatedHome();
    } catch (error) {
      return fail2({
        mode: decision.mode,
        error: "\u65E0\u6CD5\u521B\u5EFA\u9694\u79BB HOME\uFF08\u6C99\u7BB1\u53EF\u5199\u4F4D\u7F6E\uFF09\u3002",
        hint: error instanceof Error ? error.message : void 0
      });
    }
    env.CLOUDFLARE_API_TOKEN = "";
  }
  if (decision.mode === "account" && token !== void 0) {
    env.CLOUDFLARE_API_TOKEN = token;
  }
  const assetsAbs = wroteTempConfig ? generatedAssetsDirectory(project) : void 0;
  const deployWorkdir = configPath === void 0 ? project.directory : dirname(configPath);
  try {
    if (configPath !== void 0 && assetsAbs !== void 0) {
      await mkdir5(dirname(configPath), { recursive: true });
      await writeFile4(
        configPath,
        generatedWranglerConfigBody(generatedName, assetsAbs, COMPATIBILITY_DATE),
        "utf8"
      );
    }
    const runOnce = () => ctx.shell.run(ctx.shell.resolve({
      command,
      workdir: deployWorkdir,
      timeoutMs: DEPLOY_TIMEOUT_MS,
      signal: exec.signal,
      stdoutMaxBytes: 2e6,
      ...Object.keys(env).length > 0 ? { env } : {}
    }));
    const run = assetsAbs === void 0 ? await runOnce() : await withAssetsIgnore(assetsAbs, runOnce);
    const redacted = redactSecrets(combineOutput2(run), extraSecrets);
    if (run.timedOut) {
      return fail2({
        mode: decision.mode,
        error: "\u90E8\u7F72\u8D85\u65F6\u3002",
        stdout: redacted,
        ...run.exitCode === null ? {} : { exitCode: run.exitCode }
      });
    }
    if (run.aborted) {
      return fail2({ mode: decision.mode, error: "\u90E8\u7F72\u5DF2\u53D6\u6D88\u3002", stdout: redacted });
    }
    if (run.exitCode !== 0) {
      const mapped = hintFromOutput(redacted);
      const loginHint = decision.mode === "account" && token === void 0 ? L2_LOGIN_SANDBOX_HINT : void 0;
      return fail2({
        mode: decision.mode,
        error: `wrangler \u9000\u51FA\u7801 ${String(run.exitCode)}\u3002`,
        hint: [mapped, loginHint].filter(Boolean).join(" ") || void 0,
        stdout: redacted,
        ...run.exitCode === null ? {} : { exitCode: run.exitCode }
      });
    }
    const parsed = parseWranglerOutput(redacted);
    const reportedName = workerName ?? (parsed.previewUrl === void 0 ? void 0 : workerNameFromPreviewUrl(parsed.previewUrl));
    const result = {
      ok: true,
      mode: decision.mode,
      warnings,
      stdout: redacted,
      exitCode: 0,
      ...reportedName === void 0 ? {} : { workerName: reportedName },
      ...parsed.previewUrl === void 0 ? {} : { previewUrl: parsed.previewUrl },
      ...parsed.temporary?.claimUrl === void 0 ? {} : { claimUrl: parsed.temporary.claimUrl },
      ...parsed.temporary?.claimWithin === void 0 ? {} : { claimWithin: parsed.temporary.claimWithin }
    };
    if (decision.mode === "temporary") {
      try {
        await persistUnclaimed({
          directory,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          ...result.previewUrl === void 0 ? {} : { previewUrl: result.previewUrl },
          ...reportedName === void 0 ? {} : { workerName: reportedName }
        });
      } catch {
        result.warnings.push("\u672A\u80FD\u628A\u672A\u8BA4\u9886\u8BB0\u5F55\u5199\u5230\u672C\u673A\u4E34\u65F6\u76EE\u5F55\uFF1B\u672C\u6B21\u7ED3\u679C\u4ECD\u4EE5\u8FD9\u6761\u56DE\u590D\u4E3A\u51C6\u3002");
      }
      if (result.previewUrl === void 0) {
        result.warnings.push("\u672A\u80FD\u4ECE wrangler \u8F93\u51FA\u89E3\u6790\u51FA\u9884\u89C8 URL\uFF0C\u8BF7\u67E5\u770B\u4E0B\u65B9\u539F\u59CB\u8F93\u51FA\u3002");
      }
    }
    return result;
  } finally {
    if (configPath !== void 0) {
      try {
        await unlink2(configPath);
      } catch {
      }
    }
  }
}

// src/format.ts
var CLAIM_LOG_NOTICE = "\u8BE5\u8BA4\u9886\u94FE\u63A5\u4F1A\u8BB0\u5F55\u5728\u4F1A\u8BDD\u65E5\u5FD7\u4E2D\uFF0C\u8BF7\u52FF\u5206\u4EAB\u6B64\u4F1A\u8BDD\u3002";
var UNCLAIMED_NOTICE = "\u8FD9\u662F\u4E34\u65F6\u9884\u89C8\u5730\u5740\uFF0C\u4E0D\u662F\u6B63\u5F0F\u4E0A\u7EBF\u3002\u82E5\u4E0D\u5728\u8BA4\u9886\u7A97\u53E3\u5185\u5B8C\u6210\u8BA4\u9886\uFF0CCloudflare \u4F1A\u5220\u9664\u8BE5\u4E34\u65F6\u8D26\u53F7\u53CA\u5176\u8D44\u6E90\u3002";
var UNSTRUCTURED_RESULT_NOTICE = "\u672C\u6B21\u8C03\u7528\u672A\u63D0\u4F9B\u7ED3\u6784\u5316\u7ED3\u679C\uFF0C\u65E0\u6CD5\u5C55\u793A\u9884\u89C8\u94FE\u63A5\u3002\u4E0B\u9762\u662F\u539F\u59CB\u8F93\u51FA\u3002";
function formatDeployText(result) {
  const lines = [];
  if (!result.ok) {
    lines.push(`\u90E8\u7F72\u672A\u5B8C\u6210\uFF1A${result.error ?? "\u672A\u77E5\u9519\u8BEF"}`);
    if (result.hint) lines.push(result.hint);
    if (result.stdout) lines.push("", result.stdout);
    return lines.join("\n");
  }
  if (result.mode === "temporary") {
    lines.push("\u4E34\u65F6\u9884\u89C8\u5730\u5740\u5DF2\u751F\u6210\uFF08\u4E0D\u662F\u6B63\u5F0F\u4E0A\u7EBF\uFF09\u3002");
    lines.push("\u90E8\u7F72\u6A21\u5F0F\uFF1Atemporary");
    if (result.previewUrl) lines.push(`\u9884\u89C8 URL\uFF1A${result.previewUrl}`);
    if (result.workerName) lines.push(`Worker \u540D\uFF1A${result.workerName}`);
    if (result.claimWithin) lines.push(`\u8BA4\u9886\u7A97\u53E3\uFF1A${result.claimWithin}`);
    if (result.claimUrl) lines.push(`\u8BA4\u9886 URL\uFF1A${result.claimUrl}`);
    lines.push(UNCLAIMED_NOTICE);
    lines.push(CLAIM_LOG_NOTICE);
  } else {
    lines.push("\u5DF2\u90E8\u7F72\u5230\u4F60\u7684 Cloudflare \u8D26\u53F7\u3002");
    lines.push("\u90E8\u7F72\u6A21\u5F0F\uFF1Aaccount");
    if (result.previewUrl) lines.push(`\u8BBF\u95EE URL\uFF1A${result.previewUrl}`);
    if (result.workerName) lines.push(`Worker \u540D\uFF1A${result.workerName}`);
  }
  if (result.warnings.length > 0) {
    lines.push("", "\u63D0\u9192\uFF1A");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }
  return lines.join("\n");
}
function formatTerminalOutput(result) {
  return formatDeployText(result);
}
var META_KEYS2 = [
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
function isNonEmptyString2(value) {
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
function labeledValue2(line, labels) {
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
    const fail3 = /^部署未完成[：:]\s*(.*)$/.exec(line);
    if (fail3) {
      const message = fail3[1].trim();
      if (message.length > 0) parsed.error = message;
      continue;
    }
    const windowValue = labeledValue2(line, /认领窗口[：:]/);
    if (windowValue !== void 0) parsed.claimWithin = windowValue;
    const claimParen = /认领链接[（(]([^）)]+)[）)]/.exec(line);
    if (claimParen) parsed.claimWithin = claimParen[1].trim();
    const worker = labeledValue2(line, /Worker(?:\s*名)?[：:]/);
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
  if (!META_KEYS2.some((key) => key in record)) return void 0;
  return record;
}
function pickString2(preferred, fallback) {
  if (isNonEmptyString2(preferred)) return preferred.trim();
  if (isNonEmptyString2(fallback)) return fallback;
  return void 0;
}
function resolveDeployPresentation(input) {
  const meta = readPresentationMeta(input.meta);
  const parsed = parseDeployText(input.text);
  const previewUrl = pickString2(meta?.previewUrl, parsed.previewUrl);
  const claimUrl = pickString2(meta?.claimUrl, parsed.claimUrl);
  const claimWithin = pickString2(meta?.claimWithin, parsed.claimWithin);
  const workerName = pickString2(meta?.workerName, parsed.workerName);
  const mode = pickString2(meta?.mode, parsed.mode);
  const error = pickString2(meta?.error, parsed.error);
  const hint = pickString2(meta?.hint, parsed.hint);
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

// src/tool.ts
function textFromContent2(content) {
  return content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text ?? "").join("\n");
}
function asMeta2(value) {
  if (value === null || typeof value !== "object") return void 0;
  const record = value;
  if (typeof record.ok !== "boolean" || !Array.isArray(record.warnings)) return void 0;
  return record;
}
function createDeployTool(ctx, getConfig) {
  const host = ctx;
  return defineTool2({
    name: "deploy",
    description: "\u628A\u5F53\u524D\u9879\u76EE\u90E8\u7F72\u5230 Cloudflare\u3002mode=auto \u65F6\uFF1A\u672A\u8BA4\u8BC1\u8D70\u4E34\u65F6\u9884\u89C8\uFF0860 \u5206\u949F\u8BA4\u9886\u7A97\u53E3\uFF09\uFF1B\u5DF2\u914D\u7F6E CLOUDFLARE_API_TOKEN \u6216 wrangler \u5DF2\u767B\u5F55\u5219\u90E8\u7F72\u5230\u7528\u6237\u8D26\u53F7\u3002\u663E\u5F0F mode=temporary \u5373\u4F7F\u672C\u673A\u5DF2\u767B\u5F55\u4E5F\u4F1A\u8D70\u9694\u79BB HOME \u7684\u4E34\u65F6\u9884\u89C8\uFF0C\u4E0D\u8981\u4E3A\u6B64\u767B\u51FA wrangler\u3002\u4E0D\u8981\u628A token \u653E\u8FDB\u53C2\u6570\u3002directory \u53EF\u7701\u7565\uFF08\u9ED8\u8BA4\u5F53\u524D\u5DE5\u4F5C\u533A\uFF09\u3002",
    parameters: {
      directory: {
        type: "string",
        description: "\u8981\u90E8\u7F72\u7684\u76EE\u5F55\u3002\u7701\u7565\u5219\u4F7F\u7528\u5F53\u524D\u4F1A\u8BDD\u5DE5\u4F5C\u533A\u3002"
      },
      target: {
        type: "string",
        enum: ["auto", "cloudflare"],
        description: "\u90E8\u7F72\u76EE\u6807\u3002P0 \u53EA\u6709 Cloudflare\u3002"
      },
      mode: {
        type: "string",
        enum: ["auto", "temporary", "account"],
        description: "auto \u6309\u8BA4\u8BC1\u72B6\u6001\u9009\u62E9\uFF08\u5DF2\u8BA4\u8BC1\u4F18\u5148\u8D26\u53F7\uFF09\uFF1Btemporary \u4E3A\u4E34\u65F6\u9884\u89C8\uFF08\u5373\u4F7F\u672C\u673A\u5DF2\u767B\u5F55\u4E5F\u8D70\u9694\u79BB HOME\uFF0C\u4E0D\u8981 logout\uFF09\uFF1Baccount \u4E3A\u7528\u6237\u8D26\u53F7\u3002"
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean", required: true },
          mode: { type: "string", enum: ["temporary", "account", "none"], required: true },
          previewUrl: { type: "string" },
          claimUrl: { type: "string" },
          claimWithin: { type: "string" },
          workerName: { type: "string" },
          warnings: { type: "array", items: { type: "string" }, required: true },
          error: { type: "string" },
          hint: { type: "string" },
          stdout: { type: "string" },
          exitCode: { type: "integer" }
        }
      },
      render: (_args, value) => [{ type: "text", text: formatDeployText(value) }],
      presentationMeta: (_args, value) => value
    },
    timeoutMs: 36e4,
    presentCall: (args) => ({
      card: "terminal",
      title: "wrangler deploy",
      description: "\u90E8\u7F72\u5230 Cloudflare",
      ...args.directory === void 0 ? {} : { cwd: args.directory }
    }),
    presentResult: (_args, result) => {
      if (result.isError) {
        return {
          card: "terminal",
          title: "\u90E8\u7F72\u5931\u8D25",
          output: textFromContent2(result.content),
          exitCode: 1
        };
      }
      const meta = asMeta2(result.meta);
      if (meta === void 0) {
        return {
          card: "terminal",
          title: "\u90E8\u7F72",
          output: textFromContent2(result.content)
        };
      }
      return {
        card: "terminal",
        title: meta.mode === "temporary" ? "\u4E34\u65F6\u9884\u89C8" : "Cloudflare \u90E8\u7F72",
        output: formatTerminalOutput(meta),
        ...meta.exitCode === void 0 ? {} : { exitCode: meta.exitCode }
      };
    },
    async execute(args, exec) {
      return runDeploy(host, args, {
        signal: exec.signal,
        ...exec.agent === void 0 ? {} : { agent: exec.agent },
        ...exec.callId === void 0 ? {} : { callId: String(exec.callId) }
      }, getConfig());
    }
  });
}
function createDeployCommand(ctx, getConfig) {
  const host = ctx;
  return {
    name: "deploy",
    description: "\u628A\u5F53\u524D\u9879\u76EE\u90E8\u7F72\u5230 Cloudflare",
    input: { hint: "\u53EF\u9009\uFF1A\u8981\u90E8\u7F72\u7684\u76EE\u5F55" },
    async handler(invocation) {
      const directory = invocation.rawInput.trim();
      const args = {
        target: "cloudflare",
        mode: "auto",
        ...directory.length === 0 ? {} : { directory }
      };
      const value = await runDeploy(host, args, {
        agent: invocation.agent,
        signal: invocation.signal
      }, getConfig());
      const text = formatDeployText(value);
      return value.ok ? { kind: "success", text } : { kind: "error", text };
    }
  };
}

// src/index.ts
var name = "dsh-plugin-deploy";
var inject = [
  "tools",
  "shell",
  "subprocess",
  "commands",
  "userQuestions",
  "approval"
];
function apply(ctx, config) {
  let source = () => config;
  installSettingsSection(ctx, DEPLOY_SETTINGS_NS, Config, config, {
    setSource: (current) => {
      source = current;
    },
    onChange: () => {
    }
  });
  ctx.tools.register(createDeployTool(ctx, () => source()));
  ctx.tools.register(createPublishTool(ctx, () => source()));
  ctx.effect(() => ctx.commands.register(createDeployCommand(ctx, () => source())));
  ctx.effect(() => ctx.commands.register(createPublishCommand(ctx, () => source())));
}
export {
  ASSET_IGNORE_PATTERNS,
  Config,
  L1_ISOLATED_HOME,
  MIN_TEMPORARY_WRANGLER,
  NPM_CACHE_DIR,
  PACK_DEST_DIR,
  PUBLISH_NEXT_STEPS,
  TARBALL_TMP_NOTICE,
  UNSTRUCTURED_PUBLISH_NOTICE,
  UNSTRUCTURED_RESULT_NOTICE,
  apply,
  createPublishCommand,
  createPublishTool,
  deriveWorkerName,
  evaluateChecks,
  forbiddenPackReason,
  formatDeployText,
  formatPublishText,
  generatedConfigPath,
  generatedWranglerConfigBody,
  hintFromOutput,
  inject,
  inspectClientBundle,
  installCommandFor,
  isOldDshTrain,
  isWranglerVersionAtLeast,
  loadUnclaimed,
  name,
  packedTarballPath,
  parseDeployText,
  parseNpmPackJson,
  parseNpmViewVersions,
  parsePublishCommandInput,
  parsePublishText,
  parseScanJson,
  parseWranglerAssetsDirectory,
  parseWranglerOutput,
  parseWranglerVersion,
  parseWranglerWorkerName,
  readPresentationMeta,
  redactSecrets,
  resolveDeployPresentation,
  resolvePublishAccess,
  resolvePublishPresentation,
  runDeploy,
  runPublish,
  selectMode
};
