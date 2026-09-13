import { useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ListChecks,
} from 'lucide-react'

import type {
  IssueAutomationHealth,
  IssueAutomationHealthState,
  IssueListItem,
  IssuePriority,
  IssueStatus,
  IssueWorkspace,
} from '../api/issues'
import type { ScheduleWhen } from '../api/schedule'
import { useIssues } from '../hooks/useIssues'
import { useWorkspaces } from '../contexts/workspaces-context'
import { formatRelativeTime } from '../lib/intl'
import { useWorkspace } from '../tabs/store'
import { CenteredLoading } from './StateViews'
import { IssueAssigneePopover } from './IssueAssigneePopover'
import { STATUS_META } from './issue-status-meta'

// ==================== Cadence pill (lifted from AutomationSchedulesSection) ====================

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function two(n: number): string {
  return String(n).padStart(2, '0')
}

function cronInt(field: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(field)) return null
  const n = Number(field)
  return n >= min && n <= max ? n : null
}

function cronDayPhrase(field: string, t: TFunction): string | null {
  if (field === '*') return t('issues.cadence.day')
  if (field === '1-5') return t('issues.cadence.weekday')
  if (field === '0,6' || field === '6,0') return t('issues.cadence.weekend')
  const out: string[] = []
  for (const part of field.split(',')) {
    const range = part.match(/^(\d+)-(\d+)$/)
    if (range) {
      const start = cronInt(range[1], 0, 7)
      const end = cronInt(range[2], 0, 7)
      if (start === null || end === null || start > end) return null
      const startKey = WEEKDAY_KEYS[start === 7 ? 0 : start]
      const endKey = WEEKDAY_KEYS[end === 7 ? 0 : end]
      out.push(`${t(`issues.weekday.${startKey}`)}-${t(`issues.weekday.${endKey}`)}`)
      continue
    }
    const n = cronInt(part, 0, 7)
    if (n === null) return null
    out.push(t(`issues.weekday.${WEEKDAY_KEYS[n === 7 ? 0 : n]}`))
  }
  return out.length > 0 ? Array.from(new Set(out)).join(', ') : null
}

function cronLabel(expr: string, t: TFunction): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return t('issues.cadence.custom')
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return t('issues.cadence.everyMinute')
  }
  const minuteStep = minute.match(/^\*\/(\d+)$/)
  if (minuteStep && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return t('issues.cadence.everyDuration', { duration: `${minuteStep[1]}m` })
  }
  const hourStep = hour.match(/^\*\/(\d+)$/)
  if (minute === '0' && hourStep && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return t('issues.cadence.everyDuration', { duration: `${hourStep[1]}h` })
  }
  if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return t('issues.cadence.everyHour')
  }
  const m = cronInt(minute, 0, 59)
  const h = cronInt(hour, 0, 23)
  if (m === null || h === null) return t('issues.cadence.custom')
  const time = `${two(h)}:${two(m)}`
  if (month === '*' && dayOfMonth === '*') {
    const dayPhrase = cronDayPhrase(dayOfWeek, t)
    return dayPhrase
      ? t('issues.cadence.everyDayAt', { day: dayPhrase, time })
      : t('issues.cadence.customAt', { time })
  }
  if (month === '*' && dayOfWeek === '*') {
    const dom = cronInt(dayOfMonth, 1, 31)
    return dom === null
      ? t('issues.cadence.customAt', { time })
      : t('issues.cadence.everyMonthDayAt', { day: dom, time })
  }
  return t('issues.cadence.customAt', { time })
}

function onceLabel(at: string): string {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return at
  const now = new Date()
  return new Intl.DateTimeFormat(undefined, {
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/** Short pill label: one-shots show their time; recurring schedules start with "Every". */
function cadenceLabel(when: ScheduleWhen, t: TFunction): string {
  switch (when.kind) {
    case 'at':
      return onceLabel(when.at)
    case 'every':
      return t('issues.cadence.everyDuration', { duration: when.every })
    case 'cron':
      return cronLabel(when.cron, t)
  }
}

function cadenceTitle(when: ScheduleWhen, t: TFunction): string {
  switch (when.kind) {
    case 'at':
      return `${onceLabel(when.at)} (${when.at})`
    case 'every':
      return t('issues.cadence.everyDuration', { duration: when.every })
    case 'cron':
      return `${cronLabel(when.cron, t)} · ${when.timezone ?? t('issues.cadence.localTime')} (${when.cron})`
  }
}

export function CadencePill({ when }: { when: ScheduleWhen }) {
  const { t } = useTranslation()
  return (
    <span
      title={cadenceTitle(when, t)}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
    >
      <Clock size={10} className="text-muted-foreground/70" />
      {cadenceLabel(when, t)}
      {when.kind === 'cron' && (
        <span className="text-muted-foreground/70">· {when.timezone ?? t('issues.cadence.local')}</span>
      )}
    </span>
  )
}

/**
 * Inspector treatment for a schedule. Unlike CadencePill, this deliberately
 * gives the wall-clock label and timezone their own lines so a narrow details
 * rail never turns schedule metadata into an oversized wrapping capsule.
 */
export function CadenceSummary({ when }: { when: ScheduleWhen }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Clock size={14} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-snug text-foreground">
          {cadenceLabel(when, t)}
        </span>
        {when.kind === 'cron' && (
          <span className="mt-0.5 block break-all text-xs leading-snug text-muted-foreground">
            {when.timezone ?? t('issues.cadence.localTime')}
          </span>
        )}
        {when.kind === 'cron' && (
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
            {when.catchUp === false
              ? t('issues.cadence.calendarOnly')
              : t('issues.cadence.catchUp')}
          </span>
        )}
      </span>
    </div>
  )
}

const AUTOMATION_HEALTH_CLASS: Record<IssueAutomationHealthState, string> = {
  inactive: 'bg-muted text-muted-foreground',
  not_started: 'bg-muted text-muted-foreground',
  due: 'bg-warning/15 text-warning',
  running: 'bg-info/15 text-info',
  healthy: 'bg-success/15 text-success',
  interrupted: 'bg-warning/15 text-warning',
  failed: 'bg-destructive/15 text-destructive',
  blocked: 'bg-destructive/15 text-destructive',
}

export function AutomationHealthPill({ health }: { health: IssueAutomationHealth }) {
  const { t } = useTranslation()
  return (
    <span
      title={health.message}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${AUTOMATION_HEALTH_CLASS[health.state]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {t(`issues.health.${health.state}`)}
    </span>
  )
}

// ==================== Priority indicator (Linear-style bars) ====================

/**
 * Linear-style priority glyph. high/medium/low/none render as three bars with
 * the matching number filled; urgent is a distinct filled amber square with a
 * `!` so it never reads as "just high".
 */
export function PriorityIndicator({ priority }: { priority: IssuePriority }) {
  const { t } = useTranslation()
  if (priority === 'urgent') {
    return (
      <span
        title={t('issues.priority.urgent')}
        aria-label={t('issues.priority.label', { priority: t('issues.priority.urgent') })}
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-warning text-[10px] font-bold leading-none text-warning-foreground"
      >
        !
      </span>
    )
  }
  const filled = priority === 'high' ? 3 : priority === 'medium' ? 2 : priority === 'low' ? 1 : 0
  const heights = [4, 7, 10]
  return (
    <span
      title={t('issues.priority.label', { priority: t(`issues.priority.${priority}`) })}
      aria-label={t('issues.priority.label', { priority: t(`issues.priority.${priority}`) })}
      className="inline-flex h-3.5 w-3.5 shrink-0 items-end justify-center gap-[1.5px]"
    >
      {heights.map((h, i) => (
        <span
          key={i}
          style={{ height: `${h}px` }}
          className={`w-[2.5px] rounded-[1px] ${i < filled ? 'bg-muted-foreground/80' : 'bg-muted-foreground/20'}`}
        />
      ))}
    </span>
  )
}

// ==================== Status metadata + ordering ====================

/** Linear's group order: active work first, terminal states last. */
const STATUS_ORDER: IssueStatus[] = ['in_progress', 'todo', 'backlog', 'done', 'canceled']

interface BoardRow {
  wsId: string
  wsTag: string
  issue: IssueListItem
  /** When this issue's name collides across workspaces (`issue.nameCollision`),
   *  how many OTHER workspaces also claim the name — drives the warning tooltip.
   *  Absent ⇒ no collision. */
  dupOthers?: number
}

/** Normalised collision key — title, trimmed + lowercased. Mirrors the server's
 *  `annotateNameCollisions` detection key. */
const nameKey = (title: string): string => title.trim().toLowerCase()

// ==================== Rows + groups ====================

const ATTENTION_ORDER: Record<IssueAutomationHealthState, number> = {
  blocked: 0,
  failed: 1,
  interrupted: 2,
  running: 3,
  due: 4,
  not_started: 5,
  healthy: 6,
  inactive: 7,
}

const PRIORITY_ORDER: Record<IssuePriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
}

function boardRowOrder(a: BoardRow, b: BoardRow): number {
  const aAttention = a.issue.automationHealth ? ATTENTION_ORDER[a.issue.automationHealth.state] : 4
  const bAttention = b.issue.automationHealth ? ATTENTION_ORDER[b.issue.automationHealth.state] : 4
  if (aAttention !== bAttention) return aAttention - bAttention

  const priority = PRIORITY_ORDER[a.issue.priority] - PRIORITY_ORDER[b.issue.priority]
  if (priority !== 0) return priority

  const aDue = a.issue.nextDueAtMs ?? Number.POSITIVE_INFINITY
  const bDue = b.issue.nextDueAtMs ?? Number.POSITIVE_INFINITY
  if (aDue !== bDue) return aDue - bDue
  return a.issue.title.localeCompare(b.issue.title)
}

function BoardCadence({ issue }: { issue: IssueListItem }) {
  const { t } = useTranslation()
  if (!issue.when) return null
  const nextRun = issue.nextDueAtMs ? formatRelativeTime(issue.nextDueAtMs) : ''
  return (
    <span
      title={cadenceTitle(issue.when, t)}
      className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"
    >
      <Clock size={11} className="shrink-0 text-muted-foreground/70" aria-hidden />
      <span className="truncate tabular-nums">{nextRun || cadenceLabel(issue.when, t)}</span>
    </span>
  )
}

function IssueRow({ wsId, wsTag, issue, dupOthers, onOpen }: BoardRow & { onOpen: () => void }) {
  const { t } = useTranslation()
  const terminal = issue.status === 'done' || issue.status === 'canceled'
  const meta = STATUS_META[issue.status]
  return (
    <li className="relative">
      <button
        type="button"
        onClick={onOpen}
        title={t('issues.openIssue', { id: issue.id })}
        className="oa-pressable flex h-11 w-full min-w-0 items-center gap-3 py-0 pl-3 pr-12 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:pl-6 sm:pr-16"
      >
        <PriorityIndicator priority={issue.priority} />
        <span className="hidden w-28 shrink-0 truncate text-xs text-muted-foreground sm:block" title={t('issues.issueIdTitle', { id: issue.id })}>
          #{issue.id}
        </span>
        <meta.Icon size={14} className={`shrink-0 ${meta.className}`} aria-label={t(`issues.status.${issue.status}`)} />
        <span className={`min-w-0 flex-1 truncate text-[13px] ${terminal ? 'text-muted-foreground' : 'text-foreground'}`}>
          {issue.title}
        </span>
        {issue.nameCollision && (
          <span title={t((dupOthers ?? 1) === 1 ? 'issues.duplicateOne' : 'issues.duplicateMany', { count: dupOthers ?? 1 })} aria-label={t('issues.duplicateLabel')} className="shrink-0 text-warning">
            <Copy size={12} aria-hidden />
          </span>
        )}
        <span className="hidden max-w-36 shrink-0 items-center gap-1.5 rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground lg:inline-flex" title={t('issues.workspaceTitle', { workspace: wsTag, id: wsId.slice(0, 8) })}>
          <Layers size={11} className="shrink-0" aria-hidden />
          <span className="truncate">{wsTag}</span>
        </span>
        <span data-testid="issue-automation-summary" className="flex shrink-0 items-center gap-4">
          <span className="hidden w-28 items-center justify-end sm:flex"><BoardCadence issue={issue} /></span>
        </span>
      </button>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 sm:right-5"><IssueAssigneePopover wsId={wsId} id={issue.id} health={issue.automationHealth} /></div>
    </li>
  )
}

function StatusGroup({
  status,
  rows,
  collapsed,
  onToggle,
  onOpenRow,
}: {
  status: IssueStatus
  rows: BoardRow[]
  collapsed: boolean
  onToggle: () => void
  onOpenRow: (row: BoardRow) => void
}) {
  const { t } = useTranslation()
  const meta = STATUS_META[status]
  const statusLabel = t(`issues.status.${status}`)
  const listId = `issues-status-${status}`
  return (
    <section
      data-testid={`issue-status-group-${status}`}
      className="min-w-0"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={listId}
        aria-label={t(collapsed ? 'issues.expandStatus' : 'issues.collapseStatus', { status: statusLabel })}
        className="flex h-9 w-full items-center gap-2 bg-muted/45 px-3 text-left transition-colors hover:bg-muted/60 sm:px-4"
      >
        {collapsed ? (
          <ChevronRight size={14} className="shrink-0 text-muted-foreground/70" />
        ) : (
          <ChevronDown size={14} className="shrink-0 text-muted-foreground/70" />
        )}
        <meta.Icon size={14} className={`shrink-0 ${meta.className}`} />
        <span className="text-[13px] font-medium text-foreground">{statusLabel}</span>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </button>
      {!collapsed && (
        <ul id={listId} className="py-1">
          {rows.map((row) => (
            <IssueRow
              key={`${row.wsId}:${row.issue.id}`}
              {...row}
              onOpen={() => onOpenRow(row)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

// ==================== Invalid-workspace surface (loud failure) ====================

function InvalidWorkspaces({ workspaces }: { workspaces: IssueWorkspace[] }) {
  const { t } = useTranslation()
  if (workspaces.length === 0) return null
  return (
    <div className="space-y-1.5">
      {workspaces.map((ws) => (
        <div
          key={ws.wsId}
          className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-4 py-2.5 text-xs text-destructive"
        >
          <span className="font-medium text-destructive">{ws.tag}</span>{' '}
          <span className="font-mono text-destructive/70">{ws.wsId.slice(0, 8)}</span>
          <p className="mt-1 leading-relaxed">{ws.error ?? t('issues.unreadableWorkspace')}</p>
        </div>
      ))}
    </div>
  )
}

// ==================== Board ====================

/**
 * Global Issue board — a read-only, Linear-style list of every workspace's
 * issues (GET /api/issues), grouped by status. An issue with a `when` is
 * scheduled (carries a cadence pill + still fires headless runs via the
 * scanner); an issue without is a pure tracked work item. Each workspace owns
 * its issues as `.alice/issues/<id>.md` files — there is no central registry
 * and nothing to create here (Phase 1).
 */
export function IssuesBoard() {
  const { t } = useTranslation()
  const { data, error, loading } = useIssues()
  const { workspaces: workspaceMetas } = useWorkspaces()
  const openOrFocus = useWorkspace((s) => s.openOrFocus)
  const setSidebar = useWorkspace((s) => s.setSidebar)
  const [collapsed, setCollapsed] = useState<Set<IssueStatus>>(new Set())

  const openRow = (row: BoardRow) => {
    setSidebar('issue')
    openOrFocus({ kind: 'issue-detail', params: { wsId: row.wsId, id: row.issue.id } })
  }

  const toggle = (status: IssueStatus) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })

  // Keep showing any snapshot we have (incl. the warm cache) rather than
  // flipping to a loading/error screen on a transient refresh failure.
  if (!data) {
    if (loading) return <CenteredLoading />
    return <div className="text-sm text-destructive">{t('issues.loadError', { error: error ?? t('issues.unknownError') })}</div>
  }

  // Defensive: tolerate a malformed/empty payload (e.g. the demo catchAll's
  // bare `{}` before an /api/issues handler lands) rather than white-screening.
  const issueWorkspaces = data.workspaces ?? []
  const invalid = issueWorkspaces.filter((w) => w.status === 'invalid')

  // Flatten every ok workspace's issues, tagged with the workspace, then
  // bucket by status in Linear's order. Empty buckets are hidden.
  const okWorkspaces = issueWorkspaces.filter((w) => w.status === 'ok')

  // For each name, the set of workspaces that claim it — so a colliding row's
  // warning tooltip can say "also in N other workspaces". The backend already
  // flags `issue.nameCollision` (authoritative detection); this only supplies
  // the count for the tooltip.
  const wsByName = new Map<string, Set<string>>()
  for (const w of okWorkspaces) {
    for (const issue of w.issues ?? []) {
      const key = nameKey(issue.title)
      if (!key) continue
      const set = wsByName.get(key) ?? new Set<string>()
      set.add(w.wsId)
      wsByName.set(key, set)
    }
  }

  const rows: BoardRow[] = okWorkspaces.flatMap((w) =>
    (w.issues ?? []).map((issue) => ({
      wsId: w.wsId,
      wsTag: workspaceMetas.find((workspace) => workspace.id === w.wsId)?.displayName || w.tag,
      issue,
      dupOthers: issue.nameCollision
        ? Math.max(0, (wsByName.get(nameKey(issue.title))?.size ?? 1) - 1)
        : undefined,
    })),
  )

  const groups = STATUS_ORDER.map((status) => ({
    status,
    rows: rows.filter((r) => r.issue.status === status).sort(boardRowOrder),
  })).filter((g) => g.rows.length > 0)

  const staleBanner = error ? (
    <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-warning">
      {t('issues.stale')}
    </div>
  ) : null

  if (groups.length === 0 && invalid.length === 0) {
    return (
      <div className="mx-auto max-w-[1240px] space-y-3">
        {staleBanner}
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <ListChecks size={24} className="mx-auto text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">{t('issues.emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            {t('issues.emptyPrefix')}{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/80">
              .alice/issues/&lt;id&gt;.md
            </code>
            {t('issues.emptySuffixBeforeWhen')}<span className="text-foreground">when</span>{t('issues.emptySuffixAfterWhen')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="issues-board" className="w-full space-y-1">
      {staleBanner}
      <InvalidWorkspaces workspaces={invalid} />
      {groups.map((g) => (
        <StatusGroup
          key={g.status}
          status={g.status}
          rows={g.rows}
          collapsed={collapsed.has(g.status)}
          onToggle={() => toggle(g.status)}
          onOpenRow={openRow}
        />
      ))}
    </div>
  )
}
