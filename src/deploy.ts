import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { checkTemporaryAssetLimits } from './assets.ts'
import { DEFAULT_API_TOKEN_ENV, type Config } from './config.ts'
import { detectProject, projectFromChoice, type DetectedProject, type ProjectKind } from './detect.ts'
import {
  generatedConfigPath,
  generatedWranglerConfigBody,
  shellSingleQuote,
  withAssetsIgnore,
} from './generated-config.ts'
import { ensureL1IsolatedHome } from './isolated-home.ts'
import { selectMode } from './mode.ts'
import { parseWranglerOutput } from './parse.ts'
import { redactSecrets } from './redact.ts'
import type { DeployArgs, DeployExec, DeployResult } from './types.ts'
import { loadUnclaimed, persistUnclaimed } from './unclaimed.ts'
import {
  formatSemVer,
  isWranglerVersionAtLeast,
  MIN_TEMPORARY_WRANGLER,
  parseWranglerVersion,
} from './version.ts'
import { isAuthenticatedWhoami } from './whoami.ts'
import { deriveWorkerName, workerNameFromPreviewUrl } from './worker-name.ts'
import { readWranglerWorkerName, resolveWranglerAssetsRoot } from './wrangler-config.ts'

const DEPLOY_TIMEOUT_MS = 300_000
const PROBE_TIMEOUT_MS = 30_000
const COMPATIBILITY_DATE = '2026-08-18'

const TERMS_URLS = [
  'https://www.cloudflare.com/terms/',
  'https://www.cloudflare.com/privacypolicy/',
]

const L2_LOGIN_SANDBOX_HINT =
  '默认 workspace-write 沙箱可能读不到本机 wrangler login。请在插件设置里配置 API token（推荐），或在更宽的权限模式下运行。'

export interface ShellLike {
  resolve(request: {
    command: string
    workdir?: string
    timeoutMs?: number
    signal?: AbortSignal
    env?: Record<string, string>
    stdoutMaxBytes?: number
  }): unknown
  run(spec: unknown): Promise<{
    exitCode: number | null
    timedOut: boolean
    aborted: boolean
    stdout: { text: string }
    stderr: { text: string }
  }>
}

/** Optional credentials seam: `describe` never returns the value. */
export interface CredentialsLike {
  describe(ref: ReturnType<typeof credentialRef>): Promise<{ configured: boolean }>
  resolve(ref: ReturnType<typeof credentialRef>): Promise<{ value: string } | undefined>
}

export interface DeployHost {
  subprocess: {
    resolveExecutable(
      command: string,
      env?: Readonly<Record<string, string>>,
      signal?: AbortSignal,
    ): Promise<string>
  }
  shell: ShellLike
  get(name: string): unknown
  userQuestions: {
    ask(request: {
      questions: Array<{
        id: string
        question: string
        header?: string
        detail?: string
        options?: Array<{ label: string; description?: string }>
      }>
      agent?: unknown
      signal?: AbortSignal
    }): Promise<{ answers: Array<{ id: string; selected: string[]; custom?: string }> }>
  }
  approval: {
    request(req: {
      agent: unknown
      toolName: string
      callId?: string
      reason?: string
      signal?: AbortSignal
    }): Promise<string>
  }
}

function fail(partial: Omit<DeployResult, 'ok' | 'warnings'> & { warnings?: string[] }): DeployResult {
  return { ok: false, warnings: [], ...partial }
}

function combineOutput(result: { stdout: { text: string }; stderr: { text: string } }): string {
  return [result.stdout.text, result.stderr.text].filter(text => text.length > 0).join('\n')
}

function sessionCwd(exec: DeployExec): string | undefined {
  const agent = exec.agent as { session?: { header?: { cwd?: string } } } | undefined
  const cwd = agent?.session?.header?.cwd
  return typeof cwd === 'string' && cwd.length > 0 ? cwd : undefined
}

function resolveDirectory(args: DeployArgs, exec: DeployExec): string {
  const requested = args.directory?.trim()
  const base = sessionCwd(exec) ?? process.cwd()
  if (requested === undefined || requested.length === 0) return base
  return isAbsolute(requested) ? requested : join(base, requested)
}

function selectedLabel(
  answers: Array<{ id: string; selected: string[]; custom?: string }>,
  id: string,
): string | undefined {
  const hit = answers.find(item => item.id === id)
  if (hit === undefined) return undefined
  if (hit.custom !== undefined && hit.custom.trim().length > 0) return hit.custom.trim()
  return hit.selected[0]
}

function buildDeployCommand(
  project: DetectedProject,
  temporary: boolean,
  configPath: string | undefined,
  workerName: string,
): string {
  const flag = temporary ? ' --temporary' : ''
  if (configPath !== undefined) {
    return `wrangler deploy --config ${shellSingleQuote(configPath)}${flag}`
  }
  if (project.hasWranglerConfig) return `wrangler deploy${flag}`
  if (project.kind === 'static-dist') {
    return `wrangler deploy --assets=./dist --name=${workerName} --compatibility-date=${COMPATIBILITY_DATE}${flag}`
  }
  return `wrangler deploy --assets=. --name=${workerName} --compatibility-date=${COMPATIBILITY_DATE}${flag}`
}

function generatedAssetsDirectory(project: DetectedProject): string {
  if (project.assetsDir !== undefined) return resolve(project.assetsDir)
  if (project.kind === 'static-dist') return resolve(project.directory, 'dist')
  return resolve(project.directory)
}

export function hintFromOutput(output: string): string | undefined {
  if (/already authenticated.*--temporary/i.test(output)) {
    return '隔离环境里 wrangler 仍判定已认证。不要对本机执行 wrangler logout。请改走账号部署，或确认本次命令带了隔离 HOME 与空的 CLOUDFLARE_API_TOKEN。'
  }
  if (/too many assets|more than 1000|maximum of 1000|exceed(?:s|ed).{0,80}(1000|assets|files)|1000 (?:static )?files/i.test(output)) {
    return '临时账号最多 1000 个静态文件。'
  }
  if (/exceeds the maximum.*5\s*MiB|larger than 5|5\s*MiB|maximum file size|file (?:is )?too large|asset.{0,40}(too large|exceeds)/i.test(output)) {
    return '临时账号单文件不能超过 5 MiB。'
  }
  if (/unknown argument.*temporary/i.test(output)) {
    return '当前 wrangler 不认识 --temporary，请升级到 4.102.0 或更高。'
  }
}

function resolveWorkerName(project: DetectedProject): string | undefined {
  if (project.hasWranglerConfig && project.wranglerConfigName !== undefined) {
    return readWranglerWorkerName(project.directory, project.wranglerConfigName)
  }
  return deriveWorkerName(project.directory)
}

function assetPrecheckRoot(project: DetectedProject): string | undefined {
  if (project.hasWranglerConfig && project.wranglerConfigName !== undefined) {
    return resolveWranglerAssetsRoot(project.directory, project.wranglerConfigName)
  }
  return project.assetsDir ?? project.directory
}

export async function runDeploy(
  ctx: DeployHost,
  args: DeployArgs,
  exec: DeployExec,
  config: Config,
): Promise<DeployResult> {
  if (args.target !== undefined && args.target !== 'auto' && args.target !== 'cloudflare') {
    return fail({ mode: 'none', error: `P0 只支持 Cloudflare，不支持 target=${String(args.target)}。` })
  }

  try {
    await ctx.subprocess.resolveExecutable('wrangler', undefined, exec.signal)
  } catch {
    return fail({
      mode: 'none',
      error: '未找到 wrangler 可执行文件。',
      hint: '请先安装：npm i -g wrangler，或确保 npx 能解析到 wrangler。本插件不会自动安装。',
    })
  }

  const versionRun = await ctx.shell.run(ctx.shell.resolve({
    command: 'wrangler --version',
    timeoutMs: PROBE_TIMEOUT_MS,
    signal: exec.signal,
  }))
  const version = parseWranglerVersion(combineOutput(versionRun))
  const wranglerSupportsTemporary = version !== undefined
    && isWranglerVersionAtLeast(version, MIN_TEMPORARY_WRANGLER)

  const whoRun = await ctx.shell.run(ctx.shell.resolve({
    command: 'wrangler whoami',
    timeoutMs: PROBE_TIMEOUT_MS,
    signal: exec.signal,
  }))
  const authenticated = isAuthenticatedWhoami(whoRun.exitCode, combineOutput(whoRun))

  const refName = config.apiTokenEnv?.trim() || DEFAULT_API_TOKEN_ENV
  const credentials = ctx.get('credentials') as CredentialsLike | undefined
  let tokenConfigured = false
  if (credentials !== undefined) {
    try {
      const info = await credentials.describe(credentialRef(refName))
      tokenConfigured = info.configured
    } catch (error) {
      return fail({
        mode: 'none',
        error: `凭据引用名无效：${refName}`,
        hint: error instanceof Error ? error.message : undefined,
      })
    }
  }

  const decision = selectMode({
    requested: args.mode ?? 'auto',
    authenticated,
    tokenConfigured,
    wranglerSupportsTemporary,
  })
  if (!decision.ok) {
    const extra = version === undefined
      ? undefined
      : `当前 wrangler ${formatSemVer(version)}（临时预览需要 ${formatSemVer(MIN_TEMPORARY_WRANGLER)}+）。`
    return fail({
      mode: 'none',
      error: decision.error,
      hint: [decision.hint, extra].filter(Boolean).join(' '),
    })
  }

  const directory = resolveDirectory(args, exec)
  let project = detectProject(directory)
  if (project === undefined) {
    let answers
    try {
      answers = await ctx.userQuestions.ask({
        questions: [{
          id: 'project-kind',
          header: '项目形态',
          question: `无法从 ${directory} 自动判断项目形态。请选择要部署的内容。`,
          options: [
            { label: 'static-root', description: '当前目录是静态站点（含 index.html）' },
            { label: 'static-dist', description: '构建产物在 dist/' },
            { label: 'worker', description: '这是已有 wrangler 配置的 Worker 项目' },
            { label: 'cancel', description: '取消部署' },
          ],
        }],
        ...exec.agent === undefined ? {} : { agent: exec.agent },
        signal: exec.signal,
      })
    } catch (error) {
      return fail({
        mode: decision.mode,
        error: '无法询问项目形态（需要交互式界面）。',
        hint: error instanceof Error ? error.message : undefined,
      })
    }
    const choice = selectedLabel(answers.answers, 'project-kind')
    if (choice === undefined || choice === 'cancel') {
      return fail({ mode: decision.mode, error: '用户取消了部署。' })
    }
    if (choice !== 'static-root' && choice !== 'static-dist' && choice !== 'worker') {
      return fail({ mode: decision.mode, error: '未识别的项目形态选项，已中止。' })
    }
    project = projectFromChoice(directory, choice as ProjectKind)
  }

  if (decision.mode === 'temporary') {
    let answers
    try {
      answers = await ctx.userQuestions.ask({
        questions: [{
          id: 'cf-terms',
          header: 'Cloudflare 服务条款',
          question: [
            '临时预览会创建一个 Cloudflare 临时账号。继续即表示你同意 Cloudflare 的服务条款与隐私政策。不同意将中止部署。',
            `服务条款：${TERMS_URLS[0]}`,
            `隐私政策：${TERMS_URLS[1]}`,
          ].join('\n'),
          detail: TERMS_URLS.join('\n'),
          options: [
            { label: '同意并继续', description: '我已阅读并同意上述条款' },
            { label: '不同意，中止', description: '不部署' },
          ],
        }],
        ...exec.agent === undefined ? {} : { agent: exec.agent },
        signal: exec.signal,
      })
    } catch (error) {
      return fail({
        mode: decision.mode,
        error: '无法确认服务条款（需要交互式界面）。',
        hint: error instanceof Error ? error.message : undefined,
      })
    }
    if (selectedLabel(answers.answers, 'cf-terms') !== '同意并继续') {
      return fail({ mode: decision.mode, error: '用户未同意 Cloudflare 服务条款，已中止。' })
    }
  }

  if (exec.agent === undefined) {
    return fail({ mode: decision.mode, error: '缺少 agent 上下文，无法申请部署审批。' })
  }
  let outcome: string
  try {
    outcome = await ctx.approval.request({
      agent: exec.agent,
      toolName: 'deploy',
      ...exec.callId === undefined ? {} : { callId: exec.callId },
      reason: '即将把当前项目发布到 Cloudflare（对外可见）。本次申请不含任何凭据。',
      signal: exec.signal,
    })
  } catch (error) {
    return fail({
      mode: decision.mode,
      error: '申请部署审批失败。',
      hint: error instanceof Error ? error.message : undefined,
    })
  }
  if (outcome !== 'allowed-once') {
    return fail({ mode: decision.mode, error: `部署未获批准（${outcome}）。` })
  }

  let token: string | undefined
  if (decision.mode === 'account' && tokenConfigured) {
    if (credentials === undefined) {
      return fail({
        mode: decision.mode,
        error: '凭据服务不可用，无法读取 API token。',
        hint: '请配置 API token，或确认凭据服务已加载。',
      })
    }
    try {
      const hit = await credentials.resolve(credentialRef(refName))
      if (hit !== undefined && hit.value.length > 0) token = hit.value
    } catch (error) {
      return fail({
        mode: decision.mode,
        error: `读取凭据失败：${refName}`,
        hint: error instanceof Error ? error.message : undefined,
      })
    }
    if (token === undefined) {
      return fail({
        mode: decision.mode,
        error: '凭据引用已配置，但未能读到值。',
        hint: '请重新写入 token，或使用 wrangler login。',
      })
    }
  }

  if (decision.mode === 'temporary') {
    const precheckRoot = assetPrecheckRoot(project)
    if (precheckRoot !== undefined) {
      const limits = checkTemporaryAssetLimits(precheckRoot)
      if (!limits.ok) return fail({ mode: decision.mode, error: limits.error, hint: limits.hint })
    }
  }

  const previous = await loadUnclaimed(directory)
  const warnings = [...decision.warnings]
  if (previous?.previewUrl) {
    warnings.push(`此前有一条未认领的临时预览（${previous.createdAt}）。若不认领，Cloudflare 会删除临时账号及其资源。`)
  }

  if (project.kind === 'worker' && !project.hasWranglerConfig) {
    return fail({
      mode: decision.mode,
      error: '你选择了 Worker 项目，但目录里没有 wrangler.jsonc / wrangler.toml。',
      hint: '请先补上 wrangler 配置，或改选静态目录 / dist。',
    })
  }

  const workerName = resolveWorkerName(project)
  const wroteTempConfig = !project.hasWranglerConfig
  const generatedName = workerName ?? deriveWorkerName(project.directory)
  const configPath = wroteTempConfig ? generatedConfigPath(project.directory) : undefined
  const command = buildDeployCommand(project, decision.mode === 'temporary', configPath, generatedName)

  const extraSecrets = token === undefined ? [] : [token]
  const env: Record<string, string> = {}
  if (decision.mode === 'temporary') {
    try {
      env.HOME = await ensureL1IsolatedHome()
    } catch (error) {
      return fail({
        mode: decision.mode,
        error: '无法创建隔离 HOME（沙箱可写位置）。',
        hint: error instanceof Error ? error.message : undefined,
      })
    }
    // SENSITIVE_ENV_PATTERN = /KEY|PASSWORD|SECRET|TOKEN/i strips inherited
    // CLOUDFLARE_API_TOKEN. An explicit empty value must be set so a leftover
    // parent token cannot reappear, and so wrangler does not treat the process
    // as already authenticated.
    env.CLOUDFLARE_API_TOKEN = ''
  }
  if (decision.mode === 'account' && token !== undefined) {
    env.CLOUDFLARE_API_TOKEN = token
  }

  const assetsAbs = wroteTempConfig ? generatedAssetsDirectory(project) : undefined
  const deployWorkdir = configPath === undefined ? project.directory : dirname(configPath)

  try {
    if (configPath !== undefined && assetsAbs !== undefined) {
      await mkdir(dirname(configPath), { recursive: true })
      await writeFile(
        configPath,
        generatedWranglerConfigBody(generatedName, assetsAbs, COMPATIBILITY_DATE),
        'utf8',
      )
    }
    const runOnce = () => ctx.shell.run(ctx.shell.resolve({
      command,
      workdir: deployWorkdir,
      timeoutMs: DEPLOY_TIMEOUT_MS,
      signal: exec.signal,
      stdoutMaxBytes: 2_000_000,
      ...Object.keys(env).length > 0 ? { env } : {},
    }))
    const run = assetsAbs === undefined ? await runOnce() : await withAssetsIgnore(assetsAbs, runOnce)
    const redacted = redactSecrets(combineOutput(run), extraSecrets)
    if (run.timedOut) {
      return fail({
        mode: decision.mode,
        error: '部署超时。',
        stdout: redacted,
        ...run.exitCode === null ? {} : { exitCode: run.exitCode },
      })
    }
    if (run.aborted) {
      return fail({ mode: decision.mode, error: '部署已取消。', stdout: redacted })
    }
    if (run.exitCode !== 0) {
      const mapped = hintFromOutput(redacted)
      const loginHint = decision.mode === 'account' && token === undefined
        ? L2_LOGIN_SANDBOX_HINT
        : undefined
      return fail({
        mode: decision.mode,
        error: `wrangler 退出码 ${String(run.exitCode)}。`,
        hint: [mapped, loginHint].filter(Boolean).join(' ') || undefined,
        stdout: redacted,
        ...run.exitCode === null ? {} : { exitCode: run.exitCode },
      })
    }

    const parsed = parseWranglerOutput(redacted)
    const reportedName = workerName
      ?? (parsed.previewUrl === undefined ? undefined : workerNameFromPreviewUrl(parsed.previewUrl))
    const result: DeployResult = {
      ok: true,
      mode: decision.mode,
      warnings,
      stdout: redacted,
      exitCode: 0,
      ...reportedName === undefined ? {} : { workerName: reportedName },
      ...parsed.previewUrl === undefined ? {} : { previewUrl: parsed.previewUrl },
      ...parsed.temporary?.claimUrl === undefined ? {} : { claimUrl: parsed.temporary.claimUrl },
      ...parsed.temporary?.claimWithin === undefined ? {} : { claimWithin: parsed.temporary.claimWithin },
    }
    if (decision.mode === 'temporary') {
      try {
        await persistUnclaimed({
          directory,
          createdAt: new Date().toISOString(),
          ...result.previewUrl === undefined ? {} : { previewUrl: result.previewUrl },
          ...reportedName === undefined ? {} : { workerName: reportedName },
        })
      } catch {
        result.warnings.push('未能把未认领记录写到本机临时目录；本次结果仍以这条回复为准。')
      }
      if (result.previewUrl === undefined) {
        result.warnings.push('未能从 wrangler 输出解析出预览 URL，请查看下方原始输出。')
      }
    }
    return result
  } finally {
    if (configPath !== undefined) {
      try {
        await unlink(configPath)
      } catch {
        // best-effort cleanup
      }
    }
  }
}
