import { resolve } from 'node:path'

/** Resolve against the session's current directory, including change_working_directory. */
export function resolveWorkspaceDirectory(
  host: { get(name: string): unknown },
  requested: string | undefined,
  agent: unknown,
): string {
  const session = (agent as { session?: { header?: { cwd?: string } } } | undefined)?.session
  const directories = host.get('workingDirectory') as { get(session: unknown): string } | undefined
  const base = session !== undefined && directories !== undefined
    ? directories.get(session)
    : session?.header?.cwd ?? process.cwd()
  return requested?.trim() ? resolve(base, requested.trim()) : base
}
