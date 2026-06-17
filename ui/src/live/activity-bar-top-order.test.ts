/**
 * Pure-function specs for `reconcileTopOrder` -- the single source of
 * truth for render order in the draggable top section of the
 * ActivityBar.
 *
 * Why a pure-function spec (and not a DOM/integration spec):
 *   1. The behavior worth pinning down is the *contract* -- how a
 *      stored, possibly corrupted, order from localStorage reconciles
 *      against the canonical set of nav items. That's a pure function
 *      with no React, no DnD, no DOM.
 *   2. Drag interaction itself is owned by @dnd-kit (battle-tested);
 *      re-testing the library's keyboard sensor, sortable strategy,
 *      and pointer activation distance would be wheel-reinvention.
 *   3. These specs run via `pnpm -F open-alice-ui test` (added in the
 *      same commit) and are isolated by the workspace's vitest config
 *      -- no jsdom, no fetch mocks, no `localStorage` shimming.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ACTIVITYBAR_TOP_ORDER,
  reconcileTopOrder,
} from './activity-bar-top-order'
import type { ActivitySection } from '../tabs/types'

// ---- Test fixture: matches what NAV_SECTIONS[0] resolves to in
//      ActivityBar.tsx. Keep in sync with the source-of-truth constant;
//      if it diverges, reconcile() will still produce the correct order,
//      but the spec labels will be misleading.
const CANONICAL: readonly ActivitySection[] = [
  'inbox',
  'tracked',
  'chat',
  'workspaces',
  'market',
  'news',
]

describe('reconcileTopOrder', () => {
  it('falls back to canonical order when stored is null', () => {
    expect(reconcileTopOrder(null, CANONICAL)).toEqual([...CANONICAL])
  })

  it('falls back to canonical order when stored is undefined', () => {
    expect(reconcileTopOrder(undefined, CANONICAL)).toEqual([...CANONICAL])
  })

  it('falls back to canonical order when stored is empty', () => {
    expect(reconcileTopOrder([], CANONICAL)).toEqual([...CANONICAL])
  })

  it('preserves a valid stored order verbatim', () => {
    const stored: ActivitySection[] = ['news', 'market', 'chat', 'inbox', 'tracked', 'workspaces']
    expect(reconcileTopOrder(stored, CANONICAL)).toEqual(stored)
  })

  it('drops stored keys that are not in the canonical set', () => {
    // Simulates a stored order that pre-dates a nav item being removed
    // (or a corrupted localStorage entry with an unknown key).
    const stored = ['news', 'trading-as-git', 'market'] as ActivitySection[]
    const out = reconcileTopOrder(stored, CANONICAL)
    expect(out).toEqual(['news', 'market', 'inbox', 'tracked', 'chat', 'workspaces'])
    expect(out).not.toContain('trading-as-git')
  })

  it('appends canonical keys that are missing from the stored order', () => {
    // Simulates a new nav item being added in code after the user
    // saved their order -- the new item should appear, but the user's
    // existing choices should still lead.
    const stored: ActivitySection[] = ['news', 'inbox']
    const out = reconcileTopOrder(stored, CANONICAL)
    expect(out).toEqual([
      'news',        // stored, user-chosen first
      'inbox',       // stored, user-chosen second
      'tracked',     // canonical, missing from stored -> appended
      'chat',        // canonical, missing -> appended
      'workspaces',
      'market',
    ])
  })

  it('dedupes repeated keys (first occurrence wins)', () => {
    const stored: ActivitySection[] = ['news', 'inbox', 'news', 'market', 'inbox']
    const out = reconcileTopOrder(stored, CANONICAL)
    expect(out).toEqual(['news', 'inbox', 'market', 'tracked', 'chat', 'workspaces'])
  })

  it('drops stored keys that are not in the canonical set (corruption path)', () => {
    // Cast simulates corrupted localStorage (e.g. older schema with a
    // key we no longer render). The function must drop unknown keys
    // without throwing.
    const stored: ActivitySection[] = ['news', 'legacy-chat' as ActivitySection, 'market']
    const out = reconcileTopOrder(stored, CANONICAL)
    expect(out).not.toContain('legacy-chat')
    expect(new Set(out)).toEqual(new Set(CANONICAL))
  })

  it('handles a stored order that is a strict subset of canonical', () => {
    const stored: ActivitySection[] = ['chat']
    const out = reconcileTopOrder(stored, CANONICAL)
    expect(out[0]).toBe('chat')
    // All canonical keys present
    expect(new Set(out)).toEqual(new Set(CANONICAL))
  })

  it('returns a fresh array -- does not mutate the stored input', () => {
    const stored: ActivitySection[] = ['news', 'inbox']
    const snapshot = [...stored]
    reconcileTopOrder(stored, CANONICAL)
    expect(stored).toEqual(snapshot)
  })

  it('returns a fresh array -- does not mutate the canonical input', () => {
    const stored: ActivitySection[] = ['news']
    const canonicalSnapshot = [...CANONICAL]
    reconcileTopOrder(stored, CANONICAL)
    expect(CANONICAL).toEqual(canonicalSnapshot)
  })

  it('produces the same length as the canonical set', () => {
    // Property: reconcile() is a permutation of canonical, never
    // shorter (when canonical is non-empty) and never longer.
    const cases: (ActivitySection[] | null | undefined)[] = [
      null,
      [],
      ['news'],
      ['news', 'inbox', 'bogus' as ActivitySection, 'news', 'bogus' as ActivitySection],
      [...CANONICAL].reverse(),
    ]
    for (const stored of cases) {
      const out = reconcileTopOrder(stored, CANONICAL)
      expect(out).toHaveLength(CANONICAL.length)
    }
  })
})

describe('DEFAULT_ACTIVITYBAR_TOP_ORDER', () => {
  it('matches the canonical top section', () => {
    // Pin to the source-of-truth. If you change NAV_SECTIONS[0] in
    // ActivityBar.tsx, change this too -- they're meant to mirror.
    expect(DEFAULT_ACTIVITYBAR_TOP_ORDER).toEqual([
      'chat',
      'inbox',
      'tracked',
      'market',
      'news',
      'workspaces',
    ])
  })

  it('is frozen -- runtime mutation should throw in strict mode', () => {
    expect(Object.isFrozen(DEFAULT_ACTIVITYBAR_TOP_ORDER)).toBe(true)
  })
})
