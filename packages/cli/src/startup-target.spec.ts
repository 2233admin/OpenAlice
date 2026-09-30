import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { readStartupTarget, writeStartupTarget } from './startup-target.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })

async function root(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'openalice-startup-'))
  roots.push(path)
  return path
}

describe('client startup target', () => {
  it('distinguishes an unset preference from a saved Machine/AliceProject pair', async () => {
    const supervisorRoot = await root()
    expect(await readStartupTarget({ supervisorRoot })).toBeNull()
    await writeStartupTarget({ machine: 'cloud', project: 'research' }, { supervisorRoot })
    expect(await readStartupTarget({ supervisorRoot })).toEqual({ machine: 'cloud', project: 'research' })
    const stored = JSON.parse(await readFile(join(supervisorRoot, 'startup-target.json'), 'utf8'))
    expect(stored).toEqual({ schemaVersion: 1, target: { machine: 'cloud', project: 'research' } })
  })

  it('fails closed on malformed state and does not replace it during a read', async () => {
    const supervisorRoot = await root()
    const path = join(supervisorRoot, 'startup-target.json')
    await writeFile(path, '{broken', 'utf8')
    await expect(readStartupTarget({ supervisorRoot })).rejects.toThrow(/not JSON/)
    expect(await readFile(path, 'utf8')).toBe('{broken')
  })

  it('rejects invalid keys without changing the saved preference', async () => {
    const supervisorRoot = await root()
    await writeStartupTarget({ machine: 'local', project: 'default' }, { supervisorRoot })
    await expect(writeStartupTarget({ machine: '../other', project: 'default' }, { supervisorRoot })).rejects.toThrow(/Choose a registered/)
    expect(await readStartupTarget({ supervisorRoot })).toEqual({ machine: 'local', project: 'default' })
  })
})
