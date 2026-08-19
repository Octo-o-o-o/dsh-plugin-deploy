import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const stubs = {
  react: {
    createElement() { return null },
    useState(value) { return [value, () => {}] },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot() },
  },
  'react/jsx-runtime': {
    jsx() { return null },
    jsxs() { return null },
    Fragment: 'fragment',
  },
  'react-dom': {},
  'react-dom/client': {},
  '@deepseek-ai/cordis': {},
  '@deepseek-ai/dsh-client-ui-slots': {},
  '@deepseek-ai/dsh-client-web-react': {},
  '@deepseek-ai/dsh-client-ui-primitives': {},
  '@deepseek-ai/dsh-client-ui-attachment': {},
  '@deepseek-ai/dsh-client-schema-form': {},
  '@deepseek-ai/dsh-client-runtime/client': {},
}

test('client bundle registers a factory that exports name/inject/apply', () => {
  const reg = new Map()
  const sandbox = {
    window: { __ModuleLoader__: { load: ({ id, factory }) => { reg.set(id, factory) } } },
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(readFileSync('lib/client.js', 'utf8'), sandbox)
  assert.equal(reg.has('dsh-plugin-deploy'), true)
  const exports_ = [...reg.values()][0](spec => stubs[spec])
  assert.equal(typeof exports_.name, 'string')
  assert.equal(exports_.name, 'dsh-plugin-deploy')
  assert.ok(Array.isArray(exports_.inject))
  assert.equal(typeof exports_.apply, 'function')
})
