import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { test } from 'node:test'
import {
  ASSET_IGNORE_PATTERNS,
  generatedConfigPath,
  generatedWranglerConfigBody,
} from '../lib/index.js'

test('generated config path is under tmpdir and outside the project', () => {
  const project = '/tmp/my-static-site'
  const cfg = generatedConfigPath(project)
  assert.equal(cfg.startsWith(join(tmpdir(), 'dsh-plugin-deploy', 'generated')), true)
  assert.equal(dirname(dirname(cfg)).startsWith(project), false)
  assert.notEqual(cfg, join(project, '.dsh-deploy.wrangler.jsonc'))
})

test('generated config body uses an absolute assets.directory', () => {
  const assets = '/tmp/my-static-site'
  const body = generatedWranglerConfigBody('my-static-site', assets, '2026-08-18')
  const parsed = JSON.parse(body)
  assert.equal(parsed.name, 'my-static-site')
  assert.equal(parsed.compatibility_date, '2026-08-18')
  assert.equal(isAbsolute(parsed.assets.directory), true)
  assert.equal(parsed.assets.directory, resolve(assets))
  assert.equal(parsed.assets.directory.includes('.dsh-deploy.wrangler.jsonc'), false)
})

test('ASSET_IGNORE_PATTERNS cover leftover plugin config and wrangler tmp', () => {
  assert.ok(ASSET_IGNORE_PATTERNS.includes('.wrangler'))
  assert.ok(ASSET_IGNORE_PATTERNS.includes('.dsh-deploy.wrangler.jsonc'))
})

test('two projects get distinct generated config paths', () => {
  assert.notEqual(
    generatedConfigPath('/tmp/alpha-app'),
    generatedConfigPath('/tmp/beta-site'),
  )
})
