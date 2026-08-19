export function isAuthenticatedWhoami(exitCode: number | null, output: string): boolean {
  const text = output.toLowerCase()
  if (/not authenticated|not logged in|you are not authenticated|haven't logged in|has not logged in/.test(text)) {
    return false
  }
  if (exitCode !== 0) return false
  return /@|account name|account id|logged in|authenticated as/.test(text)
}
