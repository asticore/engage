import { getGoogleAccessToken, type GoogleEngine } from '@/features/google/auth'
import { googleErrorMessage } from '@/features/google/fetchJson'
import { requestJson } from '@/features/google/http'

import type { GoogleEvent } from './map'

const BASE = 'https://www.googleapis.com/calendar/v3/calendars'

export class CalendarApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'CalendarApiError'
    this.status = status
  }
}

export type CalendarApi = {
  list(calendarId: string, opts: { syncToken?: string; timeMin?: string; pageToken?: string }): Promise<{ items: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>
  insert(calendarId: string, event: GoogleEvent): Promise<GoogleEvent>
  patch(calendarId: string, id: string, event: GoogleEvent): Promise<GoogleEvent>
  remove(calendarId: string, id: string): Promise<void>
}

/** The real Google Calendar calls, signed in with the saved Google connection. Messages never include a token. */
export function createCalendarApi(engine: GoogleEngine): CalendarApi {
  async function call(method: string, url: string, body?: unknown): Promise<unknown> {
    const auth = await getGoogleAccessToken(engine)
    if ('message' in auth) throw new CalendarApiError(401, auth.message)
    let res
    try {
      res = await requestJson(url, {
        method,
        headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    } catch {
      throw new CalendarApiError(502, 'Could not reach Google Calendar. Try again in a minute.')
    }
    if (!res.ok && !(method === 'DELETE' && res.status === 410)) {
      const msg = res.status === 403 ? 'Google refused the calendar request. Connect with Google again so the Calendar permission is granted, and check the Calendar API is on in Google Cloud.' : googleErrorMessage(res.status, res.body)
      throw new CalendarApiError(res.status, msg)
    }
    return res.body
  }
  const cal = (id: string): string => `${BASE}/${encodeURIComponent(id)}/events`
  return {
    async list(calendarId, opts) {
      const u = new URL(cal(calendarId))
      u.searchParams.set('singleEvents', 'true')
      u.searchParams.set('showDeleted', 'true')
      u.searchParams.set('maxResults', '250')
      if (opts.syncToken) u.searchParams.set('syncToken', opts.syncToken)
      else if (opts.timeMin) u.searchParams.set('timeMin', opts.timeMin)
      if (opts.pageToken) u.searchParams.set('pageToken', opts.pageToken)
      return (await call('GET', u.toString())) as { items: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }
    },
    insert: async (calendarId, event) => (await call('POST', cal(calendarId), event)) as GoogleEvent,
    patch: async (calendarId, id, event) => (await call('PATCH', `${cal(calendarId)}/${encodeURIComponent(id)}`, event)) as GoogleEvent,
    async remove(calendarId, id) {
      await call('DELETE', `${cal(calendarId)}/${encodeURIComponent(id)}`)
    },
  }
}
