import { basename } from 'node:path'

export const FALLBACK_WORKER_NAME = 'dsh-preview'
export const MAX_WORKER_NAME_LENGTH = 63

/**
 * Derive a Cloudflare Worker name from a directory path.
 * Lowercase, `[a-z0-9-]`, must start with a letter; empty → `dsh-preview`.
 */
export function deriveWorkerName(directory: string): string {
  const raw = basename(directory).toLowerCase()
  let cleaned = raw.replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
  if (cleaned === '' || !/^[a-z]/.test(cleaned)) {
    cleaned = `dsh-${cleaned}`.replace(/-+/g, '-').replace(/-+$/g, '')
  }
  if (cleaned === '' || cleaned === 'dsh') return FALLBACK_WORKER_NAME
  if (cleaned.length > MAX_WORKER_NAME_LENGTH) {
    cleaned = cleaned.slice(0, MAX_WORKER_NAME_LENGTH).replace(/-+$/g, '')
  }
  if (cleaned === '' || !/^[a-z]/.test(cleaned)) return FALLBACK_WORKER_NAME
  return cleaned
}

export function workerNameFromPreviewUrl(url: string): string | undefined {
  try {
    const first = new URL(url).hostname.split('.')[0]
    if (first !== undefined && /^[a-z][a-z0-9-]*$/.test(first)) return first
  } catch {
    return undefined
  }
}
