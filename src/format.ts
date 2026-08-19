import type { DeployResult } from './types.ts'

const CLAIM_LOG_NOTICE = '该认领链接会记录在会话日志中，请勿分享此会话。'
const UNCLAIMED_NOTICE = '这是临时预览地址，不是正式上线。若不在认领窗口内完成认领，Cloudflare 会删除该临时账号及其资源。'

/** Shown when neither presentationMeta nor result text yields a preview URL. */
export const UNSTRUCTURED_RESULT_NOTICE = '本次调用未提供结构化结果，无法展示预览链接。下面是原始输出。'

/**
 * Shared by Host (`output.render`) and the Web UI client bundle.
 * Keep this file free of Node built-ins and Host-only packages: the client
 * esbuild graph value-imports it when `presentationMeta` is absent.
 */
export function formatDeployText(result: DeployResult): string {
  const lines: string[] = []
  if (!result.ok) {
    lines.push(`部署未完成：${result.error ?? '未知错误'}`)
    if (result.hint) lines.push(result.hint)
    if (result.stdout) lines.push('', result.stdout)
    return lines.join('\n')
  }

  if (result.mode === 'temporary') {
    lines.push('临时预览地址已生成（不是正式上线）。')
    lines.push('部署模式：temporary')
    if (result.previewUrl) lines.push(`预览 URL：${result.previewUrl}`)
    if (result.workerName) lines.push(`Worker 名：${result.workerName}`)
    if (result.claimWithin) lines.push(`认领窗口：${result.claimWithin}`)
    if (result.claimUrl) lines.push(`认领 URL：${result.claimUrl}`)
    lines.push(UNCLAIMED_NOTICE)
    lines.push(CLAIM_LOG_NOTICE)
  } else {
    lines.push('已部署到你的 Cloudflare 账号。')
    lines.push('部署模式：account')
    if (result.previewUrl) lines.push(`访问 URL：${result.previewUrl}`)
    if (result.workerName) lines.push(`Worker 名：${result.workerName}`)
  }

  if (result.warnings.length > 0) {
    lines.push('', '提醒：')
    for (const warning of result.warnings) lines.push(`- ${warning}`)
  }
  return lines.join('\n')
}

export function formatTerminalOutput(result: DeployResult): string {
  return formatDeployText(result)
}

export interface ParsedDeployText {
  ok?: boolean
  mode?: DeployResult['mode']
  previewUrl?: string
  claimUrl?: string
  claimWithin?: string
  workerName?: string
  error?: string
  hint?: string
  warnings: string[]
}

const META_KEYS = [
  'ok',
  'mode',
  'previewUrl',
  'claimUrl',
  'claimWithin',
  'workerName',
  'warnings',
  'error',
  'hint',
] as const

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function sanitizeUrl(url: string): string {
  return url.replace(/[)\]>'"，。；：、.,;:!?]+$/u, '')
}

function extractUrl(text: string): string | undefined {
  const markdown = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/.exec(text)
  if (markdown) return sanitizeUrl(markdown[2])
  const bare = /https?:\/\/[^\s]+/.exec(text)
  if (bare) return sanitizeUrl(bare[0])
  return undefined
}

function isClaimUrl(url: string): boolean {
  return /claim-preview|claimToken=/i.test(url)
}

function isIgnoredUrl(url: string): boolean {
  return /cloudflare\.com\/(terms|privacypolicy)/i.test(url)
}

function labeledValue(line: string, labels: RegExp): string | undefined {
  const match = labels.exec(line)
  if (match === null) return undefined
  const rest = line.slice(match.index + match[0].length).trim()
  return rest.length > 0 ? rest : undefined
}

const EXPLICIT_MODE = /(?:部署模式[：:]\s*|mode\s*=\s*)(account|temporary)\b/i

/**
 * Restore mode from result text. Do not treat the unclaimed-previous-preview
 * warning ("此前有一条未认领的临时预览") as evidence that *this* deploy is
 * temporary. If nothing explicit is found, leave mode unset — the card must
 * not default to the claim/deletion warnings.
 */
function inferModeFromText(
  text: string,
  clues: Pick<ParsedDeployText, 'claimUrl' | 'claimWithin'>,
): DeployResult['mode'] | undefined {
  const explicit = EXPLICIT_MODE.exec(text)
  if (explicit) {
    return explicit[1].toLowerCase() === 'account' ? 'account' : 'temporary'
  }

  const first = text.split(/\r?\n/).map(line => line.trim()).find(line => line.length > 0) ?? ''
  if (/已部署到你的 Cloudflare/.test(first)) return 'account'
  if (/临时预览地址已生成/.test(first)) return 'temporary'

  if (/已部署到你的 Cloudflare/.test(text)) return 'account'
  if (/临时预览地址已生成/.test(text)) return 'temporary'

  if (clues.claimUrl !== undefined || clues.claimWithin !== undefined) return 'temporary'
  return undefined
}

/**
 * Inverse of {@link formatDeployText}, plus a tolerant scan for rewritten
 * agent/markdown text (trailing punctuation, markdown links, 预览地址 / 认领链接).
 * `claimWithin` is kept as human-readable text; do not parse it as a number.
 */
export function parseDeployText(text: string): ParsedDeployText {
  const parsed: ParsedDeployText = { warnings: [] }
  if (text.length === 0) return parsed

  if (/部署未完成/.test(text) || /ok\s*=\s*false/.test(text)) parsed.ok = false
  else if (
    /临时预览地址已生成|已部署到你的 Cloudflare|部署完成|部署模式[：:]|ok\s*=\s*true/.test(text)
  ) {
    parsed.ok = true
  }

  const lines = text.split(/\r?\n/)
  let inWarnings = false
  for (const line of lines) {
    if (/^提醒：/.test(line)) {
      inWarnings = true
      continue
    }
    if (inWarnings) {
      const item = /^-\s+(.+)$/.exec(line)
      if (item) parsed.warnings.push(item[1])
      else if (line.trim().length === 0) inWarnings = false
      continue
    }

    const fail = /^部署未完成[：:]\s*(.*)$/.exec(line)
    if (fail) {
      const message = fail[1].trim()
      if (message.length > 0) parsed.error = message
      continue
    }

    const windowValue = labeledValue(line, /认领窗口[：:]/)
    if (windowValue !== undefined) parsed.claimWithin = windowValue

    const claimParen = /认领链接[（(]([^）)]+)[）)]/.exec(line)
    if (claimParen) parsed.claimWithin = claimParen[1].trim()

    const worker = labeledValue(line, /Worker(?:\s*名)?[：:]/)
    if (worker !== undefined) {
      const name = /^([A-Za-z0-9][A-Za-z0-9_-]*)/.exec(worker)
      if (name) parsed.workerName = name[1]
    }

    const url = extractUrl(line)
    if (url === undefined || isIgnoredUrl(url)) continue
    if (isClaimUrl(url) || /认领\s*(URL|链接|地址)/.test(line)) {
      parsed.claimUrl = url
      continue
    }
    if (/预览\s*(URL|地址|链接)|访问\s*URL/.test(line) || /\.workers\.dev(?:[/?#]|$)/i.test(url)) {
      parsed.previewUrl = url
    }
  }

  if (parsed.previewUrl === undefined || parsed.claimUrl === undefined) {
    const urls = [...text.matchAll(/https?:\/\/[^\s]+/g)].map(item => sanitizeUrl(item[0]))
    if (parsed.claimUrl === undefined) {
      const claim = urls.find(item => isClaimUrl(item))
      if (claim !== undefined) parsed.claimUrl = claim
    }
    if (parsed.previewUrl === undefined) {
      const preview = urls.find(item => !isClaimUrl(item) && !isIgnoredUrl(item) && /\.workers\.dev/i.test(item))
      if (preview !== undefined) parsed.previewUrl = preview
    }
  }

  const mode = inferModeFromText(text, parsed)
  if (mode !== undefined) parsed.mode = mode

  return parsed
}

export type PresentationSource = 'meta' | 'text' | 'none'

export interface ResolvedDeployPresentation {
  source: PresentationSource
  ok: boolean
  mode?: DeployResult['mode'] | string
  previewUrl?: string
  claimUrl?: string
  claimWithin?: string
  workerName?: string
  warnings: string[]
  error?: string
  hint?: string
  rawText: string
}

export function readPresentationMeta(value: unknown): Partial<DeployResult> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (!META_KEYS.some(key => key in record)) return undefined
  return record as Partial<DeployResult>
}

function pickString(preferred: unknown, fallback: string | undefined): string | undefined {
  if (isNonEmptyString(preferred)) return preferred.trim()
  if (isNonEmptyString(fallback)) return fallback
  return undefined
}

export function resolveDeployPresentation(input: {
  meta?: unknown
  text: string
  isError?: boolean
}): ResolvedDeployPresentation {
  const meta = readPresentationMeta(input.meta)
  const parsed = parseDeployText(input.text)
  const previewUrl = pickString(meta?.previewUrl, parsed.previewUrl)
  const claimUrl = pickString(meta?.claimUrl, parsed.claimUrl)
  const claimWithin = pickString(meta?.claimWithin, parsed.claimWithin)
  const workerName = pickString(meta?.workerName, parsed.workerName)
  const mode = pickString(meta?.mode, parsed.mode)
  const error = pickString(meta?.error, parsed.error)
  const hint = pickString(meta?.hint, parsed.hint)
  const warnings = Array.isArray(meta?.warnings) ? meta.warnings : parsed.warnings

  let ok: boolean
  if (input.isError === true) ok = false
  else if (typeof meta?.ok === 'boolean') ok = meta.ok
  else if (typeof parsed.ok === 'boolean') ok = parsed.ok
  else ok = true

  let source: PresentationSource
  if (meta !== undefined) source = 'meta'
  else if (
    parsed.previewUrl !== undefined
    || parsed.claimUrl !== undefined
    || parsed.workerName !== undefined
    || parsed.ok !== undefined
    || parsed.mode !== undefined
  ) {
    source = 'text'
  } else {
    source = 'none'
  }

  return {
    source,
    ok,
    warnings,
    rawText: input.text,
    ...mode === undefined ? {} : { mode },
    ...previewUrl === undefined ? {} : { previewUrl },
    ...claimUrl === undefined ? {} : { claimUrl },
    ...claimWithin === undefined ? {} : { claimWithin },
    ...workerName === undefined ? {} : { workerName },
    ...error === undefined ? {} : { error },
    ...hint === undefined ? {} : { hint },
  }
}
