import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

function controller() {
  let factory
  const sandbox = { window: { __ModuleLoader__: { load: entry => { factory = entry.factory } } } }
  vm.runInNewContext(readFileSync('lib/client.js', 'utf8'), sandbox)
  return factory(() => ({})).DeployCardController
}

function fixture({ accepted = true } = {}) {
  let snapshot = { status: 'ready', writable: true, revision: 1, value: { apiTokenEnv: 'CF_REF', npmTokenEnv: 'NPM_REF' } }
  const listeners = new Set()
  const mutations = []
  const scope = {
    getSnapshot: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    set: async () => accepted,
    async mutate(ops, revision) {
      mutations.push(JSON.parse(JSON.stringify({ ops, revision })))
      if (!accepted || revision !== snapshot.revision) return false
      for (const op of ops) snapshot.value[op.path[0]] = op.value
      snapshot = { ...snapshot, revision: snapshot.revision + 1 }
      for (const fn of listeners) fn()
      return true
    },
  }
  const credentials = {
    describe: async refs => ({ ok: true, value: Object.fromEntries(refs.map(ref => [ref, { configured: false, writable: true }])) }),
    set: async () => ({ ok: false }),
  }
  const Controller = controller()
  const card = new Controller(scope, credentials)
  return { card, credentials, mutations, listeners, update: value => {
    snapshot = { ...snapshot, revision: snapshot.revision + 1, value }
    for (const fn of listeners) fn()
  } }
}

test('reference changes use one revision-guarded Host mutation and the accepted credential target', async () => {
  const f = fixture()
  const actions = f.card.inject()
  actions.setTokenEnvDraft('NEW_CF_REF')
  actions.setNpmTokenEnvDraft('NEW_NPM_REF')
  await actions.saveReferences()
  assert.equal(f.mutations.length, 1)
  assert.equal(f.mutations[0].ops.length, 2)
  assert.equal(f.mutations[0].revision, 1)
  let target
  f.credentials.set = async (ref, value) => { target = [ref, value]; return { ok: true } }
  await actions.saveTokenValue('synthetic-test-value')
  assert.deepEqual(target, ['NEW_CF_REF', 'synthetic-test-value'])
  f.card.dispose()
})

test('Host refusal does not clear unsaved reference changes or hide credential failure', async () => {
  const f = fixture({ accepted: false })
  const actions = f.card.inject()
  actions.setTokenEnvDraft('PENDING_REF')
  await assert.rejects(actions.saveReferences(), /保存被拒绝/)
  assert.equal(f.card.getSnapshot().tokenEnvDraft, 'PENDING_REF')
  await assert.rejects(actions.saveTokenValue('synthetic-test-value'), /凭据保存被拒绝/)
  f.card.dispose()
})

test('external updates preserve the draft and reject stale saves', async () => {
  const f = fixture()
  const actions = f.card.inject()
  actions.setTokenEnvDraft('LOCAL_DRAFT')
  f.update({ apiTokenEnv: 'EXTERNAL_REF', npmTokenEnv: 'NPM_REF' })
  assert.equal(f.card.getSnapshot().tokenEnvDraft, 'LOCAL_DRAFT')
  await assert.rejects(actions.saveReferences(), /设置已变更/)
  f.card.dispose()
})

test('late credential reads cannot overwrite a newer reference or update a disposed controller', async () => {
  const f = fixture()
  const pending = []
  f.credentials.describe = refs => new Promise(resolve => pending.push({ refs, resolve }))
  f.update({ apiTokenEnv: 'OLD_REF', npmTokenEnv: 'NPM_REF' })
  f.update({ apiTokenEnv: 'NEW_REF', npmTokenEnv: 'NPM_REF' })
  pending[1].resolve({ ok: true, value: { NEW_REF: { configured: false } } })
  await Promise.resolve()
  pending[0].resolve({ ok: true, value: { OLD_REF: { configured: true } } })
  await Promise.resolve()
  assert.equal(f.card.getSnapshot().configured, false)
  f.card.dispose()
  assert.equal(f.listeners.size, 0)
})
