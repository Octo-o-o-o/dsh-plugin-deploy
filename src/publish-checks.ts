import type { PackManifest, PublishAccess, PublishCheck, PublishMode, ScanFinding } from './publish-types.ts'

export const CHECK_IDS = [
  'dsh-plugin',
  'patch-in-pack',
  'client-bundle',
  'main-entry',
  'deps',
  'pack-clean',
  'version-available',
  'scan',
] as const

export type CheckId = (typeof CHECK_IDS)[number]

export const FORBIDDEN_PACK_REASONS = [
  '.env*',
  '.npmrc',
  '*.pem/*.key',
  'node_modules/',
  '.git/',
  '.dsh-assistant/',
  'IMPL-PROMPT.md',
] as const

export interface PackageJsonLike {
  name?: unknown
  version?: unknown
  private?: unknown
  main?: unknown
  exports?: unknown
  files?: unknown
  dependencies?: unknown
  devDependencies?: unknown
  peerDependencies?: unknown
  optionalDependencies?: unknown
  dsh?: unknown
}

export type VersionQuery =
  | { status: 'unpublished' }
  | { status: 'available' }
  | { status: 'occupied'; versions: string[] }
  | { status: 'error'; detail: string }

export interface EvaluateChecksInput {
  pkg: PackageJsonLike
  patchExists: boolean
  pack: PackManifest
  clientSource?: string
  clientPath?: string
  versionQuery: VersionQuery
  scan: { skipped: true } | { skipped: false; findings: ScanFinding[]; error?: string }
  mode: PublishMode
}

export function normalizePackPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '')
}

export function packPathSet(files: readonly { path: string }[]): Set<string> {
  return new Set(files.map(file => normalizePackPath(file.path)))
}

export function inPack(paths: Set<string>, target: string): boolean {
  return paths.has(normalizePackPath(target))
}

export function isScopedPackageName(name: string): boolean {
  return name.startsWith('@') && name.includes('/')
}

export function exportEntryPath(exportsField: unknown, key: string): string | undefined {
  if (typeof exportsField === 'string') return key === '.' ? exportsField : undefined
  if (exportsField === null || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    return undefined
  }
  const value = (exportsField as Record<string, unknown>)[key]
  if (typeof value === 'string') return value
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const rec = value as Record<string, unknown>
  if (typeof rec.default === 'string') return rec.default
  if (typeof rec.import === 'string') return rec.import
  if (typeof rec.require === 'string') return rec.require
}

export function dshBundlePatch(pkg: PackageJsonLike): string | undefined {
  if (pkg.dsh === null || typeof pkg.dsh !== 'object' || Array.isArray(pkg.dsh)) return undefined
  const bundle = (pkg.dsh as { bundle?: unknown }).bundle
  if (bundle === null || typeof bundle !== 'object' || Array.isArray(bundle)) return undefined
  const patch = (bundle as { patch?: unknown }).patch
  return typeof patch === 'string' && patch.trim().length > 0 ? patch.trim() : undefined
}

export function hasDshClient(pkg: PackageJsonLike): boolean {
  if (pkg.dsh === null || typeof pkg.dsh !== 'object' || Array.isArray(pkg.dsh)) return false
  return (pkg.dsh as { client?: unknown }).client !== undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function inspectClientBundle(source: string, packageName: string): {
  ok: boolean
  reasons: string[]
} {
  const reasons: string[] = []
  if (!source.includes('window.__ModuleLoader__.load')) {
    reasons.push('缺少 window.__ModuleLoader__.load（不是 factory bundle）')
  }
  const quoted = JSON.stringify(packageName)
  const idRe = new RegExp(`id\\s*:\\s*(?:${escapeRegExp(quoted)}|'${escapeRegExp(packageName)}')`)
  if (!idRe.test(source)) {
    reasons.push(`factory id 不是包名 ${packageName}`)
  }
  if (!/(?:^|[^\w$])(?:var|let|const)\s+module\s*=/.test(source)) {
    reasons.push("缺少 module 声明（官方 intro：var module = { exports: {} }）")
  }
  return { ok: reasons.length === 0, reasons }
}

export function forbiddenPackReason(path: string): string | undefined {
  const normalized = normalizePackPath(path)
  const base = normalized.split('/').pop() ?? normalized
  if (base === '.npmrc' || normalized === '.npmrc') return '.npmrc'
  if (base.startsWith('.env') || /(^|\/)\.env(\.|$)/.test(normalized)) return '.env*'
  if (/\.(pem|key)$/i.test(base)) return '*.pem/*.key'
  if (normalized === 'node_modules' || normalized.startsWith('node_modules/')) return 'node_modules/'
  if (normalized === '.git' || normalized.startsWith('.git/')) return '.git/'
  if (normalized === '.dsh-assistant' || normalized.startsWith('.dsh-assistant/')) {
    return '.dsh-assistant/'
  }
  if (base === 'IMPL-PROMPT.md') return 'IMPL-PROMPT.md'
}

function collectDeps(pkg: PackageJsonLike): Array<{ name: string; spec: string }> {
  const out: Array<{ name: string; spec: string }> = []
  for (const field of [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
    pkg.optionalDependencies,
  ]) {
    if (field === null || typeof field !== 'object' || Array.isArray(field)) continue
    for (const [name, spec] of Object.entries(field as Record<string, unknown>)) {
      if (typeof spec === 'string') out.push({ name, spec })
    }
  }
  return out
}

export function isDshHarnessPackage(name: string): boolean {
  return name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')
}

export function isOldDshTrain(spec: string): boolean {
  const trimmed = spec.trim().replace(/^['"]|['"]$/g, '')
  return /^(?:[~^]=?|=)?0\.0\./.test(trimmed)
}

export function isBlockingCheck(id: string, mode: PublishMode): boolean {
  if (id === 'version-available') return mode === 'npm'
  return true
}

function check(
  id: CheckId,
  ok: boolean,
  detail: string,
  mode: PublishMode,
): PublishCheck {
  return { id, ok, detail, blocking: isBlockingCheck(id, mode) }
}

export function evaluateChecks(input: EvaluateChecksInput): PublishCheck[] {
  const { pkg, pack, mode } = input
  const name = typeof pkg.name === 'string' ? pkg.name : ''
  const version = typeof pkg.version === 'string' ? pkg.version : ''
  const paths = packPathSet(pack.files)
  const checks: PublishCheck[] = []

  const patch = dshBundlePatch(pkg)
  if (patch === undefined) {
    checks.push(check(
      'dsh-plugin',
      false,
      'package.json 没有 dsh.bundle.patch，装上不会激活为 dsh 插件。',
      mode,
    ))
  } else if (!input.patchExists) {
    checks.push(check(
      'dsh-plugin',
      false,
      `dsh.bundle.patch 指向 ${patch}，但文件不存在。`,
      mode,
    ))
  } else {
    checks.push(check(
      'dsh-plugin',
      true,
      `dsh.bundle.patch 指向 ${patch}，文件存在。`,
      mode,
    ))
  }

  if (patch === undefined) {
    checks.push(check('patch-in-pack', false, '没有 patch 路径可核对打包清单。', mode))
  } else if (!inPack(paths, patch)) {
    checks.push(check(
      'patch-in-pack',
      false,
      `${normalizePackPath(patch)} 不在 npm pack 清单里，装上不会激活。`,
      mode,
    ))
  } else {
    checks.push(check(
      'patch-in-pack',
      true,
      `${normalizePackPath(patch)} 在打包清单里。`,
      mode,
    ))
  }

  if (!hasDshClient(pkg)) {
    checks.push(check('client-bundle', true, '未声明 dsh.client，已跳过。', mode))
  } else {
    const clientExport = exportEntryPath(pkg.exports, './client')
    if (clientExport === undefined) {
      checks.push(check(
        'client-bundle',
        false,
        '声明了 dsh.client 但没有 exports["./client"]。',
        mode,
      ))
    } else if (!inPack(paths, clientExport)) {
      checks.push(check(
        'client-bundle',
        false,
        `exports["./client"] 指向 ${normalizePackPath(clientExport)}，但不在打包清单里。`,
        mode,
      ))
    } else if (input.clientSource === undefined) {
      checks.push(check(
        'client-bundle',
        false,
        `${normalizePackPath(clientExport)} 在清单里，但磁盘上读不到（${input.clientPath ?? clientExport}）。`,
        mode,
      ))
    } else if (name.length === 0) {
      checks.push(check('client-bundle', false, 'package.json 没有 name，无法核对 factory id。', mode))
    } else {
      const inspected = inspectClientBundle(input.clientSource, name)
      checks.push(check(
        'client-bundle',
        inspected.ok,
        inspected.ok
          ? `${normalizePackPath(clientExport)} 是合规 factory bundle（id=${name}）。`
          : inspected.reasons.join('；'),
        mode,
      ))
    }
  }

  const mainPath = exportEntryPath(pkg.exports, '.')
    ?? (typeof pkg.main === 'string' ? pkg.main : undefined)
  if (mainPath === undefined) {
    checks.push(check('main-entry', false, '没有 main / exports["."]。', mode))
  } else if (!inPack(paths, mainPath)) {
    checks.push(check(
      'main-entry',
      false,
      `主入口 ${normalizePackPath(mainPath)} 不在打包清单里。`,
      mode,
    ))
  } else {
    checks.push(check(
      'main-entry',
      true,
      `主入口 ${normalizePackPath(mainPath)} 在打包清单里。`,
      mode,
    ))
  }

  const deps = collectDeps(pkg)
  const workspace = deps.filter(dep => dep.spec.includes('workspace:'))
  const oldTrain = deps.filter(dep => isDshHarnessPackage(dep.name) && isOldDshTrain(dep.spec))
  if (workspace.length > 0 || oldTrain.length > 0) {
    const bits = [
      ...workspace.map(dep => `${dep.name} 使用 workspace: 协议`),
      ...oldTrain.map(dep => `${dep.name}@${dep.spec} 是 0.0.x 旧 train`),
    ]
    checks.push(check('deps', false, bits.join('；'), mode))
  } else {
    checks.push(check('deps', true, '没有 workspace: 协议，也没有 @deepseek-ai/dsh* 的 0.0.x。', mode))
  }

  const dirty = pack.files
    .map(file => {
      const reason = forbiddenPackReason(file.path)
      return reason === undefined ? undefined : `${normalizePackPath(file.path)}（${reason}）`
    })
    .filter((item): item is string => item !== undefined)
  if (dirty.length > 0) {
    checks.push(check('pack-clean', false, `清单含不应发布的文件：${dirty.join('，')}`, mode))
  } else {
    checks.push(check('pack-clean', true, '清单里没有 .env / .npmrc / 密钥 / node_modules / .git / .dsh-assistant / IMPL-PROMPT.md。', mode))
  }

  if (version.length === 0) {
    checks.push(check('version-available', false, 'package.json 没有 version。', mode))
  } else if (input.versionQuery.status === 'unpublished') {
    checks.push(check('version-available', true, `${name || '该包'} 尚未发布过，当前版本 ${version} 可用。`, mode))
  } else if (input.versionQuery.status === 'available') {
    checks.push(check(
      'version-available',
      true,
      `registry 上已有其他版本，当前 ${version} 未被占用。`,
      mode,
    ))
  } else if (input.versionQuery.status === 'occupied') {
    checks.push(check(
      'version-available',
      false,
      `${name}@${version} 已在 npm 上。`,
      mode,
    ))
  } else {
    checks.push(check('version-available', false, input.versionQuery.detail, mode))
  }

  if (input.scan.skipped) {
    checks.push(check(
      'scan',
      true,
      '未找到 .dsh-assistant/hooks/lib/scan-dsh-plugin.sh，已跳过。',
      mode,
    ))
  } else if (input.scan.error !== undefined) {
    checks.push(check('scan', false, input.scan.error, mode))
  } else {
    const highs = input.scan.findings.filter(item => item.severity === 'HIGH')
    if (highs.length > 0) {
      const preview = highs
        .slice(0, 10)
        .map(item => `${item.rule}${item.file ? ` ${item.file}` : ''}${item.message ? ` ${item.message}` : ''}`)
        .join('；')
      const extra = highs.length > 10 ? `（另有 ${highs.length - 10} 条）` : ''
      checks.push(check('scan', false, `扫描 HIGH ${highs.length} 条，阻止发布：${preview}${extra}`, mode))
    } else {
      const other = input.scan.findings.length
      checks.push(check(
        'scan',
        true,
        other === 0
          ? '扫描通过（无 HIGH）。'
          : `扫描通过（无 HIGH；另有 ${other} 条 MEDIUM/LOW，不阻止发布）。`,
        mode,
      ))
    }
  }

  return checks
}

export function blockingFailures(checks: readonly PublishCheck[]): PublishCheck[] {
  return checks.filter(item => !item.ok && item.blocking)
}

export function resolvePublishAccess(
  name: string,
  requested: PublishAccess | undefined,
): { ok: true; access: PublishAccess } | { ok: false; error: string } {
  if (!isScopedPackageName(name) && requested === 'restricted') {
    return { ok: false, error: 'unscoped 包不能设 restricted（npm 只允许 public）。' }
  }
  if (requested !== undefined) return { ok: true, access: requested }
  return { ok: true, access: 'public' }
}

function extractJsonValue(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed.length === 0) throw new Error('输出为空，不是 JSON。')
  try {
    return JSON.parse(trimmed)
  } catch {
    // continue
  }
  // Prefer a complete value that consumes the remainder (array/object/string).
  // Do not parse isolated inner lines such as {"path":"LICENSE"} as the document.
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i]
    if (ch === '{' || ch === '[' || ch === '"') {
      try {
        return JSON.parse(trimmed.slice(i))
      } catch {
        // continue
      }
    }
  }
  throw new Error('输出里解析不到 JSON。')
}

export function extractJson(stdout: string, combined = stdout): unknown {
  try {
    return extractJsonValue(stdout)
  } catch (stdoutError) {
    if (combined === stdout) throw stdoutError
    return extractJsonValue(combined)
  }
}

function asPackManifest(value: unknown): PackManifest {
  const item = Array.isArray(value) ? value[0] : value
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('npm pack --json 顶层不是对象或数组。')
  }
  const rec = item as Record<string, unknown>
  if (typeof rec.filename !== 'string' || rec.filename.length === 0) {
    throw new Error('npm pack --json 缺少 filename。')
  }
  const files = Array.isArray(rec.files)
    ? rec.files.flatMap((file) => {
      if (file === null || typeof file !== 'object' || Array.isArray(file)) return []
      const path = (file as { path?: unknown }).path
      return typeof path === 'string' ? [{ path }] : []
    })
    : []
  const size = typeof rec.size === 'number' ? rec.size : 0
  const unpackedSize = typeof rec.unpackedSize === 'number' ? rec.unpackedSize : 0
  const entryCount = typeof rec.entryCount === 'number' ? rec.entryCount : files.length
  return {
    filename: rec.filename,
    size,
    unpackedSize,
    entryCount,
    files,
    ...typeof rec.name === 'string' ? { name: rec.name } : {},
    ...typeof rec.version === 'string' ? { version: rec.version } : {},
  }
}

export function parseNpmPackJson(stdout: string, combined = stdout): PackManifest {
  return asPackManifest(extractJson(stdout, combined))
}

export function isNpmErrorCode(value: unknown, code: string): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const error = (value as { error?: unknown }).error
  if (error === null || typeof error !== 'object' || Array.isArray(error)) return false
  return (error as { code?: unknown }).code === code
}

function asVersionList(json: unknown): string[] | undefined {
  if (typeof json === 'string') return [json]
  if (Array.isArray(json) && json.every(item => typeof item === 'string')) return json
}

export function parseNpmViewVersions(
  stdout: string,
  combined: string,
  exitCode: number | null,
  version: string,
): VersionQuery {
  let json: unknown
  try {
    json = extractJson(stdout, combined)
  } catch {
    if (exitCode !== 0 && /E404|404 Not Found|is not in this registry/i.test(combined)) {
      return { status: 'unpublished' }
    }
    return {
      status: 'error',
      detail: exitCode === 0
        ? 'npm view --json 输出无法解析。'
        : `npm view 失败（退出码 ${String(exitCode)}）。`,
    }
  }
  if (isNpmErrorCode(json, 'E404')) return { status: 'unpublished' }
  if (json !== null && typeof json === 'object' && !Array.isArray(json) && 'error' in json) {
    const error = (json as { error?: { code?: unknown; summary?: unknown } }).error
    const code = typeof error?.code === 'string' ? error.code : 'unknown'
    const summary = typeof error?.summary === 'string' ? error.summary : ''
    return { status: 'error', detail: `npm view 报错 ${code}${summary ? `：${summary}` : ''}` }
  }
  const versions = asVersionList(json)
  if (versions === undefined) {
    return { status: 'error', detail: 'npm view versions 不是字符串或字符串数组。' }
  }
  if (versions.includes(version)) return { status: 'occupied', versions }
  return { status: 'available' }
}

export function parseScanJson(stdout: string, combined = stdout): ScanFinding[] {
  const trimmed = stdout.trim()
  if (trimmed.length === 0) {
    const fallback = combined.trim()
    if (fallback.length === 0) return []
    return parseScanJson(fallback, fallback)
  }
  const json = extractJson(stdout, combined)
  if (!Array.isArray(json)) throw new Error('扫描器 --json 输出不是数组。')
  const findings: ScanFinding[] = []
  for (const item of json) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue
    const rec = item as Record<string, unknown>
    if (typeof rec.rule !== 'string' || typeof rec.severity !== 'string') continue
    findings.push({
      rule: rec.rule,
      severity: rec.severity,
      ...typeof rec.file === 'string' ? { file: rec.file } : {},
      ...typeof rec.line === 'number' ? { line: rec.line } : {},
      ...typeof rec.message === 'string' ? { message: rec.message } : {},
    })
  }
  return findings
}

export function isNpmOtpChallenge(text: string, json?: unknown): boolean {
  if (isNpmErrorCode(json, 'EOTP')) return true
  return /one-time password|EOTP|\bOTP\b|two-factor|2FA|authenticator app|enter otp|npm error code EOTP/i.test(text)
}

export function isNpmAuthFailure(text: string, json?: unknown): boolean {
  if (isNpmErrorCode(json, 'E401') || isNpmErrorCode(json, 'ENEEDAUTH')) return true
  return /npm error code E401|ENEEDAUTH|not authorized|you must be logged in|unable to authenticate|401 Unauthorized/i.test(text)
}