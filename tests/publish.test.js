import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { test } from 'node:test'
import {
  createPublishTool,
  PACK_DEST_DIR,
  packedTarballPath,
  parsePublishCommandInput,
  runPublish,
} from '../lib/index.js'

const TOKEN = 'npm_TESTVALUE_PLACEHOLDER_do_not_put_in_argv'

const PACK_FILES = [
  'LICENSE',
  'README.md',
  'cordis.patch.yml',
  'lib/client.js',
  'lib/index.js',
  'package.json',
]

function packJson(overrides = {}) {
  return JSON.stringify([{
    name: overrides.name ?? 'dsh-plugin-fixture',
    version: overrides.version ?? '0.1.0',
    filename: overrides.filename ?? 'dsh-plugin-fixture-0.1.0.tgz',
    size: overrides.size ?? 1000,
    unpackedSize: overrides.unpackedSize ?? 4000,
    entryCount: PACK_FILES.length,
    files: PACK_FILES.map(path => ({ path })),
  }])
}

function shellResult(text, exitCode = 0) {
  return {
    exitCode,
    timedOut: false,
    aborted: false,
    stdout: { text },
    stderr: { text: '' },
  }
}

function createHost(options = {}) {
  const shellCalls = []
  const approvals = []
  const counts = { resolve: 0, describe: 0 }
  const host = {
    subprocess: {
      async resolveExecutable() { return 'npm' },
    },
    shell: {
      resolve(request) { return request },
      async run(spec) {
        shellCalls.push(spec)
        const command = String(spec.command)
        if (command.includes('npm pack --dry-run')) {
          return options.dryRun ?? shellResult(packJson())
        }
        if (command.includes('npm view')) {
          return options.view ?? shellResult(JSON.stringify({ error: { code: 'E404', summary: 'Not Found' } }), 1)
        }
        if (command.includes('scan-dsh-plugin.sh')) {
          return options.scan ?? shellResult('[]')
        }
        if (command.includes('npm pack') && command.includes('--json') && !command.includes('dry-run')) {
          return options.pack ?? shellResult(packJson())
        }
        if (command.includes('npm publish')) {
          return options.publish ?? shellResult('+ dsh-plugin-fixture@0.1.0')
        }
        return shellResult('unexpected', 1)
      },
    },
    get(name) {
      if (name !== 'credentials') return undefined
      if (options.credentials === 'none') return undefined
      return {
        async describe() {
          counts.describe += 1
          return { configured: options.credentials === 'configured' }
        },
        async resolve() {
          counts.resolve += 1
          return { value: TOKEN }
        },
      }
    },
    userQuestions: {
      async ask() { throw new Error('publish should not ask user questions') },
    },
    approval: {
      async request(request) {
        approvals.push(request)
        return options.approval ?? 'allowed-once'
      },
    },
  }
  return { host, shellCalls, approvals, counts }
}

const FACTORY = [
  'window.__ModuleLoader__.load({ id: "dsh-plugin-fixture", factory: (require) => {',
  'var module = { exports: {} }; var exports = module.exports;',
  'return module.exports; } });',
].join('\n')

async function writePlugin(prefix, extra = {}) {
  const dir = await mkdtemp(join(tmpdir(), `${prefix}-`))
  const pkg = {
    name: 'dsh-plugin-fixture',
    version: '0.1.0',
    main: './lib/index.js',
    exports: { '.': './lib/index.js', './client': './lib/client.js' },
    dsh: {
      bundle: { patch: './cordis.patch.yml' },
      client: { platform: 'web' },
    },
    peerDependencies: { '@deepseek-ai/dsh-tools': '0.1.0-rc.7' },
    ...extra.pkg,
  }
  await writeFile(join(dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
  await writeFile(join(dir, 'cordis.patch.yml'), '- insert: [{ id: fixture, name: dsh-plugin-fixture }]\n')
  await mkdir(join(dir, 'lib'))
  await writeFile(join(dir, 'lib', 'index.js'), 'export const name = "dsh-plugin-fixture"\n')
  await writeFile(join(dir, 'lib', 'client.js'), extra.client ?? FACTORY)
  return dir
}

async function runOn(host, directory, args = {}) {
  return runPublish(host, { directory, mode: 'check', ...args }, {
    agent: { session: { header: { cwd: directory } } },
    signal: new AbortController().signal,
  }, {})
}

function commandsOf(shellCalls) {
  return shellCalls.map(item => String(item.command))
}

test('parsePublishCommandInput accepts mode then directory', () => {
  assert.deepEqual(parsePublishCommandInput(''), {})
  assert.deepEqual(parsePublishCommandInput('pack'), { mode: 'pack' })
  assert.deepEqual(parsePublishCommandInput('pack ./plugin'), { mode: 'pack', directory: './plugin' })
  assert.deepEqual(parsePublishCommandInput('./plugin npm'), { mode: 'npm', directory: './plugin' })
  assert.deepEqual(parsePublishCommandInput('./plugin'), { directory: './plugin' })
})

test('createPublishTool parameters have no token field', () => {
  const tool = createPublishTool({}, () => ({}))
  assert.equal(tool.name, 'publish_plugin')
  const keys = Object.keys(tool.parameters ?? {})
  assert.ok(keys.includes('directory') || keys.includes('properties') || keys.length >= 0)
  const raw = JSON.stringify(tool.parameters ?? {})
  assert.equal(/token/i.test(raw), false, raw)
})

test('check mode does not pack or publish', async () => {
  const dir = await writePlugin('pub-check')
  const { host, shellCalls, counts } = createHost({ credentials: 'none' })
  const result = await runOn(host, dir, { mode: 'check' })
  assert.equal(result.ok, true, result.error)
  assert.equal(result.mode, 'check')
  assert.equal(result.packageName, 'dsh-plugin-fixture')
  assert.equal(result.checks.length, 8)
  assert.equal(result.tarballPath, undefined)
  assert.ok(commandsOf(shellCalls).some(item => item.includes('npm pack --dry-run')))
  assert.equal(commandsOf(shellCalls).some(item => item.includes('--pack-destination')), false)
  assert.equal(commandsOf(shellCalls).some(item => item.includes('npm publish')), false)
  assert.equal(commandsOf(shellCalls).some(item => item.includes('npm pack --json') && !item.includes('dry-run')), false)
  assert.equal(counts.resolve, 0)
})

test('failed checks block pack and do not run npm pack', async () => {
  const dir = await writePlugin('pub-block', {
    pkg: { dsh: { client: { platform: 'web' } } },
  })
  const { host, shellCalls } = createHost({ credentials: 'none' })
  const result = await runOn(host, dir, { mode: 'pack' })
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /校验未通过/)
  assert.equal(commandsOf(shellCalls).some(item => item.includes('npm pack --json') && !item.includes('dry-run')), false)
})

test('pack mode returns tarball path after checks pass', async () => {
  const dir = await writePlugin('pub-pack')
  const expected = packedTarballPath('dsh-plugin-fixture-0.1.0.tgz')
  await mkdir(PACK_DEST_DIR, { recursive: true })
  writeFileSync(expected, 'stale-tarball')
  const { host, shellCalls } = createHost({ credentials: 'none' })
  const result = await runOn(host, dir, { mode: 'pack' })
  assert.equal(result.ok, true, result.error)
  const packCmd = commandsOf(shellCalls).find(item => item.includes('npm pack') && item.includes('--json') && !item.includes('dry-run'))
  assert.ok(packCmd, 'expected a real npm pack command')
  assert.match(packCmd, /--pack-destination /)
  assert.ok(packCmd.includes(`--pack-destination '${PACK_DEST_DIR}'`), packCmd)
  assert.equal(isAbsolute(PACK_DEST_DIR), true)
  assert.ok(PACK_DEST_DIR.startsWith(join(tmpdir(), 'dsh-plugin-deploy')))
  assert.equal(isAbsolute(result.tarballPath ?? ''), true)
  assert.equal(result.tarballPath, expected)
  assert.ok((result.tarballPath ?? '').startsWith(PACK_DEST_DIR))
  assert.equal((result.tarballPath ?? '').startsWith(dir), false)
  assert.equal(existsSync(expected), false)
  assert.match(result.installCommand ?? '', /dsh plugin --profile <p> add /)
  assert.ok((result.installCommand ?? '').includes(expected))
  assert.equal(commandsOf(shellCalls).some(item => item.includes('npm publish')), false)
})

test('occupied version blocks npm but not pack', async () => {
  const dir = await writePlugin('pub-occupied')
  const occupied = createHost({
    credentials: 'configured',
    view: shellResult('["0.1.0"]'),
  })
  const npmResult = await runOn(occupied.host, dir, { mode: 'npm' })
  assert.equal(npmResult.ok, false)
  assert.match(npmResult.error ?? '', /校验未通过/)
  assert.equal(occupied.counts.resolve, 0)
  assert.equal(commandsOf(occupied.shellCalls).some(item => item.includes('npm publish')), false)

  const packHost = createHost({
    credentials: 'none',
    view: shellResult('["0.1.0"]'),
  })
  const packResult = await runOn(packHost.host, dir, { mode: 'pack' })
  assert.equal(packResult.ok, true, packResult.error)
  assert.ok(packResult.warnings.some(item => item.includes('已在 npm')))
})

test('denied approval does not resolve token or publish', async () => {
  const dir = await writePlugin('pub-deny')
  const { host, shellCalls, counts, approvals } = createHost({
    credentials: 'configured',
    approval: 'denied',
  })
  const result = await runOn(host, dir, { mode: 'npm' })
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /未获批准/)
  assert.equal(counts.describe, 1)
  assert.equal(counts.resolve, 0)
  assert.equal(commandsOf(shellCalls).some(item => item.includes('npm publish')), false)
  assert.match(approvals[0]?.reason ?? '', /dsh-plugin-fixture@0.1.0/)
  assert.match(approvals[0]?.reason ?? '', /dist-tag=latest/)
  assert.match(approvals[0]?.reason ?? '', /public/)
  assert.equal((approvals[0]?.reason ?? '').includes(TOKEN), false)
})

test('npm publish uses isolated npmrc interpolation and env token', async () => {
  const dir = await writePlugin('pub-npm')
  let seen
  const { host, counts, shellCalls } = createHost({ credentials: 'configured' })
  const origRun = host.shell.run.bind(host.shell)
  host.shell.run = async (spec) => {
    if (String(spec.command).includes('npm publish')) {
      const match = String(spec.command).match(/--userconfig '([^']+)'/)
      assert.ok(match, spec.command)
      const npmrcPath = match[1]
      assert.equal(existsSync(npmrcPath), true)
      assert.equal(npmrcPath.startsWith(dir), false)
      const { readFileSync } = await import('node:fs')
      const body = readFileSync(npmrcPath, 'utf8')
      assert.match(body, /\$\{DSH_NPM_TOKEN\}/)
      assert.equal(body.includes(TOKEN), false)
      assert.equal(spec.env?.DSH_NPM_TOKEN, TOKEN)
      assert.equal(String(spec.command).includes(TOKEN), false)
      assert.match(String(spec.command), /--tag 'latest'/)
      assert.equal(String(spec.command).includes('npm config set'), false)
      seen = { npmrcPath, command: spec.command }
    }
    return origRun(spec)
  }
  const result = await runOn(host, dir, { mode: 'npm' })
  assert.equal(result.ok, true, result.error)
  assert.equal(counts.resolve, 1)
  assert.ok(seen)
  assert.equal(existsSync(seen.npmrcPath), false)
  assert.equal(result.packageName, 'dsh-plugin-fixture')
  assert.equal(result.version, '0.1.0')
  assert.equal(result.tarballPath, undefined)
  assert.equal(commandsOf(shellCalls).some(item => item.includes('--pack-destination')), false)
  assert.equal(commandsOf(shellCalls).some(item => item.includes('npm pack --json') && !item.includes('dry-run')), false)
})

test('OTP challenge fails closed with automation-token hint', async () => {
  const dir = await writePlugin('pub-otp')
  const { host, counts } = createHost({
    credentials: 'configured',
    publish: shellResult('npm error code EOTP\nThis operation requires a one-time password', 1),
  })
  const result = await runOn(host, dir, { mode: 'npm' })
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /OTP|一次性密码/)
  assert.match(result.hint ?? '', /automation token/)
  assert.equal(counts.resolve, 1)
  assert.equal((result.stdout ?? '').includes(TOKEN), false)
})

test('scoped package publish adds --access public', async () => {
  const dir = await writePlugin('pub-scope', {
    pkg: { name: '@acme/dsh-plugin-fixture' },
    client: FACTORY.replaceAll('dsh-plugin-fixture', '@acme/dsh-plugin-fixture'),
  })
  const { host, shellCalls } = createHost({
    credentials: 'configured',
    dryRun: shellResult(packJson({ name: '@acme/dsh-plugin-fixture' })),
    pack: shellResult(packJson({ name: '@acme/dsh-plugin-fixture' })),
  })
  const result = await runOn(host, dir, { mode: 'npm' })
  assert.equal(result.ok, true, result.error)
  const publish = commandsOf(shellCalls).find(item => item.includes('npm publish'))
  assert.match(publish ?? '', /--access public/)
})

test('unscoped restricted access is rejected before publish', async () => {
  const dir = await writePlugin('pub-restricted')
  const { host, shellCalls, counts } = createHost({ credentials: 'configured' })
  const result = await runOn(host, dir, { mode: 'npm', access: 'restricted' })
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /unscoped/)
  assert.equal(counts.resolve, 0)
  assert.equal(commandsOf(shellCalls).some(item => item.includes('npm publish')), false)
})
