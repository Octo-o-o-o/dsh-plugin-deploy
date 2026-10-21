import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

test('release scan ignores private notes but always checks tracked files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deploy-scan-scope-'))
  try {
    execFileSync('git', ['init', '-q', directory])
    await writeFile(join(directory, '.gitignore'), 'private.md\n')
    await writeFile(join(directory, 'private.md'), ['', 'Users', 'fixture', 'project'].join('/'))
    const scanner = resolve('.dsh-assistant/hooks/lib/scan-dsh-plugin.sh').replaceAll('\\', '/')
    const scan = () => spawnSync('bash', [scanner, '--all', directory.replaceAll('\\', '/')], { encoding: 'utf8' })
    assert.equal(scan().status, 0)
    execFileSync('git', ['-C', directory, 'add', '-f', 'private.md'])
    const tracked = scan()
    assert.equal(tracked.status, 2)
    assert.match(tracked.stdout, /DSH-SEC-001/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
