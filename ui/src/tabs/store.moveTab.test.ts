/**
 * Spec for the workspace store's `moveTab` reducer — the logic behind
 * drag-to-reorder in TabStrip.
 *
 * Scope: only the reorder math (arrayMove within the focused group's
 * `tabIds`). The drag interaction itself is owned by @dnd-kit and is not
 * re-tested here — @dnd-kit's PointerSensor / SortableContext are the
 * library's responsibility. `moveTab` is the seam between that library's
 * onDragEnd payload and our state, so it's what's worth pinning down.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspace } from './store'
import type { Tab, WorkspaceState } from './types'

function seed(ids: string[]): void {
  const tabs: Record<string, Tab> = {}
  for (const id of ids) {
    tabs[id] = { id, spec: { kind: 'chat-landing', params: {} } }
  }
  const state: Partial<WorkspaceState> = {
    tabs,
    tree: { kind: 'leaf', group: { id: 'g1', tabIds: [...ids], activeTabId: ids[0] ?? null } },
    focusedGroupId: 'g1',
    selectedSidebar: null,
  }
  useWorkspace.setState(state as WorkspaceState)
}

function order(): string[] {
  const tree = useWorkspace.getState().tree
  return tree.kind === 'leaf' ? tree.group.tabIds : []
}

describe('moveTab', () => {
  beforeEach(() => {
    seed(['a', 'b', 'c', 'd'])
  })

  it('moves a tab forward to the drop target position', () => {
    useWorkspace.getState().moveTab('a', 'c')
    expect(order()).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves a tab backward to the drop target position', () => {
    useWorkspace.getState().moveTab('d', 'b')
    expect(order()).toEqual(['a', 'd', 'b', 'c'])
  })

  it('swaps adjacent tabs', () => {
    useWorkspace.getState().moveTab('a', 'b')
    expect(order()).toEqual(['b', 'a', 'c', 'd'])
  })

  it('is a no-op when active and over are the same', () => {
    useWorkspace.getState().moveTab('b', 'b')
    expect(order()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('is a no-op when the active id is unknown', () => {
    useWorkspace.getState().moveTab('zzz', 'b')
    expect(order()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('is a no-op when the over id is unknown', () => {
    useWorkspace.getState().moveTab('a', 'zzz')
    expect(order()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('does not change the set of tabs, only their order', () => {
    useWorkspace.getState().moveTab('a', 'd')
    expect([...order()].sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})
