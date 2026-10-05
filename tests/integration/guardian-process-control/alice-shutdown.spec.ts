import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { requestAliceShutdown } from '../../../packages/guardian-runtime/src/process-control.js'

describe('owned Alice IPC shutdown', () => {
  it('finishes asynchronous descendant cleanup before the owned child exits without invoking fallback', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'alice-shutdown-'))
    const marker = join(directory, 'cleaned')
    const descendantProgram = "setInterval(() => {}, 1000); process.on('SIGTERM', () => setTimeout(() => process.exit(0), 60)); process.send('ready')"
    const program = [
      "const { spawn } = require('node:child_process')",
      "const { once } = require('node:events')",
      "const { writeFile } = require('node:fs/promises')",
      `const descendant = spawn(process.execPath, ['-e', ${JSON.stringify(descendantProgram)}], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })`,
      "descendant.once('message', () => process.send({ type: 'ready', descendantPid: descendant.pid }))",
      "process.on('message', async (message) => {",
      "  if (message?.type !== 'openalice:shutdown') return",
      "  const exited = once(descendant, 'exit')",
      "  descendant.kill('SIGTERM')",
      "  await exited",
      `  await writeFile(${JSON.stringify(marker)}, 'cleaned')`,
      "  process.exit(0)",
      "})",
    ].join('\n')
    const child = spawn(process.execPath, ['-e', program], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    })
    let descendantPid: number | undefined
    try {
      const [ready] = await once(child, 'message') as [{ type: string; descendantPid: number }]
      expect(ready.type).toBe('ready')
      descendantPid = ready.descendantPid
      expect(() => process.kill(descendantPid!, 0)).not.toThrow()

      const fallback = vi.fn(() => child.kill('SIGTERM'))
      const exited = once(child, 'exit')
      requestAliceShutdown(child, fallback)
      await exited

      expect(readFileSync(marker, 'utf8')).toBe('cleaned')
      expect(() => process.kill(descendantPid!, 0)).toThrow()
      expect(fallback).not.toHaveBeenCalled()
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      if (descendantPid !== undefined) {
        try { process.kill(descendantPid, 'SIGKILL') } catch { /* already exited */ }
      }
      rmSync(directory, { recursive: true, force: true })
    }
  }, 10_000)

  it('uses fallback for a live child whose IPC channel is actually disconnected', async () => {
    const child = spawn(process.execPath, ['-e', "setInterval(() => {}, 1000); process.send('ready')"], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    })
    try {
      expect((await once(child, 'message'))[0]).toBe('ready')
      const pid = child.pid!
      const disconnected = once(child, 'disconnect')
      child.disconnect()
      await disconnected
      expect(() => process.kill(pid, 0)).not.toThrow()

      const fallback = vi.fn(() => child.kill('SIGTERM'))
      const exited = once(child, 'exit')
      requestAliceShutdown(child, fallback)
      await exited

      expect(fallback).toHaveBeenCalledOnce()
      expect(() => process.kill(pid, 0)).toThrow()
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }
  }, 10_000)
})
