export interface TemporaryAccountInfo {
  account?: string
  reused?: boolean
  claimWithin?: string
  claimUrl?: string
}

export interface ParsedWranglerOutput {
  previewUrl?: string
  temporary?: TemporaryAccountInfo
}

function valueAfterPrefix(text: string, prefix: string): string | undefined {
  const needle = prefix.toLowerCase()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.toLowerCase().startsWith(needle)) return line.slice(prefix.length).trim()
  }
}

/**
 * Parse wrangler deploy stdout. Claim-within is taken as the remainder of the
 * line (formatDistanceToNowStrict output, not a fixed string).
 */
export function parseWranglerOutput(text: string): ParsedWranglerOutput {
  const result: ParsedWranglerOutput = {}
  const urlMatch = text.match(/https:\/\/[A-Za-z0-9._-]+\.(?:workers|pages)\.dev[^\s]*/)
  if (urlMatch) result.previewUrl = urlMatch[0].replace(/[).,;]+$/, '')

  const claimUrl = valueAfterPrefix(text, 'Claim URL:')
  const claimWithin = valueAfterPrefix(text, 'Claim within:')
  const accountLine = valueAfterPrefix(text, 'Account:')
  if (claimUrl === undefined && claimWithin === undefined && accountLine === undefined) return result

  const temporary: TemporaryAccountInfo = {}
  if (accountLine !== undefined) {
    temporary.account = accountLine.replace(/\s*\((?:created|reused)\)\s*$/i, '').trim()
    temporary.reused = /\(reused\)/i.test(accountLine)
  }
  if (claimWithin !== undefined) temporary.claimWithin = claimWithin
  if (claimUrl !== undefined) temporary.claimUrl = claimUrl
  result.temporary = temporary
  return result
}
