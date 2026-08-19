import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const hookStates = []
let hookCursor = 0

function beginRender() {
  hookCursor = 0
}

function resetHookMemory() {
  hookCursor = 0
  hookStates.length = 0
}

const stubs = {
  react: {
    createElement(type, props, ...children) {
      return { type, props: { ...props, children: children.length <= 1 ? children[0] : children } }
    },
    useState(value) {
      const i = hookCursor++
      if (!(i in hookStates)) hookStates[i] = typeof value === 'function' ? value() : value
      return [
        hookStates[i],
        next => {
          hookStates[i] = typeof next === 'function' ? next(hookStates[i]) : next
        },
      ]
    },
  },
  'react/jsx-runtime': {
    jsx(type, props) { return { type, props } },
    jsxs(type, props) { return { type, props } },
    Fragment: 'fragment',
  },
  'react-dom': {},
  'react-dom/client': {},
  '@deepseek-ai/cordis': {},
  '@deepseek-ai/dsh-client-ui-slots': {},
  '@deepseek-ai/dsh-client-web-react': {},
  '@deepseek-ai/dsh-client-ui-primitives': {
    IconChevronDownOutline14(props) { return { type: 'svg', props } },
  },
  '@deepseek-ai/dsh-client-ui-attachment': {},
  '@deepseek-ai/dsh-client-schema-form': {},
  '@deepseek-ai/dsh-client-runtime/client': {},
}

function loadClientExports(extraSandbox = {}) {
  const reg = new Map()
  const sandbox = {
    window: { __ModuleLoader__: { load: ({ id, factory }) => { reg.set(id, factory) } } },
    ...extraSandbox,
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(readFileSync('lib/client.js', 'utf8'), sandbox)
  return {
    exports: [...reg.values()][0](spec => stubs[spec]),
    sandbox,
  }
}

function findNodes(node, pred, acc = []) {
  if (node === null || node === undefined || typeof node !== 'object') return acc
  if (Array.isArray(node)) {
    for (const child of node) findNodes(child, pred, acc)
    return acc
  }
  if (typeof node.type === 'function') return findNodes(node.type(node.props ?? {}), pred, acc)
  if (pred(node)) acc.push(node)
  findNodes(node.props?.children, pred, acc)
  return acc
}

function flattenText(node, acc = []) {
  if (node === null || node === undefined) return acc
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node))
    return acc
  }
  if (Array.isArray(node)) {
    for (const child of node) flattenText(child, acc)
    return acc
  }
  if (typeof node !== 'object') return acc
  if (typeof node.type === 'function') return flattenText(node.type(node.props ?? {}), acc)
  flattenText(node.props?.children, acc)
  if (typeof node.props?.value === 'string') acc.push(node.props.value)
  if (typeof node.props?.placeholder === 'string') acc.push(node.props.placeholder)
  return acc
}

function defaultState(over = {}) {
  return {
    tokenEnv: 'CLOUDFLARE_API_TOKEN',
    tokenEnvDraft: 'CLOUDFLARE_API_TOKEN',
    configured: false,
    writable: true,
    npmTokenEnv: 'NPM_TOKEN',
    npmTokenEnvDraft: 'NPM_TOKEN',
    npmConfigured: false,
    npmWritable: true,
    status: 'ready',
    scopeWritable: true,
    ...over,
  }
}

const { DeploySettingsCard } = loadClientExports().exports

function makeCard(initial = {}) {
  let state = defaultState(initial)
  const calls = []
  const props = {
    useDeployCard: select => select(state),
    setTokenEnvDraft(value) {
      state = { ...state, tokenEnvDraft: value }
    },
    saveTokenEnv: async () => {
      calls.push(['saveTokenEnv', state.tokenEnvDraft])
      state = { ...state, tokenEnv: state.tokenEnvDraft.trim() || 'CLOUDFLARE_API_TOKEN' }
    },
    saveTokenValue: async value => {
      calls.push(['saveTokenValue', value])
    },
    setNpmTokenEnvDraft(value) {
      state = { ...state, npmTokenEnvDraft: value }
    },
    saveNpmTokenEnv: async () => {
      calls.push(['saveNpmTokenEnv', state.npmTokenEnvDraft])
      state = { ...state, npmTokenEnv: state.npmTokenEnvDraft.trim() || 'NPM_TOKEN' }
    },
    saveNpmTokenValue: async value => {
      calls.push(['saveNpmTokenValue', value])
    },
  }
  return {
    calls,
    getState: () => state,
    render() {
      beginRender()
      return DeploySettingsCard(props)
    },
  }
}

function header(tree) {
  return findNodes(tree, node => node.type === 'button' && 'aria-expanded' in (node.props ?? {}))[0]
}

function pendingBadge(tree) {
  return findNodes(tree, node => node.type === 'span' && node.props?.className === 'dpd-pending')[0]
}

function inputById(tree, id) {
  return findNodes(tree, node => node.type === 'input' && node.props?.id === id)[0]
}

function buttonByClass(tree, className) {
  return findNodes(tree, node => node.type === 'button' && node.props?.className === className)[0]
}

test('settings card is an li and starts collapsed', () => {
  resetHookMemory()
  const card = makeCard()
  const tree = card.render()
  assert.equal(tree.type, 'li')
  assert.match(tree.props.className, /\bdpd-card\b/)
  assert.equal(/\bdpd-card-open\b/.test(tree.props.className), false)
  const toggle = header(tree)
  assert.equal(toggle.props['aria-expanded'], false)
  assert.equal(toggle.props['aria-label'], '展开: Cloudflare 部署')
  assert.equal(inputById(tree, 'dpd-api-token-env'), undefined)
  assert.equal(buttonByClass(tree, 'dpd-save'), undefined)
  assert.equal(pendingBadge(tree), undefined)
})

test('settings card expands on header click', () => {
  resetHookMemory()
  const card = makeCard()
  let tree = card.render()
  header(tree).props.onClick()
  tree = card.render()
  assert.match(tree.props.className, /\bdpd-card-open\b/)
  const toggle = header(tree)
  assert.equal(toggle.props['aria-expanded'], true)
  assert.equal(toggle.props['aria-label'], '收起: Cloudflare 部署')
  assert.ok(inputById(tree, 'dpd-api-token-env'))
  assert.ok(inputById(tree, 'dpd-api-token-value'))
  assert.ok(inputById(tree, 'dpd-npm-token-env'))
  assert.ok(inputById(tree, 'dpd-npm-token-value'))
  assert.ok(buttonByClass(tree, 'dpd-save'))
  assert.ok(buttonByClass(tree, 'dpd-discard'))
})

test('unsaved badge appears for a ref draft and stays on the collapsed header', () => {
  resetHookMemory()
  const card = makeCard()
  let tree = card.render()
  header(tree).props.onClick()
  tree = card.render()
  inputById(tree, 'dpd-api-token-env').props.onChange({ target: { value: 'MY_CF_TOKEN' } })
  tree = card.render()
  assert.equal(pendingBadge(tree).props.children, '未保存')
  header(tree).props.onClick()
  tree = card.render()
  assert.equal(header(tree).props['aria-expanded'], false)
  assert.equal(pendingBadge(tree).props.children, '未保存')
  assert.equal(inputById(tree, 'dpd-api-token-env'), undefined)
})

test('unsaved badge appears for a write-only token draft', () => {
  resetHookMemory()
  const card = makeCard()
  let tree = card.render()
  header(tree).props.onClick()
  tree = card.render()
  inputById(tree, 'dpd-api-token-value').props.onChange({ target: { value: 'paste-once' } })
  tree = card.render()
  assert.equal(pendingBadge(tree).props.children, '未保存')
})

test('discard restores ref drafts and clears token drafts', () => {
  resetHookMemory()
  const card = makeCard()
  let tree = card.render()
  header(tree).props.onClick()
  tree = card.render()
  inputById(tree, 'dpd-api-token-env').props.onChange({ target: { value: 'MY_CF_TOKEN' } })
  inputById(tree, 'dpd-api-token-value').props.onChange({ target: { value: 'paste-once' } })
  tree = card.render()
  buttonByClass(tree, 'dpd-discard').props.onClick()
  tree = card.render()
  assert.equal(pendingBadge(tree), undefined)
  assert.equal(inputById(tree, 'dpd-api-token-env').props.value, 'CLOUDFLARE_API_TOKEN')
  assert.equal(inputById(tree, 'dpd-api-token-value').props.value, '')
  assert.deepEqual(card.calls, [])
})

test('save writes the ref name before the token value', async () => {
  resetHookMemory()
  const card = makeCard()
  let tree = card.render()
  header(tree).props.onClick()
  tree = card.render()
  inputById(tree, 'dpd-api-token-env').props.onChange({ target: { value: 'MY_CF_TOKEN' } })
  tree = card.render()
  inputById(tree, 'dpd-api-token-value').props.onChange({ target: { value: 'paste-once' } })
  tree = card.render()
  await buttonByClass(tree, 'dpd-save').props.onClick()
  assert.deepEqual(card.calls, [
    ['saveTokenEnv', 'MY_CF_TOKEN'],
    ['saveTokenValue', 'paste-once'],
  ])
})

test('save writes the token then clears the write-only box', async () => {
  resetHookMemory()
  const card = makeCard()
  let tree = card.render()
  header(tree).props.onClick()
  tree = card.render()
  inputById(tree, 'dpd-api-token-value').props.onChange({ target: { value: 'paste-once' } })
  tree = card.render()
  await buttonByClass(tree, 'dpd-save').props.onClick()
  tree = card.render()
  assert.deepEqual(card.calls, [['saveTokenValue', 'paste-once']])
  assert.equal(inputById(tree, 'dpd-api-token-value').props.value, '')
  assert.equal(pendingBadge(tree), undefined)
})

test('configured credentials never refill a token value', () => {
  resetHookMemory()
  const card = makeCard({ configured: true, npmConfigured: true })
  let tree = card.render()
  header(tree).props.onClick()
  tree = card.render()
  assert.equal(inputById(tree, 'dpd-api-token-value').props.value, '')
  assert.equal(inputById(tree, 'dpd-api-token-value').props.type, 'password')
  assert.equal(inputById(tree, 'dpd-npm-token-value').props.value, '')
  assert.equal(inputById(tree, 'dpd-npm-token-value').props.type, 'password')
  const text = flattenText(tree).join('\n')
  assert.match(text, /已配置/)
  assert.equal(text.includes('sk-'), false)
  assert.equal(text.includes('npm_'), false)
})

test('read-only scope shows a status line and disables ref inputs', () => {
  resetHookMemory()
  const card = makeCard({ scopeWritable: false })
  let tree = card.render()
  header(tree).props.onClick()
  tree = card.render()
  const note = findNodes(tree, node => node.type === 'p' && node.props?.className === 'dpd-readonly')[0]
  assert.equal(note.props.role, 'status')
  assert.equal(inputById(tree, 'dpd-api-token-env').props.disabled, true)
  assert.equal(inputById(tree, 'dpd-npm-token-env').props.disabled, true)
})

test('client factory injects prefixed card css once', () => {
  const styles = []
  const document = {
    querySelector(sel) {
      if (sel !== 'style[data-plugin-css="dsh-plugin-deploy"]') return null
      return styles.find(el => el.dataset.pluginCss === 'dsh-plugin-deploy') ?? null
    },
    createElement() {
      return { dataset: {}, textContent: '' }
    },
    head: {
      appendChild(el) {
        styles.push(el)
        return el
      },
    },
  }
  const loaded = loadClientExports({ document })
  assert.equal(styles.length, 1)
  assert.equal(styles[0].dataset.pluginCss, 'dsh-plugin-deploy')
  const css = styles[0].textContent
  assert.match(css, /\.dpd-card\b/)
  assert.match(css, /\.dpd-header\b/)
  assert.match(css, /--dsw-alias-border-l2/)
  assert.match(css, /--dsw-alias-bg-layer-3/)
  assert.match(css, /--dsw-alias-bg-layer-2/)
  assert.match(css, /--dsw-alias-label-primary/)
  assert.match(css, /--dsw-alias-label-secondary/)
  assert.match(css, /--dsw-alias-label-tertiary/)
  assert.match(css, /--dsw-alias-label-dimmed/)
  assert.match(css, /--dsw-alias-brand-primary/)
  assert.match(css, /--dsw-alias-bg-module-platform/)
  assert.match(css, /--dsw-alias-label-error/)
  assert.equal(loaded.exports.name, 'dsh-plugin-deploy')
  loadClientExports({ document })
  assert.equal(styles.length, 1)
})
