import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  evaluateChecks,
  forbiddenPackReason,
  inspectClientBundle,
  isOldDshTrain,
  parseNpmPackJson,
  parseNpmViewVersions,
  parseScanJson,
  resolvePublishAccess,
} from '../lib/index.js'

const PACK_SAMPLE = `[
  {
    "name":"dsh-plugin-deploy",
    "version":"0.1.0",
    "filename":"dsh-plugin-deploy-0.1.0.tgz",
    "size":21788,
    "unpackedSize":74912,
    "entryCount":6,
    "files":[
      {"path":"LICENSE"},
      {"path":"README.md"},
      {"path":"cordis.patch.yml"},
      {"path":"lib/client.js"},
      {"path":"lib/index.js"},
      {"path":"package.json"}
    ]
  }
]`

const GOOD_PKG = {
  name: 'dsh-plugin-deploy',
  version: '0.1.0',
  main: './lib/index.js',
  exports: { '.': './lib/index.js', './client': './lib/client.js' },
  dsh: {
    bundle: { patch: './cordis.patch.yml' },
    client: { platform: 'web' },
  },
  peerDependencies: { '@deepseek-ai/dsh-tools': '0.1.0-rc.7' },
}

const GOOD_CLIENT = [
  'window.__ModuleLoader__.load({ id: "dsh-plugin-deploy", factory: (require) => {',
  'var module = { exports: {} }; var exports = module.exports;',
  'return module.exports; } });',
].join('\n')

function baseInput(overrides = {}) {
  return {
    pkg: GOOD_PKG,
    patchExists: true,
    pack: parseNpmPackJson(PACK_SAMPLE),
    clientSource: GOOD_CLIENT,
    clientPath: 'lib/client.js',
    versionQuery: { status: 'unpublished' },
    scan: { skipped: true },
    mode: 'check',
    ...overrides,
  }
}

function byId(checks) {
  return Object.fromEntries(checks.map(item => [item.id, item]))
}

test('parseNpmPackJson reads the real dry-run array shape', () => {
  const pack = parseNpmPackJson(`npm notice\n${PACK_SAMPLE}`)
  assert.equal(pack.filename, 'dsh-plugin-deploy-0.1.0.tgz')
  assert.equal(pack.size, 21788)
  assert.equal(pack.unpackedSize, 74912)
  assert.equal(pack.entryCount, 6)
  assert.equal(pack.files.length, 6)
  assert.ok(pack.files.some(file => file.path === 'cordis.patch.yml'))
})

test('parseNpmViewVersions treats JSON E404 as unpublished', () => {
  const query = parseNpmViewVersions(
    JSON.stringify({ error: { code: 'E404', summary: 'Not Found' } }),
    'npm error code E404',
    1,
    '0.1.0',
  )
  assert.equal(query.status, 'unpublished')
})

test('parseNpmViewVersions detects occupied and available versions', () => {
  assert.equal(
    parseNpmViewVersions('["0.1.0","0.2.0"]', '["0.1.0","0.2.0"]', 0, '0.1.0').status,
    'occupied',
  )
  assert.equal(
    parseNpmViewVersions('"0.2.0"', '"0.2.0"', 0, '0.1.0').status,
    'available',
  )
})

test('parseScanJson keeps HIGH findings', () => {
  const findings = parseScanJson('[{"rule":"DSH-PKG-003","severity":"HIGH","file":"package.json","line":12,"message":"old train"}]')
  assert.equal(findings.length, 1)
  assert.equal(findings[0].rule, 'DSH-PKG-003')
})

test('inspectClientBundle requires loader, matching id, and module intro', () => {
  assert.equal(inspectClientBundle(GOOD_CLIENT, 'dsh-plugin-deploy').ok, true)
  assert.equal(inspectClientBundle('export const name = "x"', 'dsh-plugin-deploy').ok, false)
  const wrongId = GOOD_CLIENT.replace('dsh-plugin-deploy', 'other-plugin')
  assert.equal(inspectClientBundle(wrongId, 'dsh-plugin-deploy').ok, false)
  const noModule = GOOD_CLIENT.replace('var module = { exports: {} }; var exports = module.exports;', '')
  assert.equal(inspectClientBundle(noModule, 'dsh-plugin-deploy').ok, false)
})

test('forbiddenPackReason flags the listed secret and internal paths', () => {
  assert.equal(forbiddenPackReason('.env.local'), '.env*')
  assert.equal(forbiddenPackReason('.npmrc'), '.npmrc')
  assert.equal(forbiddenPackReason('certs/site.pem'), '*.pem/*.key')
  assert.equal(forbiddenPackReason('node_modules/foo/index.js'), 'node_modules/')
  assert.equal(forbiddenPackReason('.git/config'), '.git/')
  assert.equal(forbiddenPackReason('.dsh-assistant/hooks/x.sh'), '.dsh-assistant/')
  assert.equal(forbiddenPackReason('docs/IMPL-PROMPT.md'), 'IMPL-PROMPT.md')
  assert.equal(forbiddenPackReason('lib/index.js'), undefined)
})

test('isOldDshTrain only matches 0.0.x specs', () => {
  assert.equal(isOldDshTrain('0.0.1'), true)
  assert.equal(isOldDshTrain('^0.0.1'), true)
  assert.equal(isOldDshTrain('0.1.0-rc.7'), false)
  assert.equal(isOldDshTrain('next'), false)
})

test('evaluateChecks passes a compliant plugin', () => {
  const checks = evaluateChecks(baseInput())
  const map = byId(checks)
  assert.equal(checks.length, 8)
  for (const item of checks) assert.equal(item.ok, true, item.id)
  assert.equal(map['version-available'].blocking, false)
  assert.equal(map.scan.detail.includes('已跳过'), true)
})

test('evaluateChecks fails missing patch, dirty pack, workspace deps, and HIGH scan', () => {
  const pack = parseNpmPackJson(PACK_SAMPLE)
  pack.files.push({ path: '.env' }, { path: 'IMPL-PROMPT.md' })
  const checks = evaluateChecks(baseInput({
    pkg: {
      ...GOOD_PKG,
      dsh: { client: { platform: 'web' } },
      dependencies: {
        '@deepseek-ai/dsh-tools': 'workspace:*',
        helper: '1.0.0',
      },
    },
    patchExists: false,
    pack,
    versionQuery: { status: 'occupied', versions: ['0.1.0'] },
    scan: { skipped: false, findings: [{ rule: 'DSH-HOST-001', severity: 'HIGH', message: 'default export' }] },
    mode: 'npm',
  }))
  const map = byId(checks)
  assert.equal(map['dsh-plugin'].ok, false)
  assert.equal(map['patch-in-pack'].ok, false)
  assert.equal(map.deps.ok, false)
  assert.equal(map['pack-clean'].ok, false)
  assert.equal(map['version-available'].ok, false)
  assert.equal(map['version-available'].blocking, true)
  assert.equal(map.scan.ok, false)
})

test('client-bundle is skipped when dsh.client is absent', () => {
  const checks = evaluateChecks(baseInput({
    pkg: { ...GOOD_PKG, dsh: { bundle: { patch: './cordis.patch.yml' } } },
    clientSource: undefined,
  }))
  assert.equal(byId(checks)['client-bundle'].ok, true)
  assert.match(byId(checks)['client-bundle'].detail, /未声明/)
})

test('resolvePublishAccess rejects restricted on unscoped packages', () => {
  assert.equal(resolvePublishAccess('dsh-plugin-deploy', undefined).access, 'public')
  assert.equal(resolvePublishAccess('@acme/plug', undefined).access, 'public')
  assert.equal(resolvePublishAccess('dsh-plugin-deploy', 'restricted').ok, false)
  assert.equal(resolvePublishAccess('@acme/plug', 'restricted').ok, true)
})
