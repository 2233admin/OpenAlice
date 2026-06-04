import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type { BootstrapContext, CliAdapter, SpawnContext, WorkspaceAiCred } from '../cli-adapter.js';
import { readWorkspaceFile, writeWorkspaceFile } from '../file-service.js';

const CODEX_CONFIG_PATH = '.codex/config.toml';
const CODEX_ENV_PATH = '.codex/env.json';
const CODEX_KEY_ENV_NAME = 'OPENALICE_WORKSPACE_KEY';
const CODEX_PROVIDER_NAME = 'workspace';

/**
 * OpenAI Codex CLI (Rust rewrite, `codex-cli`).
 *
 * Verified empirically against `codex-cli 0.130.0` on macOS:
 * - Resume CLI: `codex resume --last` (= most recent for this cwd; codex
 *   filters by cwd by default), and `codex resume <uuid>` for a specific id.
 *   So the resume model is structurally the same as claude's `--continue` /
 *   `--resume <id>`, just expressed as a subcommand instead of a flag.
 * - Sessions live at `~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl`
 *   (uncompressed plain JSONL). The directory tree is **global, not
 *   per-cwd**, so transcript discovery via fs.watch is degenerate here —
 *   we'd see new files from every codex session on the machine, not just
 *   this workspace. v1 punts on this (`transcriptDiscovery: 'none'`); the
 *   `codex resume` picker is cwd-aware and handles the user-facing case.
 * - Trust model: codex prompts on first run for any cwd not in
 *   `~/.codex/config.toml` `[projects."<abs>"] trust_level`. `bootstrap()`
 *   pre-writes that entry so the launcher's spawn doesn't stall on the
 *   prompt.
 *
 * AI provider model — two modes, mutually exclusive:
 *
 *   1. **Default (no override).** Workspace has no `.codex/` directory.
 *      Adapter doesn't set `CODEX_HOME`. Codex reads the user's global
 *      `~/.codex/auth.json` + `~/.codex/config.toml` — exactly what a
 *      vanilla `codex` invocation in any project does. The OpenAlice MCP
 *      servers are wired via per-invocation `-c mcp_servers...url=...`
 *      flags in `composeCommand` below, so MCP is visible without polluting
 *      the user's global config.
 *
 *   2. **Override (user-configured via OpenAlice UI).** Workspace has its
 *      own `.codex/{config.toml, env.json[, auth.json]}`. Adapter sets
 *      `CODEX_HOME=<cwd>/.codex`. Codex reads workspace files only,
 *      isolated from global state.
 *
 * No symlinks, no global-fallback inheritance. The `-c` flag is OpenAlice's
 * "local MCP registration" — analogous to claude's `.mcp.json` cwd
 * discovery, but driven via codex's CLI override flag since codex has no
 * cwd-MCP convention of its own.
 */

export const codexAdapter: CliAdapter = {
  id: 'codex',
  displayName: 'Codex',
  namePrefix: 'x',
  capabilities: {
    parallelPerCwd: true,
    resumeLast: true,
    resumeById: true,
    transcriptDiscovery: 'none',
  },

  /**
   * Always prepends `-c mcp_servers.openalice.url="..."` and the workspace
   * scoped `openalice-workspace` server so OpenAlice MCP is visible
   * per-spawn without writing to `~/.codex/config.toml`. The
   * flag overrides any same-key entry in the read config.toml (verified
   * empirically), and adds a new key when none exists — safe in both
   * default and override modes.
   */
  composeCommand(_base: readonly string[], ctx: SpawnContext): readonly string[] {
    // Read from the spawn-bound env (which service.ts populates with the
    // backend's actual MCP port), NOT from process.env. The backend's own
    // env only carries OPENALICE_MCP_PORT (set by the dev orchestrator);
    // OPENALICE_MCP_URL is composed per-spawn and injected via buildSpawnEnv.
    // Reading process.env here used to fall back to the historical 3001
    // hardcode and route codex at a port nothing listens on — visible in
    // path.trace as `composedCommand: [..., 'http://127.0.0.1:3001/mcp']`.
    const mcpUrl = ctx.env['OPENALICE_MCP_URL'];
    if (!mcpUrl) {
      throw new Error('codex adapter: OPENALICE_MCP_URL missing from spawn env');
    }
    const workspaceId = ctx.env['AQ_WS_ID'];
    if (!workspaceId) {
      throw new Error('codex adapter: AQ_WS_ID missing from spawn env');
    }
    const head = [
      'codex',
      '-c',
      `mcp_servers.openalice.url="${mcpUrl}"`,
      '-c',
      `mcp_servers."openalice-workspace".url="${mcpUrl}/${workspaceId}"`,
    ];
    if (ctx.resume === undefined) return head;
    if (ctx.resume === 'last') return [...head, 'resume', '--last'];
    return [...head, 'resume', ctx.resume.sessionId];
  },

  async writeAiConfig(cwd: string, cred: WorkspaceAiCred): Promise<void> {
    const hasProvider = !!(cred.baseUrl || cred.model);

    if (!hasProvider) {
      // Reset: tear down the workspace's entire `.codex/` directory. The
      // adapter's `composeEnv` won't set `CODEX_HOME` when the directory is
      // absent, so codex falls back to the user's global `~/.codex/`. We
      // don't leave empty stubs behind — workspace files exist only when
      // there's an actual override. Note: `CODEX_HOME` is exclusive (not a
      // merge layer), so a half-empty `.codex/` would *shadow* the user's
      // global login and break auth. Full teardown is the only safe reset.
      const codexDir = join(cwd, '.codex');
      await rm(codexDir, { recursive: true, force: true });
      return;
    }

    // Provider override. config.toml carries only model / model_provider /
    // [model_providers.*] — the OpenAlice MCP server entries are wired per-spawn
    // via this adapter's `-c mcp_servers...url=...` flags, so we
    // don't repeat it here.
    let toml = '';
    if (cred.model) toml += `model = ${tomlString(cred.model)}\n`;
    if (cred.baseUrl) toml += `model_provider = "${CODEX_PROVIDER_NAME}"\n`;
    if (cred.baseUrl) {
      toml += '\n';
      toml += `[model_providers.${CODEX_PROVIDER_NAME}]\n`;
      toml += `name = "OpenAlice workspace provider"\n`;
      toml += `base_url = ${tomlString(cred.baseUrl)}\n`;
      toml += `env_key = "${CODEX_KEY_ENV_NAME}"\n`;
      toml += `wire_api = "${cred.wireApi ?? 'chat'}"\n`;
    }
    await writeWorkspaceFile(cwd, CODEX_CONFIG_PATH, toml);

    // env.json: holds the per-workspace API key codex picks up via env_key.
    // composeEnv reads this and exports at spawn.
    if (cred.apiKey) {
      const envObj: Record<string, string> = { [CODEX_KEY_ENV_NAME]: cred.apiKey };
      await writeWorkspaceFile(cwd, CODEX_ENV_PATH, JSON.stringify(envObj, null, 2) + '\n');
    } else {
      await writeWorkspaceFile(cwd, CODEX_ENV_PATH, '{}\n');
    }
  },

  async readAiConfig(cwd: string): Promise<WorkspaceAiCred | null> {
    const tomlRaw = await readWorkspaceFile(cwd, CODEX_CONFIG_PATH);
    const envRaw = await readWorkspaceFile(cwd, CODEX_ENV_PATH);
    if (tomlRaw === null && envRaw === null) return null;

    let baseUrl: string | null = null;
    let wireApi: 'chat' | 'responses' | null = null;
    let model: string | null = null;
    if (tomlRaw) {
      // Shape-specific extraction: we always write the provider section as
      // `[model_providers.workspace]` with `base_url`, `wire_api`, plus
      // top-level `model`. Regex is brittle in general but our shape is
      // controlled (writer above produces deterministic output).
      const providerBlock = tomlRaw.match(/\[model_providers\.workspace\][^\[]*/);
      if (providerBlock) {
        const block = providerBlock[0];
        const base = block.match(/base_url\s*=\s*"([^"]*)"/);
        if (base) baseUrl = base[1] ?? null;
        const wire = block.match(/wire_api\s*=\s*"(chat|responses)"/);
        if (wire) wireApi = wire[1] as 'chat' | 'responses';
      }
      const modelMatch = tomlRaw.match(/^model\s*=\s*"([^"]*)"\s*$/m);
      if (modelMatch) model = modelMatch[1] ?? null;
    }

    let apiKey: string | null = null;
    if (envRaw) {
      try {
        const env = JSON.parse(envRaw) as Record<string, unknown>;
        const k = env[CODEX_KEY_ENV_NAME];
        if (typeof k === 'string') apiKey = k;
      } catch { /* ignore parse error, leave apiKey null */ }
    }

    if (baseUrl === null && apiKey === null && model === null && wireApi === null) return null;
    return { baseUrl, apiKey, model, wireApi };
  },

  /**
   * Set `CODEX_HOME` only when workspace has its own `.codex/` directory
   * (override mode). Otherwise codex falls back to its own `~/.codex/`,
   * which is its normal behavior in any uninvolved project. The "reset
   * to default" UI action deletes the entire `.codex/` directory so the
   * adapter naturally falls back here.
   *
   * `.codex/env.json` is OpenAlice's per-workspace key bridge. Codex's
   * `[model_providers.X].env_key` field indirects through an env var; the
   * UI writes the chosen key into `env.json` and the adapter exports it
   * at spawn so codex's `env_key` lookup resolves. This is the only place
   * we bridge file → env, and the source of truth is still the workspace
   * file (not OpenAlice's internal state).
   */
  composeEnv(ctx: SpawnContext): Record<string, string> {
    const result: Record<string, string> = {};
    const workspaceCodex = join(ctx.cwd, '.codex');
    if (!existsSync(workspaceCodex)) return result;
    result['CODEX_HOME'] = workspaceCodex;
    const envFile = join(workspaceCodex, 'env.json');
    if (existsSync(envFile)) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(envFile, 'utf8'));
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof v === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) {
              result[k] = v;
            }
          }
        }
      } catch {
        // ignore parse errors; file is user-editable and v1 doesn't surface
      }
    }
    return result;
  },

  async bootstrap(ctx: BootstrapContext): Promise<void> {
    await ensureTrustedProject(ctx.cwd);
  },
};

/**
 * Add (or no-op if present) a `[projects."<abs>"] trust_level = "trusted"`
 * entry to `~/.codex/config.toml`. Uses a minimal append-or-rewrite strategy
 * — we don't bring in a TOML library because the section grammar is simple
 * and we only ever touch one section per workspace.
 *
 * If the project is already present we leave the file alone, regardless of
 * what value it has (the user may have set `read_only` deliberately).
 */
async function ensureTrustedProject(cwd: string): Promise<void> {
  const abs = resolve(cwd);
  const configPath = join(homedir(), '.codex', 'config.toml');

  let existing = '';
  try {
    existing = await readFile(configPath, 'utf8');
  } catch (err) {
    if (!isENOENT(err)) throw err;
    await mkdir(dirname(configPath), { recursive: true });
  }

  // Match either single- or triple-bracket [projects."<path>"] headers.
  const headerEsc = abs.replace(/[\\"]/g, (c) => `\\${c}`);
  const headerRe = new RegExp(
    `^\\[projects\\."${headerEsc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\]\\s*$`,
    'm',
  );
  if (headerRe.test(existing)) return; // already configured — don't clobber

  const block = `\n[projects."${headerEsc}"]\ntrust_level = "trusted"\n`;
  const next = existing.endsWith('\n') || existing.length === 0 ? existing + block : existing + '\n' + block;
  await writeFile(configPath, next, 'utf8');
}

function isENOENT(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ENOENT';
}

function tomlString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
