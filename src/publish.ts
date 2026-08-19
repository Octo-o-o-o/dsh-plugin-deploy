import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { DEFAULT_NPM_TOKEN_ENV, type Config } from './config.ts'
import type { CredentialsLike, DeployHost } from './deploy.ts'
import { shellSingleQuote } from './generated-config.ts'
import {
  blockingFailures,
  dshBundlePatch,
  evaluateChecks,
  exportEntryPath,
  hasDshClient,
  isNpmAuthFailure,
  isNpmOtpChallenge,
  isScopedPackageName,
  parseNpmPackJson,
  parseNpmViewVersions,
  parseScanJson,
  resolvePublishAccess,
  type PackageJsonLike,
  type VersionQuery,
} from './publish-checks.ts'
import { PUBLISH_NEXT_STEPS } from './publish-format.ts'
import type {
  PublishArgs,
  PublishExec,
  PublishMode,
  PublishResult,
  ScanFinding,
} from './publish-types.ts'
import { redactSecrets } from './redact.ts'

const PROBE_TIMEOUT_MS = 45_000
const SCAN_TIMEOUT_MS = 90_000
const PUBLISH_TIMEOUT_MS = 180_000

const SCAN_SCRIPT = join('.dsh-assistant', 'hooks', 'lib', 'scan-dsh-plugin.sh')
const NPMRC_BODY = '//registry.npmjs.org/:_authToken=${DSH_NPM_TOKEN}\n'

/** Isolated npm cache so pack/view/publish do not read or write ~/.npm. */
export const NPM_CACHE_DIR = join(tmpdir(), 'dsh-plugin-deploy', 'npm-cache')

/** Isolated dest for `npm pack` so the tarball never lands in the plugin repo. */
export const PACK_DEST_DIR = join(tmpdir(), 'dsh-plugin-deploy', 'packed')

export const NPMRC_ROOT = join(tmpdir(), 'dsh-plugin-deploy', 'npmrc')

export function packedTarballPath(filename: string): string {
  return join(PACK_DEST_DIR, basename(filename))
}

export function installCommandFor(packageName: string, tarballPath?: string): string {
  const target = tarballPath ?? packageName
  return `dsh plugin --profile <p> add ${target}`
}

export function parsePublishCommandInput(raw: string): Pick<PublishArgs, 'mode' | 'directory'> {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return {}
  const parts = trimmed.split(/\s+/).filter(part => part.length > 0)
  const modes = new Set<PublishMode>(['check', 'pack', 'npm'])
  if (modes.has(parts[0] as PublishMode)) {
    return {
      mode: parts[0] as PublishMode,
      ...parts.length > 1 ? { directory: parts.slice(1).join(' ') } : {},
    }
  }
  if (parts.length >= 2 && modes.has(parts[parts.length - 1] as PublishMode)) {
    return {
      mode: parts[parts.length - 1] as PublishMode,
      directory: parts.slice(0, -1).join(' '),
    }
  }
  return { directory: trimmed }
}

function fail(
  partial: Omit<PublishResult, 'ok' | 'warnings' | 'checks'> & {
    warnings?: string[]
    checks?: PublishResult['checks']
  },
): PublishResult {
  return {
    ok: false,
    warnings: [],
    checks: [],
    nextSteps: PUBLISH_NEXT_STEPS,
    ...partial,
  }
}

function combineOutput(result: { stdout: { text: string }; stderr: { text: string } }): string {
  return [result.stdout.text, result.stderr.text].filter(text => text.length > 0).join('\n')
}

function sessionCwd(exec: PublishExec): string | undefined {
  const agent = exec.agent as { session?: { header?: { cwd?: string } } } | undefined
  const cwd = agent?.session?.header?.cwd
  return typeof cwd === 'string' && cwd.length > 0 ? cwd : undefined
}

function resolveDirectory(args: PublishArgs, exec: PublishExec): string {
  const requested = args.directory?.trim()
  const base = sessionCwd(exec) ?? process.cwd()
  if (requested === undefined || requested.length === 0) return base
  return isAbsolute(requested) ? requested : join(base, requested)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function npmCacheFlag(cacheDir: string): string {
  return `--cache ${shellSingleQuote(cacheDir)}`
}

export async function runPublish(
  ctx: DeployHost,
  args: PublishArgs,
  exec: PublishExec,
  config: Config,
): Promise<PublishResult> {
  const mode: PublishMode = args.mode ?? 'check'
  const tag = args.tag?.trim() || 'latest'
  if (mode !== 'check' && mode !== 'pack' && mode !== 'npm') {
    return fail({ mode: 'check', error: `不支持的 mode=${String(mode)}。` })
  }

  const directory = resolveDirectory(args, exec)
  try {
    await ctx.subprocess.resolveExecutable('npm', undefined, exec.signal)
  } catch {
    return fail({
      mode,
      error: '未找到 npm 可执行文件。',
      hint: '请先安装 Node.js / npm。本插件不会自动安装。',
    })
  }

  const pkgPath = join(directory, 'package.json')
  let pkgRaw: string
  try {
    pkgRaw = await readFile(pkgPath, 'utf8')
  } catch {
    return fail({ mode, error: `目录里没有 package.json：${directory}` })
  }

  let pkg: PackageJsonLike
  try {
    pkg = JSON.parse(pkgRaw) as PackageJsonLike
  } catch (error) {
    return fail({
      mode,
      error: 'package.json 不是合法 JSON。',
      hint: error instanceof Error ? error.message : undefined,
    })
  }

  const packageName = typeof pkg.name === 'string' ? pkg.name : undefined
  const version = typeof pkg.version === 'string' ? pkg.version : undefined
  if (packageName === undefined || version === undefined) {
    return fail({ mode, error: 'package.json 缺少 name 或 version。' })
  }

  try {
    await mkdir(NPM_CACHE_DIR, { recursive: true })
  } catch (error) {
    return fail({
      mode,
      error: '无法创建隔离 npm cache。',
      hint: error instanceof Error ? error.message : undefined,
    })
  }

  const cacheFlag = npmCacheFlag(NPM_CACHE_DIR)
  const dryRun = await ctx.shell.run(ctx.shell.resolve({
    command: `npm pack --dry-run --json ${cacheFlag}`,
    workdir: directory,
    timeoutMs: PROBE_TIMEOUT_MS,
    signal: exec.signal,
    stdoutMaxBytes: 2_000_000,
  }))
  const dryCombined = combineOutput(dryRun)
  if (dryRun.timedOut || dryRun.aborted || dryRun.exitCode !== 0) {
    return fail({
      mode,
      packageName,
      version,
      error: dryRun.timedOut
        ? 'npm pack --dry-run 超时。'
        : dryRun.aborted
          ? 'npm pack --dry-run 已取消。'
          : `npm pack --dry-run 退出码 ${String(dryRun.exitCode)}。`,
      stdout: redactSecrets(dryCombined),
      ...dryRun.exitCode === null ? {} : { exitCode: dryRun.exitCode },
    })
  }

  let pack
  try {
    pack = parseNpmPackJson(dryRun.stdout.text, dryCombined)
  } catch (error) {
    return fail({
      mode,
      packageName,
      version,
      error: '无法解析 npm pack --dry-run --json。',
      hint: error instanceof Error ? error.message : undefined,
      stdout: redactSecrets(dryCombined),
    })
  }

  const patch = dshBundlePatch(pkg)
  const patchExists = patch === undefined ? false : await pathExists(join(directory, patch))
  let clientSource: string | undefined
  let clientPath: string | undefined
  if (hasDshClient(pkg)) {
    const clientExport = exportEntryPath(pkg.exports, './client')
    if (clientExport !== undefined) {
      clientPath = resolve(directory, clientExport)
      try {
        clientSource = await readFile(clientPath, 'utf8')
      } catch {
        clientSource = undefined
      }
    }
  }

  const view = await ctx.shell.run(ctx.shell.resolve({
    command: `npm view ${shellSingleQuote(packageName)} versions --json ${cacheFlag}`,
    workdir: directory,
    timeoutMs: PROBE_TIMEOUT_MS,
    signal: exec.signal,
    stdoutMaxBytes: 2_000_000,
  }))
  const viewCombined = combineOutput(view)
  const versionQuery: VersionQuery = view.timedOut
    ? { status: 'error', detail: 'npm view 超时。' }
    : view.aborted
      ? { status: 'error', detail: 'npm view 已取消。' }
      : parseNpmViewVersions(view.stdout.text, viewCombined, view.exitCode, version)

  const scanScript = join(directory, SCAN_SCRIPT)
  let scan: { skipped: true } | { skipped: false; findings: ScanFinding[]; error?: string }
  if (!await pathExists(scanScript)) {
    scan = { skipped: true }
  } else {
    const scanned = await ctx.shell.run(ctx.shell.resolve({
      command: `bash ${shellSingleQuote(scanScript)} --json --all .`,
      workdir: directory,
      timeoutMs: SCAN_TIMEOUT_MS,
      signal: exec.signal,
      stdoutMaxBytes: 2_000_000,
    }))
    const scannedText = combineOutput(scanned)
    if (scanned.timedOut) {
      scan = { skipped: false, findings: [], error: '扫描器超时。' }
    } else if (scanned.aborted) {
      scan = { skipped: false, findings: [], error: '扫描已取消。' }
    } else {
      try {
        scan = {
          skipped: false,
          findings: parseScanJson(scanned.stdout.text, scannedText),
        }
      } catch (error) {
        scan = {
          skipped: false,
          findings: [],
          error: error instanceof Error ? `无法解析扫描器 JSON：${error.message}` : '无法解析扫描器 JSON。',
        }
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
    ...clientSource === undefined ? {} : { clientSource },
    ...clientPath === undefined ? {} : { clientPath },
  })

  const warnings: string[] = []
  if (versionQuery.status === 'occupied' && mode !== 'npm') {
    warnings.push(`${packageName}@${version} 已在 npm 上，mode=npm 会被拒绝。`)
  }

  const accessDecision = resolvePublishAccess(packageName, args.access)
  const access = accessDecision.ok ? accessDecision.access : undefined

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
    ...access === undefined ? {} : { access },
  } satisfies Partial<PublishResult>

  const blockers = blockingFailures(checks)
  if (blockers.length > 0) {
    return fail({
      ...base,
      error: mode === 'check' ? '校验未通过。' : `校验未通过，已中止${mode === 'pack' ? '打包' : '发布'}。`,
      hint: blockers.map(item => `${item.id}：${item.detail}`).join('；'),
    })
  }

  if (mode === 'check') {
    return { ok: true, ...base }
  }

  if (mode === 'pack') {
    try {
      await mkdir(PACK_DEST_DIR, { recursive: true })
      await rm(packedTarballPath(pack.filename), { force: true })
    } catch (error) {
      return fail({
        ...base,
        error: '无法准备隔离打包目录。',
        hint: error instanceof Error ? error.message : undefined,
      })
    }
    const destFlag = `--pack-destination ${shellSingleQuote(PACK_DEST_DIR)}`
    const packed = await ctx.shell.run(ctx.shell.resolve({
      command: `npm pack --json ${destFlag} ${cacheFlag}`,
      workdir: directory,
      timeoutMs: PROBE_TIMEOUT_MS,
      signal: exec.signal,
      stdoutMaxBytes: 2_000_000,
    }))
    const packedText = redactSecrets(combineOutput(packed))
    if (packed.timedOut || packed.aborted || packed.exitCode !== 0) {
      return fail({
        ...base,
        error: packed.timedOut
          ? 'npm pack 超时。'
          : packed.aborted
            ? 'npm pack 已取消。'
            : `npm pack 退出码 ${String(packed.exitCode)}。`,
        stdout: packedText,
        ...packed.exitCode === null ? {} : { exitCode: packed.exitCode },
      })
    }
    let filename = pack.filename
    try {
      filename = parseNpmPackJson(packed.stdout.text, combineOutput(packed)).filename
    } catch {
      // keep dry-run filename
    }
    const tarballPath = packedTarballPath(filename)
    return {
      ok: true,
      ...base,
      filename,
      tarballPath,
      installCommand: installCommandFor(packageName, tarballPath),
      stdout: packedText,
      exitCode: 0,
    }
  }

  if (pkg.private === true) {
    return fail({
      ...base,
      error: 'package.json 声明了 private=true，npm 会拒绝发布。',
    })
  }
  if (!accessDecision.ok) {
    return fail({ ...base, error: accessDecision.error })
  }

  const refName = config.npmTokenEnv?.trim() || DEFAULT_NPM_TOKEN_ENV
  const credentials = ctx.get('credentials') as CredentialsLike | undefined
  if (credentials === undefined) {
    return fail({
      ...base,
      error: '凭据服务不可用，无法读取 npm token。',
      hint: `请在设置里配置引用名 ${refName}，或确认凭据服务已加载。`,
    })
  }

  let tokenConfigured = false
  try {
    const info = await credentials.describe(credentialRef(refName))
    tokenConfigured = info.configured
  } catch (error) {
    return fail({
      ...base,
      error: `凭据引用名无效：${refName}`,
      hint: error instanceof Error ? error.message : undefined,
    })
  }
  if (!tokenConfigured) {
    return fail({
      ...base,
      error: `未配置 npm token 引用 ${refName}。`,
      hint: '在插件设置里写入 token（只存引用名；值走凭据服务）。请使用 automation token，避免 2FA/OTP 挑战。',
    })
  }

  if (exec.agent === undefined) {
    return fail({ ...base, error: '缺少 agent 上下文，无法申请发布审批。' })
  }

  const accessLabel = accessDecision.access === 'restricted' ? 'restricted（私有）' : 'public（公开）'
  let outcome: string
  try {
    outcome = await ctx.approval.request({
      agent: exec.agent,
      toolName: 'publish_plugin',
      ...exec.callId === undefined ? {} : { callId: exec.callId },
      reason: `即将发布 ${packageName}@${version} 到 npm。dist-tag=${tag}。访问：${accessLabel}。此操作不可逆。本次申请不含任何凭据。`,
      signal: exec.signal,
    })
  } catch (error) {
    return fail({
      ...base,
      error: '申请发布审批失败。',
      hint: error instanceof Error ? error.message : undefined,
    })
  }
  if (outcome !== 'allowed-once') {
    return fail({ ...base, error: `发布未获批准（${outcome}）。` })
  }

  let token: string | undefined
  try {
    const hit = await credentials.resolve(credentialRef(refName))
    if (hit !== undefined && hit.value.length > 0) token = hit.value
  } catch (error) {
    return fail({
      ...base,
      error: `读取凭据失败：${refName}`,
      hint: error instanceof Error ? error.message : undefined,
    })
  }
  if (token === undefined) {
    return fail({
      ...base,
      error: '凭据引用已配置，但未能读到值。',
      hint: '请重新写入 npm token（建议 automation token）。',
    })
  }

  let npmrcDir: string | undefined
  try {
    await mkdir(NPMRC_ROOT, { recursive: true })
    npmrcDir = await mkdtemp(join(NPMRC_ROOT, 'run-'))
    const npmrcPath = join(npmrcDir, '.npmrc')
    await writeFile(npmrcPath, NPMRC_BODY, 'utf8')

    const accessFlag = isScopedPackageName(packageName) || args.access !== undefined
      ? ` --access ${accessDecision.access}`
      : ''
    const command = [
      'npm publish',
      `--userconfig ${shellSingleQuote(npmrcPath)}`,
      cacheFlag,
      `--tag ${shellSingleQuote(tag)}`,
    ].join(' ') + accessFlag

    const published = await ctx.shell.run(ctx.shell.resolve({
      command,
      workdir: directory,
      timeoutMs: PUBLISH_TIMEOUT_MS,
      signal: exec.signal,
      stdoutMaxBytes: 2_000_000,
      env: { DSH_NPM_TOKEN: token },
    }))
    const publishedText = redactSecrets(combineOutput(published), [token])
    let publishedJson: unknown
    try {
      publishedJson = JSON.parse(published.stdout.text.trim())
    } catch {
      publishedJson = undefined
    }

    if (published.timedOut) {
      return fail({
        ...base,
        error: 'npm publish 超时。',
        stdout: publishedText,
        ...published.exitCode === null ? {} : { exitCode: published.exitCode },
      })
    }
    if (published.aborted) {
      return fail({ ...base, error: 'npm publish 已取消。', stdout: publishedText })
    }
    if (published.exitCode !== 0) {
      if (isNpmOtpChallenge(publishedText, publishedJson)) {
        return fail({
          ...base,
          error: 'npm 要求一次性密码（OTP / 2FA），非交互环境不能继续。',
          hint: '请改用 automation token（不受 2FA 挑战），不要在对话或工具参数里粘贴 token。',
          stdout: publishedText,
          ...published.exitCode === null ? {} : { exitCode: published.exitCode },
        })
      }
      if (isNpmAuthFailure(publishedText, publishedJson)) {
        return fail({
          ...base,
          error: 'npm 未认证（E401）。',
          hint: '请检查设置里的 npm token 引用是否指向有效的 automation token。',
          stdout: publishedText,
          ...published.exitCode === null ? {} : { exitCode: published.exitCode },
        })
      }
      return fail({
        ...base,
        error: `npm publish 退出码 ${String(published.exitCode)}。`,
        stdout: publishedText,
        ...published.exitCode === null ? {} : { exitCode: published.exitCode },
      })
    }

    return {
      ok: true,
      ...base,
      access: accessDecision.access,
      installCommand: installCommandFor(packageName),
      stdout: publishedText,
      exitCode: 0,
    }
  } finally {
    if (npmrcDir !== undefined) {
      try {
        await rm(npmrcDir, { recursive: true, force: true })
      } catch {
        // best-effort cleanup
      }
    }
  }
}
