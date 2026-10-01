import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join, parse, resolve } from 'node:path'

const requireDesktop = createRequire(new URL('../apps/desktop/package.json', import.meta.url))

export function desktopDevExecutable() {
  return requireDesktop('electron')
}

/** Native CLI state must follow the disposable smoke home, not the caller. */
export function desktopSmokeEnv(root, inherited = process.env) {
  const home = resolve(root, 'os-home')
  const env = { ...inherited }
  for (const key of [
    'PI_CONFIG_DIR', 'PI_PROFILE', 'OMP_PROFILE',
    'OPENCODE_CONFIG', 'OPENCODE_CONFIG_CONTENT', 'OPENCODE_CONFIG_DIR',
    'BASH_ENV', 'ENV',
    'OPENAI_API_KEY', 'OPENAI_ACCESS_TOKEN', 'OPENAI_BASE_URL',
    'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_OAUTH_TOKEN',
    'GOOGLE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'OPENROUTER_API_KEY',
    'XAI_API_KEY', 'GROK_API_KEY', 'CURSOR_API_KEY',
  ]) delete env[key]
  Object.assign(env, {
    HOME: home,
    USERPROFILE: home,
    ZDOTDIR: home,
    APPDATA: join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: join(home, 'AppData', 'Local'),
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_CACHE_HOME: join(home, '.cache'),
    XDG_DATA_HOME: join(home, '.local', 'share'),
    XDG_STATE_HOME: join(home, '.local', 'state'),
    CODEX_HOME: join(home, '.codex'),
    CLAUDE_CONFIG_DIR: join(home, '.claude'),
    PI_CODING_AGENT_DIR: join(home, '.pi', 'agent'),
    PI_CODING_AGENT_SESSION_DIR: join(home, '.pi', 'agent', 'sessions'),
    GROK_HOME: join(home, '.grok'),
    CURSOR_DATA_DIR: join(home, '.cursor'),
  })
  if (process.platform === 'win32') {
    env.HOMEDRIVE = parse(home).root.replace(/[\\/]$/, '')
    env.HOMEPATH = home.slice(env.HOMEDRIVE.length)
  }
  for (const key of ['HOME', 'APPDATA', 'LOCALAPPDATA', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'CODEX_HOME']) {
    mkdirSync(env[key], { recursive: true })
  }
  return env
}

export function spawnDesktopSmoke(executable, args, options) {
  // A private process group lets the smoke clean up Electron's helper and
  // Alice child processes even when Electron exits before its wrapper does.
  const env = { ...options.env }
  delete env.ELECTRON_RUN_AS_NODE
  return spawn(executable, args, {
    ...options,
    env,
    detached: process.platform !== 'win32',
  })
}

/** Positive signal probes include zombies. Only a complete, stable Linux
 * snapshot can establish that every remaining member has exited. */
export function desktopSmokeGroupAlive(pid, {
  platform = process.platform,
  probe = (group, signal) => process.kill(-group, signal),
  read = readFileSync,
  list = readdirSync,
} = {}) {
  if (platform === 'win32' || !Number.isInteger(pid) || pid <= 0) return false
  try {
    probe(pid, 0)
  } catch (error) {
    return error?.code !== 'ESRCH'
  }
  if (platform !== 'linux') return true
  try {
    // A hidden/restricted procfs is not evidence that unseen members exited.
    const mount = read('/proc/self/mountinfo', 'utf8').split('\n').find(line => {
      const fields = line.split(' ')
      return fields[4] === '/proc' && fields[fields.indexOf('-') + 1] === 'proc'
    })
    if (!mount || /(?:^|[, ])hidepid=(?!0(?:[, ]|$))/.test(mount)) return true
    const snapshot = () => {
      const members = []
      for (const entry of list('/proc')) {
        if (!/^\d+$/.test(entry)) continue
        let stat
        try { stat = read(`/proc/${entry}/stat`, 'utf8') }
        catch (error) { if (error?.code === 'ENOENT' || error?.code === 'ESRCH') continue; throw error }
        const commEnd = stat.lastIndexOf(')')
        if (!stat.startsWith(`${entry} (`) || commEnd <= stat.indexOf('(') || stat[commEnd + 1] !== ' ') return null
        const fields = stat.slice(commEnd + 2).trim().split(/\s+/)
        if (!/^\d+$/.test(fields[2] ?? '') || !/^\d+$/.test(fields[3] ?? '')) return null
        // Smoke children own a private session. A live member which changed
        // groups could rejoin later; fail conservatively rather than losing it.
        if (Number(fields[2]) !== pid && Number(fields[3]) !== pid) continue
        // A Z leader can retain live pthread workers: require num_threads=1.
        if (fields[0] !== 'Z' || fields[17] !== '1' || !/^\d+$/.test(fields[19] ?? '')) return null
        members.push(`${entry}:${fields[19]}`)
      }
      return members.sort().join(',')
    }
    const first = snapshot()
    if (!first) return true
    // A member might fork after readdir and exit before its stat was read.
    // The second complete scan must agree on the nonempty zombie identities.
    // Those same sole zombies cannot fork between scans. New/reused PIDs,
    // unknown state or an empty positive-probe snapshot stay live.
    return snapshot() !== first
  } catch { return true }
}

function signalGroup(pid, signal) {
  if (!pid || process.platform === 'win32') return
  try { process.kill(-pid, signal) } catch { /* already stopped */ }
}

async function waitUntil(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return !predicate()
}

export async function stopDesktopSmoke(child, graceMs = 5_000) {
  const pid = child?.pid
  if (!pid) return

  if (process.platform === 'win32') {
    if (child.exitCode === null && child.signalCode === null) {
      spawnSync('taskkill.exe', ['/pid', String(pid), '/T', '/F'], {
        stdio: 'ignore', windowsHide: true,
      })
    }
    await waitUntil(() => child.exitCode === null && child.signalCode === null, graceMs)
    return
  }

  // Let the main process run its own Guardian shutdown first. Its helpers are
  // in the smoke-owned group, so an unexpected main-process exit still leaves
  // us a bounded way to reap them before deleting temporary data or packages.
  if (child.exitCode === null && child.signalCode === null) {
    try { child.kill('SIGTERM') } catch { /* already stopped */ }
    await waitUntil(() => child.exitCode === null && child.signalCode === null, graceMs)
  }
  if (!desktopSmokeGroupAlive(pid)) return
  signalGroup(pid, 'SIGTERM')
  if (await waitUntil(() => desktopSmokeGroupAlive(pid), 1_000)) return
  signalGroup(pid, 'SIGKILL')
  if (!await waitUntil(() => desktopSmokeGroupAlive(pid), 1_000)) {
    throw new Error(`desktop smoke process group ${pid} did not exit`)
  }
}
