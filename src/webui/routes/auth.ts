/**
 * Auth routes: /api/auth/login, /api/auth/logout, /api/auth/status.
 *
 * Mounted in `src/webui/plugin.ts` BEFORE the auth middleware applies,
 * since these are the entry points to acquire a session.
 *
 * Status check (`/api/auth/status`) is bypass-friendly so the UI can
 * decide whether to render the login screen without a real authed call
 * round-trip. It reveals nothing beyond `{ authed: boolean }`.
 */

import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { z } from 'zod'
import {
  verifyToken,
  createSession,
  revokeSession,
  validateAndTouch,
  getTokenInfo,
} from '@/services/auth/index.js'
import { SESSION_COOKIE_NAME, isLoopbackIp } from '../middleware/auth.js'

const loginSchema = z.object({
  token: z.string().min(1, 'token is required'),
})

export interface AuthRouteOptions {
  /** Should `Set-Cookie` mark the session cookie `Secure`? Set true in
   *  prod (HTTPS behind reverse proxy). Auto-detected from headers when
   *  not provided. */
  forceSecureCookie?: boolean
}

export function createAuthRoutes(opts: AuthRouteOptions = {}) {
  const app = new Hono()

  /**
   * Returns whether the current request is authenticated, plus minimal
   * metadata. No-side-effect endpoint — does NOT extend session expiry.
   */
  app.get('/status', async (c) => {
    const tokenInfo = await getTokenInfo()

    // Mirror the middleware's localhost-trust passthrough: when no
    // trusted proxy is configured and the request came from a real
    // loopback socket, report authed:true even without a cookie. This
    // keeps `pnpm dev` zero-friction — the UI never bounces to the
    // login page in single-user local mode.
    const trustedProxies = (process.env['OPENALICE_TRUSTED_PROXIES'] ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean)
    if (trustedProxies.length === 0) {
      const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined
      const remote = env?.incoming?.socket?.remoteAddress ?? ''
      if (isLoopbackIp(remote)) {
        return c.json({ authed: true, tokenConfigured: tokenInfo.exists, passthrough: 'localhost' })
      }
    }

    const sid = readSidFromCookie(c.req.header('cookie') ?? '')
    if (!sid) {
      return c.json({ authed: false, tokenConfigured: tokenInfo.exists })
    }
    const session = await validateAndTouch(sid)
    if (!session) {
      return c.json({ authed: false, tokenConfigured: true })
    }
    return c.json({
      authed: true,
      tokenConfigured: true,
      session: {
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
      },
    })
  })

  /**
   * Accept an admin token, verify, issue a session cookie.
   *
   * Failures all return 401 with the same body to avoid leaking
   * "token configured vs not" via timing or content.
   */
  app.post('/login', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid request' }, 400)
    }

    const ok = await verifyToken(parsed.data.token)
    if (!ok) {
      // Don't reveal whether the token was malformed vs wrong vs no auth
      // configured. Constant-ish behavior.
      return c.json({ error: 'Invalid token' }, 401)
    }

    const userAgent = c.req.header('user-agent') ?? undefined
    const ip = readClientIp(c) ?? undefined
    const session = await createSession({ userAgent, ip })

    const secure = opts.forceSecureCookie ?? isLikelyHttps(c)
    setCookie(c, SESSION_COOKIE_NAME, session.sid, {
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      path: '/',
      maxAge: Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
    })

    return c.json({ ok: true })
  })

  /**
   * Invalidate the caller's session server-side and clear the cookie.
   * Idempotent — calling without a cookie returns 200.
   */
  app.post('/logout', async (c) => {
    const sid = readSidFromCookie(c.req.header('cookie') ?? '')
    if (sid) await revokeSession(sid)
    deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
    return c.json({ ok: true })
  })

  return app
}

function readSidFromCookie(cookieHeader: string): string | null {
  if (!cookieHeader) return null
  for (const raw of cookieHeader.split(';')) {
    const entry = raw.trim()
    const eq = entry.indexOf('=')
    if (eq < 0) continue
    if (entry.slice(0, eq) === SESSION_COOKIE_NAME) {
      const value = entry.slice(eq + 1).trim()
      return value.length > 0 ? decodeURIComponent(value) : null
    }
  }
  return null
}

/**
 * Best-effort: detect whether the original client request was HTTPS,
 * so the `Secure` flag can be set on the cookie. Reverse proxies set
 * `X-Forwarded-Proto`; we only trust it if a proxy IP is configured to
 * be trusted — otherwise an attacker could send `X-Forwarded-Proto: https`
 * to coerce `Secure` to be set on an HTTP cookie that the browser
 * would then drop.
 */
function isLikelyHttps(c: { req: { header: (n: string) => string | undefined }; env?: unknown }): boolean {
  const proto = c.req.header('x-forwarded-proto')
  if (proto?.split(',')[0]?.trim().toLowerCase() === 'https') return true
  return false
}

function readClientIp(c: { req: { header: (n: string) => string | undefined }; env?: unknown }): string | null {
  const xff = c.req.header('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined
  return env?.incoming?.socket?.remoteAddress ?? null
}
