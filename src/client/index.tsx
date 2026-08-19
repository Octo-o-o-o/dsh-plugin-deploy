import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { ComposerActionButton } from './ActionButton.tsx'
import { DeployCardController, type CredentialsWire, type SettingsScopeLike } from './card-controller.ts'
import { DeploySettingsCard } from './SettingsCard.tsx'
import { DeployToolView } from './DeployView.tsx'
import { PublishToolView } from './PublishView.tsx'

export { DeployToolView, PublishToolView, ComposerActionButton }
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
    ctx.effect(() => remote.$on!('credentials/updated', ref => {
      card.refreshCredential(ref)
    }))
  }
}
