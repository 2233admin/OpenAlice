import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, UserRound } from 'lucide-react'
import { issuesApi } from '../api/issues'
import { useIssueDetail } from '../hooks/useIssueDetail'
import { useWorkspaceSessionDirectory } from '../hooks/useWorkspaceSessionDirectory'
import { useWorkspaces } from '../contexts/workspaces-context'
import { AssigneeEditor } from './IssueAssigneeEditor'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

export function IssueAssigneePopover({ wsId, id }: { wsId: string; id: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={t('issues.detail.assignee')} title={t('issues.detail.assignee')} className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <UserRound size={16} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        {open && <AssigneeContent wsId={wsId} id={id} />}
      </PopoverContent>
    </Popover>
  )
}

function AssigneeContent({ wsId, id }: { wsId: string; id: string }) {
  const { t } = useTranslation()
  const { data, error, mutate } = useIssueDetail(wsId, id)
  const { directory, loading, error: directoryError } = useWorkspaceSessionDirectory(wsId)
  const { openHeadlessRun } = useWorkspaces()
  const [actionError, setActionError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  if (!data) return <p className="p-4 text-sm text-muted-foreground" role={error ? 'alert' : 'status'}>{error || t('common.loading')}</p>
  const owner = data.assigneeSession
  const concrete = data.issue.assignee.startsWith('@resume-')
  const ready = concrete && owner?.state === 'ready' && owner.workspace
  const policy = data.issue.assignee === '@new-each-run' ? t('issues.detail.assigneeEachDescription')
    : data.issue.assignee === '@new-then-resume' ? t('issues.detail.assigneeNewDescription')
    : data.issue.assignee === '@human' ? t('issues.detail.assigneeHumanDescription')
    : t('issues.detail.assigneeUnassignedDescription')
  const openConversation = async () => {
    if (!ready || opening) return
    setOpening(true)
    setActionError(null)
    try {
      await openHeadlessRun(owner.workspace!.id, owner.resumeId, { title: owner.displayName || data.issue.title })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setOpening(false)
    }
  }
  return (
    <>
      <div className="space-y-3 p-4">
        <p className="text-xs text-muted-foreground">{t('issues.detail.assignee')}</p>
        {concrete ? <>
          <p className="break-words text-sm font-medium">{owner?.displayName || data.issue.assignee.slice(1)}</p>
          {ready ? <>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">{t('issues.detail.runtime')}</dt><dd className="truncate">{owner.agent || '—'}</dd>
              <dt className="text-muted-foreground">{t('issues.detail.model')}</dt><dd className="truncate" title={owner.runtime?.model}>{owner.runtime?.model || '—'}</dd>
              <dt className="text-muted-foreground">{t('issues.detail.effort')}</dt><dd>{owner.runtime?.reasoningEffort || '—'}</dd>
              <dt className="text-muted-foreground">{t('issues.detail.credential')}</dt><dd className="truncate">{owner.runtime?.credentialSlug || owner.runtime?.credentialSource || '—'}</dd>
            </dl>
            <Button variant="outline" className="w-full" disabled={opening} onClick={() => void openConversation()}>
              <MessageSquare size={14} aria-hidden />{t('issues.detail.openConversation')}
            </Button>
          </> : <p className="text-xs text-muted-foreground">{t('issues.detail.sessionUnavailable')}</p>}
        </> : <p className="text-sm text-muted-foreground">{policy}</p>}
      </div>
      <div className="border-t border-border p-3">
        <AssigneeEditor triggerLabel={t('issues.detail.chooseAssignee')} value={data.issue.assignee} scheduled={Boolean(data.issue.when)} sessions={directory?.sessions ?? []} authoritativeOwner={owner} error={actionError} disabled={loading || Boolean(directoryError)} onChange={async (assignee) => {
          setActionError(null)
          try {
            mutate(await issuesApi.update(wsId, id, { assignee }))
            return true
          } catch (e) {
            setActionError(e instanceof Error ? e.message : String(e))
            return false
          }
        }} />
        {(actionError || directoryError || error) && <p role="alert" className="mt-2 text-xs text-destructive">{actionError || directoryError || error}</p>}
      </div>
    </>
  )
}
