// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { useUpgradeRehearsal } from './useUpgradeRehearsal'
beforeEach(() => sessionStorage.clear())
it('restores an approved checkpoint through guarded command replay', () => {
  const first = renderHook(useUpgradeRehearsal)
  for (const type of ['review','approve','next','next','next'] as const) act(() => first.result.current.dispatch({type}))
  expect(first.result.current.state.phase).toBe('suspended')
  first.unmount()
  const restored = renderHook(useUpgradeRehearsal)
  expect(restored.result.current.state.phase).toBe('suspended')
  expect(restored.result.current.state.client).toBe('1.1')
  act(() => restored.result.current.dispatch({type:'target',value:'1.2'}))
  expect(restored.result.current.state.target).toBe('1.1')
})
it('rejects malformed stored commands without breaking the page', () => {
  sessionStorage.setItem('openalice.dev.upgrade-rehearsal.v1','[{"type":"scenario","value":"__proto__"}]')
  expect(renderHook(useUpgradeRehearsal).result.current.state.scenario).toBe('together')
})
