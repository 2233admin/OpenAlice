import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock3, RefreshCw } from 'lucide-react'
import { useWorkspaceSessionDirectory } from '../../hooks/useWorkspaceSessionDirectory'
import { useWorkspace } from '../../tabs/store'
import { Button } from '../ui/button'
import type { SessionRecord } from './api'
import { sessionCoworkerLabel } from './display'

export function SessionBusyPanel({ record, workspaceId, onRefresh }: {
  record: SessionRecord
  workspaceId: string
  onRefresh(): void
}) {
  const { t, i18n } = useTranslation()
  const { directory, loading, error, refresh } = useWorkspaceSessionDirectory(workspaceId)
  const openOrFocus = useWorkspace(s => s.openOrFocus)
  const [refreshing, setRefreshing] = useState(false)
  const entry = directory?.sessions.find(row => row.resumeId === record.resumeId)
  const run = entry?.latestExecution?.status === 'running' ? entry.latestExecution : undefined
  const unknown = t('workspace.sessionBusy.unknown')
  const rows = [
    [t('workspace.sessionBusy.session'), sessionCoworkerLabel(record)],
    [t('workspace.sessionBusy.runtime'), record.agent],
    [t('workspace.sessionBusy.source'), run?.issueId ? `Issue ${run.issueId}` : unknown],
    [t('workspace.sessionBusy.started'), run ? new Date(run.startedAt).toLocaleString(i18n.language) : unknown],
    [t('workspace.sessionBusy.duration'), run ? t('workspace.sessionBusy.seconds', { count: Math.max(0, Math.floor((Date.now() - run.startedAt) / 1000)) }) : unknown],
  ]
  async function check() {
    setRefreshing(true)
    try { await refresh(); onRefresh() } finally { setRefreshing(false) }
  }
  return <div className="flex h-full min-h-0 overflow-y-auto p-6 sm:p-10">
    <section className="m-auto w-full max-w-xl space-y-6" aria-labelledby="session-busy-title">
      <div className="space-y-3">
        <Clock3 className="text-muted-foreground" size={28} aria-hidden />
        <h2 id="session-busy-title" className="text-xl font-semibold">{t('workspace.sessionBusy.title')}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('workspace.sessionBusy.description')}</p>
      </div>
      <dl className="divide-y divide-border border-y border-border text-sm">
        {rows.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
          <dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{value}</dd>
        </div>)}
      </dl>
      {loading && <p role="status" className="text-sm text-muted-foreground">{t('workspace.sessionBusy.loading')}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{t('workspace.sessionBusy.unavailable')}</p>}
      <p className="text-sm leading-relaxed text-muted-foreground">{t('workspace.sessionBusy.next')}</p>
      <div className="flex flex-wrap gap-2">
        {run?.issueId && <Button onClick={() => openOrFocus({ kind: 'issue-detail', params: { wsId: workspaceId, id: run.issueId! } })}>{t('workspace.sessionBusy.issue')}</Button>}
        <Button variant="outline" disabled={refreshing || loading} onClick={() => void check()}>
          <RefreshCw size={16} aria-hidden className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />{t('workspace.sessionBusy.refresh')}
        </Button>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer py-2">{t('workspace.sessionBusy.details')}</summary>
        <p className="break-all py-1">{t('workspace.sessionBusy.identity')}: {record.resumeId}</p>
        <p className="break-all py-1">{t('workspace.sessionBusy.task')}: {run?.taskId ?? unknown}</p>
      </details>
    </section>
  </div>
}
