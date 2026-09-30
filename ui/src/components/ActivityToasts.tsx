import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { AgentActivitySignal } from '../hooks/useGlobalAgentActivity'
import { useGlobalAgentActivity } from '../hooks/useGlobalAgentActivity'
import { useActivitySessionLabel } from '../hooks/useWorkspaceData'
import { useWorkspaces } from '../contexts/workspaces-context'
import { useWorkspace } from '../tabs/store'
import { useSessionDetailsDialog } from './workspace/session-details-store'
import { useNotifications } from './Toast'
import type { NotificationInput } from '../lib/notifications/queue'

function operationId(signal: AgentActivitySignal): string {
  return signal.operationId ?? (signal.taskId ? `task:${signal.taskId}`
    : signal.workspaceId && signal.resumeId ? `session:${signal.workspaceId}:${signal.resumeId}` : `event:${signal.revision}`)
}

/** Maps user-facing facts only; the queue owns display, never domain/runtime state. */
export function ActivityToasts() {
  const { t } = useTranslation()
  const queue = useNotifications()
  const openOrFocus = useWorkspace(state => state.openOrFocus)
  const sessionLabel = useActivitySessionLabel()
  const { workspaces } = useWorkspaces()
  const { signals, loading, error } = useGlobalAgentActivity()
  const baseline = useRef<number | null>(null)
  const announcedThrough = useRef(0)
  const running = useRef(new Set<string>())
  const delivered = useRef(new Map<string, number>())
  const failed = useRef(new Map<string, number>())

  useEffect(() => {
    if (loading) return
    if (baseline.current === null) {
      if (error) return
      baseline.current = Math.max(0, ...signals.map(signal => signal.revision))
      announcedThrough.current = baseline.current
      return
    }
    for (const map of [delivered.current, failed.current]) {
      while (map.size > 500) map.delete(map.keys().next().value!)
    }
    const active = new Set(signals.filter(signal => signal.kind === 'conversation' || signal.kind === 'sonner-test-running')
      .map(signal => signal.kind === 'conversation' ? `activity:${operationId(signal)}` : `activity:${signal.id}`))

    // Announce in journal order. A polling replay (even >200 facts) never emits twice.
    for (const signal of [...signals].sort((a, b) => a.revision - b.revision)) {
      if (signal.revision <= announcedThrough.current) continue
      announcedThrough.current = signal.revision
      const operation = operationId(signal)
      const id = `activity:${operation}`
      const agent = sessionLabel(signal) ?? signal.agent ?? t('activityToast.agent')
      const record = workspaces.find(ws => ws.id === signal.workspaceId)?.sessions.find(session =>
        signal.sessionRecordId ? session.id === signal.sessionRecordId : session.resumeId === signal.resumeId)
      const inspect = {
        label: t('activityToast.viewSession'),
        onClick: () => record ? useSessionDetailsDialog.getState().show(record) : openOrFocus({ kind: 'office', params: {} }),
      }
      const common = { id, revision: signal.revision, action: inspect }
      let input: NotificationInput
      switch (signal.kind) {
        case 'conversation':
          if (delivered.current.has(operation) || failed.current.has(operation)) continue
          input = { ...common, status: 'running', title: agent,
            description: t('activityToast.conversationRunning', { agent }), duration: Infinity }
          break
        case 'conversation-failed':
          failed.current.set(operation, signal.revision)
          input = { ...common, status: signal.failureKind === 'rejected' ? 'warning' : 'error',
            title: t(signal.failureKind === 'spawn' ? 'activityToast.conversationSpawnFailed'
              : signal.failureKind === 'rejected' ? 'activityToast.conversationRejected' : 'activityToast.conversationFailed', { agent }),
            description: signal.detail, duration: signal.failureKind === 'rejected' ? 8_000 : 10_000 }
          break
        case 'conversation-completed':
          if (delivered.current.has(operation) || failed.current.has(operation)) continue
          input = { ...common, status: 'success', title: t('activityToast.conversationCompleted', { agent }), duration: 4_000 }
          break
        case 'conversation-interrupted':
        case 'conversation-paused':
          input = { ...common, status: 'neutral', title: t(signal.kind === 'conversation-paused'
            ? 'activityToast.conversationPaused' : 'activityToast.conversationInterrupted', { agent }), duration: 4_000 }
          break
        case 'inbox': {
          const related = signal.taskId ? `task:${signal.taskId}` : undefined
          // If failure is already known, the report is a delivery fact, not a successful execution.
          const reportsFailure = related && failed.current.has(related)
          if (related) delivered.current.set(related, signal.revision)
          input = {
            ...(related && !reportsFailure ? { id: `activity:${related}` } : {}),
            group: `inbox:${signal.workspaceId}:${signal.sessionRecordId ?? signal.resumeId ?? signal.agent ?? 'unknown'}`,
            windowMs: 4_000, revision: signal.revision, status: 'success',
            title: t('activityToast.inboxDelivered', { agent }), description: signal.detail, duration: 6_000,
            action: { label: t('activityToast.viewInbox'), onClick: () => openOrFocus({ kind: 'inbox', params: {} }) },
          }
          break
        }
        case 'news':
          input = { status: 'info', title: signal.source ?? t('activityToast.newsSource'),
            description: signal.detail, articleId: signal.newsItemId, image: signal.image,
            group: `news:${(signal.source ?? '').trim().toLowerCase()}`, windowMs: 4_000,
            revision: signal.revision, duration: 6_000,
            action: { label: t('activityToast.viewNews'), onClick: () => openOrFocus({ kind: 'news', params: {} }) },
          }
          break
        default:
          input = { id: `activity:${signal.id}`, revision: signal.revision,
            status: signal.kind === 'sonner-test-running' ? 'running' : signal.kind === 'sonner-test-success' ? 'success' : 'error',
            title: signal.detail ?? 'Sonner test', duration: signal.kind === 'sonner-test-running' ? Infinity : signal.kind === 'sonner-test-success' ? 4_000 : 10_000 }
      }
      queue.publish(input)
    }
    for (const id of running.current) if (!active.has(id)) queue.withdraw(id)
    running.current = active
  }, [error, loading, openOrFocus, queue, sessionLabel, signals, t, workspaces])
  return null
}
