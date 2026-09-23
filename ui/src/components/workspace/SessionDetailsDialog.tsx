import { useRef } from 'react'
import { useSessionControl } from '../../hooks/useSessionControl'
import { SessionControlPanel } from './SessionControlPanel'
import { useSessionDetailsDialog } from './session-details-store'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import { useSessionDetails } from '../../hooks/useSessionDetails'
import { useWorkspace } from '../../tabs/store'
import { sessionCoworkerLabel } from './display'
import type { SessionRecord } from './api'

export function SessionDetailsDialog({ record, onClose }: { record: SessionRecord; onClose(): void }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const { t, i18n } = useTranslation()
  const control = useSessionControl(record.wsId, record.id)
  const data = useSessionDetails(record.wsId, record.id, record.resumeId)
  const openOrFocus = useWorkspace(state => state.openOrFocus)
  const text = (key: 'title' | 'unknown' | 'state' | 'workspace' | 'runtime' | 'surface' | 'created' | 'started' | 'ended' | 'active' | 'provider' | 'credential' | 'model' | 'effort' | 'createdBy' | 'running' | 'issues' | 'none' | 'history' | 'noHistory' | 'partial' | 'source' | 'reason' | 'identifiers') => t(`workspace.sessionDetails.${key}`)
  const unknown = text('unknown')
  const date = (value?: string | number | null) => {
    if (value === undefined || value === null || value === '') return unknown
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? unknown : parsed.toLocaleString(i18n.language)
  }
  const last = data.executions[0]
  const fallback = data.entry?.latestExecution
  const live = last ? ['starting', 'running', 'stopping'].includes(last.phase) : record.state === 'running'
  const config = data.entry?.runtime ?? record.runtime
  const rows = [
    [text('state'), last?.phase ?? record.state],
    [text('workspace'), record.wsId],
    [text('runtime'), record.agent],
    [text('surface'), last?.surface ?? record.surface ?? unknown],
    [text('created'), date(record.createdAt)],
    [text('started'), date(last ? last.startedAt : fallback?.startedAt ?? record.startedAt)],
    [text('ended'), live ? text('running') : date(last ? last.finishedAt : fallback?.finishedAt)],
    [text('active'), date(data.entry?.interactive?.lastActiveAt ?? record.lastActiveAt)],
    [text('provider'), config?.credentialSource ?? last?.configuration.credentialSource ?? unknown],
    [text('credential'), (config ? config.credentialSlug : last?.configuration.credentialSlug) ?? unknown],
    [text('model'), (config ? config.model : last?.configuration.model) ?? unknown],
    [text('effort'), (config ? config.reasoningEffort : last?.configuration.effort) ?? unknown],
    [text('createdBy'), data.entry?.createdBy?.kind === 'issue' ? `Issue ${data.entry.createdBy.workspaceId}/${data.entry.createdBy.issueId}` : data.entry?.createdBy?.kind ?? unknown],
  ]
  const boundIssues = data.issues?.workspaces.flatMap(ws => ws.issues.filter(issue => issue.assignee === `@${record.resumeId}`).map(issue => ({ wsId: ws.wsId, issue }))) ?? []
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent initialFocus={titleRef} className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl" closeLabel={t('common.close')}>
      <DialogHeader><DialogTitle ref={titleRef} tabIndex={-1} className="outline-none pr-6">{text('title')}</DialogTitle><DialogDescription>{sessionCoworkerLabel(record)}</DialogDescription></DialogHeader>
      {data.loading && <p role="status" className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {data.errors.length > 0 && <p role="alert" className="text-sm text-destructive">{text('partial')}</p>}
      <SessionControlPanel control={control} />
      <dl className="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        {rows.map(([label, value]) => <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{value}</dd></div>)}
      </dl>
      <section className="space-y-2 border-t border-border pt-4"><h3 className="text-sm font-semibold">{text('issues')}</h3>
        {!data.loading && boundIssues.length === 0 && <p className="text-sm text-muted-foreground">{data.issues ? text('none') : unknown}</p>}
        {boundIssues.map(({ wsId, issue }) => <Button key={`${wsId}:${issue.id}`} variant="outline" className="h-auto max-w-full justify-start whitespace-normal text-left" onClick={() => { onClose(); openOrFocus({ kind: 'issue-detail', params: { wsId, id: issue.id } }) }}>{issue.title} · {issue.status}</Button>)}
      </section>
      <section className="space-y-3 border-t border-border pt-4"><h3 className="text-sm font-semibold">{text('history')}</h3>
        {!data.loading && data.executions.length === 0 && <p className="text-sm text-muted-foreground">{text('noHistory')}</p>}
        {data.executions.map(run => <details key={run.executionId} className="rounded-md border border-border p-3 text-sm">
          <summary className="cursor-pointer break-words">{date(run.startedAt ?? run.requestedAt)} · {run.phase} · {run.origin.kind}</summary>
          <dl className="mt-3 space-y-2 break-words">
            <div>{text('source')}: {run.origin.entry}</div>
            <div>{text('started')}: {date(run.startedAt)}</div><div>{text('ended')}: {date(run.finishedAt)}</div>
            <div>{text('reason')}: {run.reason ?? run.activity ?? unknown}</div>
            {run.origin.issueId && <Button variant="link" onClick={() => { onClose(); openOrFocus({ kind: 'issue-detail', params: { wsId: run.origin.workspaceId ?? record.wsId, id: run.origin.issueId! } }) }}>Issue {run.origin.issueId}</Button>}
            <div className="break-all font-mono text-xs">{run.executionId}{run.pid ? ` · PID ${run.pid}` : ''}</div>
          </dl>
        </details>)}
      </section>
      <details className="border-t border-border pt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">{text('identifiers')}</summary><p className="mt-2 break-all">Session: {record.id}</p><p className="break-all">Resume: {record.resumeId}</p></details>
      <Button variant="outline" disabled={data.loading} onClick={data.refresh}>{t('workspace.sessionBusy.refresh')}</Button>
    </DialogContent>
  </Dialog>
}


export function SessionDetailsDialogHost() {
  const { record, close } = useSessionDetailsDialog()
  return record ? <SessionDetailsDialog key={`${record.wsId}:${record.id}`} record={record} onClose={close} /> : null
}
