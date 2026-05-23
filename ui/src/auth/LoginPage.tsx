/**
 * Full-screen login gate — shown when `/api/auth/status` reports
 * `authed:false` and `tokenConfigured:true`.
 *
 * The single input is the admin token printed on the backend's first run.
 * On submit we POST `/api/auth/login`; the backend sets the cookie via
 * Set-Cookie and we re-check status to flip the AuthContext to 'authed'.
 *
 * Intentionally no styling library, no logo, no marketing. This is the
 * smallest thing that unblocks a Docker / LAN / public deployment.
 */

import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useAuth } from './AuthContext'
import { login } from './api'

export function LoginPage() {
  const { refresh } = useAuth()
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    setBusy(true); setError(null)
    const result = await login(token.trim())
    if (!result.ok) {
      setError(result.error ?? 'Login failed')
      setBusy(false)
      return
    }
    await refresh()
    // AuthContext flips to 'authed'; this component unmounts.
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[400px] rounded-lg border border-border bg-surface px-6 py-7 shadow-sm">
        <h1 className="text-[18px] font-semibold text-text mb-1">Sign in to OpenAlice</h1>
        <p className="text-[12px] text-text-muted leading-relaxed mb-5">
          Paste the admin token shown on first launch.
          {' '}
          <span className="text-text-faint">
            Find it in the backend logs after <code className="font-mono">pnpm dev</code> /
            {' '}<code className="font-mono">docker run</code>, or rotate via
            {' '}<code className="font-mono">rm data/config/auth.json</code> and restart.
          </span>
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-text-muted mb-1">
              Admin token
            </label>
            <input
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
              className="w-full rounded border border-border bg-bg px-2.5 py-1.5 text-[13px] font-mono text-text focus:outline-none focus:border-accent disabled:opacity-60"
              placeholder="xKUT78dNUcRVDwoyDsUUROqffPJV8-..."
            />
          </div>

          {error && (
            <div className="rounded border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-[12px] text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !token.trim()}
            className="btn-primary w-full justify-center"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function NoTokenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[460px] rounded-lg border border-border bg-surface px-6 py-7">
        <h1 className="text-[18px] font-semibold text-text mb-2">No admin token configured</h1>
        <p className="text-[13px] text-text leading-relaxed mb-3">
          The backend did not generate <code className="font-mono">data/config/auth.json</code>.
          This usually means bootstrap was skipped via <code className="font-mono">OPENALICE_DISABLE_AUTH=1</code>,
          or the file was created empty.
        </p>
        <p className="text-[12px] text-text-muted leading-relaxed">
          Stop the backend, delete <code className="font-mono">data/config/auth.json</code> if it exists,
          unset <code className="font-mono">OPENALICE_DISABLE_AUTH</code>, and restart. The first-run
          token will be printed to stdout.
        </p>
      </div>
    </div>
  )
}
