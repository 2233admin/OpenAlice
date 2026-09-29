// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useVersionDiscovery } from './useVersionDiscovery'
it('rejects stale responses and callbacks across backend/channel switches', async () => {
  const { result, rerender } = renderHook(
    ({ scope }) => useVersionDiscovery<string>(scope),
    { initialProps: { scope: 'stable' } },
  )
  let finish!: (value: string) => void
  const oldCheck = result.current.check
  let request!: Promise<string | null>
  act(() => {
    request = oldCheck(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
  })
  rerender({ scope: 'beta' })
  await act(async () => {
    await result.current.check(async () => 'beta.1')
  })
  await act(async () => {
    finish('stable-old')
    await request
  })
  expect(result.current.value).toBe('beta.1')
  expect(await oldCheck(async () => 'late old caller')).toBeNull()
})
it('exposes errors without retaining a stale actionable release and supports retry', async () => {
  const { result } = renderHook(() => useVersionDiscovery<string>('stable'))
  await act(async () => {
    await result.current.check(async () => 'v1')
  })
  await act(async () => {
    await result.current.check(async () => {
      throw new Error('offline')
    })
  })
  expect(result.current.value).toBeNull()
  expect(result.current.error).toBe('offline')
  await act(async () => {
    await result.current.check(async () => 'v2')
  })
  expect(result.current.error).toBeNull()
  expect(result.current.value).toBe('v2')
})

it('does not revive a request after switching away and back to the same channel', async () => {
  const {result,rerender}=renderHook(({scope})=>useVersionDiscovery<string>(scope),{initialProps:{scope:'stable'}})
  let finish!: (value:string)=>void
  const original=result.current.check
  let pending!: Promise<string|null>
  act(()=>{pending=original(()=>new Promise(resolve=>{finish=resolve}))})
  rerender({scope:'beta'})
  rerender({scope:'stable'})
  await act(async()=>{finish('stale'); await pending})
  expect(result.current.value).toBeNull()
  expect(await original(async()=>'old callback')).toBeNull()
})
