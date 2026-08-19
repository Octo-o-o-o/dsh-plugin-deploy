import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deriveWorkerName } from '../lib/index.js'

test('two different directories yield different worker names', () => {
  const a = deriveWorkerName('/tmp/alpha-app')
  const b = deriveWorkerName('/tmp/beta-site')
  assert.equal(a, 'alpha-app')
  assert.equal(b, 'beta-site')
  assert.notEqual(a, b)
})

test('sanitizes basename and requires a leading letter', () => {
  assert.equal(deriveWorkerName('/proj/My App!!!'), 'my-app')
  assert.equal(deriveWorkerName('/proj/123shop'), 'dsh-123shop')
  assert.equal(deriveWorkerName('/proj/---'), 'dsh-preview')
  assert.equal(deriveWorkerName('/'), 'dsh-preview')
})

test('truncates to 63 characters without a trailing hyphen', () => {
  const long = `aaa-${'b'.repeat(80)}`
  const name = deriveWorkerName(`/proj/${long}`)
  assert.ok(name.length <= 63)
  assert.match(name, /^[a-z][a-z0-9-]*[a-z0-9]$/)
})
