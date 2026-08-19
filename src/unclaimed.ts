import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface UnclaimedRecord {
  previewUrl?: string
  createdAt: string
  directory: string
  workerName?: string
}

function recordPath(directory: string): string {
  const id = createHash('sha256').update(directory).digest('hex').slice(0, 16)
  return join(tmpdir(), 'dsh-plugin-deploy', `${id}.json`)
}

export async function persistUnclaimed(record: UnclaimedRecord): Promise<void> {
  const path = recordPath(record.directory)
  await mkdir(join(path, '..'), { recursive: true })
  const body: Record<string, string> = { createdAt: record.createdAt }
  if (record.previewUrl !== undefined) body.previewUrl = record.previewUrl
  if (record.workerName !== undefined) body.workerName = record.workerName
  await writeFile(path, `${JSON.stringify(body)}\n`, 'utf8')
}

export async function loadUnclaimed(directory: string): Promise<UnclaimedRecord | undefined> {
  try {
    const raw = await readFile(recordPath(directory), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return undefined
    const value = parsed as Partial<UnclaimedRecord>
    if (typeof value.createdAt !== 'string') return undefined
    return {
      createdAt: value.createdAt,
      directory,
      ...typeof value.previewUrl === 'string' ? { previewUrl: value.previewUrl } : {},
      ...typeof value.workerName === 'string' ? { workerName: value.workerName } : {},
    }
  } catch {
    return undefined
  }
}
