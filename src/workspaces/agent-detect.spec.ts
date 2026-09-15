import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectAgentBinary, detectBinary, findExecutableOnPath, preflightAgentBinary, preflightAgentBinaryAsync, runtimeInstallOverride } from './agent-detect.js';
import { resolveLaunchCommand } from './win-command.js';
import { buildCliPath } from './spawn-env.js';

let dir: string;

async function touch(name: string): Promise<string> {
  const p = join(dir, name);
  await writeFile(p, '');
  await chmod(p, 0o755);
  return p;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'agent-detect-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('findExecutableOnPath (posix)', () => {
  it('resolves a bare name to its absolute path on PATH', async () => {
    const p = await touch('claude');
    expect(findExecutableOnPath('claude', { platform: 'linux', env: { PATH: dir } })).toBe(p);
  });

  it('returns null when the binary is absent', () => {
    expect(findExecutableOnPath('codex', { platform: 'linux', env: { PATH: dir } })).toBeNull();
  });

  it('searches every PATH entry, not just the first', async () => {
    const other = await mkdtemp(join(tmpdir(), 'agent-detect-2-'));
    try {
      const p = await touch('pi');
      const env = { PATH: [other, dir].join(delimiter) };
      expect(findExecutableOnPath('pi', { platform: 'linux', env })).toBe(p);
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });

  it('checks an explicit path directly without walking PATH', async () => {
    const p = await touch('opencode');
    expect(findExecutableOnPath(p, { platform: 'linux', env: { PATH: '' } })).toBe(p);
    expect(findExecutableOnPath(join(dir, 'nope'), { platform: 'linux', env: { PATH: dir } })).toBeNull();
  });
});

describe('findExecutableOnPath (win32)', () => {
  it('appends PATHEXT to a bare name', async () => {
    const p = await touch('codex.exe');
    const env = { PATH: dir, PATHEXT: '.COM;.EXE;.CMD' };
    expect(findExecutableOnPath('codex', { platform: 'win32', env })).toBe(p);
  });

  it('finds a .cmd npm shim when no .exe exists (opencode/pi case)', async () => {
    const p = await touch('opencode.cmd');
    const env = { PATH: dir, PATHEXT: '.COM;.EXE;.CMD' };
    expect(findExecutableOnPath('opencode', { platform: 'win32', env })).toBe(p);
  });

  it('matches Windows detection with the launch candidate across PATH entries', async () => {
    const nativeDir = await mkdtemp(join(tmpdir(), 'agent-detect-native-'));
    try {
      const native = join(nativeDir, 'omp.exe');
      await writeFile(native, '');
      const env = {
        PATH: [dir, nativeDir].join(delimiter),
        PATHEXT: '.CMD;.EXE;.BAT',
      };
      await touch('omp.cmd');

      const detected = detectAgentBinary('omp', 'omp', { platform: 'win32', env });
      const launched = resolveLaunchCommand(['omp'], { platform: 'win32', env });
      expect(detected.path).toBe(native);
      expect(launched.argv[0]).toBe(native);
    } finally {
      await rm(nativeDir, { recursive: true, force: true });
    }
  });
  it('ignores a directory shadowing a Windows executable', async () => {
    await mkdir(join(dir, 'codex.exe'));
    const env = { PATH: dir, PATHEXT: '.EXE;.CMD' };
    expect(findExecutableOnPath('codex', { platform: 'win32', env })).toBeNull();
  });
});

describe('GUI Windows agent discovery', () => {
  it.skipIf(process.platform !== 'win32')('detects OMP from Bun global bin when GUI PATH is minimal', async () => {
    const home = await mkdtemp(join(tmpdir(), 'agent-detect-windows-home-'));
    try {
      const bunBin = join(home, '.bun', 'bin');
      await mkdir(bunBin, { recursive: true });
      const omp = join(bunBin, 'omp.exe');
      await writeFile(omp, '');

      const env = {
        HOME: home,
        USERPROFILE: home,
        PATH: join(home, 'host-bin'),
        PATHEXT: '.COM;.EXE;.CMD',
      };
      const resolved = buildCliPath(env);

      expect(detectAgentBinary('omp', 'omp', {
        platform: 'win32',
        env: { ...env, PATH: resolved },
      })).toEqual({
        installed: true,
        path: omp,
        fingerprint: expect.any(String),
      });
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform !== 'win32')('detects Cursor Agent from the standard user bin when GUI PATH is minimal', async () => {
    const home = await mkdtemp(join(tmpdir(), 'agent-detect-cursor-home-'));
    try {
      const cursorBin = join(home, '.cursor', 'bin');
      await mkdir(cursorBin, { recursive: true });
      const cursorAgent = join(cursorBin, 'cursor-agent.exe');
      await writeFile(cursorAgent, '');

      const env = {
        HOME: home,
        USERPROFILE: home,
        PATH: join(home, 'host-bin'),
        PATHEXT: '.COM;.EXE;.CMD',
      };
      const resolved = buildCliPath(env);

      expect(detectAgentBinary('cursor', 'cursor-agent', {
        platform: 'win32',
        env: { ...env, PATH: resolved },
      })).toEqual({
        installed: true,
        path: cursorAgent,
        fingerprint: expect.any(String),
      });
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
describe('detectBinary', () => {
  it('reports installed:true with the resolved path when present', async () => {
    const p = await touch('claude');
    expect(detectBinary('claude', { platform: 'linux', env: { PATH: dir } })).toEqual({
      installed: true,
      path: p,
      fingerprint: expect.any(String),
    });
  });

  it('reports installed:false with null path when missing', () => {
    expect(detectBinary('claude', { platform: 'linux', env: { PATH: dir } })).toEqual({
      installed: false,
      path: null,
      fingerprint: null,
    });
  });
});
describe('preflightAgentBinary', () => {
  it('distinguishes an installed executable that starts from one that is missing', () => {
    const runnable = preflightAgentBinary('claude', process.execPath, {
      platform: process.platform,
      env: { ...process.env, PATH: dir },
    });
    expect(runnable).toMatchObject({ installed: true, path: process.execPath, runnable: true });

    const missing = preflightAgentBinary('claude', join(dir, 'missing-runtime'), {
      platform: process.platform,
      env: { ...process.env, PATH: dir },
    });
    expect(missing).toMatchObject({ installed: false, path: null, runnable: false });
  });

  it('passes --version to managed Pi and reports nonzero and timeout failures', async () => {
    const marker = join(dir, 'managed-pi-args.txt');
    const entry = join(dir, 'managed-pi-entry.js');
    await writeFile(entry, 'require(\'node:fs\').writeFileSync(' + JSON.stringify(marker) + ', process.argv.slice(2).join(\'\\n\'))');
    const env = {
      ...process.env,
      OPENALICE_MANAGED_PI_PATH: entry,
      OPENALICE_MANAGED_PI_NODE_PATH: process.execPath,
      PATH: dir,
    };
    const result = preflightAgentBinary('pi', 'pi', { platform: process.platform, env });
    expect(result).toMatchObject({ installed: true, path: entry, runnable: true });
    await expect(readFile(marker, 'utf8')).resolves.toBe('--version');
    await expect(preflightAgentBinaryAsync('pi', 'pi', { platform: process.platform, env }))
      .resolves.toMatchObject({ installed: true, path: entry, runnable: true });

    const failing = join(dir, 'managed-pi-failing.js');
    await writeFile(failing, 'process.exitCode = 7');
    expect(preflightAgentBinary('pi', 'pi', {
      platform: process.platform,
      env: { ...env, OPENALICE_MANAGED_PI_PATH: failing },
    })).toMatchObject({ installed: true, runnable: false });

    const hanging = join(dir, 'managed-pi-hanging.js');
    await writeFile(hanging, 'setTimeout(() => {}, 10_000)');
    expect(preflightAgentBinary('pi', 'pi', {
      platform: process.platform,
      timeoutMs: 25,
      env: { ...env, OPENALICE_MANAGED_PI_PATH: hanging },
    })).toMatchObject({ installed: true, runnable: false });
    const childPidFile = join(dir, 'managed-pi-child.pid');
    await writeFile(hanging, [
      "const { spawn } = require('node:child_process');",
      "const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 10_000)'], { stdio: 'inherit' });",
      "require('node:fs').writeFileSync(" + JSON.stringify(childPidFile) + ", String(child.pid));",
      'setTimeout(() => {}, 10_000);',
    ].join('\n'));
    const startedAt = Date.now();
    await expect(preflightAgentBinaryAsync('pi', 'pi', {
      platform: process.platform,
      timeoutMs: 100,
      env: { ...env, OPENALICE_MANAGED_PI_PATH: hanging },
    })).resolves.toMatchObject({ installed: true, runnable: false });
    let childPid: number | null = null;
    for (let attempt = 0; attempt < 20 && childPid === null; attempt += 1) {
      try {
        childPid = Number(await readFile(childPidFile, 'utf8'));
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    expect(Number.isInteger(childPid)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 150));
    let childAlive = false;
    try {
      process.kill(childPid!, 0);
      childAlive = true;
    } catch {
      // Expected once process-tree cleanup has terminated the descendant.
    }
    expect(childAlive).toBe(false);
    expect(Date.now() - startedAt).toBeLessThan(500);
    await expect(preflightAgentBinaryAsync('pi', 'pi', { platform: process.platform, env }))
      .resolves.toMatchObject({ installed: true, path: entry, runnable: true });
  });

  it('rejects a batch-only Windows PATH entry without executing it', async () => {
    const batch = join(dir, 'batch-only-agent.cmd');
    await writeFile(batch, '@echo off\r\nexit /b 0\r\n');
    const result = preflightAgentBinary('claude', 'batch-only-agent', {
      platform: 'win32',
      env: { ...process.env, PATH: dir, PATHEXT: '.CMD', ComSpec: 'cmd.exe' },
    });
    expect(result).toMatchObject({ installed: true, path: batch, runnable: false });
  });
});
describe('detectAgentBinary', () => {
  it('reports managed Pi as installed before searching PATH', async () => {
    const managedPi = await touch('managed-pi');
    const pathPi = await touch('pi');
    expect(detectAgentBinary('pi', 'pi', {
      platform: 'linux',
      env: {
        OPENALICE_MANAGED_PI_PATH: managedPi,
        PATH: dir,
      },
    })).toEqual({ installed: true, path: managedPi, fingerprint: expect.any(String) });
    expect(findExecutableOnPath('pi', { platform: 'linux', env: { PATH: dir } })).toBe(pathPi);
  });

  it('does not claim managed Pi when its configured Node entry is missing', async () => {
    const managedPi = await touch('managed-pi');
    expect(detectAgentBinary('pi', 'pi', {
      platform: 'linux',
      env: {
        OPENALICE_MANAGED_PI_PATH: managedPi,
        OPENALICE_MANAGED_PI_NODE_PATH: join(dir, 'missing-node'),
        PATH: '',
      },
    })).toEqual({ installed: false, path: null, fingerprint: null });
  });

  it('includes managed Pi Node metadata in the fingerprint', async () => {
    const managedPi = await touch('managed-pi-with-node');
    const managedNode = await touch('managed-node');
    const env = {
      OPENALICE_MANAGED_PI_PATH: managedPi,
      OPENALICE_MANAGED_PI_NODE_PATH: managedNode,
      PATH: '',
    };
    const first = detectAgentBinary('pi', 'pi', { platform: 'linux', env });
    await writeFile(managedNode, 'changed');
    const second = detectAgentBinary('pi', 'pi', { platform: 'linux', env });
    expect(first).toMatchObject({ installed: true, path: managedPi });
    expect(second).toMatchObject({ installed: true, path: managedPi });
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  it('falls back to PATH when managed Pi path is absent or invalid', async () => {
    const pathPi = await touch('pi');
    expect(detectAgentBinary('pi', 'pi', {
      platform: 'linux',
      env: {
        OPENALICE_MANAGED_PI_PATH: join(dir, 'missing-pi'),
        PATH: dir,
      },
    })).toEqual({ installed: true, path: pathPi, fingerprint: expect.any(String) });
  });
});

describe('runtimeInstallOverride', () => {
  it('only applies in onboarding test mode', () => {
    expect(runtimeInstallOverride('claude', { OPENALICE_AGENT_RUNTIME_INSTALLS: 'none' })).toBeNull();
  });

  it('can simulate no installed agent runtimes', () => {
    expect(runtimeInstallOverride('claude', {
      OPENALICE_ONBOARDING_TEST: '1',
      OPENALICE_AGENT_RUNTIME_INSTALLS: 'none',
    })).toEqual({ installed: false, path: null });
  });

  it('can simulate only selected installed runtimes', () => {
    const env = {
      OPENALICE_ONBOARDING_TEST: '1',
      OPENALICE_AGENT_RUNTIME_INSTALLS: 'only:codex,opencode',
    };
    expect(runtimeInstallOverride('codex', env)).toEqual({ installed: true, path: null });
    expect(runtimeInstallOverride('claude', env)).toEqual({ installed: false, path: null });
  });

  it('can simulate selected missing runtimes', () => {
    const env = {
      OPENALICE_ONBOARDING_TEST: '1',
      OPENALICE_AGENT_RUNTIME_INSTALLS: 'missing:pi',
    };
    expect(runtimeInstallOverride('codex', env)).toEqual({ installed: true, path: null });
    expect(runtimeInstallOverride('pi', env)).toEqual({ installed: false, path: null });
  });
});
