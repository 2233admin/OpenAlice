/**
 * Guardian — dev entry.
 *
 * Spawns UTA → Alice → Vite. UTA must hit `/__uta/health` 200 before Alice
 * is spawned (Alice fails fast if `OPENALICE_UTA_URL` doesn't respond on
 * boot). Vite comes last because it only needs Alice's port for its dev
 * proxy target.
 *
 * Restart protocol: Guardian watches `data/control/restart-uta.flag`. When
 * Alice touches it (after broker config changes), Guardian SIGTERMs UTA,
 * waits for graceful exit, respawns. Alice stays up the whole time — its
 * BFF proxy returns 502 for `/api/trading/*` until the new UTA is ready.
 *
 * Replaces the previous `scripts/dev.ts`. Same `pnpm dev` UX.
 */

import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import {
  probePorts,
  spawnChild,
  waitForHttp,
  installCascadeShutdown,
  UTAController,
  startFlagWatcher,
  type SpawnSpec,
} from './shared.js'

function cleanupStaleDevProcesses(): void {
  if (process.platform !== 'win32') return

  const selfPid = process.pid
  const root = process.cwd().toLowerCase()

  const markers = [
    resolve(process.cwd(), 'scripts', 'guardian', 'dev.ts'),
    resolve(process.cwd(), 'services', 'uta', 'src', 'main.ts'),
    resolve(process.cwd(), 'src', 'main.ts'),
    resolve(process.cwd(), 'ui', 'node_modules', 'vite', 'bin', 'vite.js'),
  ].map((s) => s.toLowerCase().replaceAll('\\', '/'))

  const normalize = (input: string) => input.toLowerCase().replaceAll('\\', '/')

  let lines: string[] = []
  try {
    const query = "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { \"{0}|{1}\" -f $_.ProcessId, $_.CommandLine }"
    const out = execFileSync('powershell', ['-NoProfile', '-Command', query], { encoding: 'utf8' })
    lines = out.split(/\r?\n/)
  } catch {
    return
  }

  const targets = lines
    .map((line) => line.trim())
    .map((line) => {
      const pipe = line.indexOf('|')
      if (pipe <= 0) return null
      const pid = Number.parseInt(line.slice(0, pipe), 10)
      if (!Number.isFinite(pid) || pid === selfPid) return null
      const cmd = line.slice(pipe + 1).trim()
      if (!cmd) return null
      return { pid, cmd }
    })
    .filter((item): item is { pid: number; cmd: string } => item !== null)
    .filter(({ cmd }) => {
      const normalized = normalize(cmd)
      if (!normalized.includes(root)) return false
      return markers.some((m) => normalized.includes(m))
    })

  for (const { pid } of targets) {
    try {
      process.kill(pid)
      console.log(`[guardian] cleaned stale process pid=${pid}`)
    } catch {
      // If kill fails here, continue; user can still proceed manually.
    }
  }
}

async function main(): Promise<void> {
  cleanupStaleDevProcesses()

  const ports = await probePorts()
  const dataHome = process.cwd()
  const flagPath = resolve(dataHome, 'data/control/restart-uta.flag')

  console.log('')
  console.log(`[guardian] UTA      →  http://127.0.0.1:${ports.utaPort}`)
  console.log(`[guardian] Alice    →  http://localhost:${ports.webPort}`)
  console.log(`[guardian] MCP      →  http://localhost:${ports.mcpPort}/mcp`)
  console.log(`[guardian] UI       →  http://localhost:5173  (Vite picks +1 if taken)`)
  console.log(`[guardian] flag     →  ${flagPath}`)
  console.log('')

  const baseEnv = {
    ...process.env,
    NODE_OPTIONS: `${process.env['NODE_OPTIONS'] ?? ''} --conditions=openalice-source`.trim(),
    OPENALICE_USER_DATA_HOME: dataHome,
  }

  // ── UTA spec (re-used by Guardian for restart) ────────────
  const utaSpec: SpawnSpec = {
    name: 'uta',
    command: 'tsx',
    args: ['watch', 'services/uta/src/main.ts'],
    env: { ...baseEnv, OPENALICE_UTA_PORT: String(ports.utaPort) },
    prefixLogs: true,
  }
  const utaUrl = `http://127.0.0.1:${ports.utaPort}`

  const utaInitial = spawnChild(utaSpec)
  const utaReady = await waitForHttp(`${utaUrl}/__uta/health`, { timeoutMs: 15_000 })
  if (!utaReady) {
    console.error(`[guardian] UTA failed to come up within 15s — aborting`)
    try { utaInitial.kill('SIGTERM') } catch { /* noop */ }
    process.exit(1)
  }
  console.log(`[guardian] UTA ready`)
  const uta = new UTAController(utaSpec, `${utaUrl}/__uta/health`, utaInitial)

  // ── Alice ─────────────────────────────────────────────────
  const alice: ChildProcess = spawnChild({
    name: 'alice',
    command: 'tsx',
    args: ['watch', 'src/main.ts'],
    env: {
      ...baseEnv,
      OPENALICE_WEB_PORT: String(ports.webPort),
      OPENALICE_MCP_PORT: String(ports.mcpPort),
      OPENALICE_UTA_URL: utaUrl,
    },
    prefixLogs: true,
  })

  // ── Vite ──────────────────────────────────────────────────
  const vite: ChildProcess = spawnChild({
    name: 'vite',
    command: 'node',
    args: [
      resolve(process.cwd(), 'ui', 'node_modules', 'vite', 'bin', 'vite.js'),
      '--host',
      '0.0.0.0',
    ],
    env: { ...baseEnv, OPENALICE_BACKEND_PORT: String(ports.webPort) },
    cwd: resolve(process.cwd(), 'ui'),
    prefixLogs: true,
  })

  const cascade = installCascadeShutdown({
    children: [uta.process, alice, vite],
  })

  // UTA restart cooperates with cascade — old SIGTERM is "expected", new
  // child is tracked for unexpected exit + signal forwarding.
  uta.cascade = {
    expectExit: cascade.expectExit,
    trackReplacement: cascade.trackReplacement,
  }

  // ── Flag watch ────────────────────────────────────────────
  // Triggered by Alice after `accounts.json` mutations. Guardian restarts
  // UTA — Alice and Vite untouched.
  await startFlagWatcher({
    flagPath,
    onTrigger: () => {
      void uta.restart()
    },
  })
}

main().catch((err: unknown) => {
  console.error('[guardian] fatal:', err)
  process.exit(1)
})
