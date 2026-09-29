import { useEffect, useState } from 'react'
import { initial, reduce, scenarios, type Action } from '../components/dev/upgrade-rehearsal/model'
const KEY = 'openalice.dev.upgrade-rehearsal.v1'
// Persist commands rather than trusting a serialized runtime state. Replaying
// through the reducer preserves guards and the approved plan after a reload.
function valid(a: unknown): a is Action {
  if (!a || typeof a !== 'object' || !('type' in a)) return false
  if (a.type === 'scenario') return 'value' in a && typeof a.value === 'string' && Object.hasOwn(scenarios, a.value)
  if (a.type === 'target') return 'value' in a && (a.value === '1.1' || a.value === '1.2')
  if (a.type === 'backend' || a.type === 'content') return 'value' in a && typeof a.value === 'boolean'
  return ['review', 'back', 'approve', 'next', 'resume', 'retry', 'release', 'reset'].includes(String(a.type))
}
export function useUpgradeRehearsal() {
  const [actions, setActions] = useState<Action[]>(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]')
      return Array.isArray(saved) && saved.length <= 2000 && saved.every(valid) ? saved : []
    } catch { return [] }
  })
  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(actions)) } catch { /* Rehearsal remains usable without storage. */ }
  }, [actions])
  const state = actions.reduce(reduce, initial())
  function dispatch(a: Action) {
    setActions(old => a.type === 'reset' ? [{ type: 'scenario', value: state.scenario }] : a.type === 'scenario' ? [a] : [...old, a])
  }
  return { state, dispatch }
}
