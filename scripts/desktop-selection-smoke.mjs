#!/usr/bin/env node
/** Real Electron navigation + Default persistence; disposable Guardian/HTTP fixture, no SSH or accounts. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acquireGuardianRuntime, buildGuardianRuntimeStatus, startGuardianControlServer } from '@traderalice/guardian-runtime'
import { desktopDevExecutable, spawnDesktopSmoke, stopDesktopSmoke } from './desktop-smoke-process.mjs'

const repo = fileURLToPath(new URL('..', import.meta.url))
const root = await realpath(await mkdtemp(join(tmpdir(), 'openalice-selection-smoke-')))
const home = join(root, 'home')
const supervisor = join(root, 'supervisor')
const target = { machine: 'local', project: 'default' }
const id = `alice-project-${createHash('sha256').update('openalice/alice-project/v1\0').update(home).digest('hex').slice(0, 24)}`
const project = { id, key: 'default', displayName: 'Default AliceProject', home, appRoot: null }
let child, control, lock, socket
let output = ''
let nextId = 0
const pending = new Map()
async function until(check, label) {
  const deadline = Date.now() + 30_000
  let error
  while (Date.now() < deadline) {
    try { const value = await check(); if (value) return value } catch (cause) { error = cause }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`${label}: ${error ?? output}`)
}
async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return server.address().port
}
function command(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 10_000)
    pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value) }, reject: error => { clearTimeout(timeout); reject(error) } })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result?.value
}
const backend = createServer((req, res) => {
  res.setHeader('content-type', 'application/json')
  if (req.url === '/api/auth/status') res.end(JSON.stringify({ authed: true, tokenConfigured: false }))
  else if (req.url === '/api/alice-project') res.end(JSON.stringify({ project }))
  else { res.statusCode = 404; res.end('{}') }
})
try {
  await mkdir(home); await mkdir(supervisor)
  // Seed the exact persisted outcome of a conflicting legacy migration.
  await writeFile(join(supervisor, 'config.json'), JSON.stringify({ schemaVersion: 3, defaultTarget: null,
    defaultTargetMigrationError: 'Legacy startup choices conflict. Choose an AliceProject to save one Default.',
    projects: { default: { home } } }))
  const webPort = await listen(backend)
  lock = await acquireGuardianRuntime({ userDataHome: home, launcherRoot: join(home, 'workspaces'), launcher: 'guardian-cli-server', heartbeatMs: 100 })
  control = await startGuardianControlServer({ homeRoot: home, allowStop: false,
    getStatus: () => buildGuardianRuntimeStatus({ productVersion: '0.94.1', state: 'running', home,
      owner: { surface: 'cli-server', pid: process.pid, instanceId: 'selection-smoke', startedAt: lock.owner.acquiredAt, mode: 'foreground' },
      endpoints: { web: `http://127.0.0.1:${webPort}` }, provider: { kind: 'source' }, startedAtMs: Date.now(),
      components: { alice: 'ready', uta: 'disabled', connector: 'disabled' }, capabilities: [],
    }), onStop: () => undefined })
  const portServer = createServer()
  const debugPort = await listen(portServer)
  await new Promise(resolve => portServer.close(resolve))
  const env = { ...process.env, OPENALICE_SUPERVISOR_HOME: supervisor, OPENALICE_GLOBAL_DIR: join(root, 'global'), OPENALICE_ELECTRON_SMOKE_USER_DATA: join(root, 'profile') }
  for (const name of ['OPENALICE_HOME', 'AQ_LAUNCHER_ROOT', 'OPENALICE_PROJECT', 'OPENALICE_INSTANCE']) delete env[name]
  const appPath = process.argv.includes('--app-path') ? process.argv[process.argv.indexOf('--app-path') + 1] : null
  if (process.argv.includes('--app-path') && !appPath) throw new Error('--app-path requires an executable')
  child = spawnDesktopSmoke(appPath ?? desktopDevExecutable(), [...(appPath ? [] : [join(repo, 'dist/electron/main.js')]), `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1'], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] })
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += String(data) })
  const page = await until(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(page => page.type === 'page' && page.url.startsWith('http://127.0.0.1:')), 'renderer')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data))
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result)
  })
  await until(() => evaluate("document.body.innerText.includes('Legacy startup choices conflict')"), 'migration conflict displayed')
  // Use the real preload/IPC operation; the old renderer is intentionally destroyed.
  await evaluate("void window.openAlice.desktopConnection.connect('local', 'default').catch(console.error)")
  await until(async () => {
    const config = JSON.parse(await readFile(join(supervisor, 'config.json'), 'utf8'))
    return config.defaultTarget?.machine === 'local' && config.defaultTarget?.project === 'default' && !config.defaultTargetMigrationError
  }, 'Default committed after navigation')
  await until(() => evaluate("location.pathname === '/settings' && !document.body.innerText.includes('Legacy startup choices conflict') && document.body.innerText.includes('Default AliceProject')"), 'Settings reflects saved Default')
  assert.deepEqual((await evaluate('window.openAlice.desktopConnection.startupTarget()')).target, target)
  // Also exercise the subsequent separated -> separated IPC path and HTTP observer.
  await evaluate("void window.openAlice.desktopConnection.connect('local', 'default').catch(console.error)")
  await until(() => evaluate("window.openAlice.desktopConnection.status().then(s => s.generation === 2 && !s.switching)"), 'second switch')
  await evaluate("void fetch('/relay/v1/connect', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({machine:'local',project:'default'})})")
  await until(() => evaluate("window.openAlice.desktopConnection.status().then(s => s.generation === 3 && !s.switching)"), 'HTTP switch')
  assert(!output.includes('ERR_ABORTED'), output)
  assert.deepEqual((await evaluate('window.openAlice.desktopConnection.startupTarget()')).target, target)
  console.log('[selection-smoke] PASS: conflict -> native IPC switch -> Settings Default -> repeat switch -> HTTP switch; no aborted navigation')
} finally {
  socket?.close()
  await stopDesktopSmoke(child)
  await control?.close()
  await lock?.release()
  backend.closeAllConnections()
  await new Promise(resolve => backend.close(resolve))
  await rm(root, { recursive: true, force: true })
}
