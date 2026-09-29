import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptPath = resolve(import.meta.dirname, 'windows-source-dev.ps1')
const powershellPath = join(
  process.env['SystemRoot'] ?? 'C:\\Windows',
  'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe',
)

function runPowerShell(root: string, args: string[] = []) {
  return spawnSync(powershellPath, [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath, '-Root', root, ...args,
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  })
}

describe.skipIf(process.platform !== 'win32')('Windows source-dev PowerShell CLI', () => {
  it('defaults to read-only Status for an isolated root and task name', () => {
    const disposableRoot = mkdtempSync(join(tmpdir(), 'openalice-source-dev-cli-'))
    const statusRoot = join(disposableRoot, 'status')
    mkdirSync(statusRoot)

    try {
      // Status only reads this GUID-named task; it never targets a user task.
      const taskName = 'OpenAliceSourceDevTest-' + randomUUID()
      const statusResult = runPowerShell(statusRoot, [
        '-TaskName', taskName, '-WebPort', '0', '-UiPort', '0',
      ])

      expect(statusResult.error).toBeUndefined()
      expect(statusResult.signal).toBeNull()
      expect(statusResult.status).toBe(0)
      const status = JSON.parse(statusResult.stdout.trim()) as {
        task: string
        root: string
        webReady: boolean
        uiReady: boolean
        installStamp: boolean
      }
      expect(status.task).toBe('missing')
      expect(status.root.toLowerCase()).toBe(statusRoot.toLowerCase())
      expect(status.webReady).toBe(false)
      expect(status.uiReady).toBe(false)
      expect(status.installStamp).toBe(false)
    } finally {
      rmSync(disposableRoot, { recursive: true, force: true })
    }
  })
})
