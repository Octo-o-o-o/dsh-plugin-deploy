const TOKEN_ASSIGN = /(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN|API_TOKEN|NPM_TOKEN|DSH_NPM_TOKEN|_authToken)\s*[=:]\s*\S+/gi
const NPM_TOKEN_VALUE = /\bnpm_[A-Za-z0-9]{8,}/g
const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi

/**
 * Strip credential-shaped values from command output before it becomes model-visible.
 * Does not touch Cloudflare claim URLs: those must appear in the result (known tradeoff).
 */
export function redactSecrets(text: string, extraSecrets: readonly string[] = []): string {
  let out = text
  for (const secret of extraSecrets) {
    // Below 4 chars, replacement collides with ordinary output. Newline
    // truncation or "print last 4 chars" can still leak a value that no
    // longer appears as one contiguous substring — this is best-effort.
    if (secret.length >= 4) out = out.split(secret).join('***')
  }
  out = out.replace(TOKEN_ASSIGN, match => match.replace(/[=:]\s*\S+/, '=***'))
  out = out.replace(BEARER, 'Bearer ***')
  out = out.replace(NPM_TOKEN_VALUE, 'npm_***')
  return out
}
