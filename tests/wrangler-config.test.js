import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  parseWranglerAssetsDirectory,
  parseWranglerWorkerName,
} from '../lib/index.js'

test('parses name and assets.directory from jsonc', () => {
  const text = `{
    // comment
    "name": "keep-me",
    "assets": { "directory": "./public", },
  }`
  assert.equal(parseWranglerWorkerName(text, 'wrangler.jsonc'), 'keep-me')
  assert.equal(parseWranglerAssetsDirectory(text, 'wrangler.jsonc'), './public')
})

test('parses name and [assets] directory from toml', () => {
  const text = `
name = "from-toml"
compatibility_date = "2026-08-18"

[assets]
directory = "./dist"
`
  assert.equal(parseWranglerWorkerName(text, 'wrangler.toml'), 'from-toml')
  assert.equal(parseWranglerAssetsDirectory(text, 'wrangler.toml'), './dist')
})

test('unparsable config yields undefined (caller must skip precheck)', () => {
  assert.equal(parseWranglerAssetsDirectory('not-valid {', 'wrangler.jsonc'), undefined)
  assert.equal(parseWranglerWorkerName('???', 'wrangler.json'), undefined)
})
