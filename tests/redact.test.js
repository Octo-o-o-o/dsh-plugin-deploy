import assert from 'node:assert/strict'
import { test } from 'node:test'
import { redactSecrets } from '../lib/index.js'

const SECRET = 'SECRETVALUE_PLACEHOLDER_ABCDEFGHIJKLMNOP'

test('removes extra secret values and token assignment shapes', () => {
  const input = [
    `CLOUDFLARE_API_TOKEN=${SECRET}`,
    `Authorization: Bearer ${SECRET}`,
    `plain ${SECRET} remains only if missed`,
  ].join('\n')
  const output = redactSecrets(input, [SECRET])
  assert.equal(output.includes(SECRET), false)
  assert.match(output, /CLOUDFLARE_API_TOKEN=\*\*\*/)
  assert.match(output, /Bearer \*\*\*/)
})

test('does not strip claim URLs', () => {
  const url = 'https://dash.cloudflare.com/claim-preview?claimToken=CLAIM_TOKEN_PLACEHOLDER'
  const output = redactSecrets(`Claim URL: ${url}`)
  assert.equal(output.includes(url), true)
})

test('redacts extra secrets of length 4 or more', () => {
  const output = redactSecrets('seen abcd in log', ['abcd'])
  assert.equal(output.includes('abcd'), false)
  assert.equal(output.includes('***'), true)
})

test('redacts npm token assignment and npm_ values', () => {
  const token = 'npm_INTERPOLATION_WORKS_PLACEHOLDER'
  const output = redactSecrets(
    [`NPM_TOKEN=${token}`, `DSH_NPM_TOKEN=${token}`, `_authToken=${token}`, token].join('\n'),
  )
  assert.equal(output.includes(token), false)
  assert.match(output, /NPM_TOKEN=\*\*\*/)
  assert.match(output, /npm_\*\*\*/)
})
