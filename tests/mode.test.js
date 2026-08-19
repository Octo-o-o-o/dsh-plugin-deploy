import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectMode } from '../lib/index.js'

test('authenticated auto selects account (L2)', () => {
  const decision = selectMode({
    requested: 'auto',
    authenticated: true,
    tokenConfigured: false,
    wranglerSupportsTemporary: true,
  })
  assert.equal(decision.ok, true)
  if (decision.ok) {
    assert.equal(decision.mode, 'account')
    assert.match(decision.warnings.join('\n'), /显式指定 mode=temporary/)
    assert.match(decision.warnings.join('\n'), /隔离 HOME/)
    assert.doesNotMatch(decision.warnings.join('\n'), /请.*登出/)
  }
})

test('unauthenticated without token selects temporary (L1)', () => {
  const decision = selectMode({
    requested: 'auto',
    authenticated: false,
    tokenConfigured: false,
    wranglerSupportsTemporary: true,
  })
  assert.equal(decision.ok, true)
  if (decision.ok) {
    assert.equal(decision.mode, 'temporary')
    assert.deepEqual(decision.warnings, [])
  }
})

test('authenticated explicit temporary is allowed', () => {
  const decision = selectMode({
    requested: 'temporary',
    authenticated: true,
    tokenConfigured: false,
    wranglerSupportsTemporary: true,
  })
  assert.equal(decision.ok, true)
  if (decision.ok) {
    assert.equal(decision.mode, 'temporary')
    assert.match(decision.warnings.join('\n'), /隔离 HOME/)
    assert.match(decision.warnings.join('\n'), /无需登出/)
  }
})

test('token configured also counts as L2', () => {
  const decision = selectMode({
    requested: 'auto',
    authenticated: false,
    tokenConfigured: true,
    wranglerSupportsTemporary: true,
  })
  assert.equal(decision.ok, true)
  if (decision.ok) assert.equal(decision.mode, 'account')
})

test('token configured plus explicit temporary is allowed and ignores the token', () => {
  const decision = selectMode({
    requested: 'temporary',
    authenticated: false,
    tokenConfigured: true,
    wranglerSupportsTemporary: true,
  })
  assert.equal(decision.ok, true)
  if (decision.ok) {
    assert.equal(decision.mode, 'temporary')
    assert.match(decision.warnings.join('\n'), /忽略该 token/)
    assert.match(decision.warnings.join('\n'), /CLOUDFLARE_API_TOKEN 设为空/)
  }
})

test('explicit temporary still requires wrangler 4.102.0+', () => {
  const decision = selectMode({
    requested: 'temporary',
    authenticated: true,
    tokenConfigured: false,
    wranglerSupportsTemporary: false,
  })
  assert.equal(decision.ok, false)
  if (!decision.ok) assert.match(decision.error, /低于 4\.102\.0/)
})
