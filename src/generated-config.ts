import { createHash } from 'node:crypto'
import { readFile, unlink, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/** Leftover name from the previous in-project config; still ignored if present. */
export const LEGACY_IN_PROJECT_CONFIG_NAME = '.dsh-deploy.wrangler.jsonc'

/**
 * Patterns written into a transient `.assetsignore` under the assets root.
 * wrangler 4.x `assets` has no `exclude` field (`additionalProperties: false`);
 * the real ignore mechanism is `.assetsignore` (gitignore syntax) in the
 * assets directory. `.assetsignore` itself is ignored automatically.
 */
export const ASSET_IGNORE_PATTERNS = ['.wrangler', LEGACY_IN_PROJECT_CONFIG_NAME] as const

export const GENERATED_CONFIG_ROOT = join(tmpdir(), 'dsh-plugin-deploy', 'generated')
export const GENERATED_CONFIG_BASENAME = 'wrangler.jsonc'

export function generatedConfigPath(projectDirectory: string): string {
  const id = createHash('sha256').update(resolve(projectDirectory)).digest('hex').slice(0, 16)
  return join(GENERATED_CONFIG_ROOT, id, GENERATED_CONFIG_BASENAME)
}

export function generatedWranglerConfigBody(
  name: string,
  assetsDirectory: string,
  compatibilityDate: string,
): string {
  return `${JSON.stringify({
    name,
    compatibility_date: compatibilityDate,
    assets: { directory: resolve(assetsDirectory) },
  }, null, 2)}\n`
}

/** Quote a path for `bash -c` (harness shell runs `bash -c spec.command`). */
export function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/**
 * Ensure `.assetsignore` lists plugin/wrangler internals, then restore the
 * previous file (or delete it if we created it). Covers leftovers from an
 * older in-project config and a prior `.wrangler/tmp` in the project root.
 */
export async function withAssetsIgnore<T>(assetsRoot: string, fn: () => Promise<T>): Promise<T> {
  const ignorePath = join(assetsRoot, '.assetsignore')
  let previous: string | undefined
  try {
    previous = await readFile(ignorePath, 'utf8')
  } catch {
    previous = undefined
  }

  const existing = new Set(
    (previous ?? '').split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0),
  )
  const missing = ASSET_IGNORE_PATTERNS.filter(pattern =>
    !existing.has(pattern)
    && !existing.has(`/${pattern}`)
    && !existing.has(`${pattern}/`)
    && !existing.has(`/${pattern}/`)
  )
  if (missing.length > 0) {
    await mkdir(assetsRoot, { recursive: true })
    const prefix = previous === undefined ? '' : previous.endsWith('\n') || previous.length === 0 ? previous : `${previous}\n`
    await writeFile(ignorePath, `${prefix}${missing.join('\n')}\n`, 'utf8')
  }

  try {
    return await fn()
  } finally {
    if (previous === undefined) {
      try {
        await unlink(ignorePath)
      } catch {
        // best-effort cleanup
      }
    } else if (missing.length > 0) {
      try {
        await writeFile(ignorePath, previous, 'utf8')
      } catch {
        // best-effort restore
      }
    }
  }
}
