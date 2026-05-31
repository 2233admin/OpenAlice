import { useWorkspace } from '../tabs/store'
import { getFocusedTab, type ViewSpec } from '../tabs/types'
import { SidebarRow } from './SidebarRow'

type DevTab = Extract<ViewSpec, { kind: 'dev' }>['params']['tab']

interface CategoryItem {
  label: string
  tab: DevTab
}

const CATEGORIES: CategoryItem[] = [
  { label: 'Connectors', tab: 'connectors' },
  { label: 'Tools', tab: 'tools' },
  { label: 'Sessions', tab: 'sessions' },
  { label: 'Snapshots', tab: 'snapshots' },
  { label: 'Logs', tab: 'logs' },
  { label: 'Simulator', tab: 'simulator' },
  { label: 'Showcase', tab: 'showcase' },
]

/**
 * Dev sidebar — five sub-pages, click opens (or focuses) the
 * corresponding dev tab. Active highlight is driven by the focused tab's
 * spec.
 */
export function DevCategoryList() {
  const focused = useWorkspace((state) => getFocusedTab(state)?.spec)
  const openOrFocus = useWorkspace((state) => state.openOrFocus)

  return (
    <div className="py-0.5">
      {CATEGORIES.map((item) => {
        const active = focused?.kind === 'dev' && focused.params.tab === item.tab
        return (
          <SidebarRow
            key={item.tab}
            label={item.label}
            active={active}
            onClick={() => openOrFocus({ kind: 'dev', params: { tab: item.tab } })}
          />
        )
      })}
    </div>
  )
}
