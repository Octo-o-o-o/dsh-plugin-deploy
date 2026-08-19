import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const stubs = {
  react: {
    createElement() { return null },
    useState(value) { return [value, () => {}] },
  },
  'react/jsx-runtime': { jsx() { return null }, jsxs() { return null }, Fragment: 'fragment' },
  '@deepseek-ai/dsh-client-runtime/client': {},
}

const reg = new Map()
const sandbox = { window: { __ModuleLoader__: { load: ({ id, factory }) => { reg.set(id, factory) } } } }
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), sandbox)
const exports_ = [...reg.values()][0](spec => stubs[spec])
if (exports_.name !== 'dsh-plugin-deploy') throw new Error(`unexpected name: ${String(exports_.name)}`)
if (!Array.isArray(exports_.inject)) throw new Error('missing inject')
if (typeof exports_.apply !== 'function') throw new Error('missing apply')
console.log('vm-client: ok', { id: [...reg.keys()][0], name: exports_.name, inject: exports_.inject })
