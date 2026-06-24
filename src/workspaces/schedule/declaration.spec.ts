import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { readScheduleDeclaration } from './declaration.js'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sched-decl-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function writeDecl(content: string): Promise<void> {
  await mkdir(join(dir, '.alice'), { recursive: true })
  await writeFile(join(dir, '.alice', 'schedule.json'), content, 'utf8')
}

describe('readScheduleDeclaration', () => {
  it('reports absent when the file is missing', async () => {
    expect(await readScheduleDeclaration(dir)).toEqual({ ok: false, reason: 'absent' })
  })

  it('reports invalid on malformed JSON', async () => {
    await writeDecl('{ not json')
    const r = await readScheduleDeclaration(dir)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('invalid')
  })

  it('reports invalid on a schema mismatch (unknown when.kind)', async () => {
    await writeDecl(JSON.stringify({ tasks: [{ id: 't1', when: { kind: 'weekly' }, what: 'go' }] }))
    const r = await readScheduleDeclaration(dir)
    expect(r.ok).toBe(false)
  })

  it('reports invalid when a task is missing its prompt', async () => {
    await writeDecl(JSON.stringify({ tasks: [{ id: 't1', when: { kind: 'every', every: '30m' } }] }))
    const r = await readScheduleDeclaration(dir)
    expect(r.ok).toBe(false)
  })

  it('parses a valid declaration', async () => {
    await writeDecl(
      JSON.stringify({
        tasks: [
          { id: 'research', when: { kind: 'every', every: '30m' }, what: 'run research' },
          { id: 'eod', when: { kind: 'cron', cron: '0 16 * * 1-5' }, what: 'summarize', agent: 'codex', enabled: false },
        ],
      }),
    )
    const r = await readScheduleDeclaration(dir)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.tasks).toHaveLength(2)
      expect(r.tasks[0]).toMatchObject({ id: 'research', what: 'run research' })
      expect(r.tasks[1]).toMatchObject({ id: 'eod', agent: 'codex', enabled: false })
    }
  })
})
