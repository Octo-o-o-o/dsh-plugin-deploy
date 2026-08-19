import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseWranglerOutput } from '../lib/index.js'

const created = `
Temporary account ready:
	Account: example-name (created)
	Claim within: 60 minutes
	Claim URL: https://dash.cloudflare.com/claim-preview?claimToken=CLAIM_TOKEN_PLACEHOLDER
Deployed example-worker triggers
https://example-worker.example-name.workers.dev
`

const reused = `
Temporary account ready:
	Account: example-name (reused)
	Claim within: about 1 hour
	Claim URL: https://dash.cloudflare.com/claim-preview?claimToken=CLAIM_TOKEN_PLACEHOLDER
https://example-worker.example-name.workers.dev
`

test('parses created temporary account output', () => {
  const parsed = parseWranglerOutput(created)
  assert.equal(parsed.previewUrl, 'https://example-worker.example-name.workers.dev')
  assert.equal(parsed.temporary?.account, 'example-name')
  assert.equal(parsed.temporary?.reused, false)
  assert.equal(parsed.temporary?.claimWithin, '60 minutes')
  assert.equal(
    parsed.temporary?.claimUrl,
    'https://dash.cloudflare.com/claim-preview?claimToken=CLAIM_TOKEN_PLACEHOLDER',
  )
})

test('parses reused temporary account and non-numeric claim window', () => {
  const parsed = parseWranglerOutput(reused)
  assert.equal(parsed.temporary?.reused, true)
  assert.equal(parsed.temporary?.claimWithin, 'about 1 hour')
  assert.equal(parsed.previewUrl, 'https://example-worker.example-name.workers.dev')
})
