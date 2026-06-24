import { http, HttpResponse } from 'msw'
import { demoScheduleSnapshot } from '../fixtures/schedule'

export const scheduleHandlers = [
  http.get('/api/schedule', () => HttpResponse.json(demoScheduleSnapshot)),
]
