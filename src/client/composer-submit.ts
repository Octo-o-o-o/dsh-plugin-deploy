/**
 * 把「部署 / 检查发布」写成一句自然语言，再交给输入框 submit。
 * 不直接调 Host：审批必须发生在开启的 agent turn 内。
 */

export const DEPLOY_PROMPT = '把当前工作区部署到 Cloudflare（用 deploy 工具）'

export const PUBLISH_CHECK_PROMPT = '检查当前工作区能否作为 dsh 插件发布（用 publish_plugin 工具，mode 用 check）'

export const COMPOSER_PROMPTS = [DEPLOY_PROMPT, PUBLISH_CHECK_PROMPT] as const

export interface ComposerActions {
  setDraft(text: string): void
  submit(): void
}

export interface ComposerInputSnapshot {
  draft: string
  phase: string
  sessionRemoved?: boolean
}

export type ComposerRefuseReason = 'busy' | 'occupied' | 'unavailable'

export type ComposerSubmitPlan =
  | { action: 'submit'; text: string }
  | { action: 'refuse'; reason: ComposerRefuseReason }

export const REFUSE_TITLE: Record<ComposerRefuseReason, string> = {
  busy: '输入区正在处理，请等当前提交结束',
  occupied: '输入框里已有内容。先发出去或清空，再点这里，以免覆盖你正在写的字',
  unavailable: '当前没有可提交的会话',
}

export function planComposerSubmit(
  prompt: string,
  input: ComposerInputSnapshot | undefined,
  actions: ComposerActions | undefined,
): ComposerSubmitPlan {
  if (
    actions === undefined
    || typeof actions.setDraft !== 'function'
    || typeof actions.submit !== 'function'
  ) {
    return { action: 'refuse', reason: 'unavailable' }
  }
  if (input === undefined || input.sessionRemoved === true) {
    return { action: 'refuse', reason: 'unavailable' }
  }
  // claimed / adjudicating / submitting 都不要抢：setDraft 是全量写入。
  if (input.phase !== 'plain') {
    return { action: 'refuse', reason: 'busy' }
  }
  const draft = input.draft.trim()
  // 不覆盖、不追加。追加会把用户半句话和部署指令糊在一起，模型可能两头都做或两头都做错。
  // InputActions 没有 notify，没法在输入区旁轻提示，所以只能禁用并靠 title 说明。
  // 草稿已经等于目标指令时允许再提交（结果卡「再来一次」）。
  if (draft !== '' && draft !== prompt) {
    return { action: 'refuse', reason: 'occupied' }
  }
  return { action: 'submit', text: prompt }
}

export function runComposerSubmit(
  prompt: string,
  input: ComposerInputSnapshot | undefined,
  actions: ComposerActions | undefined,
): ComposerSubmitPlan {
  const plan = planComposerSubmit(prompt, input, actions)
  if (plan.action === 'submit' && actions !== undefined) {
    actions.setDraft(plan.text)
    actions.submit()
  }
  return plan
}

export function composerControlReason(
  input: ComposerInputSnapshot | undefined,
  actions: ComposerActions | undefined,
  prompts: readonly string[] = COMPOSER_PROMPTS,
): ComposerRefuseReason | undefined {
  if (
    actions === undefined
    || typeof actions.setDraft !== 'function'
    || typeof actions.submit !== 'function'
    || input === undefined
    || input.sessionRemoved === true
  ) {
    return 'unavailable'
  }
  if (input.phase !== 'plain') return 'busy'
  const draft = input.draft.trim()
  if (draft !== '' && !prompts.includes(draft)) return 'occupied'
  return undefined
}
