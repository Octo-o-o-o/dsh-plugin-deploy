export interface DeploySettingsState {
  tokenEnv: string
  tokenEnvDraft: string
  configured: boolean
  writable: boolean
  npmTokenEnv: string
  npmTokenEnvDraft: string
  npmConfigured: boolean
  npmWritable: boolean
  status: 'loading' | 'ready' | 'unavailable'
  scopeWritable: boolean
}

export interface CredentialsWire {
  describe: (payload: { refs: string[] }) => Promise<{
    result: { ok: boolean; value?: { credentials: Record<string, { configured?: boolean; writable?: boolean }> } }
  }>
  set: (payload: { ref: string; value: string }) => Promise<unknown>
}

export interface SettingsScopeLike {
  getSnapshot(): {
    status: 'loading' | 'ready' | 'unavailable'
    value?: { apiTokenEnv?: string; npmTokenEnv?: string }
    writable: boolean
  }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

const DEFAULT_REF = 'CLOUDFLARE_API_TOKEN'
const DEFAULT_NPM_REF = 'NPM_TOKEN'

export class DeployCardController {
  private state: DeploySettingsState
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly scope: SettingsScopeLike,
    private readonly credentials: CredentialsWire | undefined,
  ) {
    this.state = this.blank()
    scope.subscribe(() => {
      this.syncScope()
      void this.readCredential()
    })
    this.syncScope()
    void this.readCredential()
  }

  private blank(): DeploySettingsState {
    return {
      tokenEnv: DEFAULT_REF,
      tokenEnvDraft: DEFAULT_REF,
      configured: false,
      writable: true,
      npmTokenEnv: DEFAULT_NPM_REF,
      npmTokenEnvDraft: DEFAULT_NPM_REF,
      npmConfigured: false,
      npmWritable: true,
      status: 'loading',
      scopeWritable: false,
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }

  private syncScope(): void {
    const snapshot = this.scope.getSnapshot()
    const tokenEnv = snapshot.value?.apiTokenEnv?.trim() || DEFAULT_REF
    const npmTokenEnv = snapshot.value?.npmTokenEnv?.trim() || DEFAULT_NPM_REF
    this.state = {
      ...this.state,
      tokenEnv,
      tokenEnvDraft: tokenEnv,
      npmTokenEnv,
      npmTokenEnvDraft: npmTokenEnv,
      status: snapshot.status,
      scopeWritable: snapshot.writable,
    }
    this.emit()
  }

  getSnapshot(): DeploySettingsState {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  inject() {
    return {
      hooks: { deployCard: this },
      setTokenEnvDraft: (value: string) => {
        this.state = { ...this.state, tokenEnvDraft: value }
        this.emit()
      },
      saveTokenEnv: async () => {
        const next = this.state.tokenEnvDraft.trim() || DEFAULT_REF
        await this.scope.set('apiTokenEnv', next)
      },
      saveTokenValue: async (value: string) => {
        if (this.credentials === undefined) return
        const ref = this.state.tokenEnv
        await this.credentials.set({ ref, value })
        await this.readCredential()
      },
      setNpmTokenEnvDraft: (value: string) => {
        this.state = { ...this.state, npmTokenEnvDraft: value }
        this.emit()
      },
      saveNpmTokenEnv: async () => {
        const next = this.state.npmTokenEnvDraft.trim() || DEFAULT_NPM_REF
        await this.scope.set('npmTokenEnv', next)
      },
      saveNpmTokenValue: async (value: string) => {
        if (this.credentials === undefined) return
        const ref = this.state.npmTokenEnv
        await this.credentials.set({ ref, value })
        await this.readCredential()
      },
    }
  }

  refreshCredential(ref: string): void {
    if (ref !== this.state.tokenEnv && ref !== this.state.npmTokenEnv) return
    void this.readCredential()
  }

  private async readCredential(): Promise<void> {
    if (this.credentials === undefined) return
    const snapshot = this.scope.getSnapshot().value
    const cfRef = snapshot?.apiTokenEnv?.trim() || DEFAULT_REF
    const npmRef = snapshot?.npmTokenEnv?.trim() || DEFAULT_NPM_REF
    const refs = cfRef === npmRef ? [cfRef] : [cfRef, npmRef]
    let response
    try {
      response = await this.credentials.describe({ refs })
    } catch {
      return
    }
    if (!response.result.ok) return
    const creds = response.result.value?.credentials ?? {}
    const cfView = creds[cfRef]
    const npmView = creds[npmRef]
    const next = {
      configured: cfView?.configured ?? false,
      writable: cfView?.writable ?? true,
      npmConfigured: npmView?.configured ?? false,
      npmWritable: npmView?.writable ?? true,
    }
    if (
      next.configured === this.state.configured
      && next.writable === this.state.writable
      && next.npmConfigured === this.state.npmConfigured
      && next.npmWritable === this.state.npmWritable
    ) return
    this.state = { ...this.state, ...next }
    this.emit()
  }
}
