import { describe, expect, it } from 'vitest'
import { initial, reduce, plan, runtimePlans, runtimeTargetVersion, releaseSnapshot, type State } from './model'
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

it('upgrades only the older side of a frontend/backend mismatch', () => {
  for (const scenario of ['client-ahead', 'server-ahead'] as const) {
    let s = initial(scenario)
    s = reduce(reduce(s, { type: 'review' }), { type: 'approve' })
    expect(
      s.steps.some((step) =>
        step.startsWith(scenario === 'client-ahead' ? 'client-' : 'backend-'),
      ),
    ).toBe(false)
    const done = until(s, 'done')
    expect(done.phase).toBe('done')
    expect([done.client, done.server]).toEqual(['0.94.2', '0.94.2'])
  }
})
it('reconnects the upgraded backend before updating its managed Chat template', () => {
  let s = initial('chat-follow')
  s = reduce(reduce(s, { type: 'review' }), { type: 'approve' })
  expect(s.steps.indexOf('backend-reconnect')).toBeLessThan(
    s.steps.indexOf('content-apply'),
  )
  const done = until(s, 'done')
  expect(done.workspace).toBe('Chat template 2')
  expect(done.client).toBe('0.94.2')
})
it('updates an outdated Chat template without reinstalling current app/backend', () => {
  let s = initial('chat-stale')
  s = reduce(reduce(s, { type: 'review' }), { type: 'approve' })
  expect(s.steps).toEqual(['content-check', 'content-apply', 'content-verify'])
  expect(until(s, 'done').workspace).toBe('Chat template 2')
})
it('keeps the backend upgrade while busy Chat waits, then applies only its template', () => {
  let s = initial('chat-busy')
  s = reduce(reduce(s, { type: 'review' }), { type: 'approve' })
  s = until(s, 'blocked')
  expect([s.server, s.workspace]).toEqual(['0.94.2', 'Chat template 1'])
  expect(s.connected).toBe(true)
  const done = until(reduce(s, { type: 'release' }), 'done')
  expect(done.workspace).toBe('Chat template 2')
  expect(
    done.log.filter((line) => line === 'backend-install completed'),
  ).toHaveLength(1)
})
it('does not downgrade a newer backend when the selected channel has no matching frontend', () => {
  let s = initial('server-ahead')
  s = reduce(s, { type: 'channel', value: 'beta' })
  s = reduce(reduce(s, { type: 'review' }), { type: 'approve' })
  expect(s.phase).toBe('done')
  expect(s.steps).toEqual([])
  expect(s.server).toBe('0.94.2')
})

it('does not complete activation when a different release starts after handoff', () => {
  let s = until(approved(initial('client')), 'suspended')
  s = reduce({ ...s, client: '0.94.3' }, { type: 'resume' })
  const failed = reduce(s, { type: 'next' })
  expect(failed.phase).toBe('failed')
  expect(failed.clientInstalled).toBe('0.94.2')
  expect(failed.cursor).toBe(s.cursor)
})

it('rehearses an installed stable release with an old beta process through the shared plan', () => {
  let s = initial('pending-activation')
  expect(runtimePlans(s).backend.stages).toEqual(['activate', 'verify', 'reconnect'])
  expect(plan(s)).toEqual(['backend-activate', 'backend-verify', 'backend-reconnect'])
  s = reduce(reduce(s, { type: 'review' }), { type: 'approve' })
  const done = until(s, 'done')
  expect(done.server).toBe('0.94.1')
  expect(done.operations.backend?.completed).toEqual(['activate', 'verify', 'reconnect'])
  expect(done.log.some(line => line.includes('backend-install'))).toBe(false)
})
it('retains stable when the client requests the same-base older beta', () => {
  const s = initial('stable-over-beta')
  expect(runtimePlans(s).backend.target?.version).toBe('0.94.1')
  expect(plan(s)).toEqual([])
})
it('activates the retained installed target when an older client reconnects to a pending upgrade', () => {
  let s = { ...initial('stable-over-beta'), server: '0.94.1-beta.2' }
  expect(runtimeTargetVersion(s, 'backend')).toBe('0.94.1')
  s = reduce(reduce(s, { type: 'review' }), { type: 'approve' })
  const done = until(s, 'done')
  expect(done.server).toBe('0.94.1')
  expect(done.phase).toBe('done')
  expect(done.operations.backend?.completed).toEqual(['activate', 'verify', 'reconnect'])
})
