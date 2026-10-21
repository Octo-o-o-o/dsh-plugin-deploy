import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { evaluateChecks, resolveWorkspaceDirectory, shellSingleQuote } from '../lib/index.js'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
const input = (pkg, runtimeVersion = '0.2.1-rc.2') => ({
  pkg, runtimeVersion, patchExists: true, mode: 'check',
  pack: { files: [], entryCount: 0 },
  versionQuery: { status: 'available' }, scan: { skipped: true },
})
const compatibility = (pkg, version) => evaluateChecks(input(pkg, version)).find(c => c.id === 'dsh-compat')

test('published compatibility accepts the reported desktop release and bounds future trains', () => {
  assert.equal(compatibility(manifest, '0.2.1-rc.2').ok, true)
  assert.equal(compatibility(manifest, '0.2.2-rc.1').ok, true)
  assert.equal(compatibility(manifest, '0.1.5-rc.3').ok, false)
  assert.equal(compatibility(manifest, '0.3.0-rc.1').ok, false)
  assert.equal(compatibility(manifest, '0.3.0').ok, false)
})

test('publish check catches the exact peer-only installation rejection from issue 1', () => {
  const pkg = { name: 'fixture', version: '0.1.3', peerDependencies: { '@deepseek-ai/dsh-tools': '0.1.0-rc.7' } }
  const check = compatibility(pkg)
  assert.equal(check.ok, false)
  assert.equal(check.blocking, true)
  assert.match(check.detail, /0\.1\.0-rc\.7/)
  assert.equal(compatibility({ ...pkg, engines: { dsh: manifest.engines.dsh } }).ok, true)
})

test('malformed compatibility declarations fail closed', () => {
  assert.equal(compatibility({ name: 'fixture', version: '1.0.0', engines: { dsh: 'workspace:*' } }).ok, false)
  assert.equal(compatibility({ engines: { dsh: 42 } }).ok, false)
})

test('relative deployment and publication paths follow the current session directory', () => {
  const session = { header: { cwd: resolve('original-project') } }
  const current = resolve('current-project')
  const host = { get: name => name === 'workingDirectory' ? { get: value => {
    assert.equal(value, session)
    return current
  } } : undefined }
  assert.equal(resolveWorkspaceDirectory(host, undefined, { session }), current)
  assert.equal(resolveWorkspaceDirectory(host, '../sibling', { session }), resolve(current, '../sibling'))
  assert.equal(resolveWorkspaceDirectory(host, resolve('explicit'), { session }), resolve('explicit'))
})

test('PowerShell and bash paths preserve spaces, quotes, and literal substitution characters', () => {
  const path = "C:\\work\\O'Brien $site`name"
  assert.equal(shellSingleQuote(path, 'win32'), "'C:\\work\\O''Brien $site`name'")
  assert.equal(shellSingleQuote("/work/O'Brien $site", 'darwin'), "'/work/O'\\''Brien $site'")
})
