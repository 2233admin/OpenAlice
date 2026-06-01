/**
 * AgentWork — comprehensive coverage of the runner's pipeline behaviour.
 *
 * The runner is the load-bearing primitive for every "Alice does an
 * async task outside chat" path (heartbeat / cron / task-router /
 * future async triggers). Test coverage here is intentionally thorough:
 * gate combinations, error paths, tool-call observation, hook
 * misbehaviour. Trigger-source-specific tests (active-hours, heartbeat
 * stub gate) live in the heartbeat / cron spec files; this file
 * exercises the abstraction itself.
 *
 * Post-AgentCenter-retirement: the runner drives GenerateRouter directly
 * (a mock provider yields ProviderEvents ending in `done`) and delivers
 * to the InboxStore under a synthetic `automation:<source>` workspace id.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AgentWorkRunner, type AgentWorkRequest, type AgentWorkEmitFn, type AgentWorkResultProbe } from './agent-work.js'
import type { GenerateRouter } from './ai-provider-manager.js'
import type { ISessionStore } from './session.js'
import { createMemoryInboxStore, type IInboxStore } from './inbox-store.js'
import type { ToolCallSummary } from '../ai-providers/types.js'

// ==================== Helpers ====================

interface RouterMock {
  router: GenerateRouter
  setResult(result: { text?: string; toolCalls?: ToolCallSummary[] }): void
  setShouldThrow(err: Error | null): void
  callCount(): number
  lastCall(): { prompt: string; preamble: string | undefined } | null
}

/** Mocks a GenerateRouter whose resolved provider yields a scripted
 *  ProviderEvent stream. The runner consumes provider.generate() and
 *  awaits the `done` event — so we yield optional tool_use events then a
 *  terminal done carrying the reply text. */
function createMockRouter(): RouterMock {
  let result: { text: string; toolCalls: ToolCallSummary[] } = { text: 'mock reply', toolCalls: [] }
  let shouldThrow: Error | null = null
  const calls: Array<{ prompt: string; preamble: string | undefined }> = []

  const provider = {
    providerTag: 'vercel-ai' as const,
    // eslint-disable-next-line require-yield
    async *generate(_entries: unknown, prompt: string, opts?: { historyPreamble?: string }) {
      calls.push({ prompt, preamble: opts?.historyPreamble })
      if (shouldThrow) throw shouldThrow
      for (const tc of result.toolCalls) {
        yield { type: 'tool_use' as const, id: tc.id, name: tc.name, input: tc.input }
      }
      yield { type: 'done' as const, result: { text: result.text, media: [], toolCalls: result.toolCalls } }
    },
  }

  const router = {
    resolve: async () => ({ provider, profile: {} }),
  } as unknown as GenerateRouter

  return {
    router,
    setResult(next) { result = { text: 'mock reply', toolCalls: [], ...next } },
    setShouldThrow(err) { shouldThrow = err },
    callCount() { return calls.length },
    lastCall() { return calls[calls.length - 1] ?? null },
  }
}

/** Minimal session — the runner appends the prompt, reads the active
 *  window, and appends the assistant reply. None of the bodies matter to
 *  these tests; we just need the methods to exist and resolve. */
function createMockSession(): ISessionStore {
  return {
    id: 'test/session',
    appendUser: vi.fn(async () => {}),
    appendAssistant: vi.fn(async () => {}),
    readActive: vi.fn(async () => []),
  } as unknown as ISessionStore
}

/** Records emit() calls for assertion. */
function createEmitRecorder() {
  const events: Array<{ type: string; payload: object }> = []
  const emit: AgentWorkEmitFn = async (type, payload) => {
    events.push({ type, payload })
    return { seq: events.length, ts: Date.now() }
  }
  return { events, emit }
}

/** Minimal request factory — overlay caller-specific fields onto sane defaults. */
function makeRequest(overrides: Partial<AgentWorkRequest> = {}): AgentWorkRequest {
  return {
    prompt: 'do something',
    session: createMockSession(),
    preamble: 'You are operating in test context.',
    metadata: { source: 'cron' },
    emitNames: { done: 'cron.done', skip: 'cron.skip', error: 'cron.error' },
    buildDonePayload: (req, result, durationMs, delivered) => ({
      reply: result.text,
      durationMs,
      delivered,
    }),
    buildErrorPayload: (req, err, durationMs) => ({
      error: err.message,
      durationMs,
    }),
    ...overrides,
  }
}

function createRunner(mock: RouterMock, store?: IInboxStore) {
  const inboxStore = store ?? createMemoryInboxStore()
  const logger = { warn: vi.fn(), error: vi.fn() }
  const runner = new AgentWorkRunner({
    router: mock.router,
    inboxStore,
    logger,
  })
  return { runner, inboxStore, logger }
}

// Restore per-test spies (e.g. an inboxStore.append rejection) so a
// mocked rejection in one test can't bleed into the next.
afterEach(() => {
  vi.restoreAllMocks()
})

// ==================== Tests ====================

describe('AgentWorkRunner — default behaviour (no gates)', () => {
  let mock: RouterMock
  let runner: AgentWorkRunner
  let store: IInboxStore
  let emitRec: ReturnType<typeof createEmitRecorder>

  beforeEach(() => {
    mock = createMockRouter()
    const made = createRunner(mock)
    runner = made.runner
    store = made.inboxStore
    emitRec = createEmitRecorder()
  })

  it('invokes AI with the prompt + preamble', async () => {
    await runner.run(makeRequest({ prompt: 'hello', preamble: 'context X' }), emitRec.emit)
    expect(mock.callCount()).toBe(1)
    expect(mock.lastCall()?.prompt).toBe('hello')
    expect(mock.lastCall()?.preamble).toBe('context X')
  })

  it('delivers result.text to the inbox under automation:<source>', async () => {
    mock.setResult({ text: 'AI says hi' })
    await runner.run(makeRequest(), emitRec.emit)
    const { entries } = await store.read()
    expect(entries).toHaveLength(1)
    expect(entries[0].comments).toBe('AI says hi')
    expect(entries[0].workspaceId).toBe('automation:cron')
  })

  it('emits done with delivered=true and durationMs >= 0', async () => {
    mock.setResult({ text: 'reply' })
    await runner.run(makeRequest(), emitRec.emit)
    expect(emitRec.events).toHaveLength(1)
    expect(emitRec.events[0].type).toBe('cron.done')
    const payload = emitRec.events[0].payload as { reply: string; durationMs: number; delivered: boolean }
    expect(payload.reply).toBe('reply')
    expect(payload.delivered).toBe(true)
    expect(payload.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('does not emit skip or error on the happy path', async () => {
    await runner.run(makeRequest(), emitRec.emit)
    expect(emitRec.events.filter(e => e.type === 'cron.skip')).toHaveLength(0)
    expect(emitRec.events.filter(e => e.type === 'cron.error')).toHaveLength(0)
  })

  it('returns outcome=delivered', async () => {
    const result = await runner.run(makeRequest(), emitRec.emit)
    expect(result.outcome).toBe('delivered')
  })
})

describe('AgentWorkRunner — inputGate', () => {
  let mock: RouterMock
  let runner: AgentWorkRunner
  let store: IInboxStore
  let logger: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }
  let emitRec: ReturnType<typeof createEmitRecorder>

  beforeEach(() => {
    mock = createMockRouter()
    const made = createRunner(mock)
    runner = made.runner
    store = made.inboxStore
    logger = made.logger
    emitRec = createEmitRecorder()
  })

  it('returns null → AI is invoked', async () => {
    await runner.run(
      makeRequest({ inputGate: () => null }),
      emitRec.emit,
    )
    expect(mock.callCount()).toBe(1)
  })

  it('returns skip → AI is NOT invoked', async () => {
    await runner.run(
      makeRequest({
        inputGate: () => ({ reason: 'outside-hours', payload: { reason: 'outside-hours' } }),
      }),
      emitRec.emit,
    )
    expect(mock.callCount()).toBe(0)
  })

  it('skip → emits skip event with skip.payload', async () => {
    await runner.run(
      makeRequest({
        inputGate: () => ({ reason: 'outside-hours', payload: { reason: 'outside-hours', detail: 'asia/tokyo' } }),
      }),
      emitRec.emit,
    )
    expect(emitRec.events).toHaveLength(1)
    expect(emitRec.events[0].type).toBe('cron.skip')
    expect(emitRec.events[0].payload).toEqual({ reason: 'outside-hours', detail: 'asia/tokyo' })
  })

  it('skip → outcome=skipped with skipReason set', async () => {
    const result = await runner.run(
      makeRequest({
        inputGate: () => ({ reason: 'outside-hours', payload: {} }),
      }),
      emitRec.emit,
    )
    expect(result.outcome).toBe('skipped')
    expect(result.skipReason).toBe('outside-hours')
  })

  it('skip → no inbox entry appended', async () => {
    await runner.run(
      makeRequest({
        inputGate: () => ({ reason: 'gated', payload: {} }),
      }),
      emitRec.emit,
    )
    const { entries } = await store.read()
    expect(entries).toHaveLength(0)
  })

  it('skip → buildSkipPayload override is used when provided', async () => {
    await runner.run(
      makeRequest({
        inputGate: () => ({ reason: 'gated', payload: { from: 'gate' } }),
        buildSkipPayload: (_req, skip) => ({ reason: skip.reason, customField: 'override' }),
      }),
      emitRec.emit,
    )
    expect(emitRec.events[0].payload).toEqual({ reason: 'gated', customField: 'override' })
  })

  it('skip but emitNames.skip undefined → silent suppression with warning', async () => {
    await runner.run(
      makeRequest({
        emitNames: { done: 'cron.done', error: 'cron.error' }, // no skip
        inputGate: () => ({ reason: 'gated', payload: {} }),
      }),
      emitRec.emit,
    )
    expect(emitRec.events).toHaveLength(0) // nothing emitted
    expect(logger.warn).toHaveBeenCalled()
    expect(logger.warn.mock.calls[0][0]).toContain('skip=')
  })
})

describe('AgentWorkRunner — outputGate', () => {
  let mock: RouterMock
  let runner: AgentWorkRunner
  let store: IInboxStore
  let emitRec: ReturnType<typeof createEmitRecorder>

  beforeEach(() => {
    mock = createMockRouter()
    const made = createRunner(mock)
    runner = made.runner
    store = made.inboxStore
    emitRec = createEmitRecorder()
  })

  it('default (omitted) delivers result.text', async () => {
    mock.setResult({ text: 'untouched reply' })
    await runner.run(makeRequest(), emitRec.emit)
    const { entries } = await store.read()
    expect(entries[0].comments).toBe('untouched reply')
  })

  it('deliver decision uses the gate text not result.text', async () => {
    mock.setResult({ text: 'raw AI text' })
    await runner.run(
      makeRequest({
        outputGate: () => ({ kind: 'deliver', text: 'rewritten by gate', media: [] }),
      }),
      emitRec.emit,
    )
    const { entries } = await store.read()
    expect(entries[0].comments).toBe('rewritten by gate')
  })

  it('skip decision → emits skip event with reason, no inbox entry', async () => {
    await runner.run(
      makeRequest({
        outputGate: () => ({ kind: 'skip', reason: 'duplicate', payload: { reason: 'duplicate' } }),
      }),
      emitRec.emit,
    )
    expect(emitRec.events.find(e => e.type === 'cron.skip')).toBeDefined()
    expect(emitRec.events.find(e => e.type === 'cron.done')).toBeUndefined()
    const { entries } = await store.read()
    expect(entries).toHaveLength(0)
  })

  it('skip decision → outcome=skipped with reason', async () => {
    const result = await runner.run(
      makeRequest({
        outputGate: () => ({ kind: 'skip', reason: 'duplicate', payload: {} }),
      }),
      emitRec.emit,
    )
    expect(result.outcome).toBe('skipped')
    expect(result.skipReason).toBe('duplicate')
  })

  it('receives probe with text, media, toolCalls', async () => {
    const observed: Array<{ text: string; mediaLen: number; toolCallCount: number }> = []
    mock.setResult({
      text: 'AI text',
      toolCalls: [{ id: 't1', name: 'foo', input: { x: 1 } }],
    })
    await runner.run(
      makeRequest({
        outputGate: (probe) => {
          observed.push({
            text: probe.text,
            mediaLen: probe.media.length,
            toolCallCount: probe.toolCalls.length,
          })
          return { kind: 'deliver', text: probe.text, media: probe.media }
        },
      }),
      emitRec.emit,
    )
    expect(observed).toHaveLength(1)
    // media is always [] post-rewire (inbox renders workspace files, not
    // inline binaries); the toolCall surfaced from the stream is observed.
    expect(observed[0]).toEqual({ text: 'AI text', mediaLen: 0, toolCallCount: 1 })
  })

  it('no tool calls in stream → probe gets empty array', async () => {
    let observedLen = -1
    mock.setResult({ text: 'reply' /* no toolCalls */ })
    await runner.run(
      makeRequest({
        outputGate: (probe) => {
          observedLen = probe.toolCalls.length
          return { kind: 'deliver', text: probe.text, media: probe.media }
        },
      }),
      emitRec.emit,
    )
    expect(observedLen).toBe(0)
  })
})

describe('AgentWorkRunner — tool-inspecting outputGate', () => {
  let mock: RouterMock
  let runner: AgentWorkRunner
  let store: IInboxStore
  let emitRec: ReturnType<typeof createEmitRecorder>

  beforeEach(() => {
    mock = createMockRouter()
    const made = createRunner(mock)
    runner = made.runner
    store = made.inboxStore
    emitRec = createEmitRecorder()
  })

  /** A source's outputGate can inspect the observed tool calls and
   *  deliver a tool's args instead of the raw model text. This is the
   *  generic idiom the (now-deleted) notify_user gate relied on; the
   *  AgentWork primitive still guarantees it works for any tool name. */
  function pushToolGate(probe: AgentWorkResultProbe) {
    const call = probe.toolCalls.find((c) => c.name === 'push')
    if (!call) return { kind: 'skip' as const, reason: 'ack', payload: { reason: 'ack' } }
    const text = ((call.input ?? {}) as { text?: string }).text ?? ''
    if (!text.trim()) return { kind: 'skip' as const, reason: 'empty', payload: { reason: 'empty' } }
    return { kind: 'deliver' as const, text, media: probe.media }
  }

  it('AI calls the tool → delivers tool args, not result.text', async () => {
    mock.setResult({
      text: 'I have decided to push', // raw model text — should NOT be delivered
      toolCalls: [{ id: 't1', name: 'push', input: { text: 'BTC dropped 5%', urgency: 'important' } }],
    })
    await runner.run(makeRequest({ outputGate: pushToolGate }), emitRec.emit)
    const { entries } = await store.read()
    expect(entries).toHaveLength(1)
    expect(entries[0].comments).toBe('BTC dropped 5%')
  })

  it('AI does not call the tool → skip with reason=ack', async () => {
    mock.setResult({ text: 'nothing to report', toolCalls: [] })
    const result = await runner.run(makeRequest({ outputGate: pushToolGate }), emitRec.emit)
    expect(result.skipReason).toBe('ack')
    expect((await store.read()).entries).toHaveLength(0)
  })

  it('AI calls the tool with empty text → skip reason=empty', async () => {
    mock.setResult({
      text: '',
      toolCalls: [{ id: 't1', name: 'push', input: { text: '   ' } }],
    })
    const result = await runner.run(makeRequest({ outputGate: pushToolGate }), emitRec.emit)
    expect(result.skipReason).toBe('empty')
  })
})

describe('AgentWorkRunner — AI invocation errors', () => {
  let mock: RouterMock
  let runner: AgentWorkRunner
  let store: IInboxStore
  let emitRec: ReturnType<typeof createEmitRecorder>

  beforeEach(() => {
    mock = createMockRouter()
    const made = createRunner(mock)
    runner = made.runner
    store = made.inboxStore
    emitRec = createEmitRecorder()
  })

  it('AI throws → emits error event with caller-shaped payload', async () => {
    mock.setShouldThrow(new Error('provider boom'))
    await runner.run(makeRequest(), emitRec.emit)
    expect(emitRec.events).toHaveLength(1)
    expect(emitRec.events[0].type).toBe('cron.error')
    expect(emitRec.events[0].payload).toMatchObject({ error: 'provider boom' })
  })

  it('AI throws → outcome=errored', async () => {
    mock.setShouldThrow(new Error('boom'))
    const result = await runner.run(makeRequest(), emitRec.emit)
    expect(result.outcome).toBe('errored')
  })

  it('AI throws → no inbox entry appended', async () => {
    mock.setShouldThrow(new Error('boom'))
    await runner.run(makeRequest(), emitRec.emit)
    expect((await store.read()).entries).toHaveLength(0)
  })

  it('AI throws → no done event emitted', async () => {
    mock.setShouldThrow(new Error('boom'))
    await runner.run(makeRequest(), emitRec.emit)
    expect(emitRec.events.find(e => e.type === 'cron.done')).toBeUndefined()
  })

  it('AI throws non-Error → wraps in Error', async () => {
    mock.setShouldThrow('string error' as unknown as Error)
    await runner.run(makeRequest(), emitRec.emit)
    expect(emitRec.events[0].payload).toMatchObject({ error: 'string error' })
  })

  it('error event emit failure is logged, run does not throw', async () => {
    mock.setShouldThrow(new Error('boom'))
    const made = createRunner(mock)
    const flakyEmit: AgentWorkEmitFn = vi.fn(async () => {
      throw new Error('emit fail')
    })
    // Should NOT throw despite emit failing
    const result = await made.runner.run(makeRequest(), flakyEmit)
    expect(result.outcome).toBe('errored')
    expect(made.logger.error).toHaveBeenCalled()
  })
})

describe('AgentWorkRunner — inbox append failure', () => {
  let mock: RouterMock
  let emitRec: ReturnType<typeof createEmitRecorder>

  beforeEach(() => {
    mock = createMockRouter()
    emitRec = createEmitRecorder()
  })

  it('append throw → done event emitted with delivered=false', async () => {
    const inboxStore = createMemoryInboxStore()
    vi.spyOn(inboxStore, 'append').mockRejectedValue(new Error('inbox boom'))
    const logger = { warn: vi.fn(), error: vi.fn() }
    const runner = new AgentWorkRunner({ router: mock.router, inboxStore, logger })

    await runner.run(makeRequest(), emitRec.emit)

    const doneEvent = emitRec.events.find(e => e.type === 'cron.done')
    expect(doneEvent).toBeDefined()
    expect((doneEvent!.payload as { delivered: boolean }).delivered).toBe(false)
    expect(logger.warn).toHaveBeenCalled()
  })

  it('append throw → outcome still delivered (work itself succeeded)', async () => {
    const inboxStore = createMemoryInboxStore()
    vi.spyOn(inboxStore, 'append').mockRejectedValue(new Error('inbox boom'))
    const runner = new AgentWorkRunner({
      router: mock.router,
      inboxStore,
      logger: { warn: vi.fn(), error: vi.fn() },
    })
    const result = await runner.run(makeRequest(), emitRec.emit)
    expect(result.outcome).toBe('delivered')
  })

  it('append throw → onDelivered NOT called', async () => {
    const inboxStore = createMemoryInboxStore()
    vi.spyOn(inboxStore, 'append').mockRejectedValue(new Error('inbox boom'))
    const runner = new AgentWorkRunner({
      router: mock.router,
      inboxStore,
      logger: { warn: vi.fn(), error: vi.fn() },
    })
    const onDelivered = vi.fn()
    await runner.run(makeRequest({ onDelivered }), emitRec.emit)
    expect(onDelivered).not.toHaveBeenCalled()
  })
})

describe('AgentWorkRunner — onDelivered hook', () => {
  let mock: RouterMock
  let runner: AgentWorkRunner
  let logger: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }
  let emitRec: ReturnType<typeof createEmitRecorder>

  beforeEach(() => {
    mock = createMockRouter()
    const made = createRunner(mock)
    runner = made.runner
    logger = made.logger
    emitRec = createEmitRecorder()
  })

  it('called with delivered text after successful append', async () => {
    mock.setResult({ text: 'hello' })
    const onDelivered = vi.fn()
    await runner.run(makeRequest({ onDelivered }), emitRec.emit)
    expect(onDelivered).toHaveBeenCalledTimes(1)
    expect(onDelivered.mock.calls[0][0]).toBe('hello')
  })

  it('NOT called when outputGate skips', async () => {
    const onDelivered = vi.fn()
    await runner.run(
      makeRequest({
        onDelivered,
        outputGate: () => ({ kind: 'skip', reason: 'duplicate', payload: {} }),
      }),
      emitRec.emit,
    )
    expect(onDelivered).not.toHaveBeenCalled()
  })

  it('NOT called when inputGate skips', async () => {
    const onDelivered = vi.fn()
    await runner.run(
      makeRequest({
        onDelivered,
        inputGate: () => ({ reason: 'gated', payload: {} }),
      }),
      emitRec.emit,
    )
    expect(onDelivered).not.toHaveBeenCalled()
  })

  it('throw is caught, run completes, done emitted', async () => {
    const onDelivered = vi.fn(() => { throw new Error('hook boom') })
    const result = await runner.run(makeRequest({ onDelivered }), emitRec.emit)
    expect(result.outcome).toBe('delivered')
    expect(emitRec.events.find(e => e.type === 'cron.done')).toBeDefined()
    expect(logger.warn).toHaveBeenCalled()
  })
})

describe('AgentWorkRunner — clock injection', () => {
  it('durationMs uses injected now()', async () => {
    const mock = createMockRouter()
    const inboxStore = createMemoryInboxStore()
    let t = 1000
    const runner = new AgentWorkRunner({
      router: mock.router,
      inboxStore,
      now: () => {
        const v = t
        t += 250 // every call advances by 250ms
        return v
      },
      logger: { warn: vi.fn(), error: vi.fn() },
    })
    const emitRec = createEmitRecorder()
    await runner.run(makeRequest(), emitRec.emit)
    const done = emitRec.events.find(e => e.type === 'cron.done')!
    // start=1000, end=1250 → duration 250
    expect((done.payload as { durationMs: number }).durationMs).toBe(250)
  })
})

describe('AgentWorkRunner — source label flows through to the inbox', () => {
  it('inbox entry carries the source in its workspace id + label', async () => {
    const mock = createMockRouter()
    const inboxStore = createMemoryInboxStore()
    const appendSpy = vi.spyOn(inboxStore, 'append')
    const runner = new AgentWorkRunner({
      router: mock.router,
      inboxStore,
      logger: { warn: vi.fn(), error: vi.fn() },
    })
    const emitRec = createEmitRecorder()
    await runner.run(makeRequest({ metadata: { source: 'heartbeat' } }), emitRec.emit)
    expect(appendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'automation:heartbeat',
        workspaceLabel: 'Automation · heartbeat',
      }),
    )
  })
})

describe('AgentWorkRunner — concurrent runs (stateless runner)', () => {
  it('two parallel run() calls do not interfere', async () => {
    const mock = createMockRouter()
    const made = createRunner(mock)
    const emit1 = createEmitRecorder()
    const emit2 = createEmitRecorder()
    const [r1, r2] = await Promise.all([
      made.runner.run(makeRequest({ prompt: 'A', metadata: { source: 'cron' } }), emit1.emit),
      made.runner.run(makeRequest({ prompt: 'B', metadata: { source: 'task' } }), emit2.emit),
    ])
    expect(r1.outcome).toBe('delivered')
    expect(r2.outcome).toBe('delivered')
    expect(mock.callCount()).toBe(2)
    // Each emit recorder got its own done event
    expect(emit1.events).toHaveLength(1)
    expect(emit2.events).toHaveLength(1)
  })
})
