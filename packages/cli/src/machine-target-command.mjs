import { readMachineRegistrySummary, findRegisteredMachine, machineIsEnabled } from './machine-registry.ts'
import { runSshCommand } from './remote.mjs'

/**
 * Herdr's --machine mode is a target selector in front of the ordinary
 * command dispatcher. OpenAlice keeps that shape while using its existing
 * SSH transport until the shared remote API exists.
 */
export async function runMachineTarget(selector, commandArgs, dependencies = {}) {
  if (!selector) throw usageError('A Machine id or label is required after --machine')
  if (!Array.isArray(commandArgs) || commandArgs.length === 0) {
    throw usageError(formatMachineTargetHelp())
  }
  if (commandArgs[0] === '--remote' || commandArgs[0] === '--machine') {
    throw usageError('Target selectors cannot be nested')
  }

  if (selector === 'local') {
    const runLocal = dependencies.runLocal
    if (!runLocal) throw usageError('The local Machine target is unavailable in this invocation')
    return runLocal(commandArgs)
  }

  const summary = await (dependencies.loadMachines
    ?? (() => readMachineRegistrySummary(dependencies)))()
  const machine = findRegisteredMachine(summary, selector)
  if (!machine) throw usageError(`Machine "${selector}" is not registered.`)
  if (!machineIsEnabled(machine)) {
    throw usageError(`Machine "${selector}" is disabled. Enable it before using --machine.`)
  }

  const remoteCommand = buildRemoteCommand(commandArgs)
  const runRemote = dependencies.runRemote ?? runSshCommand
  const output = await runRemote({
    destination: machine.sshTarget,
    sshPort: machine.sshPort ?? null,
    identityFile: machine.identityFile ?? null,
  }, remoteCommand, dependencies)
  ;(dependencies.stdout ?? process.stdout).write(output)
  return 0
}

export function formatMachineTargetHelp() {
  return `Usage:
  openalice --machine <id-or-label> <command> [options]

Run an ordinary OpenAlice CLI command against a saved remote Machine.
The remote CLI is selected by its normal PATH or ~/.openalice installation.
`
}

export function buildRemoteCommand(commandArgs) {
  return [
    'set -eu',
    'cli=$(command -v openalice 2>/dev/null || true)',
    '[ -n "$cli" ] || { [ -x "$HOME/.openalice/bin/openalice" ] || { printf \'%s\\n\' \'OpenAlice CLI is not installed\' >&2; exit 127; }; cli="$HOME/.openalice/bin/openalice"; }',
    `exec "$cli" ${commandArgs.map(shellQuote).join(' ')}`,
  ].join('\n')
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}

function usageError(message) {
  return Object.assign(new Error(message), { code: 'EUSAGE', exitCode: 2 })
}
