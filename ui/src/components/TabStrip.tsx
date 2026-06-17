import { useState, type CSSProperties, type MouseEvent, type WheelEvent } from 'react'
import { X } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useWorkspaces } from '../contexts/WorkspacesContext'
import { useWorkspace } from '../tabs/store'
import { getView } from '../tabs/registry'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'

/**
 * The strip of tab buttons above the main content area. Click to focus,
 * × or middle-click to close, right-click for context menu (close /
 * close others / close to the right / close all / copy URL). Drag a tab
 * sideways to reorder; the new order persists via the workspace store.
 *
 * The strip scrolls horizontally when the row of tabs overflows, but the
 * scrollbar itself is hidden — a thick scrollbar across the full width
 * just to indicate "there's more" steals editor space and looks ugly.
 * Vertical mouse-wheel deltas are translated to horizontal scroll so a
 * regular mouse can still navigate; trackpads pass `deltaX` through
 * naturally.
 *
 * Hidden on mobile (`< md`) — mobile is single-tab mode where the strip
 * would just be noise.
 */
export function TabStrip() {
  const { workspaces } = useWorkspaces()
  const tabIds = useWorkspace((state) =>
    state.tree.kind === 'leaf' ? state.tree.group.tabIds : [],
  )
  const activeTabId = useWorkspace((state) =>
    state.tree.kind === 'leaf' ? state.tree.group.activeTabId : null,
  )
  const tabsMap = useWorkspace((state) => state.tabs)
  const focusTab = useWorkspace((state) => state.focusTab)
  const closeTab = useWorkspace((state) => state.closeTab)
  const moveTab = useWorkspace((state) => state.moveTab)
  const closeOthers = useWorkspace((state) => state.closeOthers)
  const closeToRight = useWorkspace((state) => state.closeToRight)
  const closeToLeft = useWorkspace((state) => state.closeToLeft)
  const closeAll = useWorkspace((state) => state.closeAll)

  const [menu, setMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)

  // PointerSensor with a small activation distance so a plain click still
  // selects/closes — drag only kicks in after the pointer moves 5px.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (tabIds.length === 0) return null

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    // Trackpads emit horizontal deltas natively; only translate the
    // mouse-wheel case (deltaX === 0 && deltaY !== 0). Otherwise let the
    // browser handle the native horizontal scroll.
    if (e.deltaX === 0 && e.deltaY !== 0) {
      e.currentTarget.scrollLeft += e.deltaY
    }
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      moveTab(String(active.id), String(over.id))
    }
  }

  const buildMenuItems = (tabId: string): ContextMenuItem[] => {
    const tab = tabsMap[tabId]
    if (!tab) return []
    const idx = tabIds.indexOf(tabId)
    const onlyOne = tabIds.length === 1
    const view = getView(tab.spec.kind)
    const url = view.toUrl(tab.spec as never)
    return [
      { kind: 'item', label: 'Close', danger: true, onClick: () => closeTab(tabId) },
      {
        kind: 'item',
        label: 'Close Others',
        disabled: onlyOne,
        onClick: () => closeOthers(tabId),
      },
      {
        kind: 'item',
        label: 'Close to the Right',
        disabled: idx === tabIds.length - 1,
        onClick: () => closeToRight(tabId),
      },
      {
        kind: 'item',
        label: 'Close to the Left',
        disabled: idx <= 0,
        onClick: () => closeToLeft(tabId),
      },
      { kind: 'item', label: 'Close All', onClick: () => closeAll() },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Copy URL',
        onClick: () => {
          const fullUrl = window.location.origin + url
          navigator.clipboard.writeText(fullUrl).catch(() => {
            /* clipboard refusal is fine; nothing to surface here */
          })
        },
      },
    ]
  }

  return (
    <>
      <div
        onWheel={handleWheel}
        className="scrollbar-hide hidden md:flex shrink-0 h-10 bg-bg-secondary/95 border-b border-border/80 overflow-x-auto"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
            {tabIds.map((id) => {
              const tab = tabsMap[id]
              if (!tab) return null
              const view = getView(tab.spec.kind)
              const title = view.title(tab.spec as never, { workspaces })
              const isActive = id === activeTabId
              return (
                <TabButton
                  key={id}
                  id={id}
                  title={title}
                  active={isActive}
                  onSelect={() => focusTab(id)}
                  onClose={() => closeTab(id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenu({ tabId: id, x: e.clientX, y: e.clientY })
                  }}
                />
              )
            })}
          </SortableContext>
        </DndContext>
      </div>

      {menu && (
        <ContextMenu
          anchor={{ x: menu.x, y: menu.y }}
          items={buildMenuItems(menu.tabId)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}

interface TabButtonProps {
  id: string
  title: string
  active: boolean
  onSelect: () => void
  onClose: () => void
  onContextMenu: (e: MouseEvent<HTMLDivElement>) => void
}

function TabButton({ id, title, active, onSelect, onClose, onContextMenu }: TabButtonProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Lift the dragged tab above its neighbours and dim it slightly so the
    // drop target reads clearly.
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onAuxClick={(e) => {
        // Middle click closes the tab (matches VS Code / browser convention).
        if (e.button === 1) {
          e.preventDefault()
          onClose()
        }
      }}
      onContextMenu={onContextMenu}
      className={`group flex items-center gap-2 pl-3 pr-2 h-full text-[13px] cursor-pointer border-r border-border/80 transition-colors ${
        active
          ? 'bg-bg-tertiary text-text'
          : 'text-text-muted hover:text-text hover:bg-overlay'
      }`}
    >
      <span className="truncate max-w-[200px]">{title}</span>
      <button
        type="button"
        onPointerDown={(e) => {
          // Keep the drag sensor from claiming the press so the close
          // button stays clickable mid-strip.
          e.stopPropagation()
        }}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="w-4 h-4 rounded flex items-center justify-center text-text-muted/60 hover:text-text hover:bg-overlay-strong"
        aria-label={`Close ${title}`}
      >
        <X size={11} strokeWidth={2.5} />
      </button>
    </div>
  )
}
