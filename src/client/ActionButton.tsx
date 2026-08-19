import { useEffect, useRef, useState } from 'react'
import {
  DEPLOY_PROMPT,
  PUBLISH_CHECK_PROMPT,
  REFUSE_TITLE,
  composerControlReason,
  planComposerSubmit,
  runComposerSubmit,
  type ComposerActions,
  type ComposerInputSnapshot,
} from './composer-submit.ts'

export interface ComposerActionButtonProps {
  sessionId?: string
  useInput?: (select: (state: ComposerInputSnapshot) => ComposerInputSnapshot) => ComposerInputSnapshot | undefined
  inputActions?: ComposerActions
  useSession?: (select: (state: { removed?: boolean }) => unknown) => unknown
}

const rootStyle = {
  position: 'relative',
} as const

const triggerStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  minHeight: 28,
  padding: '3px 4px',
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 12,
  lineHeight: '18px',
  cursor: 'pointer',
} as const

const triggerDisabledStyle = {
  ...triggerStyle,
  cursor: 'default',
  opacity: 0.45,
} as const

const menuStyle = {
  position: 'absolute',
  top: 'calc(100% + 5px)',
  left: 0,
  zIndex: 100,
  boxSizing: 'border-box',
  minWidth: 168,
  margin: 0,
  padding: 4,
  listStyle: 'none',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 12,
  background: 'var(--dsw-specific-menu, var(--dsw-alias-bg-elevated, #fff))',
  boxShadow: 'var(--dsw-shadow-lv3)',
} as const

const itemStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  textAlign: 'left',
  minHeight: 32,
  padding: '6px 8px',
  border: 0,
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 13,
  lineHeight: '18px',
  cursor: 'pointer',
} as const

function snapshotFromKit(props: ComposerActionButtonProps): ComposerInputSnapshot | undefined {
  if (typeof props.useInput !== 'function') return undefined
  const state = props.useInput(current => current)
  if (state === undefined) return undefined
  const removed = typeof props.useSession === 'function'
    && props.useSession(session => session.removed) === true
  return {
    draft: state.draft,
    phase: state.phase,
    sessionRemoved: removed,
  }
}

export function ComposerActionButton(props: ComposerActionButtonProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      const root = rootRef.current
      if (root !== null && event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => { document.removeEventListener('pointerdown', closeOutside) }
  }, [open])

  const hasSession = props.sessionId !== undefined
    && typeof props.useInput === 'function'
    && props.inputActions !== undefined
  const input = snapshotFromKit(props)
  const actions = props.inputActions
  const blocked = composerControlReason(input, actions)

  if (!hasSession || input?.sessionRemoved === true) return null

  const title = blocked === undefined ? '写入一句部署/校验指令并提交，走正常 agent turn' : REFUSE_TITLE[blocked]
  const disabled = blocked !== undefined

  const pick = (prompt: string) => {
    setOpen(false)
    runComposerSubmit(prompt, input, actions)
  }

  return (
    <div
      ref={rootRef}
      style={rootStyle}
      onKeyDown={event => {
        if (event.key !== 'Escape' || !open) return
        event.preventDefault()
        setOpen(false)
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="部署或检查发布"
        title={title}
        disabled={disabled}
        style={disabled ? triggerDisabledStyle : triggerStyle}
        onClick={() => {
          if (disabled) return
          setOpen(current => !current)
        }}
      >
        发布
        <span aria-hidden="true" style={{ fontSize: 10, lineHeight: '18px', opacity: 0.7 }}>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open
        ? (
          <ul role="menu" aria-label="部署或检查发布" style={menuStyle}>
            <li>
              <button
                type="button"
                role="menuitem"
                style={itemStyle}
                disabled={planComposerSubmit(DEPLOY_PROMPT, input, actions).action !== 'submit'}
                onClick={() => { pick(DEPLOY_PROMPT) }}
              >
                部署到 Cloudflare
              </button>
            </li>
            <li>
              <button
                type="button"
                role="menuitem"
                style={itemStyle}
                disabled={planComposerSubmit(PUBLISH_CHECK_PROMPT, input, actions).action !== 'submit'}
                onClick={() => { pick(PUBLISH_CHECK_PROMPT) }}
              >
                检查插件发布
              </button>
            </li>
          </ul>
        )
        : null}
    </div>
  )
}

export interface ComposerRetryButtonProps {
  prompt: string
  label: string
  useInput: (select: (state: ComposerInputSnapshot) => ComposerInputSnapshot) => ComposerInputSnapshot
  inputActions: ComposerActions
}

export function ComposerRetryButton(props: ComposerRetryButtonProps) {
  const input = props.useInput(state => state)
  const plan = planComposerSubmit(props.prompt, input, props.inputActions)
  const disabled = plan.action !== 'submit'
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled && plan.action === 'refuse' ? REFUSE_TITLE[plan.reason] : undefined}
      onClick={() => {
        runComposerSubmit(props.prompt, input, props.inputActions)
      }}
    >
      {props.label}
    </button>
  )
}

export function maybeComposerRetry(
  props: {
    useInput?: ComposerRetryButtonProps['useInput']
    inputActions?: ComposerActions
  },
  prompt: string,
  label: string,
) {
  if (props.inputActions === undefined || typeof props.useInput !== 'function') return null
  return (
    <ComposerRetryButton
      prompt={prompt}
      label={label}
      useInput={props.useInput}
      inputActions={props.inputActions}
    />
  )
}
