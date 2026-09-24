import { useCallback, useState } from 'react'

import { useRelayConnection } from './useRelayConnection'

export interface MachinePlan {
  id: string
  mode: 'add' | 'upgrade'
  machine: { key: string | null; label: string; sshTarget: string }
  project: { key: string; displayName: string } | null
  platform: string
  installedVersion: string
  targetVersion: string
  runtime: string
  actions: string[]
  blocker: string | null
  deferredUpdate: boolean
  expiresAt: string
}

export type MachinePlanInput = {
  mode: 'add' | 'upgrade'
  sshTarget?: string
  label?: string
  sshPort?: number
  identityFile?: string
  machineKey?: string
  projectKey?: string
}

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
export function useMachineManagement() {
  const relay = useRelayConnection()
  const desktop = window.openAlice?.desktopMachine
  const [plan, setPlan] = useState<MachinePlan | null>(null)
  const [probing, setProbing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearPlan = useCallback(() => { setPlan(null); setError(null) }, [])
  const probe = useCallback(async (input: MachinePlanInput) => {
    setProbing(true)
    setPlan(null)
    setError(null)
    try {
      const next = desktop
        ? await desktop.plan(input) as MachinePlan
        : await relayMutation<MachinePlan>('plan', input)
      setPlan(next)
      return next
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      throw cause
    } finally { setProbing(false) }
  }, [desktop])

  const apply = useCallback(async () => {
    if (!plan || plan.blocker) return
    setApplying(true)
    setError(null)
    try {
      if (desktop) await desktop.apply(plan.id)
      else await relayMutation('apply', { id: plan.id })
      setPlan(null)
      await relay.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      throw cause
    } finally { setApplying(false) }
  }, [desktop, plan, relay.refresh])

  return { ...relay, plan, probing, applying, operationError: error, clearPlan, probe, apply }
}
