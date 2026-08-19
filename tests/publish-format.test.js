import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import {
  formatPublishText,
  parsePublishText,
  resolvePublishPresentation,
  TARBALL_TMP_NOTICE,
  UNSTRUCTURED_PUBLISH_NOTICE,
} from '../lib/index.js'

const CHECK_RESULT = {
  ok: true,
  mode: 'check',
  packageName: 'dsh-plugin-deploy',
  version: '0.1.0',
  tag: 'latest',
  access: 'public',
  fileCount: 6,
  packedSize: 21788,
  unpackedSize: 74912,
  checks: [
    { id: 'dsh-plugin', ok: true, detail: 'dsh.bundle.patch 指向 ./cordis.patch.yml，文件存在。', blocking: true },
    { id: 'version-available', ok: false, detail: 'dsh-plugin-deploy@0.1.0 已在 npm 上。', blocking: false },
  ],
  warnings: ['dsh-plugin-deploy@0.1.0 已在 npm 上，mode=npm 会被拒绝。'],
}

const PACK_RESULT = {
  ...CHECK_RESULT,
  mode: 'pack',
  tarballPath: '/tmp/dsh-plugin-deploy-0.1.0.tgz',
  installCommand: 'dsh plugin --profile <p> add /tmp/dsh-plugin-deploy-0.1.0.tgz',
  checks: CHECK_RESULT.checks.map(item => item.id === 'version-available'
    ? item
    : { ...item, ok: true }),
}

const NPM_RESULT = {
  ok: true,
  mode: 'npm',
  packageName: 'dsh-plugin-deploy',
  version: '0.1.0',
  tag: 'latest',
  access: 'public',
  installCommand: 'dsh plugin --profile <p> add dsh-plugin-deploy',
  fileCount: 6,
  packedSize: 21788,
  unpackedSize: 74912,
  checks: [
    { id: 'dsh-plugin', ok: true, detail: 'ok', blocking: true },
  ],
  warnings: [],
}

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

test('parsePublishText reads formatPublishText check output', () => {
  const text = formatPublishText(CHECK_RESULT)
  assert.match(text, /^校验完成/)
  assert.match(text, /发布模式：check/)
  const parsed = parsePublishText(text)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.mode, 'check')
  assert.equal(parsed.packageName, 'dsh-plugin-deploy')
  assert.equal(parsed.version, '0.1.0')
  assert.equal(parsed.fileCount, 6)
  assert.equal(parsed.packedSize, 21788)
  assert.equal(parsed.checks.length, 2)
  assert.equal(parsed.checks[1].ok, false)
  assert.equal(parsed.checks[1].blocking, false)
  assert.deepEqual(parsed.warnings, CHECK_RESULT.warnings)
})

test('parsePublishText reads pack and npm success text', () => {
  const packText = formatPublishText(PACK_RESULT)
  assert.match(packText, new RegExp(TARBALL_TMP_NOTICE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  const packed = parsePublishText(packText)
  assert.equal(packed.mode, 'pack')
  assert.equal(packed.tarballPath, PACK_RESULT.tarballPath)
  assert.match(packed.installCommand ?? '', /dsh plugin --profile <p> add /)
  const published = parsePublishText(formatPublishText(NPM_RESULT))
  assert.equal(published.mode, 'npm')
  assert.equal(published.ok, true)
  assert.equal(published.installCommand, NPM_RESULT.installCommand)
})

test('resolvePublishPresentation prefers meta over text', () => {
  const resolved = resolvePublishPresentation({
    meta: {
      ok: true,
      mode: 'pack',
      packageName: 'from-meta',
      version: '9.9.9',
      tarballPath: '/tmp/from-meta.tgz',
      checks: [],
      warnings: [],
    },
    text: formatPublishText(CHECK_RESULT),
  })
  assert.equal(resolved.source, 'meta')
  assert.equal(resolved.mode, 'pack')
  assert.equal(resolved.packageName, 'from-meta')
  assert.equal(resolved.tarballPath, '/tmp/from-meta.tgz')
  assert.equal(resolved.version, '9.9.9')
})

test('PublishToolView renders checks from formatPublishText when meta is missing', () => {
  const exports_ = loadClientExports()
  const tree = exports_.PublishToolView({
    toolName: 'publish_plugin',
    block: {
      kind: 'tool-result',
      content: [{ type: 'text', text: formatPublishText(PACK_RESULT) }],
    },
  })
  const text = flattenText(tree).join('\n')
  assert.match(text, /^打包完成/)
  assert.match(text, /dsh-plugin-deploy@0.1.0/)
  assert.match(text, /6 个文件/)
  assert.match(text, /tarball：/)
  assert.match(text, /tarball 放在临时目录/)
  assert.match(text, /dsh-plugin/)
  assert.equal(text.includes(UNSTRUCTURED_PUBLISH_NOTICE), false)
})

test('PublishToolView shows unstructured notice when both sources are empty', () => {
  const exports_ = loadClientExports()
  const tree = exports_.PublishToolView({
    toolName: 'publish_plugin',
    block: {
      kind: 'tool-result',
      content: [{ type: 'text', text: 'agent 只写了几句闲话。' }],
    },
  })
  const text = flattenText(tree).join('\n')
  assert.match(text, /本次调用未提供结构化结果/)
})
