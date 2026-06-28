// Diagnostic: reproduce guardian's child spawn on Windows under different
// stdio modes to isolate the hang. Run: node .dev/_diag-spawn.mjs <mode>
//   inherit = guardian's exact stdio  ['inherit','pipe','pipe'], shell:true
//   ignore  = same but stdin 'ignore'
// Spawns TWO concurrent tsx-watch children (ports 47351 + 47361) to mimic
// Alice + Vite both spawned together after UTA — the real guardian timing.
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const mode = process.argv[2] || 'inherit'
const root = resolve(process.cwd())
const binDir = resolve(root, 'node_modules/.bin')
const PATH = binDir + ';' + (process.env.PATH || '')
const stdin = mode === 'ignore' ? 'ignore' : 'inherit'

function baseEnv(web, mcp) {
  return {
    ...process.env,
    PATH,
    Path: PATH,
    NODE_OPTIONS: '--conditions=openalice-source',
    OPENALICE_HOME: process.env.USERPROFILE + '\\.openalice',
    OPENALICE_WEB_PORT: String(web),
    OPENALICE_MCP_PORT: String(mcp),
    OPENALICE_UI_PORT: '5173',
    OPENALICE_UTA_URL: 'http://127.0.0.1:47333',
  }
}

function launch(name, web, mcp) {
  const c = spawn('tsx', ['watch', 'src/main.ts'], {
    env: baseEnv(web, mcp),
    stdio: [stdin, 'pipe', 'pipe'],
    shell: true,
  })
  c.stdout?.on('data', (b) => process.stdout.write(`[${name}] ` + b))
  c.stderr?.on('data', (b) => process.stderr.write(`[${name}] ` + b))
  c.on('exit', (code, sig) => console.log(`[diag] ${name} EXIT code=${code} sig=${sig}`))
  console.log(`[diag] ${name} spawned pid=${c.pid}`)
}

console.log(`[diag] mode=${mode} stdin=${stdin} — spawning TWO children concurrently`)
launch('one', 47351, 47352)
launch('two', 47361, 47362)
