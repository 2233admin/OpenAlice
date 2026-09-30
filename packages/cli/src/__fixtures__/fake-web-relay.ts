import type { WebRelay } from '../web-relay.ts'

/** Keeps PTY tests focused on TUI flow without binding a port or probing HTTP. */
export function fakeWebRelay(): WebRelay {
  const state = { generation: 0, target: null as null | { machine: string; project: string } }
  return {
    originUrl: 'http://127.0.0.1:45454',
    get status() { return state },
    get activeSelection() { return state.target ? { machine: { key: state.target.machine }, project: { key: state.target.project }, endpoint: 'http://127.0.0.1:47331' } : null },
    startupPreference: async () => ({ target: null, error: null }),
    setStartupError: () => {},
    listen: async () => 'http://127.0.0.1:45454',
    connect: async (machine: string, project: string) => {
      state.generation += 1
      state.target = { machine, project }
    },
    disconnect: () => { state.target = null; state.generation += 1 },
    subscribe: () => () => {},
    close: async () => {},
  } as unknown as WebRelay
}
