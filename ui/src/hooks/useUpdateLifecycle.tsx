import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { newerRelease } from '@traderalice/update-lifecycle'
import { useDiscoverySnapshot } from '../lib/updates/useDiscoverySnapshot'
import type { VersionInfo } from '../api/types'
import { api } from '../api'
import { useRelayConnection } from './useRelayConnection'
import type { MachinePlan, MachinePlanInput, MachineOperation } from '../lib/updates/machine-types'
import { useBackendRecoverySignal } from '../auth/AuthContext'
import { useWorkspaces } from '../contexts/workspaces-context'

export interface UpdatePreferences {
  autoCheckApp: boolean
  autoUpdateAutoQuant: boolean
  autoUpdateAutoPrediction: boolean
}
export interface WorkspaceUpdateState {
  workspaceId: string
  template: 'auto-quant-v2' | 'auto-prediction'
  phase: 'checking' | 'available' | 'applying' | 'current' | 'updated' | 'blocked' | 'failed'
  checkedAt: string | null
  fromVersion?: string
  toVersion?: string
  verified?: boolean
  reason?: string
}
export type NativeStatus =
  | { phase: 'available'; version?: string; releaseUrl?: string }
  | { phase: 'downloading'; version?: string; percent?: number }
  | { phase: 'downloaded'; version: string; releaseUrl: string }
  | { phase: 'installing'; version: string; stage: 'preparing' | 'stopping-services' | 'releasing-runtime' | 'handing-off' }
  | { phase: 'error'; message: string }
interface UpdateResponse { preferences: UpdatePreferences; workspaces: WorkspaceUpdateState[] }

export interface UpdateLifecycle {
  machines: ReturnType<typeof useMachineControls>
  preferences: UpdatePreferences | null
  versionInfo: VersionInfo | null
  nativeStatus: NativeStatus | null
  nativeReady: Extract<NativeStatus, { phase: 'downloaded' }> | null
  nativeInstalling: boolean
  nativeError: string | null
  installClient(): Promise<void>
  openClientRelease(version?: string): Promise<void>
  workspaceStates: WorkspaceUpdateState[]
  checking: boolean
  error: string | null
  versionError: string | null
  updatesUnsupported: boolean
  availableCount: number
  refresh(): Promise<void>
  savePreferences(next: UpdatePreferences): Promise<void>
}

const Context = createContext<UpdateLifecycle | null>(null)
const POLL_MS = 60_000
const CLIENT_VERSION = typeof __OPENALICE_UI_VERSION__ === 'string' ? __OPENALICE_UI_VERSION__ : 'development'


async function getUpdates(): Promise<UpdateResponse> {
  const response = await fetch('/api/updates')
  // Pre-update-lifecycle Runtimes serve their SPA for unknown /api routes.
  // That fallback is HTTP 200 text/html, so response.ok alone is insufficient.
  if (response.status === 404 || response.status === 405 || response.headers?.get('content-type')?.includes('text/html')) {
    throw new UnsupportedUpdatesError()
  }
  if (!response.ok) throw new Error(`Update status failed: HTTP ${response.status}`)
  return response.json() as Promise<UpdateResponse>
}

class UnsupportedUpdatesError extends Error {}

export function UpdateLifecycleProvider({ children }: { children: ReactNode }) {
  const machines = useMachineControls()
  const { workspaces, refresh: refreshWorkspaces } = useWorkspaces()
  const { backendUnavailable, backendRecoveryGeneration } = useBackendRecoverySignal()
  const [preferences, setPreferences] = useState<UpdatePreferences | null>(null)
  const discovery = useDiscoverySnapshot<VersionInfo>(`${backendRecoveryGeneration}:${backendUnavailable}`)
  const { value: versionInfo, error: versionError, check: checkVersion, clear: clearVersion } = discovery
  const [nativeStatus, setNativeStatus] = useState<NativeStatus | null>(null)
  const [nativeReady, setNativeReady] = useState<Extract<NativeStatus, { phase: 'downloaded' }> | null>(null)
  const [nativeInstalling, setNativeInstalling] = useState(false)
  const [nativeError, setNativeError] = useState<string | null>(null)
  const nativeInstallFlight = useRef<Promise<void> | null>(null)
  const [workspaceStates, setWorkspaceStates] = useState<WorkspaceUpdateState[]>([])
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatesUnsupported, setUpdatesUnsupported] = useState(false)
  // A connection generation owns every project response, not only /version.
  // Native updater state remains local and is deliberately outside this scope.
  const scope = useMemo(() => ({ active: true }), [backendRecoveryGeneration, backendUnavailable])
  const currentScope = useRef(scope)
  currentScope.current = scope
  const isCurrent = useCallback(() => scope.active && currentScope.current === scope, [scope])
  useEffect(() => {
    scope.active = true
    return () => { scope.active = false }
  }, [scope])
  const updatesSupported = useRef<boolean | null>(null)
  const nativeAutoChecked = useRef(false)
  const observedWorkspaceUpdates = useRef(new Set<string>())

  const load = useCallback(async (force = false) => {
    if (backendUnavailable || !isCurrent()) return
    if (force) setChecking(true)
    let snapshot: UpdateResponse | null = null
    try {
      // Once an older Runtime is identified, avoid POSTing a check endpoint it
      // cannot implement. GET remains a cheap capability probe after upgrades.
      const response = force && updatesSupported.current !== false
        ? await fetch('/api/updates/check', { method: 'POST' })
        : null
      if (response && (response.status === 404 || response.status === 405 || response.headers?.get('content-type')?.includes('text/html'))) {
        throw new UnsupportedUpdatesError()
      }
      if (response && !response.ok) throw new Error(`Update check failed: HTTP ${response.status}`)
      snapshot = response ? await response.json() as UpdateResponse : await getUpdates()
      if (!isCurrent()) return
      updatesSupported.current = true
      setUpdatesUnsupported(false)
      setPreferences(snapshot.preferences)
      setWorkspaceStates(snapshot.workspaces)
      let refreshedWorkspace = false
      for (const state of snapshot.workspaces) {
        if (state.phase !== 'updated') continue
        const key = `${state.workspaceId}:${state.toVersion}`
        if (observedWorkspaceUpdates.current.has(key)) continue
        observedWorkspaceUpdates.current.add(key)
        refreshedWorkspace = true
      }
      if (refreshedWorkspace) void refreshWorkspaces().catch(() => undefined)
      setError(null)
    } catch (cause) {
      if (!isCurrent()) return
      const unsupported = cause instanceof UnsupportedUpdatesError
      updatesSupported.current = unsupported ? false : updatesSupported.current
      setUpdatesUnsupported(unsupported)
      if (unsupported) {
        setPreferences(null)
        setWorkspaceStates([])
      }
      setError(unsupported ? null : cause instanceof Error ? cause.message : String(cause))
    }
    // Version identity is independent of the newer Workspace update API.
    // Keep it visible when an older remote Runtime cannot serve /api/updates.
    try {
      const next = await checkVersion(() => force ? api.version.check() : snapshot?.preferences.autoCheckApp === false ? api.version.current() : api.version.get())
      if (!next || !isCurrent()) return
      if (force) await window.openAlice?.updater?.checkForUpdates().catch(() => undefined)
      else if (!nativeAutoChecked.current && window.openAlice?.updater && snapshot?.preferences.autoCheckApp !== false) {
        nativeAutoChecked.current = true
        void window.openAlice.updater.checkForUpdates().catch(() => undefined)
      }
    } catch (cause) {
      // Native updater failures are reported by its own status stream.
    }
    finally { if (force && isCurrent()) setChecking(false) }
  }, [backendUnavailable, refreshWorkspaces, checkVersion, isCurrent])

  useEffect(() => {
    setChecking(false)
    setError(null)
    updatesSupported.current = null
    observedWorkspaceUpdates.current.clear()
    setPreferences(null)
    setWorkspaceStates([])
    setUpdatesUnsupported(false)
    if (backendUnavailable) {
      clearVersion()
      return
    }
    let active = true
    let timer: number | undefined
    // Two frames let the shell paint before the backend begins cloning or
    // checking source releases. Activation is idempotent across tabs.
    const first = window.requestAnimationFrame(() => {
      const second = window.requestAnimationFrame(() => {
        if (!active) return
        void fetch('/api/updates/activate', { method: 'POST' }).catch(() => undefined)
        void load()
        timer = window.setInterval(() => { void load() }, POLL_MS)
      })
      cancelSecond = () => window.cancelAnimationFrame(second)
    })
    let cancelSecond: (() => void) | undefined
    return () => {
      active = false
      window.cancelAnimationFrame(first)
      cancelSecond?.()
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [backendRecoveryGeneration, backendUnavailable, load, clearVersion])

  useEffect(() => {
    const updater = window.openAlice?.updater
    if (!updater) return
    let active = true
    let receivedEvent = false
    const accept = (status: NativeStatus | null) => {
      setNativeStatus(status)
      if (status?.phase === 'downloaded') setNativeReady(status)
      if (status?.phase === 'installing') setNativeInstalling(true)
      if (status?.phase === 'error') {
        setNativeError(status.message)
        setNativeInstalling(false)
        nativeInstallFlight.current = null
      } else setNativeError(null)
    }
    const unsubscribe = updater.onStatus((status) => {
      receivedEvent = true
      if (active) accept(status)
    })
    void updater.getStatus().then((status) => {
      if (active && !receivedEvent) accept(status)
    }).catch(() => undefined)
    return () => { active = false; unsubscribe() }
  }, [])

  const installClient = useCallback((): Promise<void> => {
    if (nativeInstallFlight.current) return nativeInstallFlight.current
    const updater = window.openAlice?.updater
    if (!updater || !nativeReady) return Promise.reject(new Error('No downloaded client update is ready'))
    setNativeInstalling(true)
    setNativeError(null)
    const flight = Promise.resolve().then(async () => { await updater.installAndRestart() }).catch((cause: unknown) => {
      nativeInstallFlight.current = null
      setNativeInstalling(false)
      setNativeError(cause instanceof Error ? cause.message : String(cause))
      throw cause
    })
    nativeInstallFlight.current = flight
    return flight
  }, [nativeReady])

  const openClientRelease = useCallback(async (version?: string) => {
    const updater = window.openAlice?.updater
    if (updater) await updater.openRelease(version)
    else window.open(version
      ? `https://github.com/TraderAlice/OpenAlice/releases/tag/v${encodeURIComponent(version)}`
      : 'https://github.com/TraderAlice/OpenAlice/releases', '_blank', 'noopener,noreferrer')
  }, [])

  const savePreferences = useCallback(async (next: UpdatePreferences) => {
    if (backendUnavailable || !isCurrent()) throw new Error('The update target changed; retry on the current backend')
    const response = await fetch('/api/preferences/updates', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next),
    })
    if (!response.ok) throw new Error(`Could not save update preferences: HTTP ${response.status}`)
    const saved = await response.json() as UpdatePreferences
    if (!isCurrent()) return
    setPreferences(saved)
    await load()

  }, [load, preferences, isCurrent, backendUnavailable])

  const availableCount = useMemo(() => {
    const candidates = new Set<string>()
    if (preferences?.autoCheckApp && versionInfo?.hasUpdate) candidates.add('backend')
    if (preferences?.autoCheckApp && newerRelease(versionInfo?.latest, CLIENT_VERSION)) candidates.add('client')
    if (preferences?.autoCheckApp && ['available', 'downloaded'].includes(nativeStatus?.phase ?? '')) candidates.add('client')
    for (const workspace of workspaces) {
      const completed = workspaceStates.find((state) => state.workspaceId === workspace.id
        && state.phase === 'updated' && state.toVersion === workspace.upgradeAvailable?.to)
      if (workspace.upgradeAvailable && !completed) candidates.add(workspace.id)
    }
    for (const state of workspaceStates) {
      if (state.toVersion && ['available', 'blocked', 'failed'].includes(state.phase)) candidates.add(state.workspaceId)
    }
    return candidates.size
  }, [nativeStatus, preferences, versionInfo, workspaceStates, workspaces])

  const value = useMemo<UpdateLifecycle>(() => ({
    machines, preferences, versionInfo, nativeStatus, nativeReady, nativeInstalling, nativeError, installClient, openClientRelease, workspaceStates, checking, error, versionError, updatesUnsupported, availableCount,
    refresh: () => load(true), savePreferences,
  }), [machines, preferences, versionInfo, nativeStatus, nativeReady, nativeInstalling, nativeError, installClient, openClientRelease, workspaceStates, checking, error, versionError, updatesUnsupported, availableCount, load, savePreferences])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useUpdateLifecycle(options: { optional: true }): UpdateLifecycle | null
export function useUpdateLifecycle(): UpdateLifecycle
export function useUpdateLifecycle(options?: { optional: true }): UpdateLifecycle | null {
  const value = useContext(Context)
  if (!value && !options?.optional) throw new Error('UpdateLifecycleProvider is missing')
  return value
}

// Mounted once by the public provider; presentation consumers never poll.
async function relayMutation<T>(path: string, input: unknown): Promise<T> {
  const response = await fetch(`/relay/v1/machines/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? `Relay returned HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

/** Machine operations are local client controls, never proxied backend API calls. */
function useMachineControls() {
  const relay = useRelayConnection()
  const desktop = window.openAlice?.desktopMachine
  const [plan, setPlan] = useState<MachinePlan | null>(null)
  const [probing, setProbing] = useState(false)
  const [applying, setApplying] = useState(false)
  const operationDiscovery = useDiscoverySnapshot<MachineOperation | null>('local-machine-control')
  const operation = operationDiscovery.value
  const checkOperation = operationDiscovery.check
  const probeGeneration = useRef(0)
  const applyFlight = useRef<Promise<void> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshOperation = useCallback(() => checkOperation(async () => {
    if (desktop) return await desktop.operation() as MachineOperation | null
    const response = await fetch('/relay/v1/machines/operation', { cache: 'no-store' })
    if (response.status === 404 || response.headers?.get('content-type')?.includes('text/html')) return null
    if (!response.ok) throw new Error(`Operation status failed: HTTP ${response.status}`)
    return response.json() as Promise<MachineOperation | null>
  }), [desktop, checkOperation])
  useEffect(() => () => { probeGeneration.current++ }, [])

  useEffect(() => { void refreshOperation() }, [refreshOperation])
  useEffect(() => {
    if (!applying && operation?.phase !== 'running') return
    const timer = window.setInterval(() => { void refreshOperation() }, 700)
    return () => window.clearInterval(timer)
  }, [applying, operation?.phase, refreshOperation])

  const clearPlan = useCallback(() => { probeGeneration.current++; setPlan(null); setError(null); setProbing(false) }, [])
  const probe = useCallback(async (input: MachinePlanInput) => {
    if (applyFlight.current) throw new Error('Wait for the current operation to finish')
    const generation = ++probeGeneration.current
    setProbing(true)
    setPlan(null)
    setError(null)
    try {
      const next = desktop
        ? await desktop.plan(input) as MachinePlan
        : await relayMutation<MachinePlan>('plan', input)
      if (generation !== probeGeneration.current) throw new Error('This probe was superseded')
      setPlan(next)
      return next
    } catch (cause) {
      if (generation === probeGeneration.current) setError(cause instanceof Error ? cause.message : String(cause))
      throw cause
    } finally { if (generation === probeGeneration.current) setProbing(false) }
  }, [desktop])

  const apply = useCallback((): Promise<void> => {
    if (applyFlight.current) return applyFlight.current
    if (!plan || plan.blocker) return Promise.reject(new Error('A reviewed unblocked plan is required'))
    const approved = plan
    setApplying(true)
    setError(null)
    const flight = Promise.resolve().then(async () => {
      try {
        if (desktop) await desktop.apply(approved.id)
        else await relayMutation('apply', { id: approved.id })
        await refreshOperation()
        setPlan(null)
        await relay.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause))
        await refreshOperation()
        throw cause
      } finally {
        setApplying(false)
        applyFlight.current = null
      }
    })
    applyFlight.current = flight
    return flight
  }, [desktop, plan, relay.refresh, refreshOperation])

  return { ...relay, plan, probing, applying, operation, operationError: error ?? operationDiscovery.error, clearPlan, probe, apply }
}
