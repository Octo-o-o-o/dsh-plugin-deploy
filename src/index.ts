import type { Context } from '@deepseek-ai/cordis'
import { Config, readConfig, type Config as ConfigValue, type RuntimeConfig } from './config.ts'
import { createPublishCommand, createPublishTool } from './publish-tool.ts'
import { createDeployCommand, createDeployTool } from './tool.ts'

export const name = 'dsh-plugin-deploy'

export const inject = [
  'tools',
  'shell',
  'subprocess',
  'commands',
  'userQuestions',
  'approval',
]

export { Config }
export type { ConfigValue as DeployPluginConfig }

export {
  isWranglerVersionAtLeast,
  MIN_TEMPORARY_WRANGLER,
  parseWranglerVersion,
} from './version.ts'
export { parseWranglerOutput } from './parse.ts'
export { redactSecrets } from './redact.ts'
export { selectMode } from './mode.ts'
export { runDeploy, hintFromOutput } from './deploy.ts'
export { deriveWorkerName } from './worker-name.ts'
export { L1_ISOLATED_HOME } from './isolated-home.ts'
export {
  ASSET_IGNORE_PATTERNS,
  generatedConfigPath,
  generatedWranglerConfigBody,
  shellSingleQuote,
} from './generated-config.ts'
export { resolveWorkspaceDirectory } from './workspace.ts'
export {
  parseWranglerAssetsDirectory,
  parseWranglerWorkerName,
} from './wrangler-config.ts'
export { loadUnclaimed } from './unclaimed.ts'
export {
  formatDeployText,
  parseDeployText,
  readPresentationMeta,
  resolveDeployPresentation,
  UNSTRUCTURED_RESULT_NOTICE,
} from './format.ts'
export {
  evaluateChecks,
  inspectClientBundle,
  parseNpmPackJson,
  parseNpmViewVersions,
  parseScanJson,
  forbiddenPackReason,
  isOldDshTrain,
  resolvePublishAccess,
} from './publish-checks.ts'
export {
  formatPublishText,
  parsePublishText,
  resolvePublishPresentation,
  PUBLISH_NEXT_STEPS,
  TARBALL_TMP_NOTICE,
  UNSTRUCTURED_PUBLISH_NOTICE,
} from './publish-format.ts'
export {
  runPublish,
  parsePublishCommandInput,
  installCommandFor,
  NPM_CACHE_DIR,
  PACK_DEST_DIR,
  packedTarballPath,
} from './publish.ts'
export { createPublishTool, createPublishCommand } from './publish-tool.ts'

export function apply(ctx: Context, config: RuntimeConfig): void {
  const source = () => readConfig(config)
  ctx.tools.register(createDeployTool(ctx, source))
  ctx.tools.register(createPublishTool(ctx, source))
  ctx.effect(() => ctx.commands.register(createDeployCommand(ctx, source)))
  ctx.effect(() => ctx.commands.register(createPublishCommand(ctx, source)))
}
