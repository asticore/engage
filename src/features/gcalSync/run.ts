import { CalendarApiError, type CalendarApi } from './api'
import { decideChange, fromGoogle, lookbackIso, pickCalendar, ruleCalendars, toGoogle, type GoogleEvent, type SiteEvent } from './map'
import { addLog, allLinks, dropLink, readConfig, saveLink, writeConfig, type GcalD1, type Link } from './store'

/**
 * One sync pass (Task 15, 34j): pull what changed in Google, then push what changed here. Last edit wins when both
 * changed since the last sync, and the clash is written to the log. Deletes go both ways. Google repeating events
 * arrive already split into single occurrences.
 */

export type SyncEngine = {
  find(args: Record<string, unknown>): Promise<{ docs: unknown[] }>
  create(args: Record<string, unknown>): Promise<unknown>
  update(args: Record<string, unknown>): Promise<unknown>
  delete(args: Record<string, unknown>): Promise<unknown>
}

export type SyncResult = { pulledNew: number; pulledChanged: number; pulledDeleted: number; pushedNew: number; pushedChanged: number; pushedDeleted: number; conflicts: number; errors: number }

const empty = (): SyncResult => ({ pulledNew: 0, pulledChanged: 0, pulledDeleted: 0, pushedNew: 0, pushedChanged: 0, pushedDeleted: 0, conflicts: 0, errors: 0 })

type EventDoc = SiteEvent & { _status?: string; location?: { venueName?: string; address?: string } }
const toSite = (d: EventDoc): SiteEvent => ({ ...d, venueName: d.location?.venueName, address: d.location?.address })

export async function runSync(deps: { engine: SyncEngine; db: GcalD1; api: CalendarApi; now?: Date; force?: boolean }): Promise<SyncResult> {
  const { engine, db, api } = deps
  const now = deps.now ?? new Date()
  const nowIso = (): string => new Date().toISOString()
  const cfg = await readConfig(db)
  const result = empty()
  if (!cfg.enabled && !deps.force) return result
  const calendars = Array.from(new Set([cfg.calendarId, ...ruleCalendars(cfg.rules)]))
  const tokens = { ...cfg.tokens }
  const fail = async (message: string): Promise<void> => {
    result.errors++
    await addLog(db, 'error', message, nowIso())
  }

  let links = await allLinks(db)
  const byGoogle = (cal: string, id: string): Link | undefined => links.find((l) => l.calendarId === cal && l.googleId === id)
  const eventDocs = async (): Promise<EventDoc[]> =>
    (await engine.find({ collection: 'events', limit: 1000, depth: 0, pagination: false, overrideAccess: true, where: { _status: { equals: 'published' } } })).docs as EventDoc[]

  // 1. Pull.
  for (const cal of calendars) {
    try {
      let syncToken = tokens[cal]
      let pageToken: string | undefined
      let next: string | undefined
      for (let guard = 0; guard < 20; guard++) {
        let page
        try {
          page = await api.list(cal, { syncToken, timeMin: syncToken ? undefined : lookbackIso(now), pageToken })
        } catch (error) {
          if (error instanceof CalendarApiError && error.status === 410 && syncToken) {
            syncToken = undefined
            pageToken = undefined
            delete tokens[cal]
            continue
          }
          throw error
        }
        for (const g of page.items ?? []) {
          if (!g.id) continue
          const link = byGoogle(cal, g.id)
          try {
            if (g.status === 'cancelled') {
              if (link) {
                await engine.delete({ collection: 'events', id: link.eventId, overrideAccess: true }).catch((): null => null)
                await dropLink(db, link.eventId)
                result.pulledDeleted++
                await addLog(db, 'info', `Deleted event ${link.eventId} because it was deleted in Google.`, nowIso())
              }
              continue
            }
            const fields = fromGoogle(g)
            if (!fields) continue
            const data = { title: fields.title, summary: fields.summary, startDate: fields.startDate, endDate: fields.endDate ?? undefined, location: { venueName: fields.venueName, address: fields.address } }
            if (!link) {
              if (g.extendedProperties?.private?.engageId) continue // our own event whose link was lost: do not duplicate it
              const created = (await engine.create({ collection: 'events', data: { ...data, eventType: 'free', _status: 'published' }, overrideAccess: true })) as { id: number | string }
              await saveLink(db, { eventId: String(created.id), calendarId: cal, googleId: g.id, syncedAt: nowIso() })
              result.pulledNew++
              continue
            }
            const doc = (await engine.find({ collection: 'events', where: { id: { equals: link.eventId } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as EventDoc | undefined
            if (!doc) {
              await dropLink(db, link.eventId)
              continue
            }
            const verdict = decideChange(link.syncedAt, doc.updatedAt, g.updated)
            if (verdict.conflict) {
              result.conflicts++
              await addLog(db, 'conflict', `"${doc.title}" changed in both places; the ${verdict.change === 'pull' ? 'Google' : 'site'} edit was newer and won.`, nowIso())
            }
            if (verdict.change === 'pull') {
              await engine.update({ collection: 'events', id: link.eventId, data, overrideAccess: true })
              await saveLink(db, { ...link, syncedAt: nowIso() })
              result.pulledChanged++
            }
          } catch (error) {
            await fail(`Could not import "${g.summary ?? g.id}": ${error instanceof Error ? error.message : 'unknown error'}`)
          }
        }
        links = await allLinks(db)
        pageToken = page.nextPageToken
        if (page.nextSyncToken) next = page.nextSyncToken
        if (!pageToken) break
      }
      if (next) tokens[cal] = next
    } catch (error) {
      await fail(`Reading ${cal}: ${error instanceof Error ? error.message : 'failed'}`)
    }
  }

  // 2. Push.
  try {
    links = await allLinks(db)
    const docs = await eventDocs()
    const live = new Set(docs.map((d) => String(d.id)))
    for (const d of docs) {
      const site = toSite(d)
      const link = links.find((l) => l.eventId === String(d.id))
      try {
        if (!link) {
          const cal = pickCalendar(site, cfg.rules, cfg.calendarId)
          const made: GoogleEvent = await api.insert(cal, toGoogle(site))
          if (made.id) await saveLink(db, { eventId: String(d.id), calendarId: cal, googleId: made.id, syncedAt: nowIso() })
          result.pushedNew++
        } else if (decideChange(link.syncedAt, d.updatedAt, null).change === 'push') {
          const cal = pickCalendar(site, cfg.rules, cfg.calendarId)
          if (cal !== link.calendarId) {
            await api.remove(link.calendarId, link.googleId).catch((): null => null)
            const made = await api.insert(cal, toGoogle(site))
            if (made.id) await saveLink(db, { eventId: String(d.id), calendarId: cal, googleId: made.id, syncedAt: nowIso() })
          } else {
            await api.patch(link.calendarId, link.googleId, toGoogle(site))
            await saveLink(db, { ...link, syncedAt: nowIso() })
          }
          result.pushedChanged++
        }
      } catch (error) {
        await fail(`Could not send "${d.title}" to Google: ${error instanceof Error ? error.message : 'failed'}`)
      }
    }
    for (const link of links) {
      if (live.has(link.eventId)) continue
      try {
        await api.remove(link.calendarId, link.googleId)
        await dropLink(db, link.eventId)
        result.pushedDeleted++
      } catch (error) {
        if (error instanceof CalendarApiError && (error.status === 404 || error.status === 410)) await dropLink(db, link.eventId)
        else await fail(`Could not delete the Google copy of event ${link.eventId}: ${error instanceof Error ? error.message : 'failed'}`)
      }
    }
  } catch (error) {
    await fail(`Sending events: ${error instanceof Error ? error.message : 'failed'}`)
  }

  await writeConfig(db, { tokens, lastRunAt: nowIso() })
  const total = result.pulledNew + result.pulledChanged + result.pulledDeleted + result.pushedNew + result.pushedChanged + result.pushedDeleted
  if (total > 0) await addLog(db, 'info', `Synced: ${result.pulledNew + result.pulledChanged + result.pulledDeleted} from Google, ${result.pushedNew + result.pushedChanged + result.pushedDeleted} to Google.`, nowIso())
  return result
}

/** True when the interval has passed since the last run, so the five-minute job can run the sync on its own pace. */
export const syncDue = (lastRunAt: string | null, intervalMin: number, now: Date): boolean =>
  !lastRunAt || now.getTime() - new Date(lastRunAt).getTime() >= intervalMin * 60_000 - 30_000
