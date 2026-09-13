// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getResponse } from 'msw'
import { handlers } from './index'
import { demoPowerReport, demoWorkspaceFilePaths, demoWorkspaceFiles } from '../fixtures/inbox'
import { demoWorkspaces } from '../fixtures/workspaces'
import { POWER_REPORT_PATH } from '../fixtures/power-research'

const baseUrl = 'http://demo.openalice.local'
const request = async (path: string) => {
  const response = await getResponse(handlers, new Request(baseUrl + path), { baseUrl })
  expect(response?.status).toBe(200)
  return response!.json()
}

describe('shared demo handlers without browser globals', () => {
  it('resolves the research Inbox origin to a real seeded web conversation and files', async () => {
    const { workspaceId, origin } = demoPowerReport
    expect(origin?.kind).toBe('interactive')
    if (origin?.kind !== 'interactive') throw new Error('wrong origin')
    const workspace = demoWorkspaces.find(ws => ws.id === workspaceId)!
    expect(workspace.sessions.some(session => session.id === origin.sessionId)).toBe(true)
    const conversation = await request(`/api/workspaces/${workspaceId}/sessions/${origin.sessionId}/web`)
    expect(JSON.stringify(conversation.snapshot.messages)).toContain(POWER_REPORT_PATH)
    const files = await request(`/api/inbox/${demoPowerReport.id}/files`)
    expect(files.files).toHaveLength(2)
    for (const file of files.files) {
      expect(demoWorkspaceFilePaths[workspaceId]).toContain(file.path)
      expect(demoWorkspaceFiles[file.path]).toBeTruthy()
    }
  })
  it('serves Office state in the Node child without localStorage', async () => {
    expect(typeof window).toBe('undefined')
    const response = await request('/api/office/day')
    expect(response.dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
