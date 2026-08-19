import { useState, type ReactNode } from 'react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
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
}

function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ')
}

function Chevron(props: { open: boolean }) {
  const className = cx('dpd-chevron', props.open && 'dpd-chevron-open')
  if (typeof IconChevronDownOutline14 === 'function') {
    return <IconChevronDownOutline14 className={className} />
  }
  return <span className={cx(className, 'dpd-chevron-fallback')} aria-hidden="true" />
}

function Field(props: {
  id: string
  label: string
  hint: string
  badge?: { configured: boolean }
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
    </div>
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
      if (state.tokenEnvDraft !== state.tokenEnv) await props.saveTokenEnv()
      if (state.npmTokenEnvDraft !== state.npmTokenEnv) await props.saveNpmTokenEnv()
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
    <li className={cx('dpd-card', open && 'dpd-card-open')}>
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
            <Field
              id="dpd-api-token-env"
              label="Cloudflare API token 引用名"
              hint="默认 CLOUDFLARE_API_TOKEN。改的是引用名，不是 token 本身。"
            >
              <input
                id="dpd-api-token-env"
                className="dpd-input"
                value={state.tokenEnvDraft}
                disabled={!state.scopeWritable}
                onChange={event => props.setTokenEnvDraft(event.target.value)}
                spellCheck={false}
              />
            </Field>
            <Field
              id="dpd-api-token-value"
              label="写入 Cloudflare token"
              hint="不会回填已有值。保存后清空，只更新配置状态。"
              badge={{ configured: state.configured }}
            >
              <input
                id="dpd-api-token-value"
                className="dpd-input"
                type="password"
                autoComplete="off"
                disabled={!state.writable}
                value={tokenDraft}
                placeholder="粘贴 token，保存后清空"
                onChange={event => setTokenDraft(event.target.value)}
              />
            </Field>
            <Field
              id="dpd-npm-token-env"
              label="npm token 引用名"
              hint="默认 NPM_TOKEN。发布请用 automation token，避免 OTP/2FA 卡住。"
            >
              <input
                id="dpd-npm-token-env"
                className="dpd-input"
                value={state.npmTokenEnvDraft}
                disabled={!state.scopeWritable}
                onChange={event => props.setNpmTokenEnvDraft(event.target.value)}
                spellCheck={false}
              />
            </Field>
            <Field
              id="dpd-npm-token-value"
              label="写入 npm token"
              hint="不会回填已有值。保存后清空。发布需审批且不可逆；不推 GitHub、不代提 dsh.pub 收录。"
              badge={{ configured: state.npmConfigured }}
            >
              <input
                id="dpd-npm-token-value"
                className="dpd-input"
                type="password"
                autoComplete="off"
                disabled={!state.npmWritable}
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
    </li>
  )
}
