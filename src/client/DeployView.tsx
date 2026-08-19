import {
  resolveDeployPresentation,
  UNSTRUCTURED_RESULT_NOTICE,
} from '../format.ts'
import { maybeComposerRetry } from './ActionButton.tsx'
import { DEPLOY_PROMPT, type ComposerActions, type ComposerInputSnapshot } from './composer-submit.ts'

interface TextBlock {
  type: string
  text?: string
}

interface DeployBlock {
  kind?: string
  isError?: boolean
  content?: readonly TextBlock[]
  meta?: unknown
}

export interface DeployViewProps {
  toolName: string
  block: DeployBlock
  useInput?: (select: (state: ComposerInputSnapshot) => ComposerInputSnapshot) => ComposerInputSnapshot
  inputActions?: ComposerActions
}

function contentText(block: DeployBlock): string {
  return (block.content ?? [])
    .filter(item => item.type === 'text' && typeof item.text === 'string')
    .map(item => item.text ?? '')
    .join('\n')
}

export function DeployToolView(props: DeployViewProps) {
  const settled = props.block.kind === 'tool-result'
  const retry = maybeComposerRetry(props, DEPLOY_PROMPT, '重新部署')

  if (!settled) {
    return (
      <article style={{ padding: 12 }}>
        <strong>正在部署到 Cloudflare…</strong>
      </article>
    )
  }

  const rawText = contentText(props.block)
  const resolved = resolveDeployPresentation({
    meta: props.block.meta,
    text: rawText,
    isError: props.block.isError,
  })
  const raw = (
    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{rawText}</pre>
  )

  if (!resolved.ok) {
    return (
      <article style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong>部署失败</strong>
        <div>{resolved.error ?? 'wrangler 未成功完成部署。'}</div>
        {resolved.hint ? <div>{resolved.hint}</div> : null}
        {raw}
        {retry}
      </article>
    )
  }

  const temporary = resolved.mode === 'temporary'
  const title = temporary
    ? '临时预览地址'
    : resolved.mode === 'account'
      ? '持久 URL'
      : '部署完成'
  return (
    <article style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <strong>{title}</strong>
      {resolved.previewUrl
        ? <a href={resolved.previewUrl} target="_blank" rel="noreferrer">{resolved.previewUrl}</a>
        : (
          <>
            <div>{UNSTRUCTURED_RESULT_NOTICE}</div>
            {raw}
          </>
          )}
      {resolved.workerName ? <div>Worker 名：{resolved.workerName}</div> : null}
      {temporary && (resolved.previewUrl !== undefined || resolved.claimUrl !== undefined)
        ? (
          <section style={{
            border: '1px solid currentColor',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
          >
            <strong>必须认领，否则会被删除</strong>
            {resolved.claimWithin ? <div>剩余时间：{resolved.claimWithin}</div> : null}
            {resolved.claimUrl
              ? <a href={resolved.claimUrl} target="_blank" rel="noreferrer">打开认领链接</a>
              : <div>未能解析出认领链接。</div>}
            <div>这是临时预览，不是正式上线。不在认领窗口内完成认领，Cloudflare 会删除该临时账号及其资源。</div>
            <div>该认领链接会记录在会话日志中，请勿分享此会话。</div>
          </section>
          )
        : null}
      {resolved.warnings.map(warning => (
        <div key={warning}>{warning}</div>
      ))}
      {retry}
    </article>
  )
}
