import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type ProjectKind = 'worker' | 'static-dist' | 'static-root'

export interface DetectedProject {
  kind: ProjectKind
  directory: string
  assetsDir?: string
  hasWranglerConfig: boolean
  wranglerConfigName?: string
}

const WRANGLER_CONFIGS = ['wrangler.jsonc', 'wrangler.toml', 'wrangler.json'] as const

export function findWranglerConfig(directory: string): string | undefined {
  for (const name of WRANGLER_CONFIGS) {
    if (existsSync(join(directory, name))) return name
  }
}

export function detectProject(directory: string): DetectedProject | undefined {
  const wranglerConfigName = findWranglerConfig(directory)
  if (wranglerConfigName !== undefined) {
    return {
      kind: 'worker',
      directory,
      hasWranglerConfig: true,
      wranglerConfigName,
    }
  }
  if (existsSync(join(directory, 'dist', 'index.html'))) {
    return {
      kind: 'static-dist',
      directory,
      assetsDir: join(directory, 'dist'),
      hasWranglerConfig: false,
    }
  }
  if (existsSync(join(directory, 'index.html'))) {
    return {
      kind: 'static-root',
      directory,
      assetsDir: directory,
      hasWranglerConfig: false,
    }
  }
}

export function projectFromChoice(directory: string, choice: ProjectKind): DetectedProject {
  const wranglerConfigName = findWranglerConfig(directory)
  if (choice === 'worker') {
    return {
      kind: 'worker',
      directory,
      hasWranglerConfig: wranglerConfigName !== undefined,
      ...wranglerConfigName === undefined ? {} : { wranglerConfigName },
    }
  }
  if (choice === 'static-dist') {
    return {
      kind: 'static-dist',
      directory,
      assetsDir: join(directory, 'dist'),
      hasWranglerConfig: wranglerConfigName !== undefined,
      ...wranglerConfigName === undefined ? {} : { wranglerConfigName },
    }
  }
  return {
    kind: 'static-root',
    directory,
    assetsDir: directory,
    hasWranglerConfig: wranglerConfigName !== undefined,
    ...wranglerConfigName === undefined ? {} : { wranglerConfigName },
  }
}
