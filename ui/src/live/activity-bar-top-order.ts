import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ActivitySection } from '../tabs/types'

/**
 * User-driven reorder of the ActivityBar's top section (the unlabeled
 * pinned-nav block). Linear-style drag-to-reorder.
 *
 * Scope (per 2026-06-08 design): ONLY the top section. Beta + System
 * are intentionally left untouched -- they're a fixed set, and mixing
 * drag with collapse-headers muddies the affordance.
 *
 * Storage model: an ordered array of ActivitySection keys. The array
 * is the source of truth at render time; defaults are baked in via
 * `DEFAULT_TOP_ORDER` and used when the store is empty / corrupted /
 * lacks a key the renderer needs.
 *
 * Why an array, not a Record: order is the whole point of the feature.
 * Records invite "what about missing keys?" debates; arrays + reconcile
 * make the contract explicit.
 *
 * Why a zustand store (vs raw localStorage): consistency with the
 * sibling `useActivityBarCollapse` shape (same directory, same persist
 * key naming). The actual mechanism is irrelevant -- both call into
 * `persist(...)` which talks to localStorage.
 *
 * Schema version: `v1`. On bump, drop stored state (loud-fail beats
 * silent migration, same contract as `useWorkspace`).
 */

// Must match NAV_SECTIONS[0] top-section order in ActivityBar.tsx so a
// fresh user (empty store) sees upstream's intended default — chat first.
const DEFAULT_TOP_ORDER: ActivitySection[] = [
  'chat',
  'inbox',
  'tracked',
  'market',
  'news',
  'workspaces',
]

const STORAGE_KEY = 'openalice.activitybar-top-order.v1'

interface ActivityBarTopOrderState {
  order: ActivitySection[]
}

interface ActivityBarTopOrderActions {
  /** Replace the entire order. Caller is responsible for passing a
   *  reconcile()'d array (full, with no duplicates, no missing keys). */
  setOrder: (next: ActivitySection[]) => void
  /** Reset to defaults. Exposed for tests + a future "Reset layout" menu. */
  reset: () => void
}

export const useActivityBarTopOrder = create<ActivityBarTopOrderState & ActivityBarTopOrderActions>()(
  persist(
    (set) => ({
      order: [...DEFAULT_TOP_ORDER],
      setOrder: (next) => set({ order: next }),
      reset: () => set({ order: [...DEFAULT_TOP_ORDER] }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      // Drop everything on schema bump (loud-fail).
      // No migrate function -- keep it that way unless we ever need a
      // real migration.
    },
  ),
)

/**
 * Reconcile a stored order against the canonical item set.
 *
 * Rules (in order):
 *   1. Stored keys appear first, in stored order.
 *   2. Canonical keys missing from storage are appended, in canonical order.
 *   3. Stored keys not in canonical are dropped.
 *   4. Duplicates are deduped (first occurrence wins).
 *
 * Returns a fresh array -- never mutates inputs. Pure function so it's
 * unit-testable without touching the zustand store / localStorage.
 */
export function reconcileTopOrder(
  stored: readonly ActivitySection[] | null | undefined,
  canonical: readonly ActivitySection[],
): ActivitySection[] {
  const seen = new Set<ActivitySection>()
  const out: ActivitySection[] = []
  const canonicalSet = new Set(canonical)

  if (stored) {
    for (const key of stored) {
      if (!canonicalSet.has(key) || seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
  }
  for (const key of canonical) {
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

/**
 * The default top section order, exported for tests + reset.
 * Same as the first `NAV_SECTIONS[0].items` mapping via
 * `activitySectionFor` -- kept as a literal here so reconcile() and
 * the DnD code path can both reach it without threading the full
 * NAV_SECTIONS constant through props.
 */
export const DEFAULT_ACTIVITYBAR_TOP_ORDER: readonly ActivitySection[] =
  Object.freeze([...DEFAULT_TOP_ORDER])
