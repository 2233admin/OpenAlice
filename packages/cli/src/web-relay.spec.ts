import { createServer, request as httpRequest, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket, WebSocketServer } from 'ws'

import { WebRelay } from './web-relay.ts'

const openedRelays: WebRelay[] = []
const openedBackends: Server[] = []
afterEach(async () => {
  await Promise.all(openedRelays.splice(0).map((relay) => relay.close()))
  await Promise.all(openedBackends.splice(0).map((backend) => new Promise<void>((done) => backend.close(() => done()))))
})

async function backend(id: string, label: string, protectedIdentity = false): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json')
    if (req.url === '/api/alice-project') {
      if (protectedIdentity) res.statusCode = 401
      res.end(protectedIdentity ? '{}' : JSON.stringify({ project: { id } }))
    }
    else if (req.url === '/api/auth/status') res.end(JSON.stringify({ authed: true, tokenConfigured: false }))
    else if (req.url === '/api/who') res.end(JSON.stringify({ label, cookie: req.headers.cookie ?? null }))
    else if (req.url === '/surface-check') res.end(JSON.stringify({ host: req.headers.host }))
    else if (req.url === '/api/login-mock') { res.setHeader('set-cookie', 'alice_session=secret; HttpOnly; Path=/'); res.end('{}') }
    else res.end('{}')
  })
  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/api/echo')) { socket.destroy(); return }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.on('message', (message) => ws.send(message))
    })
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture port')
  return { server, port: address.port }
}

async function withHost(origin: string, path: string, host: string): Promise<{ status: number; body: unknown }> {
  const url = new URL(origin)
  return new Promise((done, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port: Number(url.port), path, headers: { host } }, (response) => {
      let text = ''
      response.on('data', (chunk) => { text += String(chunk) })
      response.on('end', () => done({ status: response.statusCode ?? 0, body: JSON.parse(text) }))
    })
    request.on('error', reject)
    request.end()
  })
}

describe('WebRelay', () => {
  it('switches one local target after identity verification and refuses cross-origin mutation', async () => {
    const a = await backend('a-id', 'A')
    const b = await backend('b-id', 'B')
    const ports = { a: a.port, b: b.port }
    const relay = new WebRelay({
      inspectLocal: async () => ({ machine: {
        key: 'local', displayName: 'This computer', projects: Object.entries(ports).map(([key, port]) => ({
          key, id: `${key}-id`, displayName: key, available: true,
          runtime: { webEndpoint: `http://127.0.0.1:${port}` },
        })),
      } }) as never,
    })
    const origin = await relay.listen()
    openedRelays.push(relay)
    openedBackends.push(a.server, b.server)
    const forbidden = await fetch(`${origin}/relay/v1/connect`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ machine: 'local', project: 'a' }) })
    expect(forbidden.status).toBe(403)
    await relay.connect('local', 'a')
    expect(await (await fetch(`${origin}/api/who`)).json()).toEqual({ label: 'A', cookie: null })
    await relay.connect('local', 'b')
    expect(relay.status.generation).toBe(2)
    expect(await (await fetch(`${origin}/api/who`)).json()).toEqual({ label: 'B', cookie: null })
    const attack = await fetch(`${origin}/relay/v1/connect`, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ machine: 'local', project: 'a' }) })
    expect(attack.status).toBe(403)
    expect(relay.status.target).toMatchObject({ machine: 'local', project: 'b' })
  })

  it('keeps the active target when the candidate Runtime identity differs', async () => {
    const a = await backend('a-id', 'A')
    const b = await backend('wrong-id', 'B')
    const relay = new WebRelay({
      inspectLocal: async () => ({ machine: {
        key: 'local', displayName: 'This computer', projects: [
          { key: 'a', id: 'a-id', displayName: 'A', available: true, runtime: { webEndpoint: `http://127.0.0.1:${a.port}` } },
          { key: 'b', id: 'b-id', displayName: 'B', available: true, runtime: { webEndpoint: `http://127.0.0.1:${b.port}` } },
        ],
      } }) as never,
    })
    const origin = await relay.listen()
    openedRelays.push(relay)
    openedBackends.push(a.server, b.server)
    await relay.connect('local', 'a')
    await expect(relay.connect('local', 'b')).rejects.toThrow('different AliceProject')
    expect(relay.status.target).toMatchObject({ machine: 'local', project: 'a' })
    expect(await (await fetch(`${origin}/api/who`)).json()).toEqual({ label: 'A', cookie: null })
  })

  it('forwards WebSocket frames and closes the old socket on switch', async () => {
    const a = await backend('a-id', 'A')
    const b = await backend('b-id', 'B')
    const relay = new WebRelay({ inspectLocal: async () => ({ machine: {
      key: 'local', displayName: 'This computer', projects: [
        { key: 'a', id: 'a-id', displayName: 'A', available: true, runtime: { webEndpoint: `http://127.0.0.1:${a.port}` } },
        { key: 'b', id: 'b-id', displayName: 'B', available: true, runtime: { webEndpoint: `http://127.0.0.1:${b.port}` } },
      ],
    } }) as never })
    const origin = await relay.listen()
    openedRelays.push(relay)
    openedBackends.push(a.server, b.server)
    await relay.connect('local', 'a')
    const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/api/echo`, { origin })
    await new Promise<void>((done, reject) => { ws.once('open', done); ws.once('error', reject) })
    const answer = new Promise<string>((done) => ws.once('message', (value) => done(String(value))))
    ws.send('hello')
    expect(await answer).toBe('hello')
    const closed = new Promise<void>((done) => ws.once('close', () => done()))
    await relay.connect('local', 'b')
    await closed
  })

  it('namespaces backend cookies so a session from one target is never sent to another', async () => {
    const a = await backend('a-id', 'A')
    const b = await backend('b-id', 'B')
    const relay = new WebRelay({ inspectLocal: async () => ({ machine: {
      key: 'local', displayName: 'This computer', projects: [
        { key: 'a', id: 'a-id', displayName: 'A', available: true, runtime: { webEndpoint: `http://127.0.0.1:${a.port}` } },
        { key: 'b', id: 'b-id', displayName: 'B', available: true, runtime: { webEndpoint: `http://127.0.0.1:${b.port}` } },
      ],
    } }) as never })
    const origin = await relay.listen()
    openedRelays.push(relay)
    openedBackends.push(a.server, b.server)
    await relay.connect('local', 'a')
    const cookie = (await fetch(`${origin}/api/login-mock`)).headers.get('set-cookie')?.split(';')[0]
    expect(cookie).toContain('alice_5_local_1_a_alice_session=secret')
    const aReply = await (await fetch(`${origin}/api/who`, { headers: { cookie: cookie! } })).json()
    expect(aReply.cookie).toBe('alice_session=secret')
    await relay.connect('local', 'b')
    const bReply = await (await fetch(`${origin}/api/who`, { headers: { cookie: cookie! } })).json()
    expect(bReply.cookie).toBeNull()
  })

  it('accepts a login-gated Runtime after SSH inventory reconfirms its owner', async () => {
    const a = await backend('a-id', 'A', true)
    let inspections = 0
    const relay = new WebRelay({ inspectLocal: async () => {
      inspections += 1
      return { machine: { key: 'local', displayName: 'This computer', projects: [{
        key: 'a', id: 'a-id', displayName: 'A', available: true,
        runtime: { webEndpoint: `http://127.0.0.1:${a.port}` },
      }] } } as never
    } })
    await relay.listen()
    openedRelays.push(relay)
    openedBackends.push(a.server)
    await relay.connect('local', 'a')
    expect(inspections).toBe(2)
    expect(relay.status.target).toMatchObject({ machine: 'local', project: 'a' })
  })

  it('forwards only opaque Surface hosts to the selected Runtime, not to relay controls', async () => {
    const a = await backend('a-id', 'A')
    const relay = new WebRelay({ inspectLocal: async () => ({ machine: { key: 'local', displayName: 'This computer', projects: [{
      key: 'a', id: 'a-id', displayName: 'A', available: true, runtime: { webEndpoint: `http://127.0.0.1:${a.port}` },
    }] } }) as never })
    const origin = await relay.listen()
    openedRelays.push(relay)
    openedBackends.push(a.server)
    await relay.connect('local', 'a')
    const surfaceHost = `oa-surface-${'a'.repeat(24)}.localhost:${new URL(origin).port}`
    expect(await withHost(origin, '/surface-check', surfaceHost)).toEqual({ status: 200, body: { host: surfaceHost } })
    expect(await withHost(origin, '/relay/v1/status', surfaceHost)).toEqual({ status: 200, body: {} })
    const bad = await withHost(origin, '/surface-check', `evil.localhost:${new URL(origin).port}`)
    expect(bad.status).toBe(403)
  })
})
