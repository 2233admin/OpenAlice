import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { codexAdapter } from './codex.js';

let dir: string;

// Supply valid legacy prerequisites so ignoring .mcp.json cannot pass by
// throwing an unrelated missing-env error instead of rejecting the config.
const env = {
  OPENALICE_MCP_URL: 'http://127.0.0.1:47332/mcp',
  AQ_WS_ID: 'ws-mcp-regression',
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'codex-mcp-'));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

const writeServers = (mcpServers: unknown): Promise<void> =>
  writeFile(join(dir, '.mcp.json'), JSON.stringify({ mcpServers }));

const compose = (): readonly string[] => codexAdapter.composeCommand([], { cwd: dir, env });

// Composition is the pre-spawn boundary: rejection must happen before the
// launcher receives argv. These tests never run Codex or contact an MCP server.
describe('codexAdapter workspace MCP fail-closed boundary', () => {
  it.each([
    { label: 'malformed JSON', contents: '{"mcpServers":' },
    { label: 'a nonobject server map', contents: '{"mcpServers":[]}' },
    { label: 'a nonobject server definition', contents: '{"mcpServers":{"katana":null}}' },
    { label: 'an invalid server name', contents: '{"mcpServers":{"katana.bridge":{"command":"python"}}}' },
  ])('rejects $label instead of composing fallback trading servers', async ({ contents }) => {
    await writeFile(join(dir, '.mcp.json'), contents);
    expect(compose).toThrow(Error);
  });

  it('rejects invalid stdio field types', async () => {
    const invalidServers = [
      { label: 'command must be a string', server: { command: 7 } },
      { label: 'args must contain strings', server: { command: 'python', args: [7] } },
      { label: 'env values must be strings', server: { command: 'python', env: { TOKEN: 7 } } },
    ];
    for (const { label, server } of invalidServers) {
      await writeServers({ katana: server });
      expect(compose, label).toThrow(Error);
    }
  });

  it('rejects unsupported or conflicting transport definitions', async () => {
    const invalidServers = [
      { label: 'unknown transport', server: { type: 'sse', url: 'https://mcp.example.test/mcp' } },
      { label: 'unsupported extra field', server: { command: 'python', cwd: '/other-workspace' } },
      { label: 'HTTP mixed with stdio', server: { type: 'http', url: 'https://mcp.example.test/mcp', command: 'python' } },
    ];
    for (const { label, server } of invalidServers) {
      await writeServers({ katana: server });
      expect(compose, label).toThrow(Error);
    }
  });

  it('rejects invalid HTTP endpoint and header definitions', async () => {
    const invalidServers = [
      { label: 'non-HTTP URL', server: { type: 'http', url: 'file:///local/mcp' } },
      { label: 'header values must be strings', server: { type: 'streamable-http', url: 'https://mcp.example.test/mcp', headers: { Authorization: 7 } } },
    ];
    for (const { label, server } of invalidServers) {
      await writeServers({ katana: server });
      expect(compose, label).toThrow(Error);
    }
  });

  it('rejects an unresolved required env reference in headless composition even if the host defines it', async () => {
    vi.stubEnv('OPENALICE_TEST_MCP_COMMAND', 'host-only-command');
    await writeServers({ katana: { command: '${OPENALICE_TEST_MCP_COMMAND}' } });
    expect(() => codexAdapter.composeHeadlessCommand!([], { cwd: dir, env }, 'Inspect workspace'))
      .toThrow(Error);
  });

  it('rejects a directory at .mcp.json rather than treating it as an absent config', async () => {
    await mkdir(join(dir, '.mcp.json'));
    expect(compose).toThrow(Error);
  });
});
