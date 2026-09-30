import { afterEach, expect, it, vi } from 'vitest'
import { workspaceJourney } from '../../helpers/workspace-journey.js'

let journey: Awaited<ReturnType<typeof workspaceJourney>> | undefined
afterEach(async () => { await journey?.close(); journey = undefined })

async function setup() {
  journey = await workspaceJourney()
  const chat = await journey.service.resolveOrCreateChatWorkspace()
  if (!chat.ok) throw new Error('Chat bootstrap failed')
  const { createWorkspaceConversationControl } = await import('../../../src/workspaces/conversation-control.js')
  const { createWorkspaceRoutes } = await import('../../../src/webui/routes/workspaces.js')
  return { journey, chat: chat.workspace, conversation: createWorkspaceConversationControl(journey.service), routes: createWorkspaceRoutes(journey.service) }
}

it('records real child failure and resumes the persisted native identity after restart', async () => {
  const { journey, chat, conversation } = await setup()
  journey.fixture('console.log(JSON.stringify({type:"thread.started",thread_id:"local-native-session"})); setTimeout(()=>process.exit(9),50)')
  const offered = await conversation.ask({ target: { kind: 'workspace', workspaceId: chat.id }, agent: 'codex', prompt: 'fail', source: { kind: 'human' } })
  if (offered.status === 'unavailable') throw new Error(JSON.stringify(offered))
  const failed = await journey.settled(offered.taskId, 'failed')
  expect(failed.exitCode).toBe(9)
  expect(journey.service.executions.list(offered.resumeId)[0].phase).toBe('failed')
  await journey.restart()
  const command = journey.fixture()
  const { createWorkspaceConversationControl } = await import('../../../src/workspaces/conversation-control.js')
  const resumed = await createWorkspaceConversationControl(journey.service).ask({ target: { kind: 'resume', resumeId: offered.resumeId }, prompt: 'retry', source: { kind: 'human' } })
  if (resumed.status === 'unavailable') throw new Error(JSON.stringify(resumed))
  await journey.settled(resumed.taskId)
  expect(resumed.resumeId).toBe(offered.resumeId)
  expect(command.mock.calls[0][1]).toMatchObject({ resume: { sessionId: 'local-native-session' } })
  expect(journey.service.executions.list(offered.resumeId).map(row => row.phase)).toEqual(['failed', 'ended'])
}, 45_000)

it('waits for terminal dispatch persistence before dispose resolves', async () => {
  const { journey, chat, conversation } = await setup()
  journey.fixture('console.log(JSON.stringify({type:"thread.started",thread_id:"local-native-session"})); setInterval(()=>{},1000)')
  const offered = await conversation.ask({ target: { kind: 'workspace', workspaceId: chat.id }, agent: 'codex', prompt: 'hold', source: { kind: 'human' } })
  if (offered.status === 'unavailable') throw new Error(JSON.stringify(offered))
  await vi.waitFor(() => expect(journey.service.executions.current(offered.resumeId)?.phase).toBe('running'))
  let release!: () => void
  const persist = new Promise<void>(resolve => { release = resolve })
  const original = journey.service.headlessTasks.complete.bind(journey.service.headlessTasks)
  const complete = vi.spyOn(journey.service.headlessTasks, 'complete').mockImplementation(async (...args) => { await persist; return original(...args) })
  let finished = false
  const disposal = journey.service.dispose('shutdown-persistence-regression').then(() => { finished = true })
  let secondFinished = false
  const secondDisposal = journey.service.dispose('duplicate-quit').then(() => { secondFinished = true })
  try {
    await vi.waitFor(() => expect(complete).toHaveBeenCalled(), { timeout: 10_000 })
    expect(finished).toBe(false)
    expect(secondFinished).toBe(false)
  } finally { release(); await Promise.all([disposal, secondDisposal]) }
  expect(journey.service.headlessTasks.get(offered.taskId)?.status).not.toBe('running')
  expect(journey.service.isResumeActive(offered.resumeId)).toBe(false)
  await expect(journey.service.executions.dispatch(chat, journey.service.adapters.get('codex')!, 'late', { kind: 'user', entry: 'late-dispatch' })).rejects.toThrow('shutting down')
}, 45_000)

it('interrupts through HTTP, requires explicit release, and rejects an old execution interrupt after resume', async () => {
  const { journey, chat, conversation, routes } = await setup()
  const command = journey.fixture('console.log(JSON.stringify({type:"thread.started",thread_id:"local-native-session"})); setInterval(()=>{},1000)')
  const offered = await conversation.ask({ target: { kind: 'workspace', workspaceId: chat.id }, agent: 'codex', prompt: 'hold', source: { kind: 'human' } })
  if (offered.status === 'unavailable') throw new Error(JSON.stringify(offered))
  await vi.waitFor(() => expect(journey.service.resumeRegistry.get(offered.resumeId)?.agentSessionId).toBe('local-native-session'))
  const record = journey.service.sessionRegistry.findByResumeId(chat.id, offered.resumeId)!
  const prefix = `/${chat.id}/sessions/${record.id}`
  const oldExecution = journey.service.executions.current(offered.resumeId)!
  const interrupt = () => routes.request(`${prefix}/interrupt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ executionId: oldExecution.executionId }) })
  expect((await interrupt()).status).toBe(200)
  await journey.settled(offered.taskId, 'interrupted')
  // Termination is observed, not just a metadata transition.
  expect(() => process.kill(oldExecution.pid!, 0)).toThrow()
  await expect(conversation.ask({ target: { kind: 'resume', resumeId: offered.resumeId }, prompt: 'blocked', source: { kind: 'human' } })).rejects.toMatchObject({ code: 'session_blocked' })
  const blocks = journey.service.executions.admission.blocks(offered.resumeId)
  expect(blocks).toHaveLength(1)
  expect((await routes.request(`${prefix}/blocks/${blocks[0].id}/release`, { method: 'POST' })).status).toBe(200)
  const resumed = await conversation.ask({ target: { kind: 'resume', resumeId: offered.resumeId }, prompt: 'resume', source: { kind: 'human' } })
  if (resumed.status === 'unavailable') throw new Error(JSON.stringify(resumed))
  await vi.waitFor(() => expect(journey.service.executions.current(offered.resumeId)?.phase).toBe('running'))
  const newExecution = journey.service.executions.current(offered.resumeId)!
  expect(newExecution.executionId).not.toBe(oldExecution.executionId)
  expect(command).toHaveBeenCalledTimes(2)
  const stale = await interrupt()
  expect(stale.status).toBe(200)
  expect(await stale.json()).toEqual({ stopped: false })
  expect(journey.service.executions.current(offered.resumeId)?.executionId).toBe(newExecution.executionId)
  await journey.service.dispose('explicit-quit')
  expect(() => process.kill(newExecution.pid!, 0)).toThrow()
  await expect(conversation.ask({ target: { kind: 'resume', resumeId: offered.resumeId }, prompt: 'late', source: { kind: 'human' } })).rejects.toThrow()
}, 45_000)
