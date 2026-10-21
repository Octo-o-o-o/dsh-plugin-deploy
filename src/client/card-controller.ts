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
  describe: (refs: string[]) => Promise<{
    ok: boolean; value?: Record<string, { configured?: boolean; writable?: boolean }>
  }>
  set: (ref: string, value: string) => Promise<{ ok: boolean }>
}

export interface SettingsScopeLike {
  getSnapshot(): {
    status: 'loading' | 'ready' | 'unavailable'
    value?: { apiTokenEnv?: string; npmTokenEnv?: string }
    writable: boolean
    revision?: number
  }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
  mutate(ops: ReadonlyArray<{ op: 'set'; path: string[]; value: string }>, revision?: number): Promise<boolean>
}

const DEFAULT_REF = 'CLOUDFLARE_API_TOKEN'
const DEFAULT_NPM_REF = 'NPM_TOKEN'

export class DeployCardController {
  private state: DeploySettingsState
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribe: () => void
  private disposed = false
  private credentialRead = 0
  private draftRevision: number | undefined

  constructor(
    private readonly scope: SettingsScopeLike,
    private readonly credentials: CredentialsWire | undefined,
  ) {
    this.state = this.blank()
    this.unsubscribe = scope.subscribe(() => {
      this.syncScope()
      void this.readCredential()
    })
    this.syncScope()
    void this.readCredential()
  }

  dispose(): void {
    this.disposed = true
    this.credentialRead += 1
    this.unsubscribe()
    this.listeners.clear()
  }

  private blank(): DeploySettingsState {
    return {
      tokenEnv: DEFAULT_REF,
      tokenEnvDraft: DEFAULT_REF,
      configured: false,
      writable: false,
      npmTokenEnv: DEFAULT_NPM_REF,
      npmTokenEnvDraft: DEFAULT_NPM_REF,
      npmConfigured: false,
      npmWritable: false,
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
      tokenEnvDraft: this.state.tokenEnvDraft === this.state.tokenEnv ? tokenEnv : this.state.tokenEnvDraft,
      npmTokenEnv,
      npmTokenEnvDraft: this.state.npmTokenEnvDraft === this.state.npmTokenEnv ? npmTokenEnv : this.state.npmTokenEnvDraft,
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
        this.captureRevision()
        this.state = { ...this.state, tokenEnvDraft: value }
        this.emit()
      },
      saveTokenEnv: async () => {
        const next = this.state.tokenEnvDraft.trim() || DEFAULT_REF
        if (!await this.scope.set('apiTokenEnv', next)) throw new Error('设置保存被拒绝')
      },
      saveTokenValue: async (value: string) => {
        if (this.credentials === undefined) throw new Error('凭据服务不可用')
        const ref = this.state.tokenEnv
        if (!(await this.credentials.set(ref, value)).ok) throw new Error('凭据保存被拒绝')
        await this.readCredential()
      },
      setNpmTokenEnvDraft: (value: string) => {
        this.captureRevision()
        this.state = { ...this.state, npmTokenEnvDraft: value }
        this.emit()
      },
      saveNpmTokenEnv: async () => {
        const next = this.state.npmTokenEnvDraft.trim() || DEFAULT_NPM_REF
        if (!await this.scope.set('npmTokenEnv', next)) throw new Error('设置保存被拒绝')
      },
      saveNpmTokenValue: async (value: string) => {
        if (this.credentials === undefined) throw new Error('凭据服务不可用')
        const ref = this.state.npmTokenEnv
        if (!(await this.credentials.set(ref, value)).ok) throw new Error('凭据保存被拒绝')
        await this.readCredential()
      },
      saveReferences: async () => {
        const apiTokenEnv = this.state.tokenEnvDraft.trim() || DEFAULT_REF
        const npmTokenEnv = this.state.npmTokenEnvDraft.trim() || DEFAULT_NPM_REF
        const ops: Array<{ op: 'set'; path: string[]; value: string }> = []
        if (apiTokenEnv !== this.state.tokenEnv) ops.push({ op: 'set', path: ['apiTokenEnv'], value: apiTokenEnv })
        if (npmTokenEnv !== this.state.npmTokenEnv) ops.push({ op: 'set', path: ['npmTokenEnv'], value: npmTokenEnv })
        if (ops.length > 0 && !await this.scope.mutate(ops, this.draftRevision)) {
          throw new Error('设置已变更或保存被拒绝，请重新读取后重试')
        }
        this.draftRevision = undefined
        // The accepted remote mutation can precede the next mirror notification.
        this.state = { ...this.state, tokenEnv: apiTokenEnv, tokenEnvDraft: apiTokenEnv, npmTokenEnv, npmTokenEnvDraft: npmTokenEnv }
        this.emit()
      },
    }
  }

  private captureRevision(): void {
    if (this.state.tokenEnvDraft === this.state.tokenEnv && this.state.npmTokenEnvDraft === this.state.npmTokenEnv) {
      this.draftRevision = this.scope.getSnapshot().revision
    }
  }

  refreshCredential(ref: string): void {
    if (ref !== this.state.tokenEnv && ref !== this.state.npmTokenEnv) return
    void this.readCredential()
  }

  private async readCredential(): Promise<void> {
    if (this.credentials === undefined) return
    const read = ++this.credentialRead
    const snapshot = this.scope.getSnapshot().value
    const cfRef = snapshot?.apiTokenEnv?.trim() || DEFAULT_REF
    const npmRef = snapshot?.npmTokenEnv?.trim() || DEFAULT_NPM_REF
    const refs = cfRef === npmRef ? [cfRef] : [cfRef, npmRef]
    let response
    try {
      response = await this.credentials.describe(refs)
    } catch {
      return
    }
    if (this.disposed || read !== this.credentialRead || !response.ok) return
    const creds = response.value ?? {}
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
