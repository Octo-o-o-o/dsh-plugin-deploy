import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

function readTextFile(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

function parseJsoncObject(text: string): Record<string, unknown> | undefined {
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/,\s*([}\]])/g, '$1')
  try {
    const value: unknown = JSON.parse(stripped)
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
    return value as Record<string, unknown>
  } catch {
    return undefined
  }
}

function parseTomlWorkerName(text: string): string | undefined {
  const match = text.match(/^\s*name\s*=\s*["']([^"']+)["']/m)
  const name = match?.[1]?.trim()
  return name === undefined || name.length === 0 ? undefined : name
}

function parseTomlAssetsDirectory(text: string): string | undefined {
  const table = text.match(/\[assets\][^\[]*?^\s*directory\s*=\s*["']([^"']+)["']/m)
  if (table?.[1] !== undefined && table[1].trim().length > 0) return table[1].trim()
  const inline = text.match(/^\s*assets\s*=\s*\{[^}\n]*directory\s*=\s*["']([^"']+)["']/m)
  if (inline?.[1] !== undefined && inline[1].trim().length > 0) return inline[1].trim()
}

function assetsDirectoryFromObject(obj: Record<string, unknown>): string | undefined {
  const assets = obj.assets
  if (assets === null || typeof assets !== 'object' || Array.isArray(assets)) return undefined
  const directory = (assets as { directory?: unknown }).directory
  return typeof directory === 'string' && directory.trim().length > 0 ? directory.trim() : undefined
}

export function parseWranglerWorkerName(text: string, filename: string): string | undefined {
  if (filename.endsWith('.toml')) return parseTomlWorkerName(text)
  const obj = parseJsoncObject(text)
  if (obj === undefined) return undefined
  return typeof obj.name === 'string' && obj.name.trim().length > 0 ? obj.name.trim() : undefined
}

export function parseWranglerAssetsDirectory(text: string, filename: string): string | undefined {
  if (filename.endsWith('.toml')) return parseTomlAssetsDirectory(text)
  const obj = parseJsoncObject(text)
  if (obj === undefined) return undefined
  return assetsDirectoryFromObject(obj)
}

export function readWranglerWorkerName(directory: string, filename: string): string | undefined {
  const text = readTextFile(join(directory, filename))
  if (text === undefined) return undefined
  return parseWranglerWorkerName(text, filename)
}

/** Resolve `assets.directory` from a wrangler config. Undefined if unreadable or unparsable. */
export function resolveWranglerAssetsRoot(directory: string, filename: string): string | undefined {
  const text = readTextFile(join(directory, filename))
  if (text === undefined) return undefined
  const rel = parseWranglerAssetsDirectory(text, filename)
  if (rel === undefined) return undefined
  return isAbsolute(rel) ? rel : join(directory, rel)
}
