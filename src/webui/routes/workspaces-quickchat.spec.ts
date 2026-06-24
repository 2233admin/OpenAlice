/**
 * POST /quick-chat — the loginless-runtime credential injection (opencode/pi).
 * claude/codex carry their own CLI login and must NOT be injected; opencode/pi
 * are seeded from the vault before spawn, and dead-end (no compatible cred) with
 * a 400 the composer turns into a "configure a provider" bounce.
 *
 * core/config is partial-mocked so we can drive the vault per-test without
 * touching the real ai-provider-manager.json.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createWorkspaceRoutes } from './workspaces.js';
import { readCredentials, setCredentialLastModel, type Credential } from '../../core/config.js';
import type { WorkspaceService } from '../../workspaces/service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock('../../core/config.js', async (importActual) => {
  const actual = await importActual<typeof import('../../core/config.js')>();
  return { ...actual, readCredentials: vi.fn(), setCredentialLastModel: vi.fn(async () => {}) };
});

const openaiKey: Credential = {
  vendor: 'openai', authType: 'api-key', apiKey: 'sk-oa', wires: { 'openai-chat': '' },
};

function build() {
  const META = { id: 'ws-1', dir: '/w', agents: ['claude', 'opencode'], template: 'chat', tag: 'chat-x' };
  const opencode = {
    id: 'opencode',
    namePrefix: 'o',
    writeAiConfig: vi.fn(async () => {}),
    readAiConfig: vi.fn(async () => null), // workspace has no prior config
  };
  const claude = { id: 'claude', namePrefix: 'c' };
  const adapters: Record<string, any> = { opencode, claude };
  const spawn = vi.fn(() => ({
    recordId: 'rec-1', wsId: 'ws-1', name: 'o1', pid: 1, agentSessionId: null, startedAt: 1,
  }));
  const svc = {
    registry: { list: () => [] }, // → creator.create path (bypasses tag matching)
    creator: { create: vi.fn(async () => ({ ok: true, workspace: META })) },
    resolveAdapter: (_m: any, agentId?: string) => adapters[agentId ?? 'claude'] ?? claude,
    adapters: { get: (id: string) => adapters[id] },
    sessionRegistry: {
      ensureLoaded: vi.fn(async () => {}),
      nextName: () => 'o1',
      create: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    },
    pool: { spawn },
    publicMeta: vi.fn(async () => META),
    config: { launcherRepoRoot: '/repo' },
  } as unknown as WorkspaceService;
  return { app: createWorkspaceRoutes(svc), opencode, spawn };
}

async function quickChat(app: any, body: unknown) {
  const res = await app.request('/quick-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

beforeEach(() => {
  vi.mocked(readCredentials).mockReset();
  vi.mocked(setCredentialLastModel).mockClear();
});

describe('POST /quick-chat — loginless credential injection', () => {
  it('opencode + empty vault → 400 no_ai_credential, no inject, no spawn', async () => {
    vi.mocked(readCredentials).mockResolvedValue({});
    const { app, opencode, spawn } = build();
    const r = await quickChat(app, { prompt: 'hi', agent: 'opencode' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('no_ai_credential');
    expect(r.body.settingsTarget).toBe('ai-provider'); // the composer's bounce target
    expect(opencode.writeAiConfig).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it('opencode + compatible cred → injects it (flagship model) then spawns', async () => {
    vi.mocked(readCredentials).mockResolvedValue({ 'openai-1': openaiKey });
    const { app, opencode, spawn } = build();
    const r = await quickChat(app, { prompt: 'hi', agent: 'opencode' });
    expect(r.status).toBe(201);
    expect(opencode.writeAiConfig).toHaveBeenCalledOnce();
    const cred = (opencode.writeAiConfig.mock.calls[0] as any[])[1];
    expect(cred.apiKey).toBe('sk-oa');
    expect(cred.wireShape).toBe('openai-chat');
    expect(cred.model).toBe('gpt-5.5'); // vendor flagship — no lastModel yet
    // model remembered on the cred for next time
    expect(vi.mocked(setCredentialLastModel)).toHaveBeenCalledWith('openai-1', 'gpt-5.5');
    expect(spawn).toHaveBeenCalledOnce();
  });

  it('honors an explicit credentialSlug pick', async () => {
    vi.mocked(readCredentials).mockResolvedValue({
      'openai-1': openaiKey,
      'openai-2': { ...openaiKey, apiKey: 'sk-second', lastModel: 'gpt-5.5-mini' },
    });
    const { app, opencode } = build();
    await quickChat(app, { prompt: 'hi', agent: 'opencode', credentialSlug: 'openai-2' });
    const cred = (opencode.writeAiConfig.mock.calls[0] as any[])[1];
    expect(cred.apiKey).toBe('sk-second');
    expect(cred.model).toBe('gpt-5.5-mini'); // remembered lastModel wins over flagship
  });

  it('claude is never injected (own CLI login) — vault is not even read', async () => {
    const { app, spawn } = build();
    const r = await quickChat(app, { prompt: 'hi', agent: 'claude' });
    expect(r.status).toBe(201);
    expect(vi.mocked(readCredentials)).not.toHaveBeenCalled();
    expect(spawn).toHaveBeenCalledOnce();
  });
});
