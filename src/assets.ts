import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const MAX_TEMPORARY_FILES = 1000
export const MAX_TEMPORARY_FILE_BYTES = 5 * 1024 * 1024

const SKIP_DIRS = new Set(['.git', 'node_modules', '.wrangler'])

export interface AssetLimitFailure {
  ok: false
  error: string
  hint: string
}

export interface AssetLimitOk {
  ok: true
  fileCount: number
}

export type AssetLimitResult = AssetLimitOk | AssetLimitFailure

export function checkTemporaryAssetLimits(root: string): AssetLimitResult {
  let fileCount = 0
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) break
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      if (!entry.isFile()) continue
      fileCount += 1
      if (fileCount > MAX_TEMPORARY_FILES) {
        return {
          ok: false,
          error: `静态资源超过临时账号上限（${MAX_TEMPORARY_FILES} 个文件）。`,
          hint: '请缩小部署目录，或改用自己的 Cloudflare 账号（L2）。',
        }
      }
      let size = 0
      try {
        size = statSync(full).size
      } catch {
        continue
      }
      if (size > MAX_TEMPORARY_FILE_BYTES) {
        return {
          ok: false,
          error: `存在超过 5 MiB 的文件，临时账号无法上传。`,
          hint: '请去掉大文件，或改用自己的 Cloudflare 账号（L2）。',
        }
      }
    }
  }
  return { ok: true, fileCount }
}
