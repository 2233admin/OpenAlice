import { describe, expect, it, vi } from 'vitest'

import {
  buildRemoteCommand,
  runMachineTarget,
} from './machine-target-command.mjs'

describe('OpenAlice --machine target dispatch', () => {
  it('forwards the ordinary command through the selected SSH Machine', async () => {
    const runRemote = vi.fn(async () => 'status-json\n')
    let output = ''
    await expect(runMachineTarget('0123456789abcdef0123456789abcdef', ['status', '--json'], {
      loadMachines: async () => ({
        defaultMachine: 'local',
        machines: [{
          key: 'cloud',
          id: '0123456789abcdef0123456789abcdef',
          displayName: 'Cloud',
          sshTarget: 'alice@example.com',
          sshPort: 2222,
          identityFile: '/keys/cloud',
          enabled: true,
          isDefault: false,
        }],
      }),
      runRemote,
      stdout: { write: (chunk) => { output += chunk } },
    })).resolves.toBe(0)
    expect(runRemote).toHaveBeenCalledWith({
      destination: 'alice@example.com',
      sshPort: 2222,
      identityFile: '/keys/cloud',
    }, expect.stringContaining("exec \"$cli\" 'status' '--json'"), expect.any(Object))
    expect(output).toBe('status-json\n')
  })

  it('does not dispatch to a disabled Machine', async () => {
    await expect(runMachineTarget('cloud', ['status'], {
      loadMachines: async () => ({
        defaultMachine: 'local',
        machines: [{
          key: 'cloud',
          displayName: 'Cloud',
          sshTarget: 'alice@example.com',
          enabled: false,
          isDefault: false,
        }],
      }),
    })).rejects.toMatchObject({ code: 'EUSAGE' })
  })

  it('re-enters the local dispatcher for the implicit local Machine', async () => {
    const runLocal = vi.fn(async () => 7)
    await expect(runMachineTarget('local', ['status'], { runLocal })).resolves.toBe(7)
    expect(runLocal).toHaveBeenCalledWith(['status'])
  })

  it('shell-quotes every forwarded argument', () => {
    expect(buildRemoteCommand(['status', '--home', '/tmp/space here', "it's safe"])).toContain(
      `exec "$cli" 'status' '--home' '/tmp/space here' 'it'\\''s safe'`,
    )
  })
})
