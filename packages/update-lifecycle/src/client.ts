import type { DiscoverySnapshot } from './discovery.js'

/** Local host policy. Never read from the selected backend's AliceProject. */
export interface ClientUpdatePreferences { autoCheck: boolean }
export interface ClientReleaseObservation {
  status: 'available' | 'current' | 'unsupported'
  currentVersion: string
  latestVersion?: string
  latestCommit?: string
  channel: string
  releaseNotesUrl?: string
  message?: string
}
export interface ClientUpdateSnapshot {
  kind: 'cli' | 'desktop'
  currentVersion: string
  preferences: ClientUpdatePreferences
  discovery: DiscoverySnapshot<ClientReleaseObservation>
}
