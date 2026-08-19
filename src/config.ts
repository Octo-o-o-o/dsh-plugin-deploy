import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

export const DEFAULT_API_TOKEN_ENV = 'CLOUDFLARE_API_TOKEN'
export const DEFAULT_NPM_TOKEN_ENV = 'NPM_TOKEN'

/** Host settings namespace; the Web card is keyed on the same string. */
export const DEPLOY_SETTINGS_NS = settingsNamespace('deploy')

export interface Config {
  /** Credential reference name only — never the token value. */
  apiTokenEnv?: string
  /** npm token 的凭据引用名，默认 NPM_TOKEN。 */
  npmTokenEnv?: string
}

export const Config: z<Config> = z.object({
  apiTokenEnv: z.string().role('credential-ref').default(DEFAULT_API_TOKEN_ENV),
  npmTokenEnv: z.string().role('credential-ref').default(DEFAULT_NPM_TOKEN_ENV),
})
