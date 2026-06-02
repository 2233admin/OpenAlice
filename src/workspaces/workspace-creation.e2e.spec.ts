/**
 * End-to-end check of the create flow for the `chat` template, exercising the
 * real moving parts in order: the (shrunk) bootstrap.sh → launcher context
 * injection → launcher initial commit. Proves the load-bearing Phase-B change
 * — commit authority moved from bootstrap.sh into the launcher — yields a
 * fresh-git workspace with exactly one clean commit (the "Harness rule").
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { injectWorkspaceContext, resolveInjection } from './context-injector.js';
import type { TemplateMeta } from './template-registry.js';
import { commitInitial } from './workspace-creator.js';

const HERE = fileURLToPath(new URL('.', import.meta.url)); // src/workspaces/
const CHAT_DIR = join(HERE, 'templates', 'chat');
const CHAT_FILES = join(CHAT_DIR, 'files');
const CHAT_BOOTSTRAP = join(CHAT_DIR, 'bootstrap.sh');
const AQ_DIR = join(HERE, 'templates', 'auto-quant');
const AQ_BOOTSTRAP = join(AQ_DIR, 'bootstrap.sh');
const FR_DIR = join(HERE, 'templates', 'finance-research');
const FR_BOOTSTRAP = join(FR_DIR, 'bootstrap.sh');

function financeMeta(): TemplateMeta {
  return {
    name: 'finance-research',
    bootstrapScript: FR_BOOTSTRAP,
    filesDir: join(FR_DIR, 'files'),
    templateDir: FR_DIR,
    version: '1.0.0',
    defaultAgents: ['claude', 'codex'],
    injectMcp: true,
    injectPersona: true,
    bundledSkills: [],
  };
}

function autoQuantMeta(): TemplateMeta {
  return {
    name: 'auto-quant',
    bootstrapScript: AQ_BOOTSTRAP,
    filesDir: join(AQ_DIR, 'files'),
    templateDir: AQ_DIR,
    version: '1.0.0',
    defaultAgents: ['claude', 'codex'],
    injectMcp: false,
    injectPersona: false,
    bundledSkills: [],
  };
}

function run(cmd: string, args: readonly string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (c: Buffer) => { out += c.toString(); });
    child.stderr.on('data', (c: Buffer) => { err += c.toString(); });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err}`))));
  });
}

function chatMeta(): TemplateMeta {
  return {
    name: 'chat',
    bootstrapScript: CHAT_BOOTSTRAP,
    filesDir: CHAT_FILES,
    templateDir: CHAT_DIR,
    version: '1.0.0',
    defaultAgents: ['claude', 'codex'],
    injectMcp: true,
    injectPersona: true,
    bundledSkills: ['scan-value-chain'],
  };
}

let parent: string;
let dir: string;
beforeEach(async () => {
  parent = await mkdtemp(join(tmpdir(), 'ws-e2e-'));
  dir = join(parent, 'workspace');
});
afterEach(async () => {
  await rm(parent, { recursive: true, force: true });
});

describe('chat workspace create: bootstrap → inject → commit', () => {
  it('yields a fresh-git workspace with one clean launcher commit', async () => {
    // 1. real bootstrap.sh — git init + README + excludes, NO commit
    await run('bash', [CHAT_BOOTSTRAP, 'testtag', dir], { ...process.env, AQ_TEMPLATE_ROOT: CHAT_DIR });
    // 2. launcher-owned injection
    await injectWorkspaceContext({ template: chatMeta(), wsId: 'ws-e2e-1', dir });
    // 3. launcher-owned initial commit
    await commitInitial(dir, 'chat: testtag');

    // injected files all present
    for (const rel of [
      '.mcp.json', 'CLAUDE.md', 'AGENTS.md', 'README.md',
      '.claude/skills/scan-value-chain/SKILL.md',
      '.agents/skills/scan-value-chain/SKILL.md',
    ]) {
      expect(existsSync(join(dir, rel)), rel).toBe(true);
    }

    // .mcp.json carries the workspace id and the unresolved spawn-time placeholder
    const mcp = await readFile(join(dir, '.mcp.json'), 'utf8');
    expect(mcp).toContain('/ws-e2e-1"');
    expect(mcp).toContain('${OPENALICE_MCP_URL:-http://127.0.0.1:47332/mcp}');

    // exactly one commit, launcher author, right message
    const log = await run('git', ['-C', dir, 'log', '--pretty=%an <%ae>%n%s']);
    expect(log.trim()).toBe('launcher <launcher@local>\nchat: testtag');

    // working tree is clean (injected files were committed, not left dangling)
    const status = await run('git', ['-C', dir, 'status', '--porcelain']);
    expect(status.trim()).toBe('');
  });
});

describe('auto-quant workspace create: clone → scrub → commit', () => {
  it('scrubs cloned history + remote into a fresh-git workspace with one launcher commit', async () => {
    // fake upstream: history + an origin pointing at the public repo
    const src = join(parent, 'fake-auto-quant');
    await run('git', ['init', '-q', '-b', 'main', src]);
    await writeFile(join(src, 'strategy.py'), 'print("hi")\n');
    await run('git', ['-C', src, 'add', '.']);
    await run('git', ['-C', src, '-c', 'user.email=u@x', '-c', 'user.name=u', 'commit', '-q', '-m', 'upstream history']);
    await run('git', ['-C', src, 'remote', 'add', 'origin', 'https://github.com/TraderAlice/Auto-Quant.git']);

    const aqDir = join(parent, 'aq-workspace');
    await run('bash', [AQ_BOOTSTRAP, 'aqtag', aqDir], { ...process.env, AQ_TEMPLATE_DIR: src });
    // auto-quant injects nothing (all flags false); launcher still commits.
    await injectWorkspaceContext({ template: autoQuantMeta(), wsId: 'ws-aq-1', dir: aqDir });
    await commitInitial(aqDir, 'auto-quant: aqtag');

    // working tree carries the upstream content + the results scaffold...
    expect(existsSync(join(aqDir, 'strategy.py'))).toBe(true);
    expect(existsSync(join(aqDir, 'results.tsv'))).toBe(true);
    // ...but history + remote are scrubbed (the Harness rule)
    expect((await run('git', ['-C', aqDir, 'remote', '-v'])).trim()).toBe('');
    expect((await run('git', ['-C', aqDir, 'log', '--pretty=%s'])).trim()).toBe('auto-quant: aqtag');
    expect((await run('git', ['-C', aqDir, 'status', '--porcelain'])).trim()).toBe('');
    expect((await run('git', ['-C', aqDir, 'rev-parse', '--abbrev-ref', 'HEAD'])).trim()).toBe('autoresearch/aqtag');
  });
});

describe('finance-research workspace create: bootstrap(+skills clone) → inject → commit', () => {
  // Clones himself65/finance-skills (network, best-effort). Resilient: if the
  // clone fails the bootstrap still exits 0. The point of this guard is the
  // bootstrap completing without an unbound-var failure + the launcher
  // inject/commit landing on top.
  it('completes without unbound-var failure and yields one clean launcher commit', async () => {
    const frDir = join(parent, 'fr-workspace');
    await run('bash', [FR_BOOTSTRAP, 'frtag', frDir], { ...process.env, AQ_TEMPLATE_ROOT: FR_DIR });
    await injectWorkspaceContext({ template: financeMeta(), wsId: 'ws-fr-1', dir: frDir });
    await commitInitial(frDir, 'finance-research: frtag');

    expect(existsSync(join(frDir, '.mcp.json'))).toBe(true);
    expect(existsSync(join(frDir, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(frDir, '.openalice-finance-info'))).toBe(true);
    expect((await run('git', ['-C', frDir, 'log', '--pretty=%s'])).trim()).toBe('finance-research: frtag');
    expect((await run('git', ['-C', frDir, 'status', '--porcelain'])).trim()).toBe('');
  }, 60_000);
});

describe('chat workspace create in CLI mode (toolAccess=cli)', () => {
  it('injects inbox-only MCP + the openalice-cli skill, drops the global tool server', async () => {
    await run('bash', [CHAT_BOOTSTRAP, 'clitag', dir], { ...process.env, AQ_TEMPLATE_ROOT: CHAT_DIR });
    const effective = resolveInjection(chatMeta(), 'cli');
    await injectWorkspaceContext({ template: effective, wsId: 'ws-cli-1', dir });
    await commitInitial(dir, 'chat: clitag');

    const mcp = await readFile(join(dir, '.mcp.json'), 'utf8');
    expect(mcp).toContain('openalice-workspace'); // inbox server stays
    expect(mcp).not.toContain('"openalice"');      // global tool server dropped
    expect(existsSync(join(dir, '.claude/skills/openalice-cli/SKILL.md'))).toBe(true);
    expect(existsSync(join(dir, '.claude/skills/scan-value-chain/SKILL.md'))).toBe(true);
    expect((await run('git', ['-C', dir, 'status', '--porcelain'])).trim()).toBe('');
  });
});
