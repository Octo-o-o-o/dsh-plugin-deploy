export type DeployTarget = 'auto' | 'cloudflare'
export type ModeRequest = 'auto' | 'temporary' | 'account'
export type DeployMode = 'temporary' | 'account'

export interface DeployArgs {
  directory?: string
  target?: DeployTarget
  mode?: ModeRequest
}

export interface DeployResult {
  ok: boolean
  mode: DeployMode | 'none'
  previewUrl?: string
  claimUrl?: string
  claimWithin?: string
  workerName?: string
  warnings: string[]
  error?: string
  hint?: string
  stdout?: string
  exitCode?: number
}

export interface DeployExec {
  agent?: unknown
  signal: AbortSignal
  callId?: string
}
