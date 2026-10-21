import { useState, type ReactNode } from 'react'
import { IconChevronDownOutlineMedium } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DeploySettingsState } from './card-controller.ts'

export const CARD_TITLE = 'Cloudflare 部署'
export const CARD_DESCRIPTION = '部署与发布用的 token 只存引用名，值写入凭据服务。'

export interface SettingsCardProps {
  useDeployCard: (select: (state: DeploySettingsState) => DeploySettingsState) => DeploySettingsState
  setTokenEnvDraft: (value: string) => void
  saveTokenEnv: () => Promise<void>
  saveTokenValue: (value: string) => Promise<void>
  setNpmTokenEnvDraft: (value: string) => void
  saveNpmTokenEnv: () => Promise<void>
  saveNpmTokenValue: (value: string) => Promise<void>
  saveReferences?: () => Promise<void>
}

function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ')
}

function Chevron(props: { open: boolean }) {
  const className = cx('dpd-chevron', props.open && 'dpd-chevron-open')
  if (typeof IconChevronDownOutlineMedium === 'function') {
    return <IconChevronDownOutlineMedium className={className} />
  }
  return <span className={cx(className, 'dpd-chevron-fallback')} aria-hidden="true" />
}

function Field(props: {
  id: string
  label: string
  hint: string
  badge?: { configured: boolean }
  help?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="dpd-field">
      <div className="dpd-field-head">
        <label className="dpd-label" htmlFor={props.id}>{props.label}</label>
        {props.badge
          ? (
            <span className="dpd-badges">
              <span className={props.badge.configured ? 'dpd-badge' : 'dpd-badge-muted'}>
                {props.badge.configured ? '已配置' : '未配置'}
              </span>
            </span>
          )
          : null}
      </div>
      {props.children}
      <p className="dpd-hint">{props.hint}</p>
      {props.help}
    </div>
  )
}

function TokenGuide(props: { title: string; children: ReactNode }) {
  return (
    <details className="dpd-token-guide">
      <summary>{props.title}</summary>
      <div className="dpd-guide-body">{props.children}</div>
    </details>
  )
}

function CloudflareTokenGuide() {
  return (
    <TokenGuide title="如何获取 Cloudflare token">
      <ol>
        <li>
          打开下方的 token 管理页，登录后点击 <strong>Create Token</strong>，
          选择 <strong>Edit Cloudflare Workers</strong> 模板。
        </li>
        <li>
          账号资源限定到要部署的 Cloudflare 账号，按项目使用的服务调整权限，并设置有效期。
          检查摘要后创建 token。
        </li>
        <li>
          复制创建后仅显示一次的 token，粘贴到上方的「写入 Cloudflare token」，再点击卡片底部的「保存」。
          引用名通常保留 <code>CLOUDFLARE_API_TOKEN</code>。
        </li>
      </ol>
      <p>也可以在本机终端运行 <code>wrangler login</code> 使用登录授权；临时预览可先不配置 token。</p>
      <div className="dpd-guide-links">
        <a href="https://dash.cloudflare.com/profile/api-tokens/" target="_blank" rel="noopener noreferrer">打开 Cloudflare token 管理 ↗</a>
        <a href="https://developers.cloudflare.com/fundamentals/api/get-started/create-token/" target="_blank" rel="noopener noreferrer">官方创建说明 ↗</a>
      </div>
    </TokenGuide>
  )
}

function NpmTokenGuide() {
  return (
    <TokenGuide title="如何获取 npm token">
      <ol>
        <li>
          登录 npm 官网，点击头像 → <strong>Access Tokens</strong> → <strong>Generate New Token</strong>，
          创建 granular token。
        </li>
        <li>
          在 <strong>Packages and scopes</strong> 中选择要发布的包或作用域，权限选
          <strong> Read and write (publish and stage)</strong>。当前插件使用直接发布，stage only 权限无法完成此操作。
        </li>
        <li>
          设置较短的有效期。需要免交互发布且账号或组织策略允许时，再开启 <strong>Bypass 2FA</strong>；
          若策略要求每次二次验证，请改在终端交互式发布。
        </li>
        <li>
          复制新 token，粘贴到上方的「写入 npm token」并保存。引用名通常保留 <code>NPM_TOKEN</code>。
        </li>
      </ol>
      <div className="dpd-guide-links">
        <a href="https://www.npmjs.com/" target="_blank" rel="noopener noreferrer">打开 npm 官网 ↗</a>
        <a href="https://docs.npmjs.com/creating-and-viewing-access-tokens/" target="_blank" rel="noopener noreferrer">官方 token 创建说明 ↗</a>
      </div>
    </TokenGuide>
  )
}

export function DeploySettingsCard(props: SettingsCardProps) {
  const state = props.useDeployCard(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const [tokenDraft, setTokenDraft] = useState('')
  const [npmTokenDraft, setNpmTokenDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const dirty = state.tokenEnvDraft !== state.tokenEnv
    || state.npmTokenEnvDraft !== state.npmTokenEnv
    || tokenDraft.length > 0
    || npmTokenDraft.length > 0
  const blocked = !dirty || saving

  const discard = () => {
    if (!dirty || saving) return
    props.setTokenEnvDraft(state.tokenEnv)
    props.setNpmTokenEnvDraft(state.npmTokenEnv)
    setTokenDraft('')
    setNpmTokenDraft('')
    setFailed(false)
  }

  const save = async () => {
    if (blocked) return
    setSaving(true)
    setFailed(false)
    try {
      if (props.saveReferences !== undefined) await props.saveReferences()
      else {
        if (state.tokenEnvDraft !== state.tokenEnv) await props.saveTokenEnv()
        if (state.npmTokenEnvDraft !== state.npmTokenEnv) await props.saveNpmTokenEnv()
      }
      if (tokenDraft.length > 0) {
        const value = tokenDraft
        await props.saveTokenValue(value)
        setTokenDraft('')
      }
      if (npmTokenDraft.length > 0) {
        const value = npmTokenDraft
        await props.saveNpmTokenValue(value)
        setNpmTokenDraft('')
      }
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={cx('dpd-card', open && 'dpd-card-open')}>
      <button
        type="button"
        className="dpd-header"
        aria-expanded={open}
        aria-label={`${open ? '收起' : '展开'}: ${CARD_TITLE}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className="dpd-head-text">
          <span className="dpd-name">{CARD_TITLE}</span>
          <span className="dpd-description">{CARD_DESCRIPTION}</span>
        </span>
        {dirty ? <span className="dpd-pending">未保存</span> : null}
        <Chevron open={open} />
      </button>
      {open
        ? (
          <div className="dpd-body">
            {!state.scopeWritable
              ? <p className="dpd-readonly" role="status">本部署的设置为只读。</p>
              : null}
            <p className="dpd-setup-note">
              Cloudflare token 用于部署到自己的账号；npm token 用于发布插件。
              仅使用临时预览、检查或打包时，可先不填写。
            </p>
            <Field
              id="dpd-api-token-env"
              label="Cloudflare API token 引用名"
              hint="默认 CLOUDFLARE_API_TOKEN，通常无需改动。获取到的 token 填在下一项。"
            >
              <input
                id="dpd-api-token-env"
                className="dpd-input"
                value={state.tokenEnvDraft}
                disabled={!state.scopeWritable || saving}
                onChange={event => props.setTokenEnvDraft(event.target.value)}
                spellCheck={false}
              />
            </Field>
            <Field
              id="dpd-api-token-value"
              label="写入 Cloudflare token"
              hint="不会回填已有值。保存后清空，只更新配置状态。"
              badge={{ configured: state.configured }}
              help={<CloudflareTokenGuide />}
            >
              <input
                id="dpd-api-token-value"
                className="dpd-input"
                type="password"
                autoComplete="off"
                disabled={!state.writable || saving}
                value={tokenDraft}
                placeholder="粘贴 token，保存后清空"
                onChange={event => setTokenDraft(event.target.value)}
              />
            </Field>
            <Field
              id="dpd-npm-token-env"
              label="npm token 引用名"
              hint="默认 NPM_TOKEN，通常无需改动。仅发布到 npm 时需要配置。"
            >
              <input
                id="dpd-npm-token-env"
                className="dpd-input"
                value={state.npmTokenEnvDraft}
                disabled={!state.scopeWritable || saving}
                onChange={event => props.setNpmTokenEnvDraft(event.target.value)}
                spellCheck={false}
              />
            </Field>
            <Field
              id="dpd-npm-token-value"
              label="写入 npm token"
              hint="不会回填已有值。保存后清空。发布需审批且不可逆；不推 GitHub、不代提 dsh.pub 收录。"
              badge={{ configured: state.npmConfigured }}
              help={<NpmTokenGuide />}
            >
              <input
                id="dpd-npm-token-value"
                className="dpd-input"
                type="password"
                autoComplete="off"
                disabled={!state.npmWritable || saving}
                value={npmTokenDraft}
                placeholder="粘贴 token，保存后清空"
                onChange={event => setNpmTokenDraft(event.target.value)}
              />
            </Field>
            <div className="dpd-footer">
              {failed
                ? <p className="dpd-failed" role="status">本部署没有接受这些值，已保留供你修改。</p>
                : null}
              <button
                type="button"
                className="dpd-discard"
                disabled={!dirty || saving}
                onClick={discard}
              >
                放弃修改
              </button>
              <button
                type="button"
                className="dpd-save"
                disabled={blocked}
                onClick={save}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        )
        : null}
    </article>
  )
}
