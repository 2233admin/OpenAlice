/** Client-owned startup preference. Never stored beneath an AliceProject. */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { resolveSupervisorRootPath, type ResolveSupervisorRootOptions } from './launch-context.ts'

const FILE_NAME = 'startup-target.json'
const MACHINE_KEY = /^[a-z][a-z0-9_-]{0,31}$/
const PROJECT_KEY = /^[a-z][a-z0-9_-]{0,31}$/

export interface StartupTarget {
  machine: string
  project: string
}

interface StartupTargetDocument {
  schemaVersion: 1
  target: StartupTarget | null
}

export interface StartupTargetOptions extends ResolveSupervisorRootOptions {
  supervisorRoot?: string
}

function pathFor(options: StartupTargetOptions): string {
  return join(options.supervisorRoot ?? resolveSupervisorRootPath(options), FILE_NAME)
}

export function validateStartupTarget(value: unknown): StartupTarget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose a Machine and AliceProject.')
  const target = value as Record<string, unknown>
  if (typeof target.machine !== 'string' || !MACHINE_KEY.test(target.machine)
    || typeof target.project !== 'string' || !PROJECT_KEY.test(target.project)) {
    throw new Error('Choose a registered Machine and AliceProject.')
  }
  return { machine: target.machine, project: target.project }
}

export async function readStartupTarget(options: StartupTargetOptions = {}): Promise<StartupTarget | null> {
  const path = pathFor(options)
  let text: string
  try { text = await readFile(path, 'utf8') }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new Error(`Could not read startup target at ${path}: ${String(error)}`)
  }
  let document: unknown
  try { document = JSON.parse(text) }
  catch { throw new Error(`Invalid startup target at ${path}: not JSON.`) }
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error(`Invalid startup target at ${path}.`)
  const record = document as Record<string, unknown>
  if (record.schemaVersion !== 1 || !('target' in record)) throw new Error(`Unsupported startup target at ${path}.`)
  return record.target === null ? null : validateStartupTarget(record.target)
}

export async function writeStartupTarget(target: StartupTarget | null, options: StartupTargetOptions = {}): Promise<void> {
  const path = pathFor(options)
  const root = options.supervisorRoot ?? resolveSupervisorRootPath(options)
  const document: StartupTargetDocument = { schemaVersion: 1, target: target === null ? null : validateStartupTarget(target) }
  const temporary = join(root, `.${FILE_NAME}.${process.pid}.${randomUUID()}.tmp`)
  await mkdir(root, { recursive: true, mode: 0o700 })
  try {
    await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}
