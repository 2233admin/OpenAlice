// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useRelayConnection } from './useRelayConnection'

afterEach(() => vi.unstubAllGlobals())

describe('useRelayConnection', () => {
  it('loads the selected target and inventory together', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/status')
      ? { schemaVersion: 1, generation: 3, target: { machine: 'local', project: 'default' }, switching: false }
      : { schemaVersion: 1, machines: [{ key: 'local', displayName: 'This computer', projects: [], connection: 'local', issue: null }] }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useRelayConnection())
    await act(async () => { await result.current.refresh() })
    await waitFor(() => expect(result.current.status?.generation).toBe(3))
    expect(result.current.fleet.map((machine) => machine.key)).toEqual(['local'])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('reports inventory failures while keeping the last confirmed target', async () => {
    const fetchMock = vi.fn(async (url: string) => url.endsWith('/status')
      ? new Response(JSON.stringify({ schemaVersion: 1, generation: 1, target: { machine: 'local', project: 'default' }, switching: false }), { status: 200 })
      : new Response(JSON.stringify({ error: 'SSH discovery unavailable' }), { status: 502 }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useRelayConnection())
    await waitFor(() => expect(result.current.status?.generation).toBe(1))
    await act(async () => { await result.current.refresh() })
    expect(result.current.status?.target?.project).toBe('default')
    expect(result.current.fleet).toEqual([])
    expect(result.current.error).toBe('SSH discovery unavailable')
  })
})
