/**
 * Runtime detection for the agent CLIs (claude / codex / cursor-agent / agy / grok / omp / opencode / pi).
 *
 * The launcher registers all adapters unconditionally — registration means
 * "the launcher knows HOW to drive this CLI", NOT "the CLI is installed on
 * this box". Before this module, the only signal a user got that a runtime
 * was missing was a raw ENOENT at spawn time (the PTY dies the instant it
 * starts). That's a terrible first-run experience: a fresh install ships
 * zero agent CLIs, and the picker lists all supported agent runtimes as if
 * they were ready. The user has no idea they need to `npm i -g` anything.
 *
 * This does a cross-platform PATH lookup so the `/agents` endpoint can tell
 * the frontend which runtimes are actually present, and the UI can guide the
 * the user to install missing ones. The default path is a pure filesystem
 * probe, cheap enough to run on every list call. Inventory requests opt into
 * a bounded fixed --version preflight to distinguish installed from runnable.
 *
 * NOTE: this resolves the adapter's CANONICAL binary name (`adapter.binary`).
 * A user who overrides the launch command via `WEB_TERMINAL_COMMAND` to a
 * non-standard path is an advanced case the hint doesn't try to track — the
 * detection is a UX nudge, not a hard gate (spawn still attempts regardless).
 */
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { runtimeProfileFromEnv } from '@/core/runtime-profile.js';
import { findWindowsLaunchCandidate, resolveLaunchCommand } from './win-command.js';
export interface AgentAvailability {
  /** True iff the binary resolved to a real file on PATH. */
  readonly installed: boolean;
  /** Absolute path the binary resolved to, or null when not found. */
  readonly path: string | null;
  /**
   * Cheap identity for the resolved file. A readiness probe is valid only for
   * the exact binary it checked; replacing an executable in place must retire
   * the cached result even when PATH still resolves to the same string.
   */
  readonly fingerprint?: string | null;
  /** True iff a fixed --version preflight completed successfully. */
  readonly runnable?: boolean;
}

export interface AgentPreflightOptions {
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
  /** Maximum time allowed for the fixed-argument preflight. */
  readonly timeoutMs?: number;
}
export function detectAgentBinary(
  id: string,
  binary: string,
  opts: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv } = {},
): AgentAvailability {
  const env = opts.env ?? process.env;
  const profile = id === 'pi' ? runtimeProfileFromEnv(env) : null;
  const managed = profile?.managedPiPath ?? null;
  const managedNode = profile?.managedPiNodePath ?? null;
  if (managed && isFile(managed) && (!managedNode || isFile(managedNode))) {
    const availability = availabilityForPath(managed);
    if (availability.installed && managedNode) {
      const nodeAvailability = availabilityForPath(managedNode);
      if (nodeAvailability.installed) {
        return {
          ...availability,
          fingerprint: (availability.fingerprint ?? '') + '|node:' + (nodeAvailability.fingerprint ?? ''),
        };
      }
    }
    if (availability.installed && !managedNode) return availability;
  }
  return detectBinary(binary, opts);
}

/**
 * Verify that an installed runtime can start without opening a model session.
 * The only argument passed to the executable is the fixed --version flag;
 * no prompt, session id, or trading command can reach this path.
 */
export function preflightAgentBinary(
  id: string,
  binary: string,
  opts: AgentPreflightOptions = {},
): AgentAvailability {
  const availability = detectAgentBinary(id, binary, opts);
  if (!availability.installed || !availability.path) return { ...availability, runnable: false };
  const resolved = resolvePreflightCommand(id, availability, opts);
  if (!resolved) return { ...availability, runnable: false };
  try {
    execFileSync(resolved.argv[0]!, [...resolved.argv.slice(1), '--version'], {
      env: opts.env ?? process.env,
      shell: false,
      stdio: 'ignore',
      timeout: opts.timeoutMs ?? 2_000,
      windowsHide: true,
    });
    return { ...availability, runnable: true };
  } catch {
    return { ...availability, runnable: false };
  }
}

/** Async counterpart for HTTP inventory; never blocks the Node event loop. */
export async function preflightAgentBinaryAsync(
  id: string,
  binary: string,
  opts: AgentPreflightOptions = {},
): Promise<AgentAvailability> {
  const availability = detectAgentBinary(id, binary, opts);
  if (!availability.installed || !availability.path) return { ...availability, runnable: false };
  const resolved = resolvePreflightCommand(id, availability, opts);
  if (!resolved) return { ...availability, runnable: false };
  try {
    const timeoutMs = Math.max(1, opts.timeoutMs ?? 2_000);
    await new Promise<void>((resolve, reject) => {
      const controller = new AbortController();
      let child: ReturnType<typeof execFile> | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      let timedOut = false;
      const terminateChild = (): void => {
        const pid = child?.pid;
        if (process.platform === 'win32' && typeof pid === 'number') {
          try {
            execFile(
              'taskkill',
              ['/PID', String(pid), '/T', '/F'],
              { shell: false, windowsHide: true, timeout: 1_000 },
              () => undefined,
            );
          } catch {
            // Best-effort process-tree cleanup; direct kill below still runs.
          }
        } else if (typeof pid === 'number') {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {
            // The process may have exited or process groups may be unavailable.
          }
        }
        try {
          child?.kill();
        } catch {
          // Best-effort cleanup; the outer deadline still settles the probe.
        }
      };
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };
      timer = setTimeout(() => {
        timedOut = true;
        try {
          controller.abort();
        } catch {
          // Best-effort abort; the deadline still settles the probe below.
        }
        terminateChild();
        finish(new Error('agent preflight timed out'));
      }, timeoutMs);
      try {
        const childOptions = Object.assign(
          {
            env: opts.env ?? process.env,
            shell: false,
            windowsHide: true,
            timeout: timeoutMs,
            signal: controller.signal,
          },
          { detached: process.platform !== 'win32' },
        );
        child = execFile(
          resolved.argv[0]!,
          [...resolved.argv.slice(1), '--version'],
          childOptions,
          (error) => error ? finish(error) : finish(),
        );
        // The deadline can fire before execFile returns its ChildProcess.
        if (timedOut) terminateChild();
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
    return { ...availability, runnable: true };
  } catch {
    return { ...availability, runnable: false };
  }
}

function resolvePreflightCommand(
  id: string,
  availability: AgentAvailability,
  opts: AgentPreflightOptions,
): { readonly argv: readonly string[] } | null {
  const env = opts.env ?? process.env;
  const executable = availability.path;
  if (!executable) return null;
  const profile = id === 'pi' ? runtimeProfileFromEnv(env) : null;
  const command = profile?.managedPiPath === executable && profile.managedPiNodePath && isFile(profile.managedPiNodePath)
    ? [profile.managedPiNodePath, executable]
    : [executable];
  const resolved = resolveLaunchCommand(command, { platform: opts.platform, env });
  // A batch-only PATH entry requires cmd.exe. Even with fixed arguments, do not
  // execute arbitrary .cmd/.bat files during readiness inventory.
  return resolved.viaShell ? null : resolved;
}

export function runtimeInstallOverride(
  id: string,
  env: NodeJS.ProcessEnv = process.env,
): AgentAvailability | null {
  if (env['OPENALICE_ONBOARDING_TEST'] !== '1') return null;
  const raw = env['OPENALICE_AGENT_RUNTIME_INSTALLS']?.trim().toLowerCase();
  if (!raw || raw === 'real') return null;
  if (raw === 'none') return { installed: false, path: null };
  if (raw === 'all') return { installed: true, path: null };

  const parseList = (prefix: string): Set<string> | null => {
    if (!raw.startsWith(prefix)) return null;
    return new Set(
      raw.slice(prefix.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  };

  const only = parseList('only:');
  if (only) return { installed: only.has(id), path: null };
  const missing = parseList('missing:');
  if (missing) return { installed: !missing.has(id), path: null };
  return null;
}


/**
 * Locate an executable by bare name on PATH, cross-platform. Returns the
 * absolute path it resolved to, or null when nothing matches.
 *
 *   - A name that already contains a separator or extension is checked as-is.
 *   - On win32 we walk PATH × PATHEXT (npm shims install as `.cmd`, never
 *     `.exe`, so a naive `name.exe` probe misses opencode/pi — mirrors the
 *     resolution `win-command.ts` does for the actual spawn).
 *   - On POSIX we walk PATH looking for `<dir>/<name>` as a regular file.
 */
export function findExecutableOnPath(
  name: string,
  opts: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv } = {},
): string | null {
  const platform = opts.platform ?? process.platform;
  const env = opts.env ?? process.env;
  if (!name) return null;

  // Caller passed a path or an explicit extension — check it directly.
  if (name.includes('/') || name.includes('\\') || /\.[^.\\/]+$/.test(name)) {
    return isFile(name) ? name : null;
  }

  // Windows env var casing is unstable across hosts; check both.
  const dirs = (env['PATH'] ?? env['Path'] ?? '').split(delimiter).filter(Boolean);

  if (platform === 'win32') return findWindowsLaunchCandidate(name, env);

  for (const dir of dirs) {
    const candidate = join(dir, name);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

/** Detect whether a single binary is installed. */
export function detectBinary(
  binary: string,
  opts: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv } = {},
): AgentAvailability {
  const path = findExecutableOnPath(binary, opts);
  return path ? availabilityForPath(path) : { installed: false, path: null, fingerprint: null };
}

function availabilityForPath(path: string): AgentAvailability {
  try {
    const stat = statSync(path);
    if (!stat.isFile()) return { installed: false, path: null, fingerprint: null };
    return {
      installed: true,
      path,
      // Metadata is intentionally sufficient here: this runs on every cheap
      // discovery. Package managers replace or rewrite shims with at least one
      // of inode/size/mtime changing, without the cost of hashing binaries.
      fingerprint: `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`,
    };
  } catch {
    return { installed: false, path: null, fingerprint: null };
  }
}

function isFile(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}
