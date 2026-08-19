export type PublishMode = 'check' | 'pack' | 'npm'
export type PublishAccess = 'public' | 'restricted'

export interface PublishArgs {
  directory?: string
  mode?: PublishMode
  tag?: string
  access?: PublishAccess
}

export interface PublishCheck {
  id: string
  ok: boolean
  detail: string
  blocking: boolean
}

export interface PublishResult {
  ok: boolean
  mode: PublishMode
  packageName?: string
  version?: string
  access?: PublishAccess
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
  stdout?: string
  exitCode?: number
  nextSteps?: string
}

export interface PublishExec {
  agent?: unknown
  signal: AbortSignal
  callId?: string
}

export interface PackFile {
  path: string
}

export interface PackManifest {
  name?: string
  version?: string
  filename: string
  size: number
  unpackedSize: number
  entryCount: number
  files: PackFile[]
}

export interface ScanFinding {
  rule: string
  severity: string
  file?: string
  line?: number
  message?: string
}
