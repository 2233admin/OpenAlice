import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { buildDesktopPackagedSmokePlan, desktopSmokeStateEnv } from './desktop-packaged-smoke-plan.mjs'
import { syncPiProjectTrust } from '../src/workspaces/adapters/pi.js'

it.each([[], ['--onboarding'], ['--workspace-acceptance'], ['--trading-mode']])('isolates native Pi trust in temporary mode %j', async (...args) => {
  const parent = await mkdtemp(join(tmpdir(), 'oa-pi-sentinel-'))
  try {
    const sentinel = join(parent, 'inherited-pi')
    await mkdir(sentinel)
    await writeFile(join(sentinel, 'sentinel'), 'do not change')
    const root = join(parent, 'smoke')
    const cwd = join(root, 'workspace')
    await mkdir(cwd, { recursive: true })
    const plan = buildDesktopPackagedSmokePlan(args, {})
    expect(plan.options.tempData).toBe(true)
    const env = { PI_CODING_AGENT_DIR: sentinel, ...desktopSmokeStateEnv(root) }
    await syncPiProjectTrust(cwd, env)
    expect(await readdir(sentinel)).toEqual(['sentinel'])
    expect(await readFile(join(sentinel, 'sentinel'), 'utf8')).toBe('do not change')
    const files = await readdir(env.PI_CODING_AGENT_DIR)
    expect(files.length).toBe(1)
    expect(JSON.parse(await readFile(join(env.PI_CODING_AGENT_DIR, files[0]), 'utf8'))).toEqual({ [await realpath(cwd)]: true })
  } finally { await rm(parent, { recursive: true, force: true }) }
})
