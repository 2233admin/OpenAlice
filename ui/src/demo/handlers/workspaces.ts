import { http, HttpResponse } from 'msw'
import { demoWorkspaces, demoTemplates } from '../fixtures/workspaces'
import { demoWorkspaceFiles } from '../fixtures/inbox'

export const workspacesHandlers = [
  http.get('/api/workspaces', () => HttpResponse.json({ workspaces: demoWorkspaces })),
  http.post('/api/workspaces', () =>
    HttpResponse.json(
      { ok: false, status: 400, error: { error: 'bootstrap_failed', message: 'Demo mode — workspace creation is disabled.' } },
      { status: 400 },
    ),
  ),
  http.delete('/api/workspaces/:id', () => HttpResponse.json(true)),
  http.post('/api/workspaces/:id/stop', () => HttpResponse.json(true)),

  http.get('/api/workspaces/templates', () => HttpResponse.json({ templates: demoTemplates })),
  http.get('/api/workspaces/templates/:name/readme', () =>
    HttpResponse.text('', { status: 404 }),
  ),

  http.get('/api/workspaces/agents', () =>
    HttpResponse.json({
      agents: [
        { id: 'claude', displayName: 'Claude Code', capabilities: { parallelPerCwd: true, resumeLast: false, resumeById: true, transcriptDiscovery: 'fs-watch' } },
        { id: 'codex', displayName: 'Codex', capabilities: { parallelPerCwd: true, resumeLast: true, resumeById: true, transcriptDiscovery: 'subprocess' } },
        { id: 'opencode', displayName: 'opencode', capabilities: { parallelPerCwd: true, resumeLast: true, resumeById: true, transcriptDiscovery: 'subprocess' } },
        { id: 'pi', displayName: 'Pi', capabilities: { parallelPerCwd: true, resumeLast: true, resumeById: true, transcriptDiscovery: 'none' } },
      ],
    }),
  ),
  http.get('/api/workspaces/credentials', () => HttpResponse.json({ credentials: [] })),
  http.post('/api/workspaces/credentials', () =>
    HttpResponse.json({ slug: 'custom-1', vendor: 'custom' }, { status: 201 }),
  ),

  http.get('/api/workspaces/:id/git/log', () => HttpResponse.json({ entries: [] })),
  http.get('/api/workspaces/:id/git/status', () =>
    HttpResponse.json({ branch: 'main', clean: true, files: [] }),
  ),
  http.get('/api/workspaces/:id/files', () =>
    HttpResponse.json({ path: '/', entries: [] }),
  ),
  http.get('/api/workspaces/:id/file', ({ request }) => {
    const url = new URL(request.url)
    const path = url.searchParams.get('path') ?? ''
    const content = demoWorkspaceFiles[path]
    if (content != null) return HttpResponse.json({ content })
    return HttpResponse.json({ error: 'file_not_found' }, { status: 404 })
  }),

  http.post('/api/workspaces/:id/sessions/spawn', ({ params }) =>
    HttpResponse.json({
      sessionId: 'demo-session',
      wsId: String(params.id),
      name: 'c1',
      pid: 0,
      startedAt: Date.now(),
      agent: 'claude',
      agentSessionId: null,
      title: null,
    }),
  ),

  // Quick-chat launch — reuse the first demo chat workspace and hand back the
  // scripted demo session (the Terminal short-circuits to DemoTerminalReplay).
  http.post('/api/workspaces/quick-chat', () => {
    const ws = demoWorkspaces[0]
    return HttpResponse.json(
      {
        workspace: ws,
        session: {
          sessionId: 'demo-session',
          wsId: ws?.id ?? 'demo-ws',
          name: 'c1',
          pid: 0,
          startedAt: Date.now(),
          agent: 'claude',
          agentSessionId: null,
          title: null,
        },
      },
      { status: 201 },
    )
  }),
  http.post('/api/workspaces/:id/sessions/:sid/pause', () => HttpResponse.json(true)),
  http.post('/api/workspaces/:id/sessions/:sid/resume', () => HttpResponse.json(null)),
  http.delete('/api/workspaces/:id/sessions/:sid', () => HttpResponse.json(true)),
  http.get('/api/workspaces/:id/sessions/:sid/diagnostics', () =>
    HttpResponse.json({ status: 'demo' }),
  ),

  http.get('/api/workspaces/:id/agent-config', () => HttpResponse.json({})),
  http.put('/api/workspaces/:id/agent-config/:agent', () => HttpResponse.json({ ok: true })),
  http.post('/api/workspaces/:id/agent-config/:agent/test', () =>
    HttpResponse.json({ ok: true, response: 'Demo mode — test is stubbed.' }),
  ),
]
