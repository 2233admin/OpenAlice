import { useState } from 'react'
import { CalendarClock, ChevronDown, ChevronRight, Clock } from 'lucide-react'

import type { ScheduleTask, ScheduleWhen, ScheduleWorkspace } from '../api/schedule'
import { useSchedules } from '../hooks/useSchedules'
import { formatRelativeTime } from '../lib/intl'

/** Short pill label. `at` collapses to "once" (its exact time shows in next-due). */
function cadenceLabel(when: ScheduleWhen): string {
  switch (when.kind) {
    case 'at':
      return 'once'
    case 'every':
      return `every ${when.every}`
    case 'cron':
      return when.cron
  }
}

function cadenceTitle(when: ScheduleWhen): string {
  switch (when.kind) {
    case 'at':
      return `once, at ${when.at}`
    case 'every':
      return `every ${when.every}`
    case 'cron':
      return `cron: ${when.cron}`
  }
}

function fmtTime(ms: number | null): string {
  return ms == null ? '—' : formatRelativeTime(ms)
}

function CadencePill({ when }: { when: ScheduleWhen }) {
  return (
    <span
      title={cadenceTitle(when)}
      className="inline-flex items-center gap-1 rounded-full bg-bg-tertiary px-2 py-0.5 font-mono text-[11px] text-muted"
    >
      <Clock size={10} className="text-muted/70" />
      {cadenceLabel(when)}
    </span>
  )
}

type View = 'upcoming' | 'workspace'

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opt = (v: View, label: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
        view === v ? 'bg-bg-secondary text-text' : 'text-muted hover:text-text'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-bg-tertiary p-0.5">
      {opt('upcoming', 'Upcoming')}
      {opt('workspace', 'By workspace')}
    </div>
  )
}

/**
 * Upcoming view — every enabled task with a future fire, flattened across
 * workspaces and sorted by next-due. Answers "what is going to happen next?"
 * (the symmetric future of the Runs page's past). One-time tasks that already
 * fired and paused tasks have no next fire and live only under By workspace.
 */
function UpcomingView({ workspaces }: { workspaces: ScheduleWorkspace[] }) {
  const items = workspaces
    .filter((w) => w.status === 'ok')
    .flatMap((w) =>
      w.tasks
        .filter((t): t is ScheduleTask & { nextDueAtMs: number } => t.enabled && t.nextDueAtMs != null)
        .map((task) => ({ wsTag: w.tag, task })),
    )
    .sort((a, b) => a.task.nextDueAtMs - b.task.nextDueAtMs)

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted">
        Nothing is scheduled to run next.
        <span className="mt-1 block text-xs text-muted/80">
          One-time and paused tasks live under <span className="text-text">By workspace</span>.
        </span>
      </div>
    )
  }

  return (
    <ul className="space-y-1.5">
      {items.map(({ wsTag, task }) => (
        <li
          key={`${wsTag}:${task.id}`}
          className="flex gap-3 rounded-lg border border-border bg-bg-secondary px-4 py-3"
        >
          <div className="w-16 shrink-0">
            <div className="text-[13px] font-semibold text-text" title={new Date(task.nextDueAtMs).toLocaleString()}>
              {formatRelativeTime(task.nextDueAtMs)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted/60">next run</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] text-text">{task.id}</span>
              <CadencePill when={task.when} />
              <span className="text-xs text-muted">in {wsTag}</span>
            </div>
            <p title={task.what} className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
              {task.what}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** By-workspace view — what each workspace has declared (incl. paused / done). */
function WorkspaceView({
  workspaces,
  collapsed,
  onToggle,
}: {
  workspaces: ScheduleWorkspace[]
  collapsed: Set<string>
  onToggle: (wsId: string) => void
}) {
  return (
    <div className="space-y-2.5">
      {workspaces.map((ws) => {
        const isOpen = !collapsed.has(ws.wsId)
        return (
          <div key={ws.wsId} className="overflow-hidden rounded-lg border border-border bg-bg-secondary">
            <button
              type="button"
              onClick={() => onToggle(ws.wsId)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-bg-tertiary/40"
            >
              {isOpen ? (
                <ChevronDown size={14} className="shrink-0 text-muted/70" />
              ) : (
                <ChevronRight size={14} className="shrink-0 text-muted/70" />
              )}
              <span className="font-medium text-text">{ws.tag}</span>
              {ws.status === 'ok' ? (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                  title="scheduled"
                  aria-label="scheduled"
                />
              ) : (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">
                  needs attention
                </span>
              )}
              {ws.status === 'ok' && (
                <span className="text-xs text-muted">
                  {ws.tasks.length} task{ws.tasks.length === 1 ? '' : 's'}
                </span>
              )}
              <span className="ml-auto font-mono text-[11px] text-muted/60">{ws.wsId.slice(0, 8)}</span>
            </button>

            {isOpen && ws.status === 'invalid' && (
              <div className="border-t border-border bg-red-500/[0.04] px-4 py-2.5 text-xs text-red-400">
                {ws.error ?? 'schedule file is invalid'}
              </div>
            )}

            {isOpen && ws.status === 'ok' && (
              <ul className="divide-y divide-border/60 border-t border-border">
                {ws.tasks.map((t) => (
                  <li key={t.id} className={`px-4 py-3 ${t.enabled ? '' : 'opacity-55'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] text-text">{t.id}</span>
                      <CadencePill when={t.when} />
                      {!t.enabled && (
                        <span className="text-[10px] uppercase tracking-wide text-muted/70">paused</span>
                      )}
                    </div>
                    <p title={t.what} className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">
                      {t.what}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
                      <span>
                        last run <span className="text-text/75">{fmtTime(t.lastFiredAtMs)}</span>
                      </span>
                      <span>
                        next due{' '}
                        <span className="text-text/75">{t.enabled ? fmtTime(t.nextDueAtMs) : '—'}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Schedules dashboard — read-only view of GET /api/schedule. Two lenses:
 * "Upcoming" (a time-sorted timeline of what fires next, across all workspaces)
 * and "By workspace" (what each workspace declared). Each workspace owns its
 * `.alice/schedule.json`; the agent writes it, a scanner fires due tasks as
 * headless runs — there is no central registry and nothing to create here.
 */
export function AutomationSchedulesSection() {
  const { snapshot, error, loading } = useSchedules()
  const [view, setView] = useState<View>('upcoming')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleWs = (wsId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(wsId)) next.delete(wsId)
      else next.add(wsId)
      return next
    })

  // Keep showing any snapshot we have (incl. the warm cache) rather than
  // flipping to a loading/error screen on a transient refresh failure.
  if (!snapshot) {
    if (loading) return <div className="text-sm text-muted">Loading…</div>
    return <div className="text-sm text-red-400">Failed to load schedules: {error}</div>
  }

  // A workspace with no schedule file is noise here — only show declared ones
  // (and broken files, which need attention).
  const declared = snapshot.workspaces.filter((w) => w.status !== 'absent')

  const staleBanner = error ? (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400">
      Live refresh failing — showing the last known schedule.
    </div>
  ) : null

  if (declared.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-3">
        {staleBanner}
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <CalendarClock size={24} className="mx-auto text-muted/50" />
          <p className="mt-3 text-sm text-muted">No workspace has scheduled anything yet.</p>
          <p className="mt-1 text-xs text-muted/80">
            A workspace schedules itself by writing{' '}
            <code className="rounded bg-bg-tertiary px-1 py-0.5 font-mono text-[11px] text-text/80">
              .alice/schedule.json
            </code>{' '}
            — see the <span className="text-text">API</span> tab for the format.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      {staleBanner}
      <div className="flex items-center justify-end">
        <ViewToggle view={view} onChange={setView} />
      </div>
      {view === 'upcoming' ? (
        <UpcomingView workspaces={declared} />
      ) : (
        <WorkspaceView workspaces={declared} collapsed={collapsed} onToggle={toggleWs} />
      )}
    </div>
  )
}
