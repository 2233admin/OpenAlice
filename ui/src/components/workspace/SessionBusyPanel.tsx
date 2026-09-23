import { useSessionControl } from '../../hooks/useSessionControl'
import { SessionControlPanel } from './SessionControlPanel'
import { useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock3, RefreshCw } from 'lucide-react'
import { useWorkspaceSessionDirectory } from '../../hooks/useWorkspaceSessionDirectory'
import { useWorkspace } from '../../tabs/store'
import { Button } from '../ui/button'
import type { SessionRecord } from './api'
import { sessionCoworkerLabel } from './display'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog'
import { useSessionBusyDialog } from './session-busy-store'
import { isHeadlessOccupying } from './harness-sessions'

function SessionBusyPanel({ record, workspaceId, onClose, onOpen, titleRef }: {
  titleRef: RefObject<HTMLHeadingElement | null>
  record: SessionRecord
  workspaceId: string
  onClose(): void
  onOpen(): void
}) {
  const { t, i18n } = useTranslation()
  const control = useSessionControl(workspaceId, record.id)
  const blocked = Boolean(control.data?.blocks.length)
  const { directory, loading, error, refresh } = useWorkspaceSessionDirectory(workspaceId)
  const openOrFocus = useWorkspace(s => s.openOrFocus)
  const [refreshing, setRefreshing] = useState(false)
  const entry = directory?.sessions.find(row => row.resumeId === record.resumeId)
  const run = entry?.latestExecution
  const ended = Boolean(entry && !entry.active && !error && !loading && !isHeadlessOccupying(record, entry))
  const unknown = t('workspace.sessionBusy.unknown')
  const rows = [
    [t('workspace.sessionBusy.session'), sessionCoworkerLabel(record)],
    [t('workspace.sessionBusy.runtime'), record.agent],
    [t('workspace.sessionBusy.source'), run?.issueId ? `Issue ${run.issueId}` : unknown],
    [t('workspace.sessionBusy.started'), run ? new Date(run.startedAt).toLocaleString(i18n.language) : unknown],
    [t('workspace.sessionBusy.duration'), run ? t('workspace.sessionBusy.seconds', { count: Math.max(0, Math.floor(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000)) }) : unknown],
  ]
  async function check() {
    setRefreshing(true)
    try { await refresh() } finally { setRefreshing(false) }
  }
  return <div className="min-w-0 space-y-5">
      <div className="space-y-3">
        <Clock3 className="text-muted-foreground" size={28} aria-hidden />
        <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none pr-6" aria-live="polite">{t(ended ? 'workspace.sessionBusy.ended' : 'workspace.sessionBusy.title')}</DialogTitle>
        <DialogDescription>{t(blocked ? 'sessionControl.blockedDescription' : ended ? 'workspace.sessionBusy.endedDescription' : 'workspace.sessionBusy.description')}</DialogDescription>
      </div>
      <SessionControlPanel control={control} />
      <dl className="divide-y divide-border border-y border-border text-sm">
        {rows.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
          <dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{value}</dd>
        </div>)}
      </dl>
      {loading && <p role="status" className="text-sm text-muted-foreground">{t('workspace.sessionBusy.loading')}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{t('workspace.sessionBusy.unavailable')}</p>}
      <p className="text-sm leading-relaxed text-muted-foreground">{t(blocked ? 'sessionControl.blockedDescription' : ended ? 'workspace.sessionBusy.endedDescription' : 'workspace.sessionBusy.next')}</p>
      <div className="flex flex-wrap gap-2">
        {ended && !blocked && <Button onClick={onOpen}>{t('workspace.sessionBusy.open')}</Button>}
        {run?.issueId && <Button variant="outline" onClick={() => { onClose(); openOrFocus({ kind: 'issue-detail', params: { wsId: workspaceId, id: run.issueId! } }) }}>{t('workspace.sessionBusy.issue')}</Button>}
        <Button variant="outline" disabled={refreshing || loading} onClick={() => void check()}>
          <RefreshCw size={16} aria-hidden className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />{t('workspace.sessionBusy.refresh')}
        </Button>
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer py-2">{t('workspace.sessionBusy.details')}</summary>
        <p className="break-all py-1">{t('workspace.sessionBusy.identity')}: {record.resumeId}</p>
        <p className="break-all py-1">{t('workspace.sessionBusy.task')}: {run?.taskId ?? unknown}</p>
      </details>
  </div>
}


export function SessionBusyDialogHost() {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const { target, close } = useSessionBusyDialog()
  const openOrFocus = useWorkspace(s => s.openOrFocus)
  const { t } = useTranslation()
  return <Dialog open={target !== null} onOpenChange={open => { if (!open) close() }}>
    <DialogContent initialFocus={titleRef} className="max-h-[85dvh] overflow-y-auto sm:max-w-lg" closeLabel={t('common.close')}>
      {target && <SessionBusyPanel key={`${target.workspaceId}:${target.record.resumeId}`}
        titleRef={titleRef} record={target.record} workspaceId={target.workspaceId} onClose={close}
        onOpen={() => {
          close()
          openOrFocus({ kind: 'workspace', params: { wsId: target.workspaceId, sessionId: target.record.id, source: target.source } })
        }} />}
    </DialogContent>
  </Dialog>
}
