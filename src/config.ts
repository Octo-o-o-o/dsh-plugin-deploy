import z from '@deepseek-ai/schemastery'
import type { Volatile } from '@deepseek-ai/cordis'

export const DEFAULT_API_TOKEN_ENV = 'CLOUDFLARE_API_TOKEN'
export const DEFAULT_NPM_TOKEN_ENV = 'NPM_TOKEN'

/** Host settings namespace; the Web card is keyed on the same string. */
export const DEPLOY_SETTINGS_NS = 'dsh-plugin-deploy'

export interface Config {
  /** Credential reference name only — never the token value. */
  apiTokenEnv?: string
  /** npm token 的凭据引用名，默认 NPM_TOKEN。 */
  npmTokenEnv?: string
}

export interface RuntimeConfig {
  apiTokenEnv: Volatile<string>
  npmTokenEnv: Volatile<string>
}

export const Config = z.object({
  apiTokenEnv: z.string().pattern(/^[A-Za-z_][A-Za-z0-9_]*$/).role('credential-ref').default(DEFAULT_API_TOKEN_ENV).volatile(),
  npmTokenEnv: z.string().pattern(/^[A-Za-z_][A-Za-z0-9_]*$/).role('credential-ref').default(DEFAULT_NPM_TOKEN_ENV).volatile(),
})

/** Capture one consistent live configuration when an operation starts. */
export function readConfig(config: RuntimeConfig): Config {
  return { apiTokenEnv: config.apiTokenEnv.get(), npmTokenEnv: config.npmTokenEnv.get() }
}
