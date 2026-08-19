import type { Context } from '@deepseek-ai/cordis'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Config } from './config.ts'
import type { DeployHost } from './deploy.ts'
import { formatPublishTerminalOutput, formatPublishText } from './publish-format.ts'
import { parsePublishCommandInput, runPublish } from './publish.ts'
import type { PublishArgs, PublishResult } from './publish-types.ts'

function textFromContent(content: ReadonlyArray<{ type: string; text?: string }>): string {
  return content
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text ?? '')
    .join('\n')
}

function asMeta(value: unknown): PublishResult | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const record = value as Partial<PublishResult>
  if (typeof record.ok !== 'boolean' || !Array.isArray(record.checks) || !Array.isArray(record.warnings)) {
    return undefined
  }
  return record as PublishResult
}

export function createPublishTool(ctx: Context, getConfig: () => Config) {
  const host = ctx as unknown as DeployHost
  return defineTool({
    name: 'publish_plugin',
    description:
      '校验、打包或把一个 dsh 插件发布到 npm。默认 mode=check，只做校验，零对外副作用。'
      + 'pack 在校验通过后把 .tgz 写到临时目录（不写进插件仓）；npm 还要审批和凭据服务里的 token 引用（不要把 token 放进参数）。'
      + '不推 GitHub，不代提 dsh.pub 收录 PR。directory 可省略（默认当前工作区）。',
    parameters: {
      directory: {
        type: 'string',
        description: '插件仓目录。省略则使用当前会话工作区。',
      },
      mode: {
        type: 'string',
        enum: ['check', 'pack', 'npm'],
        description: 'check 只校验、不写文件；pack 校验后把 tarball 写到临时目录（不写进插件仓）；npm 校验且版本未占用后再发布（需审批）。默认 check。',
      },
      tag: {
        type: 'string',
        description: 'npm dist-tag，仅 mode=npm 使用。默认 latest。',
      },
      access: {
        type: 'string',
        enum: ['public', 'restricted'],
        description: 'npm access。scoped 包默认 public；unscoped 不能设 restricted。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          mode: { type: 'string', enum: ['check', 'pack', 'npm'], required: true },
          packageName: { type: 'string' },
          version: { type: 'string' },
          access: { type: 'string', enum: ['public', 'restricted'] },
          tag: { type: 'string' },
          tarballPath: { type: 'string' },
          installCommand: { type: 'string' },
          filename: { type: 'string' },
          fileCount: { type: 'integer' },
          packedSize: { type: 'integer' },
          unpackedSize: { type: 'integer' },
          checks: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                ok: { type: 'boolean', required: true },
                detail: { type: 'string', required: true },
                blocking: { type: 'boolean', required: true },
              },
            },
          },
          warnings: { type: 'array', items: { type: 'string' }, required: true },
          error: { type: 'string' },
          hint: { type: 'string' },
          stdout: { type: 'string' },
          exitCode: { type: 'integer' },
          nextSteps: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: formatPublishText(value) }],
      presentationMeta: (_args, value) => value,
    },
    timeoutMs: 240_000,
    isConcurrencySafe: (args) => (args.mode ?? 'check') === 'check',
    presentCall: (args) => ({
      card: 'terminal',
      title: 'publish_plugin',
      description: args.mode === 'npm'
        ? '发布到 npm'
        : args.mode === 'pack'
          ? '打包 dsh 插件'
          : '校验 dsh 插件',
      ...args.directory === undefined ? {} : { cwd: args.directory },
    }),
    presentResult: (_args, result) => {
      if (result.isError) {
        return {
          card: 'terminal',
          title: '发布失败',
          output: textFromContent(result.content),
          exitCode: 1,
        }
      }
      const meta = asMeta(result.meta)
      if (meta === undefined) {
        return {
          card: 'terminal',
          title: 'publish_plugin',
          output: textFromContent(result.content),
        }
      }
      const title = !meta.ok
        ? '发布未完成'
        : meta.mode === 'npm'
          ? '已发布到 npm'
          : meta.mode === 'pack'
            ? '打包完成'
            : '校验完成'
      return {
        card: 'terminal',
        title,
        output: formatPublishTerminalOutput(meta),
        ...meta.exitCode === undefined ? {} : { exitCode: meta.exitCode },
      }
    },
    async execute(args, exec) {
      return runPublish(host, args, {
        signal: exec.signal,
        ...exec.agent === undefined ? {} : { agent: exec.agent },
        ...exec.callId === undefined ? {} : { callId: String(exec.callId) },
      }, getConfig())
    },
  })
}

export function createPublishCommand(ctx: Context, getConfig: () => Config) {
  const host = ctx as unknown as DeployHost
  return {
    name: 'publish-plugin',
    description: '校验或打包当前目录的 dsh 插件（默认只校验；可写 pack / npm）',
    input: { hint: '可选：check|pack|npm，以及插件目录' },
    async handler(invocation: {
      agent: unknown
      rawInput: string
      signal: AbortSignal
    }): Promise<CommandResult> {
      const parsed = parsePublishCommandInput(invocation.rawInput)
      const args: PublishArgs = {
        mode: parsed.mode ?? 'check',
        ...parsed.directory === undefined ? {} : { directory: parsed.directory },
      }
      const value = await runPublish(host, args, {
        agent: invocation.agent,
        signal: invocation.signal,
      }, getConfig())
      const text = formatPublishText(value)
      return value.ok ? { kind: 'success', text } : { kind: 'error', text }
    },
  }
}
