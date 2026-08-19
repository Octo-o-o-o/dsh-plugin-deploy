import type { Context } from '@deepseek-ai/cordis'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Config } from './config.ts'
import { runDeploy, type DeployHost } from './deploy.ts'
import { formatDeployText, formatTerminalOutput } from './format.ts'
import type { DeployArgs, DeployResult } from './types.ts'

function textFromContent(content: ReadonlyArray<{ type: string; text?: string }>): string {
  return content
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text ?? '')
    .join('\n')
}

function asMeta(value: unknown): DeployResult | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const record = value as Partial<DeployResult>
  if (typeof record.ok !== 'boolean' || !Array.isArray(record.warnings)) return undefined
  return record as DeployResult
}

export function createDeployTool(ctx: Context, getConfig: () => Config) {
  const host = ctx as unknown as DeployHost
  return defineTool({
    name: 'deploy',
    description:
      '把当前项目部署到 Cloudflare。mode=auto 时：未认证走临时预览（60 分钟认领窗口）；'
      + '已配置 CLOUDFLARE_API_TOKEN 或 wrangler 已登录则部署到用户账号。'
      + '显式 mode=temporary 即使本机已登录也会走隔离 HOME 的临时预览，不要为此登出 wrangler。'
      + '不要把 token 放进参数。directory 可省略（默认当前工作区）。',
    parameters: {
      directory: {
        type: 'string',
        description: '要部署的目录。省略则使用当前会话工作区。',
      },
      target: {
        type: 'string',
        enum: ['auto', 'cloudflare'],
        description: '部署目标。P0 只有 Cloudflare。',
      },
      mode: {
        type: 'string',
        enum: ['auto', 'temporary', 'account'],
        description: 'auto 按认证状态选择（已认证优先账号）；temporary 为临时预览（即使本机已登录也走隔离 HOME，不要 logout）；account 为用户账号。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          mode: { type: 'string', enum: ['temporary', 'account', 'none'], required: true },
          previewUrl: { type: 'string' },
          claimUrl: { type: 'string' },
          claimWithin: { type: 'string' },
          workerName: { type: 'string' },
          warnings: { type: 'array', items: { type: 'string' }, required: true },
          error: { type: 'string' },
          hint: { type: 'string' },
          stdout: { type: 'string' },
          exitCode: { type: 'integer' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatDeployText(value) }],
      presentationMeta: (_args, value) => value,
    },
    timeoutMs: 360_000,
    presentCall: (args) => ({
      card: 'terminal',
      title: 'wrangler deploy',
      description: '部署到 Cloudflare',
      ...args.directory === undefined ? {} : { cwd: args.directory },
    }),
    presentResult: (_args, result) => {
      if (result.isError) {
        return {
          card: 'terminal',
          title: '部署失败',
          output: textFromContent(result.content),
          exitCode: 1,
        }
      }
      const meta = asMeta(result.meta)
      if (meta === undefined) {
        return {
          card: 'terminal',
          title: '部署',
          output: textFromContent(result.content),
        }
      }
      return {
        card: 'terminal',
        title: meta.mode === 'temporary' ? '临时预览' : 'Cloudflare 部署',
        output: formatTerminalOutput(meta),
        ...meta.exitCode === undefined ? {} : { exitCode: meta.exitCode },
      }
    },
    async execute(args, exec) {
      return runDeploy(host, args, {
        signal: exec.signal,
        ...exec.agent === undefined ? {} : { agent: exec.agent },
        ...exec.callId === undefined ? {} : { callId: String(exec.callId) },
      }, getConfig())
    },
  })
}

export function createDeployCommand(ctx: Context, getConfig: () => Config) {
  const host = ctx as unknown as DeployHost
  return {
    name: 'deploy',
    description: '把当前项目部署到 Cloudflare',
    input: { hint: '可选：要部署的目录' },
    async handler(invocation: {
      agent: unknown
      rawInput: string
      signal: AbortSignal
    }): Promise<CommandResult> {
      const directory = invocation.rawInput.trim()
      const args: DeployArgs = {
        target: 'cloudflare',
        mode: 'auto',
        ...directory.length === 0 ? {} : { directory },
      }
      const value = await runDeploy(host, args, {
        agent: invocation.agent,
        signal: invocation.signal,
      }, getConfig())
      const text = formatDeployText(value)
      return value.ok ? { kind: 'success', text } : { kind: 'error', text }
    },
  }
}
