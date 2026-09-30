import { useCallback, useEffect, useRef, useState } from 'react'
import { useRelayConnection, type RelayStatus } from './useRelayConnection'
import { useDiscoverySnapshot } from '../lib/updates/useDiscoverySnapshot'
import type { MachinePlan, MachinePlanInput, MachineOperation } from '../lib/updates/machine-types'

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
export function useMachineControls(initial: RelayStatus | null = null) {
  const relay = useRelayConnection(initial)
  const desktop = window.openAlice?.desktopMachine
  const [plan, setPlan] = useState<MachinePlan | null>(null)
  const [probing, setProbing] = useState(false)
  const [applying, setApplying] = useState(false)
  const operationDiscovery = useDiscoverySnapshot<MachineOperation | null>('local-machine-control')
  const operation = operationDiscovery.value
  const checkOperation = operationDiscovery.check
  const probeGeneration = useRef(0)
  const applyFlight = useRef<Promise<{ machineKey: string }> | null>(null)
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

  const apply = useCallback((): Promise<{ machineKey: string }> => {
    if (applyFlight.current) return applyFlight.current
    if (!plan || plan.blocker) return Promise.reject(new Error('A reviewed unblocked plan is required'))
    const approved = plan
    setApplying(true)
    setError(null)
    const flight = Promise.resolve().then(async () => {
      try {
        // Plans are single-use, including failed applications. Never resubmit
        // an approval after failure; probe and review the current state again.
        const result = desktop
          ? await desktop.apply(approved.id) as { machineKey: string }
          : await relayMutation<{ machineKey: string }>('apply', { id: approved.id })
        await refreshOperation()
        setPlan(null)
        await relay.refresh()
        return result
      } catch (cause) {
        setPlan(null)
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

