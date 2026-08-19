export interface SemVer {
  major: number
  minor: number
  patch: number
}

/** Wrangler first shipped `--temporary` at this version. */
export const MIN_TEMPORARY_WRANGLER: SemVer = { major: 4, minor: 102, patch: 0 }

export function parseWranglerVersion(text: string): SemVer | undefined {
  const match = text.match(/(\d+)\.(\d+)\.(\d+)/)
  if (!match) return undefined
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
}

export function isWranglerVersionAtLeast(version: SemVer, minimum: SemVer): boolean {
  if (version.major !== minimum.major) return version.major > minimum.major
  if (version.minor !== minimum.minor) return version.minor > minimum.minor
  return version.patch >= minimum.patch
}

export function formatSemVer(version: SemVer): string {
  return `${version.major}.${version.minor}.${version.patch}`
}
