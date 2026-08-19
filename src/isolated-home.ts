import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Isolated HOME for L1 (`wrangler deploy --temporary`).
 *
 * wrangler 4.x `getGlobalConfigPath` prefers `~/.wrangler` whenever that
 * directory exists (`useLegacyHomeDir`), and only then falls back to
 * `XDG_CONFIG_HOME`. On any machine that has ever run wrangler, setting
 * `XDG_CONFIG_HOME` therefore never takes effect, and `--temporary` still
 * sees the user's real credentials:
 *
 *   const legacyConfigDir = path.join(os.homedir(), dirName) // ~/.wrangler
 *   if (useLegacyHomeDir && isDirectory(legacyConfigDir)) return legacyConfigDir
 *
 * Setting HOME to this stable tmpdir path makes `os.homedir()` (and thus
 * `~/.wrangler`) point here instead. The user's real `~/.wrangler` is not
 * read or written. The path is stable so the temporary preview account can
 * be reused across deploys.
 *
 * L2 (token via env) must not set HOME — it should keep using the user's
 * real wrangler login when that is the chosen path.
 */
export const L1_ISOLATED_HOME = join(tmpdir(), 'dsh-plugin-deploy', 'home')

export async function ensureL1IsolatedHome(): Promise<string> {
  await mkdir(L1_ISOLATED_HOME, { recursive: true })
  return L1_ISOLATED_HOME
}
