import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { ComposerActionButton } from './ActionButton.tsx'
import { DeployCardController, type CredentialsWire, type SettingsScopeLike } from './card-controller.ts'
import { PLUGIN_CSS } from './card-styles.ts'
import { DeploySettingsCard } from './SettingsCard.tsx'
import { DeployToolView } from './DeployView.tsx'
import { PublishToolView } from './PublishView.tsx'

if (typeof document !== 'undefined'
    && document.querySelector('style[data-plugin-css="dsh-plugin-deploy"]') === null) {
  const tag = document.createElement('style')
  tag.dataset.pluginCss = 'dsh-plugin-deploy'
  tag.textContent = PLUGIN_CSS
  document.head.appendChild(tag)
}

export { DeployToolView, PublishToolView, ComposerActionButton, DeploySettingsCard }
export {
  DEPLOY_PROMPT,
  PUBLISH_CHECK_PROMPT,
  planComposerSubmit,
  runComposerSubmit,
} from './composer-submit.ts'

export const name = 'dsh-plugin-deploy'

export const inject = ['slots', 'connection', 'remote', 'settingsScope']

export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as { api?: { credentials?: CredentialsWire } } | undefined
  const scope = ctx.settingsScope.bind({ namespace: 'deploy' }) as SettingsScopeLike
  const card = new DeployCardController(scope, connection?.api?.credentials)

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'deploy',
    inject: () => card.inject(),
  }, DeploySettingsCard))

  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'deploy',
  }, DeployToolView))

  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'publish_plugin',
  }, PublishToolView))

  // list / session / ConversationHeaderActionOwnerProps（空）。低频入口，不占输入区。
  // useInput + inputActions 来自 session 标准 kit，不是 owner props。
  // order 100：宿主 agent-preset=-10、subagent-catalog=10、job-list=20；负值留给静态上下文。
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'dsh-plugin-deploy',
    order: 100,
    label: '发布',
  }, ComposerActionButton))

  const remote = ctx.get('remote') as { $on?: (event: string, listener: (ref: string) => void) => () => void } | undefined
  if (remote?.$on !== undefined) {
    // 0.1.0-rc.7 转发 `credentials/updated`；0.1.1-rc.1 改名为 `credentials/reference-updated`。
    // `$on` 对未知名字不抛错，宿主一次只发其中一个，两个席位并存是安全的。
    const refresh = (ref: string): void => { card.refreshCredential(ref) }
    ctx.effect(() => remote.$on!('credentials/updated', refresh))
    ctx.effect(() => remote.$on!('credentials/reference-updated', refresh))
  }
}
