/**
 * Characterization / golden test for the per-workspace AI-config writers after
 * they moved out of the webui routes into the CLI adapters (Phase A). The
 * asserted bytes are exactly what the pre-move route-level writers produced —
 * this is the regression guard proving the move is behavior-preserving.
 */

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claudeAdapter } from './claude.js';
import { codexAdapter } from './codex.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'aicfg-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const read = (rel: string): Promise<string> => readFile(join(dir, rel), 'utf8');

describe('claudeAdapter AI-config', () => {
  it('writes full x-api-key config byte-exact', async () => {
    await claudeAdapter.writeAiConfig!(dir, {
      baseUrl: 'https://api.test/v1', apiKey: 'sk-123', model: 'claude-x', authMode: 'x-api-key',
    });
    expect(await read('.claude/settings.local.json')).toBe(
      '{\n  "env": {\n    "ANTHROPIC_BASE_URL": "https://api.test/v1",\n    "ANTHROPIC_API_KEY": "sk-123"\n  },\n  "model": "claude-x"\n}\n',
    );
  });

  it('writes the key into ANTHROPIC_AUTH_TOKEN in bearer mode', async () => {
    await claudeAdapter.writeAiConfig!(dir, {
      baseUrl: 'https://g/v1', apiKey: 'k', model: 'm', authMode: 'bearer',
    });
    expect(await read('.claude/settings.local.json')).toBe(
      '{\n  "env": {\n    "ANTHROPIC_BASE_URL": "https://g/v1",\n    "ANTHROPIC_AUTH_TOKEN": "k"\n  },\n  "model": "m"\n}\n',
    );
  });

  it('writes a model-only config with no env block', async () => {
    await claudeAdapter.writeAiConfig!(dir, { model: 'm' });
    expect(await read('.claude/settings.local.json')).toBe('{\n  "model": "m"\n}\n');
  });

  it('reset (empty cred) deletes the settings file', async () => {
    await claudeAdapter.writeAiConfig!(dir, { model: 'm' });
    await claudeAdapter.writeAiConfig!(dir, {});
    expect(existsSync(join(dir, '.claude/settings.local.json'))).toBe(false);
  });

  it('round-trips through readAiConfig', async () => {
    await claudeAdapter.writeAiConfig!(dir, {
      baseUrl: 'https://api.test/v1', apiKey: 'sk-123', model: 'claude-x', authMode: 'bearer',
    });
    expect(await claudeAdapter.readAiConfig!(dir)).toEqual({
      baseUrl: 'https://api.test/v1', apiKey: 'sk-123', model: 'claude-x', authMode: 'bearer',
    });
  });

  it('readAiConfig returns null when no file exists', async () => {
    expect(await claudeAdapter.readAiConfig!(dir)).toBeNull();
  });
});

describe('codexAdapter AI-config', () => {
  it('injects both global and workspace MCP servers into fresh commands', () => {
    expect(codexAdapter.composeCommand(['ignored'], {
      cwd: dir,
      env: {
        OPENALICE_MCP_URL: 'http://127.0.0.1:47332/mcp',
        AQ_WS_ID: 'ws-abc',
      },
    })).toEqual([
      'codex',
      '-c',
      'mcp_servers.openalice.url="http://127.0.0.1:47332/mcp"',
      '-c',
      'mcp_servers."openalice-workspace".url="http://127.0.0.1:47332/mcp/ws-abc"',
    ]);
  });

  it('preserves both MCP servers when resuming codex sessions', () => {
    const env = {
      OPENALICE_MCP_URL: 'http://127.0.0.1:47332/mcp',
      AQ_WS_ID: 'ws-abc',
    };
    expect(codexAdapter.composeCommand([], { cwd: dir, env, resume: 'last' })).toEqual([
      'codex',
      '-c',
      'mcp_servers.openalice.url="http://127.0.0.1:47332/mcp"',
      '-c',
      'mcp_servers."openalice-workspace".url="http://127.0.0.1:47332/mcp/ws-abc"',
      'resume',
      '--last',
    ]);
    expect(codexAdapter.composeCommand([], { cwd: dir, env, resume: { sessionId: 'rollout-id' } })).toEqual([
      'codex',
      '-c',
      'mcp_servers.openalice.url="http://127.0.0.1:47332/mcp"',
      '-c',
      'mcp_servers."openalice-workspace".url="http://127.0.0.1:47332/mcp/ws-abc"',
      'resume',
      'rollout-id',
    ]);
  });

  it('writes full provider config byte-exact (config.toml + env.json)', async () => {
    await codexAdapter.writeAiConfig!(dir, {
      baseUrl: 'https://oai.test/v1', apiKey: 'sk-c', model: 'gpt-x', wireApi: 'responses',
    });
    expect(await read('.codex/config.toml')).toBe(
      'model = "gpt-x"\nmodel_provider = "workspace"\n\n'
      + '[model_providers.workspace]\nname = "OpenAlice workspace provider"\n'
      + 'base_url = "https://oai.test/v1"\nenv_key = "OPENALICE_WORKSPACE_KEY"\nwire_api = "responses"\n',
    );
    expect(await read('.codex/env.json')).toBe('{\n  "OPENALICE_WORKSPACE_KEY": "sk-c"\n}\n');
  });

  it('defaults wire_api to chat when unset', async () => {
    await codexAdapter.writeAiConfig!(dir, { baseUrl: 'https://oai.test/v1', apiKey: 'sk-c', model: 'gpt-x' });
    expect(await read('.codex/config.toml')).toContain('wire_api = "chat"\n');
  });

  it('model-only writes no provider block and an empty env.json', async () => {
    await codexAdapter.writeAiConfig!(dir, { model: 'gpt-y' });
    expect(await read('.codex/config.toml')).toBe('model = "gpt-y"\n');
    expect(await read('.codex/env.json')).toBe('{}\n');
  });

  it('reset (empty cred) tears down the entire .codex/ directory', async () => {
    await codexAdapter.writeAiConfig!(dir, { baseUrl: 'u', model: 'm' });
    await codexAdapter.writeAiConfig!(dir, {});
    expect(existsSync(join(dir, '.codex'))).toBe(false);
  });

  it('round-trips through readAiConfig', async () => {
    await codexAdapter.writeAiConfig!(dir, {
      baseUrl: 'https://oai.test/v1', apiKey: 'sk-c', model: 'gpt-x', wireApi: 'responses',
    });
    expect(await codexAdapter.readAiConfig!(dir)).toEqual({
      baseUrl: 'https://oai.test/v1', apiKey: 'sk-c', model: 'gpt-x', wireApi: 'responses',
    });
  });

  it('readAiConfig returns null when no files exist', async () => {
    expect(await codexAdapter.readAiConfig!(dir)).toBeNull();
  });
});
