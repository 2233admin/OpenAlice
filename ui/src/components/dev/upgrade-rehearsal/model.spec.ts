import { describe, expect, it } from 'vitest'
import { initial, reduce, releaseSnapshot, type State } from './model'
function approved(s: State) {
  s = reduce(s, { type: 'publish', value: 'stable' })
  const id = s.publication.records.at(-1)!.id
  for (let i = 0; i < 3; i++) s = reduce(s, { type: 'advance', value: id })
  s = reduce(s, { type: 'discover' })
  return reduce(reduce(s, { type: 'review' }), { type: 'approve' })
}
function until(s: State, phase: State['phase']) {
  for (let i = 0; i < 30 && s.phase !== phase; i++)
    s = reduce(s, { type: s.phase === 'suspended' ? 'resume' : 'next' })
  return s
}
describe('upgrade rehearsal guards and recovery', () => {
  it('blocks backend-ahead plans and freezes approved choices', () => {
    expect(approved(initial('blocked')).phase).toBe('review')
    const s = approved(initial())
    expect(reduce(s, { type: 'channel', value: 'beta' })).toEqual(s)
  })
  it('keeps installed separate from active until restart and resumes the same target', () => {
    let s = approved(initial())
    s = reduce(reduce(s, { type: 'next' }), { type: 'next' })
    expect([s.clientInstalled, s.client]).toEqual(['0.94.2', '0.94.1'])
    s = reduce(s, { type: 'next' })
    expect(s.phase).toBe('suspended')
    expect(until(s, 'done').server).toBe('0.94.2')
  })
  it('retries reconnect without replaying the backend installation', () => {
    const failed = until(approved(initial('reconnect')), 'failed')
    expect(failed.server).toBe('0.94.2')
    expect(failed.connected).toBe(false)
    const done = until(reduce(failed, { type: 'retry' }), 'done')
    expect(done.connected).toBe(true)
    expect(
      done.log.filter((l) => l === 'backend-install completed'),
    ).toHaveLength(1)
  })
  it('waits for idle before modifying workspace content', () => {
    const blocked = until(approved(initial('busy')), 'blocked')
    expect(blocked.workspace).toBe('R1')
    expect(until(reduce(blocked, { type: 'release' }), 'done').workspace).toBe(
      'R2',
    )
  })
  it('retains the complete captured release inventory', () => {
    expect(releaseSnapshot.assets).toHaveLength(73)
    expect(new Set(releaseSnapshot.assets.map((a) => a.name)).size).toBe(73)
  })
})
