import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Search, UserRound } from 'lucide-react'
import type { IssueAssigneeSession } from '../api/issues'
import type { WorkspaceSessionDirectoryEntry } from './workspace/api'
import { formatRelativeTime } from '../lib/intl'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { SelectionCheckIcon } from './ui/selection-check-icon'

export function AssigneeEditor({
  value,
  scheduled,
  sessions,
  authoritativeOwner,
  disabled,
  error,
  triggerLabel,
  onChange,
}: {
  value: string
  scheduled: boolean
  sessions: readonly WorkspaceSessionDirectoryEntry[]
  authoritativeOwner?: IssueAssigneeSession
  disabled?: boolean
  error?: string | null
  triggerLabel?: string
  onChange: (next: string) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draftValue, setDraftValue] = useState(value)
  const [committing, setCommitting] = useState(false)
  const sessionChoices = sessions
    .filter((session) =>
      session.resumeId
      && session.agent !== 'shell'
      && session.resumable
      && (session.presence ?? 'active') === 'active')
    .toSorted((a, b) => Number(b.active) - Number(a.active) || b.updatedAt - a.updatedAt)
  const selectedResumeId = value.startsWith('@resume-') ? value.slice(1) : null
  const draftResumeId = draftValue.startsWith('@resume-') ? draftValue.slice(1) : null
  const authoritativeSelected = selectedResumeId && authoritativeOwner?.resumeId === selectedResumeId
    ? authoritativeOwner
    : undefined
  const hasSelected = !selectedResumeId
    || sessionChoices.some((session) => session.resumeId === selectedResumeId)
    || authoritativeSelected?.state === 'ready'
  const contextFor = (session: WorkspaceSessionDirectoryEntry) => {
    const rawContext = session.interactive?.title
      || session.interactive?.name
      || session.latestExecution?.assistantPreview
    const normalizedContext = rawContext?.replace(/\s+/g, ' ').trim()
    if (!normalizedContext || normalizedContext === session.resumeId) return null
    return normalizedContext.length > 120
      ? `${normalizedContext.slice(0, 117).trimEnd()}…`
      : normalizedContext
  }
  const labelFor = (session: WorkspaceSessionDirectoryEntry) => {
    const activity = session.active ? 'active' : formatRelativeTime(session.updatedAt)
    return `${session.resumeId}, ${session.agent}, ${activity}`
  }

  const policyChoices = scheduled
    ? [
        { value: '@new-then-resume', label: t('issues.detail.assigneeNew'), description: t('issues.detail.assigneeNewDescription') },
        { value: '@new-each-run', label: t('issues.detail.assigneeWorkspaceScheduled'), description: t('issues.detail.assigneeEachDescription') },
      ]
    : [
        { value: '@human', label: t('issues.detail.human'), description: t('issues.detail.assigneeHumanDescription') },
        { value: '@unassigned', label: t('issues.detail.unassigned'), description: t('issues.detail.assigneeUnassignedDescription') },
      ]
  const selectedSession = selectedResumeId
    ? sessionChoices.find((session) => session.resumeId === selectedResumeId)
    : null
  const selectedPolicy = policyChoices.find((choice) => choice.value === value)
  const selectedLabel = selectedSession
    ? contextFor(selectedSession) ?? selectedSession.resumeId
    : authoritativeSelected?.state === 'ready'
      ? authoritativeSelected.displayName ?? authoritativeSelected.resumeId
    : selectedPolicy?.label ?? (selectedResumeId ? selectedResumeId : value)
  const selectedDescription = selectedSession
    ? `${selectedSession.agent}, ${selectedSession.active ? t('issues.detail.activeNow') : formatRelativeTime(selectedSession.updatedAt)}`
    : authoritativeSelected?.state === 'ready'
      ? [authoritativeSelected.agent, authoritativeSelected.workspace?.tag].filter(Boolean).join(', ')
    : selectedPolicy?.description
  const draftSession = draftResumeId
    ? sessionChoices.find((session) => session.resumeId === draftResumeId)
    : null
  const draftPolicy = policyChoices.find((choice) => choice.value === draftValue)
  const draftLabel = draftSession
    ? contextFor(draftSession) ?? draftSession.resumeId
    : draftPolicy?.label ?? (draftResumeId ? draftResumeId : draftValue)
  const draftDescription = draftSession
    ? `${draftSession.resumeId}, ${draftSession.agent}, ${draftSession.active ? t('issues.detail.activeNow') : formatRelativeTime(draftSession.updatedAt)}`
    : draftPolicy?.description
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredSessions = normalizedQuery
    ? sessionChoices.filter((session) => [session.resumeId, session.agent, contextFor(session)]
        .filter(Boolean)
        .some((candidate) => candidate!.toLocaleLowerCase().includes(normalizedQuery)))
    : sessionChoices
  const close = () => {
    setOpen(false)
    setQuery('')
    setDraftValue(value)
  }
  const apply = async () => {
    if (draftValue === value || committing) return
    setCommitting(true)
    try {
      if (await onChange(draftValue)) {
        setOpen(false)
        setQuery('')
      }
    } finally {
      setCommitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (next) {
        setDraftValue(value)
        setOpen(true)
        return
      }
      if (!committing) close()
    }}>
      <Button
        type="button"
        disabled={disabled}
        aria-label={t('issues.detail.assignee')}
        onClick={() => {
          setDraftValue(value)
          setOpen(true)
        }}
        variant="outline"
        className="h-auto min-h-11 w-full min-w-0 justify-start gap-2.5 whitespace-normal px-3 py-2 text-left"
      >
        <UserRound size={15} className="shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground">{triggerLabel || selectedLabel}</span>
          {!triggerLabel && selectedDescription && <span className="block truncate text-[11px] text-muted-foreground">{selectedDescription}</span>}
        </span>
        <ChevronRight size={14} className="shrink-0 text-muted-foreground/70" aria-hidden />
      </Button>
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{t('issues.detail.chooseAssignee')}</DialogTitle>
          <DialogDescription>{t('issues.detail.chooseAssigneeDescription')}</DialogDescription>
        </DialogHeader>
        <label className="mx-4 flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-ring/30">
          <Search size={15} className="text-muted-foreground" aria-hidden />
          <span className="sr-only">{t('issues.detail.searchSessions')}</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('issues.detail.searchSessions')}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="min-h-0 max-w-full overflow-x-hidden overflow-y-auto px-2 pb-4">
          <p className="px-2 pb-1.5 pt-2 text-[11px] font-medium text-muted-foreground">
            {t('issues.detail.assignmentPolicy')}
          </p>
          <div className="space-y-0.5">
            {policyChoices.map((choice) => (
              <AssigneeChoice
                key={choice.value}
                label={choice.label}
                description={choice.description}
                selected={draftValue === choice.value}
                onClick={() => setDraftValue(choice.value)}
              />
            ))}
          </div>
          <p className="mt-2 border-t border-border/60 px-2 pb-1.5 pt-3 text-[11px] font-medium text-muted-foreground">
            {t('issues.detail.workspaceSessions')}
          </p>
          <div className="space-y-0.5">
            {!hasSelected && selectedResumeId && (
              <AssigneeChoice
                label={t('issues.detail.signedSession', { resumeId: selectedResumeId })}
                description={t('issues.detail.sessionUnavailable')}
                selected={draftValue === value}
                onClick={() => setDraftValue(value)}
              />
            )}
            {authoritativeSelected?.state === 'ready'
              && !sessionChoices.some((session) => session.resumeId === authoritativeSelected.resumeId) && (
              <AssigneeChoice
                label={authoritativeSelected.displayName ?? authoritativeSelected.resumeId}
                description={[
                  authoritativeSelected.resumeId,
                  authoritativeSelected.agent,
                  authoritativeSelected.workspace?.tag,
                ].filter(Boolean).join(', ')}
                selected={draftValue === value}
                onClick={() => setDraftValue(value)}
              />
            )}
            {filteredSessions.map((session) => (
              <AssigneeChoice
                key={session.resumeId}
                label={contextFor(session) ?? session.resumeId}
                description={labelFor(session)}
                selected={draftResumeId === session.resumeId}
                onClick={() => setDraftValue(`@${session.resumeId}`)}
              />
            ))}
            {filteredSessions.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t('issues.detail.noSessionsFound')}</p>
            )}
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 min-w-0 flex-col items-stretch rounded-none px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 w-full max-w-full overflow-hidden text-left sm:mr-auto sm:flex-1">
            {error && <p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}
            <span className="block text-[11px] font-medium text-muted-foreground">
              {t('issues.detail.pendingAssignee')}
            </span>
            <span className="mt-0.5 block truncate text-sm font-medium text-foreground">{draftLabel}</span>
            {draftDescription && <span className="block truncate text-xs text-muted-foreground">{draftDescription}</span>}
          </div>
          <div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto">
            <Button type="button" variant="outline" disabled={committing} onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={committing || draftValue === value} onClick={() => void apply()}>
              {committing ? t('issues.detail.assigning') : t('issues.detail.confirmAssignment')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssigneeChoice({
  label,
  description,
  selected,
  onClick,
}: {
  label: string
  description?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="ghost"
      className="h-auto min-h-12 w-full min-w-0 max-w-full justify-start gap-3 overflow-hidden whitespace-normal px-3 py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{label}</span>
        {description && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>}
      </span>
      {selected && <SelectionCheckIcon />}
    </Button>
  )
}

