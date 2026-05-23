/**
 * AuthProvider — gates the entire app on a successful /api/auth/status check.
 *
 * Three terminal states (after the initial loading bounce):
 *
 *   - 'authed'         → render the app. Covers both real session cookies
 *                        AND the localhost passthrough (in dev, the backend
 *                        reports authed:true for true-loopback callers).
 *   - 'login-required' → tokenConfigured:true, authed:false → show LoginPage.
 *   - 'no-token'       → tokenConfigured:false — backend never bootstrapped
 *                        a token. Defensive: shouldn't happen because
 *                        bootstrap runs at boot. Shows a setup hint.
 *
 * A global window-level `app:unauthorized` event flips the state back to
 * 'login-required' — `fetchJson` dispatches it on any 401 (see api/client.ts).
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { getStatus, type AuthStatus } from './api'

type AuthState = 'loading' | 'authed' | 'login-required' | 'no-token'

interface AuthContextValue {
  state: AuthState
  status: AuthStatus | null
  /** Re-check /api/auth/status. Called after login success. */
  refresh: () => Promise<void>
  /** Locally flip state to login-required (e.g. after logout). */
  markUnauthorized: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

function deriveState(status: AuthStatus | null): AuthState {
  if (!status) return 'loading'
  if (status.authed) return 'authed'
  if (!status.tokenConfigured) return 'no-token'
  return 'login-required'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const state = deriveState(status)

  const refresh = useCallback(async () => {
    const next = await getStatus()
    setStatus(next)
  }, [])

  const markUnauthorized = useCallback(() => {
    setStatus({ authed: false, tokenConfigured: true })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Wire the global unauthorized signal — any fetchJson 401 flips us
  // back to the login page, killing whatever the user was doing. This
  // is the right trade-off: stale UI on an expired session is worse
  // than a hard interrupt.
  useEffect(() => {
    const onUnauth = () => markUnauthorized()
    window.addEventListener('app:unauthorized', onUnauth)
    return () => window.removeEventListener('app:unauthorized', onUnauth)
  }, [markUnauthorized])

  return (
    <AuthContext.Provider value={{ state, status, refresh, markUnauthorized }}>
      {children}
    </AuthContext.Provider>
  )
}
