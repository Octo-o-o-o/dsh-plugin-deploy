import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { ComposerActionButton } from './ActionButton.tsx'
import { DeployCardController } from './card-controller.ts'
import { PLUGIN_CSS } from './card-styles.ts'
import { DeploySettingsCard } from './SettingsCard.tsx'
import { DeployToolView } from './DeployView.tsx'
import { PublishToolView } from './PublishView.tsx'

export { DeployToolView, PublishToolView, ComposerActionButton, DeploySettingsCard }
export { DeployCardController } from './card-controller.ts'
export {
  DEPLOY_PROMPT,
  PUBLISH_CHECK_PROMPT,
  planComposerSubmit,
  runComposerSubmit,
} from './composer-submit.ts'

export const name = 'dsh-plugin-deploy'

export const inject = ['slots', 'remote', 'remote.credentials', 'configForms']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    if (typeof document === 'undefined') return () => {}
    const tag = document.createElement('style')
    tag.dataset.pluginCss = name
    tag.textContent = PLUGIN_CSS
    document.head.appendChild(tag)
    return () => tag.remove()
  })
  const card = new DeployCardController(ctx.configForms.get('dsh-plugin-deploy'), ctx.remote.credentials)
  ctx.effect(() => () => card.dispose())

  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: name,
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

  ctx.effect(() => ctx.remote.$on('credentials/reference-updated', (ref: string) => card.refreshCredential(ref)))
}
