import type { DeployMode, ModeRequest } from './types.ts'

export interface ModeInputs {
  requested: ModeRequest
  authenticated: boolean
  tokenConfigured: boolean
  wranglerSupportsTemporary: boolean
}

export type ModeDecision =
  | { ok: true; mode: DeployMode; warnings: string[] }
  | { ok: false; error: string; hint?: string }

export function hasCloudflareAccount(input: Pick<ModeInputs, 'authenticated' | 'tokenConfigured'>): boolean {
  return input.authenticated || input.tokenConfigured
}

const AUTO_ACCOUNT_TEMPORARY_HINT =
  '也可以显式指定 mode=temporary，会在隔离 HOME 下走临时预览，无需登出本机 wrangler。'

/**
 * Choose L1 (temporary) vs L2 (account).
 *
 * Local wrangler login (`authenticated`) is not a blocker for an explicit
 * `temporary` request. L1 execution sets isolated HOME + empty
 * CLOUDFLARE_API_TOKEN, so the child wrangler cannot see ~/.wrangler.
 * `auto` still prefers account when the host looks authenticated — that is
 * the safer default; the decision then warns that explicit temporary exists.
 *
 * A configured CLOUDFLARE_API_TOKEN is also not a blocker for explicit
 * temporary. Isolated L1 already blanks that env var; refusing would force
 * the user to delete their token config just to get a preview (same class of
 * damage as "please wrangler logout"). Warn instead that the token is unused.
 *
 * Remaining hard blocker: wrangler below 4.102.0 cannot do --temporary at all.
 */
export function selectMode(input: ModeInputs): ModeDecision {
  const hasAccount = hasCloudflareAccount(input)

  if (input.requested === 'temporary') {
    if (!input.wranglerSupportsTemporary) {
      return {
        ok: false,
        error: '当前 wrangler 低于 4.102.0，不支持临时预览账号。',
        hint: '请升级 wrangler（npm i -g wrangler），或在设置里配置账号 token 走 L2。',
      }
    }
    const warnings: string[] = []
    if (hasAccount) {
      warnings.push(explicitTemporaryWhileAuthenticatedWarning(input.tokenConfigured))
    }
    return { ok: true, mode: 'temporary', warnings }
  }

  if (input.requested === 'account') {
    if (!hasAccount) {
      return {
        ok: false,
        error: '未检测到 Cloudflare 认证，无法部署到你的账号。',
        hint: '在插件设置里填写 token 引用名，并把值写入 dsh 凭据服务；或先在本机 wrangler login。',
      }
    }
    return { ok: true, mode: 'account', warnings: [] }
  }

  if (hasAccount) {
    return { ok: true, mode: 'account', warnings: [AUTO_ACCOUNT_TEMPORARY_HINT] }
  }
  if (!input.wranglerSupportsTemporary) {
    return {
      ok: false,
      error: '未认证，且 wrangler 低于 4.102.0，无法使用临时预览。',
      hint: '请升级 wrangler，或配置 CLOUDFLARE_API_TOKEN 引用后走账号部署。',
    }
  }
  return { ok: true, mode: 'temporary', warnings: [] }
}

function explicitTemporaryWhileAuthenticatedWarning(tokenConfigured: boolean): string {
  if (tokenConfigured) {
    return '本机已登录 wrangler 或已配置 API token。你显式要求临时预览：执行会使用隔离 HOME，并把 CLOUDFLARE_API_TOKEN 设为空（忽略该 token），不会改动本机登录态。'
  }
  return '本机 wrangler 已登录。你显式要求临时预览：执行会使用隔离 HOME，读不到本机凭据，无需登出。'
}
