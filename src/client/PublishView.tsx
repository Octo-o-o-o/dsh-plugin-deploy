import {
  resolvePublishPresentation,
  TARBALL_TMP_NOTICE,
  UNSTRUCTURED_PUBLISH_NOTICE,
} from '../publish-format.ts'
import { maybeComposerRetry } from './ActionButton.tsx'
import { PUBLISH_CHECK_PROMPT, type ComposerActions, type ComposerInputSnapshot } from './composer-submit.ts'

interface TextBlock {
  type: string
  text?: string
}

interface PublishBlock {
  kind?: string
  isError?: boolean
  content?: readonly TextBlock[]
  meta?: unknown
}

export interface PublishViewProps {
  toolName: string
  block: PublishBlock
  useInput?: (select: (state: ComposerInputSnapshot) => ComposerInputSnapshot) => ComposerInputSnapshot
  inputActions?: ComposerActions
}

function contentText(block: PublishBlock): string {
  return (block.content ?? [])
    .filter(item => item.type === 'text' && typeof item.text === 'string')
    .map(item => item.text ?? '')
    .join('\n')
}

export function PublishToolView(props: PublishViewProps) {
  const settled = props.block.kind === 'tool-result'
  const retry = maybeComposerRetry(props, PUBLISH_CHECK_PROMPT, '重新校验')

  if (!settled) {
    return (
      <article style={{ padding: 12 }}>
        <strong>正在处理插件发布…</strong>
      </article>
    )
  }

  const rawText = contentText(props.block)
  const resolved = resolvePublishPresentation({
    meta: props.block.meta,
    text: rawText,
    isError: props.block.isError,
  })
  const raw = (
    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{rawText}</pre>
  )

  if (resolved.source === 'none' && resolved.checks.length === 0 && resolved.packageName === undefined) {
    return (
      <article style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong>发布结果</strong>
        <div>{UNSTRUCTURED_PUBLISH_NOTICE}</div>
        {raw}
        {retry}
      </article>
    )
  }

  const title = !resolved.ok
    ? '发布未完成'
    : resolved.mode === 'npm'
      ? '已发布到 npm'
      : resolved.mode === 'pack'
        ? '打包完成'
        : '校验完成'
  const identity = resolved.packageName !== undefined && resolved.version !== undefined
    ? `${resolved.packageName}@${resolved.version}`
    : resolved.packageName ?? resolved.version

  return (
    <article style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <strong>{title}</strong>
      {identity ? <div>{identity}</div> : null}
      {resolved.fileCount !== undefined
        ? (
          <div>
            {`清单：${resolved.fileCount} 个文件${resolved.packedSize !== undefined ? `，打包 ${resolved.packedSize} 字节` : ''}${resolved.unpackedSize !== undefined ? `，解压 ${resolved.unpackedSize} 字节` : ''}`}
          </div>
          )
        : null}
      {resolved.tarballPath ? <div>tarball：<code>{resolved.tarballPath}</code></div> : null}
      {resolved.tarballPath ? <div>{TARBALL_TMP_NOTICE}</div> : null}
      {resolved.installCommand ? <div>安装：<code>{resolved.installCommand}</code></div> : null}
      {resolved.checks.length > 0
        ? (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong>校验清单</strong>
            {resolved.checks.map(item => (
              <div key={item.id}>
                {item.ok ? '通过' : item.blocking ? '失败' : '注意'}
                {' · '}
                {item.id}
                {'：'}
                {item.detail}
              </div>
            ))}
          </section>
          )
        : null}
      {!resolved.ok
        ? (
          <>
            <div>{resolved.error ?? '发布未成功完成。'}</div>
            {resolved.hint ? <div>{resolved.hint}</div> : null}
          </>
          )
        : null}
      {resolved.warnings.map(warning => (
        <div key={warning}>{warning}</div>
      ))}
      {retry}
    </article>
  )
}
