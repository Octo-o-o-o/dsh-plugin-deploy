import type { PublishAccess, PublishCheck, PublishMode, PublishResult } from './publish-types.ts'

export const PUBLISH_NEXT_STEPS = [
  '本工具不推 GitHub、不代提 dsh.pub 收录 PR。',
  'GitHub 直装只取源码，需要自包含 prepare，用户还要把包加入 profile 的 pnpm-workspace.yaml allowBuilds。见 https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish',
  '想收录到社区目录 dsh.pub，请按该站说明自行提交。',
].join('\n')

export const UNSTRUCTURED_PUBLISH_NOTICE = '本次调用未提供结构化结果，无法展示校验清单。下面是原始输出。'

export const TARBALL_TMP_NOTICE = 'tarball 放在临时目录，请自行拷走或尽快使用。'

export function formatPublishText(result: PublishResult): string {
  const lines: string[] = []
  if (!result.ok) {
    lines.push(`发布未完成：${result.error ?? '未知错误'}`)
    if (result.hint) lines.push(result.hint)
  } else if (result.mode === 'pack') {
    lines.push('打包完成。')
  } else if (result.mode === 'npm') {
    lines.push('已发布到 npm。')
  } else {
    lines.push('校验完成。')
  }

  lines.push(`发布模式：${result.mode}`)
  if (result.packageName) lines.push(`包名：${result.packageName}`)
  if (result.version) lines.push(`版本：${result.version}`)
  if (result.access) lines.push(`访问：${result.access}`)
  if (result.tag) lines.push(`dist-tag：${result.tag}`)
  if (result.tarballPath) {
    lines.push(`tarball：${result.tarballPath}`)
    lines.push(TARBALL_TMP_NOTICE)
  }
  if (result.installCommand) lines.push(`安装：${result.installCommand}`)
  if (result.fileCount !== undefined) {
    const packed = result.packedSize === undefined ? '' : `，打包 ${result.packedSize} 字节`
    const unpacked = result.unpackedSize === undefined ? '' : `，解压 ${result.unpackedSize} 字节`
    lines.push(`清单：${result.fileCount} 个文件${packed}${unpacked}`)
  }

  if (result.checks.length > 0) {
    lines.push('校验：')
    for (const item of result.checks) {
      const mark = item.ok ? '通过' : '失败'
      const extra = !item.ok && !item.blocking ? '（不阻止 pack）' : ''
      lines.push(`- [${mark}] ${item.id}${extra}：${item.detail}`)
    }
  }

  if (result.warnings.length > 0) {
    lines.push('', '提醒：')
    for (const warning of result.warnings) lines.push(`- ${warning}`)
  }

  const next = result.nextSteps ?? PUBLISH_NEXT_STEPS
  lines.push('', '下一步：', next)

  if (!result.ok && result.stdout) {
    lines.push('', result.stdout)
  }
  return lines.join('\n')
}

export function formatPublishTerminalOutput(result: PublishResult): string {
  return formatPublishText(result)
}

export interface ParsedPublishText {
  ok?: boolean
  mode?: PublishMode
  packageName?: string
  version?: string
  access?: PublishAccess
  tag?: string
  tarballPath?: string
  installCommand?: string
  fileCount?: number
  packedSize?: number
  unpackedSize?: number
  checks: PublishCheck[]
  warnings: string[]
  error?: string
  hint?: string
}

const META_KEYS = [
  'ok',
  'mode',
  'packageName',
  'version',
  'access',
  'tag',
  'tarballPath',
  'installCommand',
  'filename',
  'fileCount',
  'packedSize',
  'unpackedSize',
  'checks',
  'warnings',
  'error',
  'hint',
] as const

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function labeledValue(line: string, labels: RegExp): string | undefined {
  const match = labels.exec(line)
  if (match === null) return undefined
  const rest = line.slice(match.index + match[0].length).trim()
  return rest.length > 0 ? rest : undefined
}

function parseCheckLine(line: string): PublishCheck | undefined {
  const match = /^-\s+\[(通过|失败)\]\s+([a-z0-9-]+)((?:（不阻止 pack）)?)\s*：\s*(.*)$/.exec(line)
  if (match === null) return undefined
  const ok = match[1] === '通过'
  const blocking = match[3].length === 0
  return { id: match[2], ok, blocking, detail: match[4] }
}

export function parsePublishText(text: string): ParsedPublishText {
  const parsed: ParsedPublishText = { checks: [], warnings: [] }
  if (text.length === 0) return parsed

  if (/发布未完成/.test(text) || /ok\s*=\s*false/.test(text)) parsed.ok = false
  else if (/校验完成|打包完成|已发布到 npm|发布模式[：:]|ok\s*=\s*true/.test(text)) {
    parsed.ok = true
  }

  const lines = text.split(/\r?\n/)
  let section: 'none' | 'checks' | 'warnings' | 'next' = 'none'
  const hintLines: string[] = []
  for (const [index, line] of lines.entries()) {
    if (/^校验：/.test(line)) {
      section = 'checks'
      continue
    }
    if (/^提醒：/.test(line)) {
      section = 'warnings'
      continue
    }
    if (/^下一步：/.test(line)) {
      section = 'next'
      continue
    }

    if (section === 'checks') {
      const item = parseCheckLine(line)
      if (item) {
        parsed.checks.push(item)
        continue
      }
      if (line.trim().length === 0) section = 'none'
      continue
    }
    if (section === 'warnings') {
      const item = /^-\s+(.+)$/.exec(line)
      if (item) parsed.warnings.push(item[1])
      else if (line.trim().length === 0) section = 'none'
      continue
    }
    if (section === 'next') continue

    const fail = /^发布未完成[：:]\s*(.*)$/.exec(line)
    if (fail) {
      const message = fail[1].trim()
      if (message.length > 0) parsed.error = message
      continue
    }

    const mode = labeledValue(line, /发布模式[：:]/)
    if (mode === 'check' || mode === 'pack' || mode === 'npm') parsed.mode = mode

    const name = labeledValue(line, /包名[：:]/)
    if (name !== undefined) parsed.packageName = name

    const version = labeledValue(line, /版本[：:]/)
    if (version !== undefined) parsed.version = version

    const access = labeledValue(line, /访问[：:]/)
    if (access === 'public' || access === 'restricted') parsed.access = access

    const tag = labeledValue(line, /dist-tag[：:]/)
    if (tag !== undefined) parsed.tag = tag

    const tarball = labeledValue(line, /tarball[：:]/)
    if (tarball !== undefined) parsed.tarballPath = tarball

    const install = labeledValue(line, /安装[：:]/)
    if (install !== undefined) parsed.installCommand = install

    const summary = labeledValue(line, /清单[：:]/)
    if (summary !== undefined) {
      const count = /(\d+)\s*个文件/.exec(summary)
      if (count) parsed.fileCount = Number(count[1])
      const packed = /打包\s+(\d+)\s*字节/.exec(summary)
      if (packed) parsed.packedSize = Number(packed[1])
      const unpacked = /解压\s+(\d+)\s*字节/.exec(summary)
      if (unpacked) parsed.unpackedSize = Number(unpacked[1])
    }

    if (
      index === 1
      && parsed.ok === false
      && parsed.error !== undefined
      && line.trim().length > 0
      && !/发布模式|包名|版本|访问|dist-tag|tarball|安装|清单/.test(line)
    ) {
      hintLines.push(line.trim())
    }
  }

  if (hintLines.length > 0 && parsed.hint === undefined) parsed.hint = hintLines.join('\n')
  return parsed
}

export type PublishPresentationSource = 'meta' | 'text' | 'none'

export interface ResolvedPublishPresentation {
  source: PublishPresentationSource
  ok: boolean
  mode?: PublishMode | string
  packageName?: string
  version?: string
  access?: PublishAccess | string
  tag?: string
  tarballPath?: string
  installCommand?: string
  filename?: string
  fileCount?: number
  packedSize?: number
  unpackedSize?: number
  checks: PublishCheck[]
  warnings: string[]
  error?: string
  hint?: string
  nextSteps?: string
  rawText: string
}

export function readPublishPresentationMeta(value: unknown): Partial<PublishResult> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (!META_KEYS.some(key => key in record)) return undefined
  return record as Partial<PublishResult>
}

function pickString(preferred: unknown, fallback: string | undefined): string | undefined {
  if (isNonEmptyString(preferred)) return preferred.trim()
  if (isNonEmptyString(fallback)) return fallback
  return undefined
}

function pickNumber(preferred: unknown, fallback: number | undefined): number | undefined {
  if (typeof preferred === 'number' && Number.isFinite(preferred)) return preferred
  return fallback
}

function asChecks(value: unknown, fallback: PublishCheck[]): PublishCheck[] {
  if (!Array.isArray(value)) return fallback
  const checks: PublishCheck[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue
    const rec = item as Record<string, unknown>
    if (typeof rec.id !== 'string' || typeof rec.ok !== 'boolean' || typeof rec.detail !== 'string') {
      continue
    }
    checks.push({
      id: rec.id,
      ok: rec.ok,
      detail: rec.detail,
      blocking: typeof rec.blocking === 'boolean' ? rec.blocking : true,
    })
  }
  return checks.length > 0 ? checks : fallback
}

export function resolvePublishPresentation(input: {
  meta?: unknown
  text: string
  isError?: boolean
}): ResolvedPublishPresentation {
  const meta = readPublishPresentationMeta(input.meta)
  const parsed = parsePublishText(input.text)
  const packageName = pickString(meta?.packageName, parsed.packageName)
  const version = pickString(meta?.version, parsed.version)
  const mode = pickString(meta?.mode, parsed.mode)
  const access = pickString(meta?.access, parsed.access)
  const tag = pickString(meta?.tag, parsed.tag)
  const tarballPath = pickString(meta?.tarballPath, parsed.tarballPath)
  const installCommand = pickString(meta?.installCommand, parsed.installCommand)
  const filename = pickString(meta?.filename, undefined)
  const error = pickString(meta?.error, parsed.error)
  const hint = pickString(meta?.hint, parsed.hint)
  const nextSteps = pickString(meta?.nextSteps, undefined)
  const fileCount = pickNumber(meta?.fileCount, parsed.fileCount)
  const packedSize = pickNumber(meta?.packedSize, parsed.packedSize)
  const unpackedSize = pickNumber(meta?.unpackedSize, parsed.unpackedSize)
  const checks = asChecks(meta?.checks, parsed.checks)
  const warnings = Array.isArray(meta?.warnings) ? meta.warnings : parsed.warnings

  let ok: boolean
  if (input.isError === true) ok = false
  else if (typeof meta?.ok === 'boolean') ok = meta.ok
  else if (typeof parsed.ok === 'boolean') ok = parsed.ok
  else ok = true

  let source: PublishPresentationSource
  if (meta !== undefined) source = 'meta'
  else if (
    parsed.packageName !== undefined
    || parsed.tarballPath !== undefined
    || parsed.mode !== undefined
    || parsed.ok !== undefined
    || parsed.checks.length > 0
  ) {
    source = 'text'
  } else {
    source = 'none'
  }

  return {
    source,
    ok,
    checks,
    warnings,
    rawText: input.text,
    ...mode === undefined ? {} : { mode },
    ...packageName === undefined ? {} : { packageName },
    ...version === undefined ? {} : { version },
    ...access === undefined ? {} : { access },
    ...tag === undefined ? {} : { tag },
    ...tarballPath === undefined ? {} : { tarballPath },
    ...installCommand === undefined ? {} : { installCommand },
    ...filename === undefined ? {} : { filename },
    ...fileCount === undefined ? {} : { fileCount },
    ...packedSize === undefined ? {} : { packedSize },
    ...unpackedSize === undefined ? {} : { unpackedSize },
    ...error === undefined ? {} : { error },
    ...hint === undefined ? {} : { hint },
    ...nextSteps === undefined ? {} : { nextSteps },
  }
}
