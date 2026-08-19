import { useState } from 'react'
import type { DeploySettingsState } from './card-controller.ts'

export interface SettingsCardProps {
  useDeployCard: (select: (state: DeploySettingsState) => DeploySettingsState) => DeploySettingsState
  setTokenEnvDraft: (value: string) => void
  saveTokenEnv: () => Promise<void>
  saveTokenValue: (value: string) => Promise<void>
  setNpmTokenEnvDraft: (value: string) => void
  saveNpmTokenEnv: () => Promise<void>
  saveNpmTokenValue: (value: string) => Promise<void>
}

function FieldLabel(props: { children: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{props.children}</div>
  )
}

function Hint(props: { children: string }) {
  return (
    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4, lineHeight: 1.45 }}>{props.children}</div>
  )
}

export function DeploySettingsCard(props: SettingsCardProps) {
  const state = props.useDeployCard(snapshot => snapshot)
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 12 }}>
      <header>
        <div style={{ fontSize: 16, fontWeight: 650 }}>Cloudflare 部署</div>
        <Hint>token 存在 dsh 凭据服务里，模型看不到值。设置里只保存引用名。auto 按认证状态选择；显式临时预览走隔离环境，不必登出 wrangler。</Hint>
      </header>
      <div>
        <FieldLabel>设置里的 token</FieldLabel>
        <div>{state.configured ? '已配置' : '未配置'}</div>
      </div>
      <div>
        <FieldLabel>API token 引用名</FieldLabel>
        <input
          value={state.tokenEnvDraft}
          disabled={!state.scopeWritable}
          onChange={event => props.setTokenEnvDraft(event.target.value)}
          onBlur={() => { void props.saveTokenEnv() }}
          spellCheck={false}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
        <Hint>默认 CLOUDFLARE_API_TOKEN。这里改的是引用名，不是 token 本身。</Hint>
      </div>
      <div>
        <FieldLabel>凭据是否已配置</FieldLabel>
        <div>{state.configured ? '已配置（值不会显示）' : '未配置'}</div>
      </div>
      <div>
        <FieldLabel>写入 token 值（只写）</FieldLabel>
        <TokenWriteField
          disabled={!state.writable}
          onSave={value => props.saveTokenValue(value)}
        />
        <Hint>输入框不会回填已有值。保存后只更新「是否已配置」。</Hint>
      </div>
      <header>
        <div style={{ fontSize: 16, fontWeight: 650 }}>发布 dsh 插件</div>
        <Hint>npm token 同样只存引用名。发布到 npm 需要审批，且不可逆。本工具不推 GitHub、不代提 dsh.pub 收录 PR。</Hint>
      </header>
      <div>
        <FieldLabel>设置里的 npm token</FieldLabel>
        <div>{state.npmConfigured ? '已配置' : '未配置'}</div>
      </div>
      <div>
        <FieldLabel>npm token 引用名</FieldLabel>
        <input
          value={state.npmTokenEnvDraft}
          disabled={!state.scopeWritable}
          onChange={event => props.setNpmTokenEnvDraft(event.target.value)}
          onBlur={() => { void props.saveNpmTokenEnv() }}
          spellCheck={false}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
        <Hint>默认 NPM_TOKEN。这里改的是引用名，不是 token 本身。发布请用 automation token，避免 OTP/2FA 卡住。</Hint>
      </div>
      <div>
        <FieldLabel>npm 凭据是否已配置</FieldLabel>
        <div>{state.npmConfigured ? '已配置（值不会显示）' : '未配置'}</div>
      </div>
      <div>
        <FieldLabel>写入 npm token 值（只写）</FieldLabel>
        <TokenWriteField
          disabled={!state.npmWritable}
          onSave={value => props.saveNpmTokenValue(value)}
        />
        <Hint>输入框不会回填已有值。保存后只更新「是否已配置」。</Hint>
      </div>
    </section>
  )
}

function TokenWriteField(props: { disabled: boolean; onSave: (value: string) => Promise<void> }) {
  const [draft, setDraft] = useState('')
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        type="password"
        autoComplete="off"
        disabled={props.disabled}
        value={draft}
        placeholder="粘贴 token，保存后清空"
        onChange={event => setDraft(event.target.value)}
        style={{ flex: 1, boxSizing: 'border-box' }}
      />
      <button
        type="button"
        disabled={props.disabled || draft.length === 0}
        onClick={() => {
          const value = draft
          setDraft('')
          void props.onSave(value)
        }}
      >
        保存
      </button>
    </div>
  )
}
