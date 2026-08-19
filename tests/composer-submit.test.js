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
    useRef(value) {
      const i = hookCursor++
      if (!(i in hookStates)) hookStates[i] = { current: value }
      return hookStates[i]
    },
    useEffect() {},
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot() },
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
  '@deepseek-ai/dsh-client-ui-primitives': {},
  '@deepseek-ai/dsh-client-ui-attachment': {},
  '@deepseek-ai/dsh-client-schema-form': {},
  '@deepseek-ai/dsh-client-runtime/client': {},
}

function loadClientExports() {
  const reg = new Map()
  const sandbox = {
    window: { __ModuleLoader__: { load: ({ id, factory }) => { reg.set(id, factory) } } },
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(readFileSync('lib/client.js', 'utf8'), sandbox)
  return [...reg.values()][0](spec => stubs[spec])
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

function fakeActions() {
  const calls = []
  return {
    calls,
    actions: {
      setDraft(text) { calls.push(['setDraft', text]) },
      submit() { calls.push(['submit']) },
    },
  }
}

function headerProps(input, actions, extra = {}) {
  return {
    sessionId: 'sessionId' in extra ? extra.sessionId : 'session-1',
    useInput: 'useInput' in extra ? extra.useInput : (select => select(input)),
    inputActions: 'inputActions' in extra ? extra.inputActions : actions,
    useSession: extra.useSession,
  }
}

function renderHeaderAction(input, actions, extra = {}) {
  beginRender()
  return ComposerActionButton(headerProps(input, actions, extra))
}

function findTrigger(tree) {
  return findNodes(tree, node => node.type === 'button' && node.props?.['aria-haspopup'] === 'menu')[0]
}

function findMenuItem(tree, label) {
  return findNodes(tree, node => node.type === 'button' && node.props?.role === 'menuitem' && node.props?.children === label)[0]
}

const client = loadClientExports()
const {
  DEPLOY_PROMPT,
  PUBLISH_CHECK_PROMPT,
  planComposerSubmit,
  runComposerSubmit,
  ComposerActionButton,
  DeployToolView,
  PublishToolView,
  apply,
} = client

test('deploy and publish prompts name the tools and do not hardcode a path', () => {
  assert.equal(DEPLOY_PROMPT, '把当前工作区部署到 Cloudflare（用 deploy 工具）')
  assert.equal(
    PUBLISH_CHECK_PROMPT,
    '检查当前工作区能否作为 dsh 插件发布（用 publish_plugin 工具，mode 用 check）',
  )
  assert.equal(/[/~]/.test(DEPLOY_PROMPT), false)
  assert.equal(/[/~]/.test(PUBLISH_CHECK_PROMPT), false)
})

function assertPlan(plan, expected) {
  assert.equal(plan.action, expected.action)
  if (expected.action === 'submit') assert.equal(plan.text, expected.text)
  if (expected.action === 'refuse') assert.equal(plan.reason, expected.reason)
}

test('empty plain draft plans a submit of the exact prompt', () => {
  const { actions } = fakeActions()
  assertPlan(
    planComposerSubmit(DEPLOY_PROMPT, { draft: '', phase: 'plain' }, actions),
    { action: 'submit', text: DEPLOY_PROMPT },
  )
  assertPlan(
    planComposerSubmit(PUBLISH_CHECK_PROMPT, { draft: '   ', phase: 'plain' }, actions),
    { action: 'submit', text: PUBLISH_CHECK_PROMPT },
  )
})

test('non-empty draft is occupied and is not overwritten', () => {
  const { actions, calls } = fakeActions()
  const plan = planComposerSubmit(
    DEPLOY_PROMPT,
    { draft: '先帮我看一下这个报错', phase: 'plain' },
    actions,
  )
  assertPlan(plan, { action: 'refuse', reason: 'occupied' })
  assertPlan(
    runComposerSubmit(DEPLOY_PROMPT, { draft: '先帮我看一下这个报错', phase: 'plain' }, actions),
    { action: 'refuse', reason: 'occupied' },
  )
  assert.deepEqual(calls, [])
})

test('busy input phases refuse and do not submit', () => {
  const { actions, calls } = fakeActions()
  for (const phase of ['adjudicating', 'submitting', 'claimed']) {
    const plan = runComposerSubmit(DEPLOY_PROMPT, { draft: '', phase }, actions)
    assertPlan(plan, { action: 'refuse', reason: 'busy' })
  }
  assert.deepEqual(calls, [])
})

test('missing session or actions is unavailable', () => {
  const { actions } = fakeActions()
  assertPlan(
    planComposerSubmit(DEPLOY_PROMPT, undefined, actions),
    { action: 'refuse', reason: 'unavailable' },
  )
  assertPlan(
    planComposerSubmit(DEPLOY_PROMPT, { draft: '', phase: 'plain' }, undefined),
    { action: 'refuse', reason: 'unavailable' },
  )
  assertPlan(
    planComposerSubmit(DEPLOY_PROMPT, { draft: '', phase: 'plain', sessionRemoved: true }, actions),
    { action: 'refuse', reason: 'unavailable' },
  )
})

test('draft already equal to the prompt may be submitted again', () => {
  const { actions, calls } = fakeActions()
  const plan = runComposerSubmit(DEPLOY_PROMPT, { draft: DEPLOY_PROMPT, phase: 'plain' }, actions)
  assertPlan(plan, { action: 'submit', text: DEPLOY_PROMPT })
  assert.deepEqual(calls, [['setDraft', DEPLOY_PROMPT], ['submit']])
})

test('ComposerActionButton click writes the deploy prompt and submits', () => {
  resetHookMemory()
  const { actions, calls } = fakeActions()
  let tree = renderHeaderAction({ draft: '', phase: 'plain' }, actions)
  const trigger = findTrigger(tree)
  assert.ok(trigger, 'expected a header trigger button')
  assert.equal(trigger.props.disabled, false)
  trigger.props.onClick()
  tree = renderHeaderAction({ draft: '', phase: 'plain' }, actions)
  const item = findMenuItem(tree, '部署到 Cloudflare')
  assert.ok(item, 'expected the deploy menu item after opening')
  item.props.onClick()
  assert.deepEqual(calls, [['setDraft', DEPLOY_PROMPT], ['submit']])
})

test('ComposerActionButton click writes the publish-check prompt', () => {
  resetHookMemory()
  const { actions, calls } = fakeActions()
  let tree = renderHeaderAction({ draft: '', phase: 'plain' }, actions)
  findTrigger(tree).props.onClick()
  tree = renderHeaderAction({ draft: '', phase: 'plain' }, actions)
  findMenuItem(tree, '检查插件发布').props.onClick()
  assert.deepEqual(calls, [['setDraft', PUBLISH_CHECK_PROMPT], ['submit']])
})

test('ComposerActionButton is disabled when the draft is occupied', () => {
  resetHookMemory()
  const { actions, calls } = fakeActions()
  const tree = renderHeaderAction({ draft: '还没写完的问题', phase: 'plain' }, actions)
  const trigger = findTrigger(tree)
  assert.equal(trigger.props.disabled, true)
  assert.match(trigger.props.title, /覆盖/)
  trigger.props.onClick()
  const open = renderHeaderAction({ draft: '还没写完的问题', phase: 'plain' }, actions)
  assert.equal(findMenuItem(open, '部署到 Cloudflare'), undefined)
  assert.deepEqual(calls, [])
})

test('ComposerActionButton is disabled while the input machine is busy', () => {
  resetHookMemory()
  const { actions, calls } = fakeActions()
  const tree = renderHeaderAction({ draft: '', phase: 'submitting' }, actions)
  const trigger = findTrigger(tree)
  assert.equal(trigger.props.disabled, true)
  assert.match(trigger.props.title, /处理/)
  trigger.props.onClick()
  const open = renderHeaderAction({ draft: '', phase: 'submitting' }, actions)
  assert.equal(findMenuItem(open, '部署到 Cloudflare'), undefined)
  assert.deepEqual(calls, [])
})

test('ComposerActionButton renders nothing without a session', () => {
  resetHookMemory()
  assert.equal(ComposerActionButton({
    useInput: select => select({ draft: '', phase: 'plain' }),
  }), null)
  assert.equal(renderHeaderAction({ draft: '', phase: 'plain' }, undefined, {
    inputActions: undefined,
  }), null)
  assert.equal(renderHeaderAction({ draft: '', phase: 'plain' }, fakeActions().actions, {
    sessionId: undefined,
  }), null)
  assert.equal(renderHeaderAction({ draft: '', phase: 'plain' }, fakeActions().actions, {
    useSession: select => select({ removed: true }),
  }), null)
})

test('apply registers conversation.session.header.actions with id and order', () => {
  const registers = []
  const ctx = {
    get() { return undefined },
    settingsScope: {
      bind() {
        return {
          getSnapshot: () => ({ status: 'unavailable', writable: false }),
          subscribe: () => () => {},
          set: async () => {},
        }
      },
    },
    slots: {
      inject(_name, fn) { fn() },
      register(opts, component) {
        registers.push({ opts, component })
        return () => {}
      },
    },
    effect() {},
  }
  apply(ctx)
  const entry = registers.find(item => item.opts.name === 'conversation.session.header.actions')
  assert.ok(entry, JSON.stringify(registers.map(item => item.opts.name)))
  assert.equal(entry.opts.id, 'dsh-plugin-deploy')
  assert.equal(entry.opts.order, 100)
  assert.equal(entry.component, ComposerActionButton)
  assert.equal(
    registers.some(item => item.opts.name === 'conversation.input.left'),
    false,
  )
})

test('DeployToolView retry writes the deploy prompt', () => {
  const { actions, calls } = fakeActions()
  const tree = DeployToolView({
    toolName: 'deploy',
    block: {
      kind: 'tool-result',
      isError: true,
      content: [{ type: 'text', text: '部署失败' }],
    },
    useInput: () => ({ draft: '', phase: 'plain' }),
    inputActions: actions,
  })
  const button = findNodes(tree, node => node.type === 'button' && node.props?.children === '重新部署')[0]
  assert.ok(button)
  assert.equal(button.props.disabled, false)
  button.props.onClick()
  assert.deepEqual(calls, [['setDraft', DEPLOY_PROMPT], ['submit']])
})

test('PublishToolView retry always uses check mode, not npm', () => {
  const { actions, calls } = fakeActions()
  const tree = PublishToolView({
    toolName: 'publish_plugin',
    block: {
      kind: 'tool-result',
      content: [{ type: 'text', text: 'agent 只写了几句闲话。' }],
    },
    useInput: () => ({ draft: '', phase: 'plain' }),
    inputActions: actions,
  })
  const button = findNodes(tree, node => node.type === 'button' && node.props?.children === '重新校验')[0]
  assert.ok(button)
  button.props.onClick()
  assert.deepEqual(calls, [['setDraft', PUBLISH_CHECK_PROMPT], ['submit']])
  assert.equal(String(calls[0][1]).includes('npm'), false)
})

test('DeployToolView has no retry control when inputActions is absent', () => {
  const tree = DeployToolView({
    toolName: 'deploy',
    block: {
      kind: 'tool-result',
      content: [{ type: 'text', text: '部署失败' }],
      isError: true,
    },
  })
  const buttons = findNodes(tree, node => node.type === 'button')
  assert.equal(buttons.length, 0)
})
