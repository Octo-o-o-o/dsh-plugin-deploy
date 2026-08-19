import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import {
  formatDeployText,
  parseDeployText,
  resolveDeployPresentation,
  UNSTRUCTURED_RESULT_NOTICE,
} from '../lib/index.js'

const TEMPORARY_RESULT = {
  ok: true,
  mode: 'temporary',
  previewUrl: 'https://dsh-deploy-testsite.breezy-broom.workers.dev',
  claimUrl: 'https://dash.cloudflare.com/claim-preview?claimToken=PLACEHOLDER_TOKEN',
  claimWithin: '60 minutes',
  workerName: 'dsh-deploy-testsite',
  warnings: [],
}

const UNCLAIMED_WARNING = '此前有一条未认领的临时预览（2026-08-18T14:44:50.077Z）。若不认领，Cloudflare 会删除临时账号及其资源。'

const ACCOUNT_RESULT = {
  ok: true,
  mode: 'account',
  previewUrl: 'https://dsh-deploy-testsite.wyxiao59.workers.dev',
  workerName: 'dsh-deploy-testsite',
  warnings: [],
}

const ACCOUNT_WITH_UNCLAIMED = {
  ...ACCOUNT_RESULT,
  warnings: [UNCLAIMED_WARNING],
}

const FORMATTED_TEMPORARY = formatDeployText(TEMPORARY_RESULT)
const FORMATTED_ACCOUNT = formatDeployText(ACCOUNT_RESULT)
const FORMATTED_ACCOUNT_WITH_UNCLAIMED = formatDeployText(ACCOUNT_WITH_UNCLAIMED)

const NO_MODE_CLUE_TEXT = [
  '访问 URL：https://dsh-deploy-testsite.example.workers.dev',
  'Worker 名：dsh-deploy-testsite',
].join('\n')

const OBSERVED_AGENT_TEXT = [
  '部署完成 ✅',
  '部署结果（deploy 工具，mode=temporary）：',
  '- 状态：ok=true，wrangler 4.112.0 成功上传 1 个静态资源（/index.html，0.39 KiB）',
  '- 预览地址：https://dsh-deploy-testsite.breezy-broom.workers.dev',
  '- 认领链接（60 分钟内有效）：https://dash.cloudflare.com/claim-preview?claimToken=PLACEHOLDER_TOKEN',
  '- Worker：dsh-deploy-testsite，Version ID 0d67021b-a058-47d9-b3c3-0750c5f4f9c8',
].join('\n')

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

function flattenText(node, acc = []) {
  if (node === null || node === undefined || node === false || node === true) return acc
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node))
    return acc
  }
  if (Array.isArray(node)) {
    for (const child of node) flattenText(child, acc)
    return acc
  }
  if (typeof node === 'object') {
    if (typeof node.type === 'function') return flattenText(node.type(node.props ?? {}), acc)
    return flattenText(node.props?.children, acc)
  }
  return acc
}

function collectHrefs(node, acc = []) {
  if (node === null || node === undefined || typeof node !== 'object') return acc
  if (Array.isArray(node)) {
    for (const child of node) collectHrefs(child, acc)
    return acc
  }
  if (typeof node.type === 'function') return collectHrefs(node.type(node.props ?? {}), acc)
  if (node.type === 'a' && typeof node.props?.href === 'string') acc.push(node.props.href)
  collectHrefs(node.props?.children, acc)
  return acc
}

test('parseDeployText reads the real formatDeployText temporary output', () => {
  assert.match(FORMATTED_TEMPORARY, /^临时预览地址已生成/)
  assert.match(FORMATTED_TEMPORARY, /部署模式：temporary/)
  assert.match(FORMATTED_TEMPORARY, /预览 URL：https:\/\/dsh-deploy-testsite\.breezy-broom\.workers\.dev/)
  const parsed = parseDeployText(FORMATTED_TEMPORARY)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.mode, 'temporary')
  assert.equal(parsed.previewUrl, TEMPORARY_RESULT.previewUrl)
  assert.equal(parsed.claimUrl, TEMPORARY_RESULT.claimUrl)
  assert.equal(parsed.claimWithin, '60 minutes')
  assert.equal(parsed.workerName, TEMPORARY_RESULT.workerName)
})

test('parseDeployText reads the real formatDeployText account output', () => {
  assert.match(FORMATTED_ACCOUNT, /^已部署到你的 Cloudflare 账号/)
  assert.match(FORMATTED_ACCOUNT, /部署模式：account/)
  assert.match(FORMATTED_ACCOUNT, /访问 URL：https:\/\/dsh-deploy-testsite\.wyxiao59\.workers\.dev/)
  const parsed = parseDeployText(FORMATTED_ACCOUNT)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.mode, 'account')
  assert.equal(parsed.previewUrl, ACCOUNT_RESULT.previewUrl)
  assert.equal(parsed.claimUrl, undefined)
  assert.equal(parsed.claimWithin, undefined)
  assert.equal(parsed.workerName, ACCOUNT_RESULT.workerName)
})

test('legacy account text without 部署模式 marker stays account when the warning says 临时预览', () => {
  const legacy = [
    '已部署到你的 Cloudflare 账号。',
    '访问 URL：https://dsh-deploy-testsite.wyxiao59.workers.dev',
    'Worker 名：dsh-deploy-testsite',
    '',
    '提醒：',
    `- ${UNCLAIMED_WARNING}`,
  ].join('\n')
  const parsed = parseDeployText(legacy)
  assert.equal(parsed.mode, 'account')
  assert.equal(parsed.previewUrl, ACCOUNT_RESULT.previewUrl)
  assert.deepEqual(parsed.warnings, [UNCLAIMED_WARNING])
})

test('account text with an unclaimed-previous warning is still account, not temporary', () => {
  assert.match(FORMATTED_ACCOUNT_WITH_UNCLAIMED, /部署模式：account/)
  assert.match(FORMATTED_ACCOUNT_WITH_UNCLAIMED, /此前有一条未认领的临时预览/)
  const parsed = parseDeployText(FORMATTED_ACCOUNT_WITH_UNCLAIMED)
  assert.equal(parsed.mode, 'account')
  assert.deepEqual(parsed.warnings, [UNCLAIMED_WARNING])
  const resolved = resolveDeployPresentation({ text: FORMATTED_ACCOUNT_WITH_UNCLAIMED })
  assert.equal(resolved.mode, 'account')
})

test('text without a mode clue does not default to temporary', () => {
  const parsed = parseDeployText(NO_MODE_CLUE_TEXT)
  assert.equal(parsed.mode, undefined)
  assert.equal(parsed.previewUrl, 'https://dsh-deploy-testsite.example.workers.dev')
  const resolved = resolveDeployPresentation({ text: NO_MODE_CLUE_TEXT })
  assert.equal(resolved.mode, undefined)
})

test('resolveDeployPresentation prefers meta when it conflicts with the text', () => {
  const resolved = resolveDeployPresentation({
    meta: {
      ok: true,
      mode: 'account',
      previewUrl: 'https://from-meta.example.workers.dev',
      workerName: 'from-meta',
      warnings: [],
    },
    text: FORMATTED_TEMPORARY,
  })
  assert.equal(resolved.source, 'meta')
  assert.equal(resolved.mode, 'account')
  assert.equal(resolved.previewUrl, 'https://from-meta.example.workers.dev')
  assert.equal(resolved.workerName, 'from-meta')
  assert.equal(resolved.claimUrl, TEMPORARY_RESULT.claimUrl)
  assert.equal(resolved.claimWithin, '60 minutes')
})

test('resolveDeployPresentation stays intact when both sources are empty', () => {
  const raw = 'agent 只写了几句闲话，没有给出链接。'
  const resolved = resolveDeployPresentation({ text: raw })
  assert.equal(resolved.source, 'none')
  assert.equal(resolved.previewUrl, undefined)
  assert.equal(resolved.claimUrl, undefined)
  assert.equal(resolved.rawText, raw)
  assert.equal(resolved.ok, true)
})

test('parseDeployText accepts markdown links and trailing punctuation', () => {
  const text = [
    '预览 URL：[site](https://dsh-deploy-testsite.breezy-broom.workers.dev.)',
    '认领 URL：https://dash.cloudflare.com/claim-preview?claimToken=PLACEHOLDER_TOKEN)。',
  ].join('\n')
  const parsed = parseDeployText(text)
  assert.equal(parsed.previewUrl, TEMPORARY_RESULT.previewUrl)
  assert.equal(parsed.claimUrl, TEMPORARY_RESULT.claimUrl)
})

test('parseDeployText is tolerant of the rewritten agent-style result text', () => {
  const parsed = parseDeployText(OBSERVED_AGENT_TEXT)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.mode, 'temporary')
  assert.equal(parsed.previewUrl, TEMPORARY_RESULT.previewUrl)
  assert.equal(parsed.claimUrl, TEMPORARY_RESULT.claimUrl)
  assert.equal(parsed.claimWithin, '60 分钟内有效')
  assert.equal(parsed.workerName, 'dsh-deploy-testsite')
})

test('DeployToolView renders URLs from formatDeployText when meta is missing', () => {
  const exports_ = loadClientExports()
  const tree = exports_.DeployToolView({
    toolName: 'deploy',
    block: {
      kind: 'tool-result',
      content: [{ type: 'text', text: FORMATTED_TEMPORARY }],
    },
  })
  const hrefs = collectHrefs(tree)
  const text = flattenText(tree).join('\n')
  assert.match(text, /^临时预览地址/)
  assert.match(text, /必须认领，否则会被删除/)
  assert.match(text, /打开认领链接/)
  assert.ok(hrefs.includes(TEMPORARY_RESULT.previewUrl), text)
  assert.ok(hrefs.includes(TEMPORARY_RESULT.claimUrl), text)
  assert.match(text, /60 minutes/)
  assert.match(text, /dsh-deploy-testsite/)
  assert.equal(text.includes(UNSTRUCTURED_RESULT_NOTICE), false)
})

test('DeployToolView account card does not show temporary/claim chrome', () => {
  const exports_ = loadClientExports()
  const tree = exports_.DeployToolView({
    toolName: 'deploy',
    block: {
      kind: 'tool-result',
      content: [{ type: 'text', text: FORMATTED_ACCOUNT }],
    },
  })
  const hrefs = collectHrefs(tree)
  const text = flattenText(tree).join('\n')
  assert.match(text, /^持久 URL/)
  assert.ok(hrefs.includes(ACCOUNT_RESULT.previewUrl), text)
  assert.equal(hrefs.length, 1)
  assert.equal(text.includes('临时预览'), false, text)
  assert.equal(text.includes('必须认领'), false, text)
  assert.equal(text.includes('会删除'), false, text)
  assert.equal(text.includes('未能解析出认领链接'), false, text)
  assert.equal(text.includes('该认领链接会记录在会话日志中'), false, text)
})

test('DeployToolView account card keeps the previous-unclaimed warning', () => {
  const exports_ = loadClientExports()
  const tree = exports_.DeployToolView({
    toolName: 'deploy',
    block: {
      kind: 'tool-result',
      content: [{ type: 'text', text: FORMATTED_ACCOUNT_WITH_UNCLAIMED }],
    },
  })
  const text = flattenText(tree).join('\n')
  assert.match(text, /^持久 URL/)
  assert.match(text, /此前有一条未认领的临时预览（2026-08-18T14:44:50.077Z）/)
  assert.equal(text.includes('必须认领'), false, text)
  assert.equal(text.includes('未能解析出认领链接'), false, text)
  assert.equal(text.includes('该认领链接会记录在会话日志中'), false, text)
  assert.equal(text.includes('这是临时预览，不是正式上线'), false, text)
})

test('DeployToolView without a mode clue uses the neutral title and no claim block', () => {
  const exports_ = loadClientExports()
  const tree = exports_.DeployToolView({
    toolName: 'deploy',
    block: {
      kind: 'tool-result',
      content: [{ type: 'text', text: NO_MODE_CLUE_TEXT }],
    },
  })
  const text = flattenText(tree).join('\n')
  assert.match(text, /^部署完成/)
  assert.equal(text.includes('临时预览'), false, text)
  assert.equal(text.includes('必须认领'), false, text)
  assert.equal(text.includes('会删除'), false, text)
  assert.equal(text.includes('未能解析出认领链接'), false, text)
  assert.ok(collectHrefs(tree).includes('https://dsh-deploy-testsite.example.workers.dev'), text)
})

test('DeployToolView prefers meta.mode=account over temporary-looking text', () => {
  const exports_ = loadClientExports()
  const tree = exports_.DeployToolView({
    toolName: 'deploy',
    block: {
      kind: 'tool-result',
      meta: {
        ok: true,
        mode: 'account',
        previewUrl: ACCOUNT_RESULT.previewUrl,
        workerName: ACCOUNT_RESULT.workerName,
        warnings: [],
      },
      content: [{ type: 'text', text: FORMATTED_TEMPORARY }],
    },
  })
  const text = flattenText(tree).join('\n')
  assert.match(text, /^持久 URL/)
  assert.equal(text.includes('必须认领'), false, text)
})

test('DeployToolView shows unstructured notice and raw text when both sources are empty', () => {
  const raw = '这次调用没有预览地址，也没有认领链接。'
  const exports_ = loadClientExports()
  const tree = exports_.DeployToolView({
    toolName: 'deploy',
    block: {
      kind: 'tool-result',
      content: [{ type: 'text', text: raw }],
    },
  })
  const text = flattenText(tree).join('\n')
  assert.match(text, /本次调用未提供结构化结果/)
  assert.match(text, /这次调用没有预览地址，也没有认领链接。/)
  assert.equal(collectHrefs(tree).length, 0)
})

