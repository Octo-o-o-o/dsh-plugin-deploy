import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { test } from 'node:test'
import {
  ASSET_IGNORE_PATTERNS,
  deriveWorkerName,
  generatedConfigPath,
  hintFromOutput,
  L1_ISOLATED_HOME,
  runDeploy,
} from '../lib/index.js'

const TOKEN = 'cf_token_TESTVALUE_do_not_put_in_argv'

function shellResult(text, exitCode = 0) {
  return {
    exitCode,
    timedOut: false,
    aborted: false,
    stdout: { text },
    stderr: { text: '' },
  }
}

const L1_STDOUT = [
  'Temporary account ready:',
  '\tAccount: preview (created)',
  '\tClaim within: 60 minutes',
  '\tClaim URL: https://dash.cloudflare.com/claim-preview?claimToken=CLAIM_TOKEN_PLACEHOLDER',
  'https://example-worker.preview.workers.dev',
].join('\n')

function createHost(options = {}) {
  const shellCalls = []
  const asked = []
  const counts = { resolve: 0, describe: 0 }
  const host = {
    subprocess: {
      async resolveExecutable() { return 'wrangler' },
    },
    shell: {
      resolve(request) { return request },
      async run(spec) {
        shellCalls.push(spec)
        if (spec.command === 'wrangler --version') return shellResult('wrangler 4.123.0')
        if (spec.command === 'wrangler whoami') {
          return options.authenticated === true
            ? shellResult('authenticated as user@example.com\nAccount Name: Test')
            : shellResult('You are not authenticated', 1)
        }
        if (String(spec.command).includes('wrangler deploy')) {
          return options.deployResult ?? shellResult(L1_STDOUT)
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
      async ask(request) {
        asked.push(request)
        const id = request.questions[0]?.id
        if (id === 'cf-terms') {
          return { answers: [{ id, selected: [options.terms ?? '同意并继续'] }] }
        }
        return { answers: [{ id, selected: [options.projectKind ?? 'cancel'] }] }
      },
    },
    approval: {
      async request() {
        return options.approval ?? 'allowed-once'
      },
    },
  }
  return { host, shellCalls, asked, counts }
}

function deployCalls(shellCalls) {
  return shellCalls.filter(item => String(item.command).includes('wrangler deploy'))
}

async function staticSite(prefix) {
  const dir = await mkdtemp(join(tmpdir(), `${prefix}-`))
  await writeFile(join(dir, 'index.html'), '<html></html>\n')
  return dir
}

async function runOn(host, directory, mode = 'auto') {
  return runDeploy(host, { directory, mode, target: 'cloudflare' }, {
    agent: { session: { header: { cwd: directory } } },
    signal: new AbortController().signal,
  }, {})
}

test('rejecting terms does not run wrangler deploy', async () => {
  const dir = await staticSite('terms-no')
  const { host, shellCalls, asked, counts } = createHost({
    terms: '不同意，中止',
    credentials: 'none',
  })
  const result = await runOn(host, dir)
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /未同意/)
  assert.equal(deployCalls(shellCalls).length, 0)
  assert.equal(counts.resolve, 0)
  assert.ok(shellCalls.every(item => !String(item.command).includes('wrangler deploy')))
  const termsQ = asked.find(item => item.questions[0]?.id === 'cf-terms')?.questions[0]?.question ?? ''
  assert.match(termsQ, /https:\/\/www\.cloudflare\.com\/terms\//)
  assert.match(termsQ, /https:\/\/www\.cloudflare\.com\/privacypolicy\//)
})

test('approval other than allowed-once does not run wrangler deploy or resolve token', async () => {
  const dir = await staticSite('deny-once')
  const { host, shellCalls, counts } = createHost({
    credentials: 'configured',
    approval: 'denied',
  })
  const result = await runOn(host, dir, 'account')
  assert.equal(result.ok, false)
  assert.match(result.error ?? '', /未获批准/)
  assert.equal(deployCalls(shellCalls).length, 0)
  assert.equal(counts.describe, 1)
  assert.equal(counts.resolve, 0)
})

test('L1 env has isolated HOME and an explicit empty token', async () => {
  const dir = await staticSite('l1-home')
  const { host, shellCalls, counts } = createHost({ credentials: 'none' })
  const result = await runOn(host, dir)
  assert.equal(result.ok, true)
  assert.equal(result.mode, 'temporary')
  assert.equal(counts.resolve, 0)
  const deploy = deployCalls(shellCalls)
  assert.equal(deploy.length, 1)
  assert.equal(deploy[0].env?.HOME, L1_ISOLATED_HOME)
  assert.equal(deploy[0].env?.CLOUDFLARE_API_TOKEN, '')
  assert.equal(deploy[0].env?.XDG_CONFIG_HOME, undefined)
  assert.ok(!Object.values(deploy[0].env ?? {}).includes(TOKEN))
})

test('authenticated plus explicit temporary uses isolated HOME and empty token', async () => {
  const dir = await staticSite('l1-auth-temp')
  const { host, shellCalls, counts } = createHost({
    authenticated: true,
    credentials: 'configured',
  })
  const result = await runOn(host, dir, 'temporary')
  assert.equal(result.ok, true)
  assert.equal(result.mode, 'temporary')
  assert.equal(counts.resolve, 0)
  assert.match(result.warnings.join('\n'), /隔离 HOME/)
  const deploy = deployCalls(shellCalls)
  assert.equal(deploy.length, 1)
  assert.match(String(deploy[0].command), /--temporary/)
  assert.equal(deploy[0].env?.HOME, L1_ISOLATED_HOME)
  assert.equal(deploy[0].env?.CLOUDFLARE_API_TOKEN, '')
  assert.equal(deploy[0].env?.XDG_CONFIG_HOME, undefined)
  assert.ok(!Object.values(deploy[0].env ?? {}).includes(TOKEN))
})

test('authenticated auto still selects account and does not isolate HOME', async () => {
  const dir = await staticSite('l2-auth-auto')
  const { host, shellCalls } = createHost({
    authenticated: true,
    credentials: 'none',
    deployResult: shellResult('https://example.workers.dev\n'),
  })
  const result = await runOn(host, dir)
  assert.equal(result.ok, true)
  assert.equal(result.mode, 'account')
  assert.match(result.warnings.join('\n'), /显式指定 mode=temporary/)
  const deploy = deployCalls(shellCalls)
  assert.equal(deploy.length, 1)
  assert.equal(String(deploy[0].command).includes('--temporary'), false)
  assert.equal(deploy[0].env?.HOME, undefined)
  assert.equal(deploy[0].env?.CLOUDFLARE_API_TOKEN, undefined)
})

test('L2 env has token, no HOME, and the command string has no token', async () => {
  const dir = await staticSite('l2-token')
  const { host, shellCalls, counts } = createHost({ credentials: 'configured' })
  const result = await runOn(host, dir)
  assert.equal(result.ok, true)
  assert.equal(result.mode, 'account')
  assert.equal(counts.describe, 1)
  assert.equal(counts.resolve, 1)
  const deploy = deployCalls(shellCalls)
  assert.equal(deploy.length, 1)
  assert.equal(deploy[0].env?.CLOUDFLARE_API_TOKEN, TOKEN)
  assert.equal(deploy[0].env?.HOME, undefined)
  assert.equal(deploy[0].env?.XDG_CONFIG_HOME, undefined)
  assert.equal(String(deploy[0].command).includes(TOKEN), false)
})

test('generated wrangler config is outside the project and not in the assets root', async () => {
  const dir = await staticSite('cfg-out')
  const leftover = join(dir, '.dsh-deploy.wrangler.jsonc')
  await writeFile(leftover, '{"name":"leftover"}\n')
  let snapshot
  const { host } = createHost({ credentials: 'none' })
  const origRun = host.shell.run.bind(host.shell)
  host.shell.run = async (spec) => {
    if (String(spec.command).includes('wrangler deploy')) {
      const match = String(spec.command).match(/--config '([^']+)'/)
      assert.ok(match, `expected --config in ${spec.command}`)
      const cfgPath = match[1]
      assert.equal(existsSync(cfgPath), true)
      assert.equal(cfgPath.startsWith(dir), false)
      assert.equal(cfgPath, generatedConfigPath(dir))
      const body = JSON.parse(readFileSync(cfgPath, 'utf8'))
      assert.equal(isAbsolute(body.assets.directory), true)
      assert.equal(body.assets.directory, dir)
      assert.equal(existsSync(join(dir, '.dsh-deploy.wrangler.jsonc')), true)
      const ignore = readFileSync(join(dir, '.assetsignore'), 'utf8')
      for (const pattern of ASSET_IGNORE_PATTERNS) {
        assert.match(ignore, new RegExp(pattern.replaceAll('.', '\\.')))
      }
      snapshot = { cfgPath, workdir: spec.workdir, ignore }
    }
    return origRun(spec)
  }
  const result = await runOn(host, dir)
  assert.equal(result.ok, true)
  assert.ok(snapshot)
  assert.equal(snapshot.workdir, dirname(snapshot.cfgPath))
  assert.notEqual(snapshot.workdir, dir)
  assert.equal(existsSync(join(dir, '.assetsignore')), false)
  assert.equal(existsSync(snapshot.cfgPath), false)
})

test('runDeploy reports different worker names for two static directories', async () => {
  const dirA = await mkdtemp(join(tmpdir(), 'alpha-app-'))
  const dirB = await mkdtemp(join(tmpdir(), 'beta-site-'))
  await writeFile(join(dirA, 'index.html'), '<html></html>\n')
  await writeFile(join(dirB, 'index.html'), '<html></html>\n')
  const a = createHost({ credentials: 'none' })
  const b = createHost({ credentials: 'none' })
  const resultA = await runOn(a.host, dirA)
  const resultB = await runOn(b.host, dirB)
  assert.equal(resultA.ok, true)
  assert.equal(resultB.ok, true)
  assert.equal(resultA.workerName, deriveWorkerName(dirA))
  assert.equal(resultB.workerName, deriveWorkerName(dirB))
  assert.notEqual(resultA.workerName, resultB.workerName)
})

test('static-dist generated config points assets.directory at dist/', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dist-site-'))
  await mkdir(join(dir, 'dist'))
  await writeFile(join(dir, 'dist', 'index.html'), '<html></html>\n')
  let assetsDir
  const { host } = createHost({ credentials: 'none' })
  const origRun = host.shell.run.bind(host.shell)
  host.shell.run = async (spec) => {
    if (String(spec.command).includes('wrangler deploy')) {
      const match = String(spec.command).match(/--config '([^']+)'/)
      assert.ok(match)
      const body = JSON.parse(readFileSync(match[1], 'utf8'))
      assetsDir = body.assets.directory
    }
    return origRun(spec)
  }
  const result = await runOn(host, dir)
  assert.equal(result.ok, true)
  assert.equal(assetsDir, join(dir, 'dist'))
})

test('existing .assetsignore is restored after deploy', async () => {
  const dir = await staticSite('keep-ignore')
  await writeFile(join(dir, '.assetsignore'), '# keep-me\n')
  const { host } = createHost({ credentials: 'none' })
  const result = await runOn(host, dir)
  assert.equal(result.ok, true)
  assert.equal(readFileSync(join(dir, '.assetsignore'), 'utf8'), '# keep-me\n')
})

test('existing wrangler config name is kept', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'keep-name-'))
  await writeFile(join(dir, 'wrangler.jsonc'), `${JSON.stringify({
    name: 'keep-me',
    compatibility_date: '2026-08-18',
  }, null, 2)}\n`)
  const { host, shellCalls } = createHost({ credentials: 'none' })
  const result = await runOn(host, dir)
  assert.equal(result.ok, true)
  assert.equal(result.workerName, 'keep-me')
  const deploy = deployCalls(shellCalls)
  assert.equal(deploy.length, 1)
  assert.equal(deploy[0].command, 'wrangler deploy --temporary')
})

test('worker project does not precheck the whole repo when assets.directory is set', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'worker-assets-'))
  await mkdir(join(dir, 'public'))
  await writeFile(join(dir, 'public', 'index.html'), '<html></html>\n')
  await mkdir(join(dir, 'coverage'))
  await writeFile(join(dir, 'coverage', 'huge.bin'), Buffer.alloc(6 * 1024 * 1024))
  await writeFile(join(dir, 'wrangler.jsonc'), `${JSON.stringify({
    name: 'only-public',
    compatibility_date: '2026-08-18',
    assets: { directory: './public' },
  }, null, 2)}\n`)
  const { host, shellCalls } = createHost({ credentials: 'none' })
  const result = await runOn(host, dir)
  assert.equal(result.ok, true)
  assert.equal(result.workerName, 'only-public')
  assert.equal(deployCalls(shellCalls).length, 1)
})

test('unclaimed record on disk has no claimUrl', async () => {
  const dir = await staticSite('no-claim')
  const { host } = createHost({ credentials: 'none' })
  const result = await runOn(host, dir)
  assert.equal(result.ok, true)
  const id = createHash('sha256').update(dir).digest('hex').slice(0, 16)
  const raw = JSON.parse(readFileSync(join(tmpdir(), 'dsh-plugin-deploy', `${id}.json`), 'utf8'))
  assert.equal('claimUrl' in raw, false)
  assert.equal(typeof raw.createdAt, 'string')
  assert.equal(raw.previewUrl, result.previewUrl)
  assert.equal(raw.workerName, result.workerName)
})

test('hintFromOutput maps file-count and file-size errors', () => {
  assert.match(hintFromOutput('Error: too many assets uploaded') ?? '', /1000/)
  assert.match(hintFromOutput('This file exceeds the maximum of 5 MiB') ?? '', /5 MiB/)
})

test('hintFromOutput for already-authenticated does not tell the user to logout', () => {
  const hint = hintFromOutput("You're already authenticated with Cloudflare, so --temporary can't be used.")
  assert.match(hint ?? '', /隔离/)
  assert.match(hint ?? '', /不要对本机执行 wrangler logout/)
  assert.doesNotMatch(hint ?? '', /请.*登出/)
})

test('L2 without token surfaces a sandbox/login hint on failure', async () => {
  const dir = await staticSite('l2-login')
  const { host } = createHost({
    authenticated: true,
    credentials: 'none',
    deployResult: shellResult('EPERM: cannot read home config', 1),
  })
  const result = await runOn(host, dir)
  assert.equal(result.ok, false)
  assert.match(result.hint ?? '', /API token/)
  assert.match(result.hint ?? '', /更宽的权限模式/)
})
