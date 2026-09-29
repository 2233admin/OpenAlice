import { useCallback, useEffect, useRef, useState } from 'react'

/** Shared by the real update provider and rehearsal. The caller owns transport
 * and channel authority; this hook owns request ordering and visible state.
 * A location/channel switch invalidates old replies, including old errors. */
export function useVersionDiscovery<T>(scope: string) {
  const sequence = useRef(0)
  const currentScope = useRef(scope)
  const generationRef = useRef(0)
  if (currentScope.current !== scope) {
    currentScope.current = scope
    generationRef.current++
    sequence.current++
  }
  const generation = generationRef.current
  const [snapshot, setSnapshot] = useState<{
    scope: string
    generation: number
    value: T | null
    error: string | null
    checking: boolean
  }>({ scope, generation, value: null, error: null, checking: false })
  useEffect(
    () => () => {
      sequence.current++
    },
    [],
  )
  const clear = useCallback(() => {
    sequence.current++
    setSnapshot({
      scope: currentScope.current,
      generation: generationRef.current,
      value: null,
      error: null,
      checking: false,
    })
  }, [])
  const check = useCallback(
    async (read: () => Promise<T>): Promise<T | null> => {
      if (scope !== currentScope.current || generation !== generationRef.current) return null
      const id = ++sequence.current
      const startedIn = currentScope.current
      setSnapshot((previous) => ({
        scope: startedIn,
        generation,
        value: previous.scope === startedIn && previous.generation === generation ? previous.value : null,
        error: null,
        checking: true,
      }))
      try {
        const value = await read()
        if (id !== sequence.current || startedIn !== currentScope.current)
          return null
        setSnapshot({ scope: startedIn, generation, value, error: null, checking: false })
        return value
      } catch (cause) {
        if (id !== sequence.current || startedIn !== currentScope.current)
          return null
        setSnapshot({
          scope: startedIn,
        generation,
          value: null,
          error: cause instanceof Error ? cause.message : String(cause),
          checking: false,
        })
        return null
      }
    },
    [scope, generation],
  )
  return {
    value: snapshot.scope === scope && snapshot.generation === generation ? snapshot.value : null,
    error: snapshot.scope === scope && snapshot.generation === generation ? snapshot.error : null,
    checking: snapshot.scope === scope && snapshot.generation === generation && snapshot.checking,
    check,
    clear,
  }
}
