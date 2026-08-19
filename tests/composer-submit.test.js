import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const stubs = {
  react: {
    createElement(type, props, ...children) {
      return { type, props: { ...props, children: children.length <= 1 ? children[0] : children } }
    },
    useState(value) { return [value, () => {}] },
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
  const { actions, calls } = fakeActions()
  const tree = ComposerActionButton({
    input: { draft: '', phase: 'plain' },
    inputActions: actions,
  })
  const select = findNodes(tree, node => node.type === 'select')[0]
  assert.ok(select, 'expected a select')
  assert.equal(select.props.disabled, false)
  select.props.onChange({
    currentTarget: { value: 'deploy' },
    target: { value: 'deploy' },
  })
  assert.deepEqual(calls, [['setDraft', DEPLOY_PROMPT], ['submit']])
})

test('ComposerActionButton click writes the publish-check prompt', () => {
  const { actions, calls } = fakeActions()
  const tree = ComposerActionButton({
    input: { draft: '', phase: 'plain' },
    inputActions: actions,
  })
  const select = findNodes(tree, node => node.type === 'select')[0]
  select.props.onChange({
    currentTarget: { value: 'publish' },
    target: { value: 'publish' },
  })
  assert.deepEqual(calls, [['setDraft', PUBLISH_CHECK_PROMPT], ['submit']])
})

test('ComposerActionButton is disabled when the draft is occupied', () => {
  const { actions, calls } = fakeActions()
  const tree = ComposerActionButton({
    input: { draft: '还没写完的问题', phase: 'plain' },
    inputActions: actions,
  })
  const select = findNodes(tree, node => node.type === 'select')[0]
  assert.equal(select.props.disabled, true)
  assert.match(select.props.title, /覆盖/)
  select.props.onChange({
    currentTarget: { value: 'deploy' },
    target: { value: 'deploy' },
  })
  assert.deepEqual(calls, [])
})

test('ComposerActionButton is disabled while the input machine is busy', () => {
  const { actions, calls } = fakeActions()
  const tree = ComposerActionButton({
    input: { draft: '', phase: 'submitting' },
    inputActions: actions,
  })
  const select = findNodes(tree, node => node.type === 'select')[0]
  assert.equal(select.props.disabled, true)
  assert.match(select.props.title, /处理/)
  select.props.onChange({
    currentTarget: { value: 'deploy' },
    target: { value: 'deploy' },
  })
  assert.deepEqual(calls, [])
})

test('ComposerActionButton is disabled without inputActions (hero / no session)', () => {
  const tree = ComposerActionButton({
    input: { draft: '', phase: 'plain' },
  })
  const select = findNodes(tree, node => node.type === 'select')[0]
  assert.equal(select.props.disabled, true)
  assert.match(select.props.title, /会话/)
})

test('apply registers conversation.input.left with id and order', () => {
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
  const entry = registers.find(item => item.opts.name === 'conversation.input.left')
  assert.ok(entry, JSON.stringify(registers.map(item => item.opts.name)))
  assert.equal(entry.opts.id, 'dsh-plugin-deploy')
  assert.equal(entry.opts.order, 100)
  assert.equal(entry.component, ComposerActionButton)
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
