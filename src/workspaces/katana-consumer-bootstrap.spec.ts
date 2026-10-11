import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { injectWorkspaceContext, resolveInjection } from './context-injector.js';
import { TemplateRegistry } from './template-registry.js';
import { commitInitial, runScript } from './workspace-creator.js';
import type { Logger } from './logger.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const logger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() { return logger; },
};

let parent: string;
let dir: string;
beforeEach(async () => {
  parent = await mkdtemp(join(tmpdir(), 'katana-consumer-'));
  dir = join(parent, 'workspace with spaces');
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(parent, { recursive: true, force: true });
});

describe('katana-desk consumer bootstrap and launcher injection', () => {
  it.each([
    {
      label: 'a Windows runtime root with spaces and a trailing backslash',
      runtimeRoot: 'C:\\katana runtime\\project\\',
      expectedRoot: 'C:/katana runtime/project',
    },
    {
      label: 'an unset runtime root with an explicit placeholder',
      runtimeRoot: undefined,
      expectedRoot: '<KATANA_RUNTIME_ROOT>',
    },
  ])('preserves consumer-only artifacts for $label', async ({ runtimeRoot, expectedRoot }) => {
    vi.stubEnv('KATANA_RUNTIME_ROOT', runtimeRoot);
    const registry = await TemplateRegistry.load(join(HERE, 'templates'), logger);
    const template = registry.get('katana-desk');
    expect(template, 'katana-desk must be discovered from its real bootstrap.sh').toBeDefined();
    if (!template) throw new Error('katana-desk template not discovered');

    // Exercise the same bootstrap helper and environment contract as the launcher.
    // On Windows the verification process must put native Git Bash first on PATH.
    const result = await runScript(template.bootstrapScript, ['consumer-test', dir], {
      AQ_TEMPLATE_ROOT: template.templateDir,
      AQ_TEMPLATE_FILES_DIR: template.filesDir,
      AQ_LAUNCHER_REPO_ROOT: join(HERE, '..', '..'),
    }, 10_000);
    expect(result.ok, result.stderr).toBe(true);

    const consumerMcp = await readFile(join(dir, '.mcp.json'), 'utf8');
    expect(JSON.parse(consumerMcp)).toEqual({
      mcpServers: {
        katana: {
          command: 'python',
          args: [
            `${expectedRoot}/scripts/katana_uv.py`,
            'run',
            '--project',
            `${expectedRoot}/backend`,
            'python',
            `${expectedRoot}/scripts/bridge/mcp.py`,
          ],
        },
      },
    });

    for (const toolAccess of ['mcp', 'cli'] as const) {
      await injectWorkspaceContext({
        template: resolveInjection(template, toolAccess),
        wsId: 'ws-katana-consumer',
        dir,
      });
      expect(await readFile(join(dir, '.mcp.json'), 'utf8')).toBe(consumerMcp);
      expect(existsSync(join(dir, '.pi'))).toBe(false);
    }

    await commitInitial(dir, 'katana-desk: consumer-test');
  }, 20_000);
});
