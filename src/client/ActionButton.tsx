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
  input?: ComposerInputSnapshot
  inputActions?: ComposerActions
  session?: { removed?: boolean }
}

const selectStyle = {
  fontSize: 12,
  lineHeight: '20px',
  height: 24,
  maxWidth: 112,
} as const

function snapshotFromZone(props: ComposerActionButtonProps): ComposerInputSnapshot | undefined {
  if (props.input === undefined) return undefined
  return {
    draft: props.input.draft,
    phase: props.input.phase,
    sessionRemoved: props.session?.removed === true || props.input.sessionRemoved === true,
  }
}

export function ComposerActionButton(props: ComposerActionButtonProps) {
  const input = snapshotFromZone(props)
  const actions = props.inputActions
  const blocked = composerControlReason(input, actions)
  const title = blocked === undefined ? '写入一句部署/校验指令并提交，走正常 agent turn' : REFUSE_TITLE[blocked]

  const onChange = (event: { currentTarget?: { value: string }; target: { value: string } }) => {
    const target = event.currentTarget ?? event.target
    const value = target.value
    target.value = ''
    if (value === 'deploy') runComposerSubmit(DEPLOY_PROMPT, input, actions)
    if (value === 'publish') runComposerSubmit(PUBLISH_CHECK_PROMPT, input, actions)
  }

  return (
    <select
      aria-label="部署或检查发布"
      title={title}
      disabled={blocked !== undefined}
      defaultValue=""
      onChange={onChange}
      style={selectStyle}
    >
      <option value="" disabled hidden>发布</option>
      <option
        value="deploy"
        disabled={planComposerSubmit(DEPLOY_PROMPT, input, actions).action !== 'submit'}
      >
        部署到 Cloudflare
      </option>
      <option
        value="publish"
        disabled={planComposerSubmit(PUBLISH_CHECK_PROMPT, input, actions).action !== 'submit'}
      >
        检查插件发布
      </option>
    </select>
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
