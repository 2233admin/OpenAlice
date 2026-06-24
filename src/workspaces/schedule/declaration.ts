/**
 * The workspace self-declared schedule file — `.alice/schedule.json` inside a
 * workspace's own checkout. The agent WRITES it (a coding task; a bundled skill
 * teaches the format); the scanner READS it live each pass. The agent can edit
 * any file in its checkout, so the scanner NEVER trusts it — every read is
 * re-validated and degrades to "no schedule" on missing/oversized/malformed,
 * isolated per workspace.
 *
 * `when` = WHEN to run (reuses the shared Schedule shape: at / every / cron).
 * `what` = an opaque prompt handed verbatim to the workspace's headless
 *          automation interface — the launcher never interprets it. Conditions
 *          ("run only if X") live INSIDE the prompt; the woken agent self-checks.
 */

import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

import { computeNextRun, type Schedule } from '../../core/schedule-expr.js'

/** Path of the declaration file, relative to a workspace's `dir`. */
export const SCHEDULE_FILE_REL = join('.alice', 'schedule.json')

/** Hard cap — an agent-authored file should be tiny; refuse to parse a blob. */
const MAX_BYTES = 64 * 1024

const whenSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('at'), at: z.string().min(1) }),
  z.object({ kind: z.literal('every'), every: z.string().min(1) }),
  z.object({ kind: z.literal('cron'), cron: z.string().min(1) }),
])

export const scheduleTaskSchema = z.object({
  /** Stable per-workspace id — keys the scanner's last-fired marker. */
  id: z.string().min(1),
  when: whenSchema,
  /** The prompt handed to the headless run. */
  what: z.string().min(1),
  /** Which adapter to run; defaults to the workspace's default agent. */
  agent: z.string().min(1).optional(),
  /** Defaults to enabled; set false to keep a task declared but dormant. */
  enabled: z.boolean().optional(),
})
export type ScheduleTask = z.infer<typeof scheduleTaskSchema>

export const scheduleDeclarationSchema = z.object({
  tasks: z.array(scheduleTaskSchema),
})
export type ScheduleDeclaration = z.infer<typeof scheduleDeclarationSchema>

/** A task's `when`, narrowed to the shared Schedule shape the math consumes. */
export function taskWhen(task: ScheduleTask): Schedule {
  return task.when
}

export type ReadResult =
  | { ok: true; tasks: ScheduleTask[] }
  | { ok: false; reason: 'absent' }
  | { ok: false; reason: 'invalid'; error: string }

/**
 * Read + validate a workspace's declaration from its live working tree. Never
 * throws — a bad file is reported, not propagated, so one workspace can't break
 * the scan.
 */
export async function readScheduleDeclaration(wsDir: string): Promise<ReadResult> {
  const path = join(wsDir, SCHEDULE_FILE_REL)

  let raw: string
  try {
    const info = await stat(path)
    if (info.size > MAX_BYTES) {
      return { ok: false, reason: 'invalid', error: `schedule file too large (${info.size} bytes)` }
    }
    raw = await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ok: false, reason: 'absent' }
    return { ok: false, reason: 'invalid', error: err instanceof Error ? err.message : String(err) }
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'invalid', error: 'not valid JSON' }
  }

  const parsed = scheduleDeclarationSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, reason: 'invalid', error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
  }

  return { ok: true, tasks: parsed.data.tasks }
}

// ==================== Dashboard snapshot ====================
// The read-only shape GET /api/schedule returns: each workspace's declared
// tasks enriched with the scanner's last-fired marker and the computed next-due.

export interface ScheduleSnapshotTask {
  id: string
  when: Schedule
  what: string
  agent?: string
  enabled: boolean
  /** When the scanner last fired this task (epoch ms), null if never. */
  lastFiredAtMs: number | null
  /** When it is next due (epoch ms), null if the schedule yields no future fire. */
  nextDueAtMs: number | null
}

export interface ScheduleSnapshotWorkspace {
  wsId: string
  tag: string
  /** 'absent' = no schedule file; 'invalid' = present but unreadable/malformed. */
  status: 'ok' | 'absent' | 'invalid'
  error?: string
  tasks: ScheduleSnapshotTask[]
}

export interface ScheduleSnapshot {
  workspaces: ScheduleSnapshotWorkspace[]
}

/** Build a dashboard task view: the declared task + its last-fired marker + the
 *  computed next-due (same base-seed as the scanner's due-ness, so the dashboard
 *  matches real firing behavior). Shared by the scanner's per-tick cache build
 *  and the route's cold-start fallback. */
/** The base timestamp for due-ness: the last fire, or a synthetic never-fired
 *  baseline. `every`/`at` seed from epoch (so they're due on first sight).
 *  `cron` looks back one scan interval — seeding a never-fired cron from `now`
 *  would make it NEVER due (computeNextRun is always strictly future), and
 *  seeding from epoch would fire it immediately; the lookback catches an
 *  occurrence that just passed without firing a stale backlog. */
export function fireBase(
  when: Schedule,
  lastFiredAtMs: number | null,
  nowMs: number,
  lookbackMs: number,
): number {
  if (lastFiredAtMs !== null) return lastFiredAtMs
  return when.kind === 'cron' ? nowMs - lookbackMs : 0
}

export function snapshotTask(
  task: ScheduleTask,
  lastFiredAtMs: number | null,
  nowMs: number,
  lookbackMs: number,
): ScheduleSnapshotTask {
  const when = taskWhen(task)
  const next = computeNextRun(when, fireBase(when, lastFiredAtMs, nowMs, lookbackMs))
  return {
    id: task.id,
    when,
    what: task.what,
    ...(task.agent ? { agent: task.agent } : {}),
    enabled: task.enabled !== false,
    lastFiredAtMs,
    // An overdue computed time clamps to now: a due-now task reads "due now",
    // never a past/epoch instant — keeps the display consistent with firing.
    nextDueAtMs: next === null ? null : Math.max(next, nowMs),
  }
}
