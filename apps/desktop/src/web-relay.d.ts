/** Types for the CLI relay bundled into dist/electron/web-relay.js. */
export declare class WebRelay {
  constructor(options?: { port?: number; uiRoot?: string })
  readonly originUrl: string
  readonly status: {
    schemaVersion: 1
    generation: number
    target: { machine: string; machineName: string; project: string; projectName: string } | null
    switching: boolean
  }
  listen(): Promise<string>
  connect(machine: string, project: string, options?: { remember?: boolean }): Promise<void>
  rememberCurrentSelection(current?: () => boolean): Promise<void>
  planMachine(input: { mode: 'add' | 'upgrade'; sshTarget?: string; label?: string; sshPort?: number; identityFile?: string; machineKey?: string }): Promise<unknown>
  applyMachine(id: string): Promise<unknown>
  readonly machineOperation: unknown
  startupPreference(): Promise<{ target: { machine: string; project: string } | null; error: string | null }>
  setStartupError(error: unknown): void
  controlProject(input: unknown): Promise<void>
  disconnect(): void
  close(): Promise<void>
}

export declare function inspectLocalMachine(): Promise<{ machine: { projects: Array<{ key: string; available: boolean; runtime: { webEndpoint: string | null } }> } }>

export declare function resolveLocalStartupHome(project: string): Promise<string>

export declare function readStartupTarget(options?: { legacyDesktopPreferencePath?: string }): Promise<{ machine: string; project: string } | null>
export declare function writeStartupTarget(target: { machine: string; project: string } | null, options?: { current?: () => boolean }): Promise<void>

export declare class ClientUpdateService {
  constructor(options?: { path?: string; kind?: 'cli' | 'desktop'; currentVersion?: string; discover?: () => Promise<import('@traderalice/update-lifecycle').ClientReleaseObservation> })
  snapshot(): Promise<import('@traderalice/update-lifecycle').ClientUpdateSnapshot>
  check(): Promise<import('@traderalice/update-lifecycle').ClientUpdateSnapshot>
  activate(): void
  stop(): void
  savePreferences(input: unknown): Promise<import('@traderalice/update-lifecycle').ClientUpdateSnapshot>
}
