import { ChevronRight, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SidebarChildRow, SidebarChildRowButton } from '../SidebarChildRow'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { AgentRuntimeIcon } from '../../lib/agentRuntimeIcon'
import type { HarnessSession } from './harness-sessions'

/** One operational group, with a visible parent/child relationship in every Harness. */
export function RunningSessionGroup({ sessions, onSelect }: {
  sessions: readonly HarnessSession[]
  onSelect(session: HarnessSession): void
}) {
  const { t } = useTranslation()
  if (sessions.length === 0) return null
  const label = t('workspace.sessionBusy.runningCount', { count: sessions.length })
  const focusClass = 'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-ring'
  return <Collapsible>
    <SidebarChildRow active={false} className={focusClass}>
      <CollapsibleTrigger render={<SidebarChildRowButton
        className="group/running text-muted-foreground"
        icon={<LoaderCircle size={14} aria-hidden className="animate-spin [animation-duration:2s] motion-reduce:animate-none" />}
      />}>
        <span className="min-w-0 flex-1 truncate tabular-nums">{label}</span>
        <ChevronRight size={14} aria-hidden className="shrink-0 transition-transform group-data-[panel-open]/running:rotate-90 motion-reduce:transition-none" />
      </CollapsibleTrigger>
    </SidebarChildRow>
    <CollapsibleContent>
      <div className="mb-1 ml-[22px] mr-1.5 max-h-[40dvh] overflow-y-auto overscroll-contain border-l border-sidebar-foreground/15 py-0.5 pl-1"
        role="group" aria-label={label}>
        {sessions.map(row => <SidebarChildRow key={row.resumeId} active={false} className={focusClass}>
          <SidebarChildRowButton onClick={() => onSelect(row)} aria-label={row.title}
            icon={<AgentRuntimeIcon agentId={row.session.agent} className="h-4 w-4" />}>
            <span className="min-w-0 flex-1 truncate" title={row.title}>{row.title}</span>
          </SidebarChildRowButton>
        </SidebarChildRow>)}
      </div>
    </CollapsibleContent>
  </Collapsible>
}
