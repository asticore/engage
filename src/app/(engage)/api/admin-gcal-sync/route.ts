import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { createCalendarApi } from '@/features/gcalSync/api'
import { clampInterval } from '@/features/gcalSync/map'
import { runSync } from '@/features/gcalSync/run'
import { gcalDb, readConfig, readLog, writeConfig } from '@/features/gcalSync/store'
import { getEngine } from '@/lib/engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Two-way Google Calendar sync settings (Task 15, 34j). Admin only.
 *   GET                              -> { config, log }
 *   POST { action: 'save', enabled, calendarId, rules, intervalMin }
 *   POST { action: 'test' }          reads the default calendar once to prove the connection and permission
 *   POST { action: 'run' }           runs one sync now
 */

const noStore = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: noStore })

export async function GET(): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.user || !context.isAdmin) return json({ error: 'unauthorised' }, 401)
    const db = await gcalDb()
    const { tokens: _tokens, ...config } = await readConfig(db)
    return json({ config, log: await readLog(db) })
  } catch (error) {
    console.error('admin-gcal-sync GET error:', error instanceof Error ? error.name : 'unknown')
    return json({ error: 'Internal server error' }, 500)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.user || !context.isAdmin) return json({ error: 'unauthorised' }, 401)
    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    const db = await gcalDb()
    const engine = await getEngine()
    if (body?.action === 'save') {
      await writeConfig(db, {
        enabled: body.enabled === true,
        calendarId: typeof body.calendarId === 'string' && body.calendarId.trim() ? body.calendarId.trim().slice(0, 300) : 'primary',
        rules: typeof body.rules === 'string' ? body.rules.slice(0, 4000) : '',
        intervalMin: clampInterval(body.intervalMin),
        tokens: {}, // a changed setup starts from a fresh read
      })
      return json({ ok: true })
    }
    if (body?.action === 'test') {
      const cfg = await readConfig(db)
      try {
        const page = await createCalendarApi(engine as never).list(cfg.calendarId, { timeMin: new Date().toISOString() })
        return json({ ok: true, message: `Connected. Found ${page.items?.length ?? 0} upcoming event(s) in ${cfg.calendarId}.` })
      } catch (error) {
        return json({ ok: false, message: error instanceof Error ? error.message : 'The test failed.' })
      }
    }
    if (body?.action === 'run') {
      const result = await runSync({ engine: engine as never, db, api: createCalendarApi(engine as never), force: true })
      return json({ ok: true, result })
    }
    return json({ error: 'unknown action' }, 400)
  } catch (error) {
    console.error('admin-gcal-sync POST error:', error instanceof Error ? error.name : 'unknown')
    return json({ error: 'Internal server error' }, 500)
  }
}
