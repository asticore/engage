// @vitest-environment node
// The activity log: filters, per-person view, CSV, and the clear (which keeps consent, privacy and clear records
// and writes its own record). Runs the real SQL against node:sqlite through a D1-shaped adapter.
import { DatabaseSync } from 'node:sqlite'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const d1State = vi.hoisted(() => ({ adapter: null as unknown }))
vi.mock('@/cms/db/connect', () => ({ resolveD1Binding: async (): Promise<unknown> => d1State.adapter }))

import {
  CLEAR_CONFIRM_WORD,
  activityPageHref,
  activityRowsToCsv,
  buildActivitySelect,
  parseActivityFilter,
  parseClearScope,
} from '@/features/security/activityQuery'
import { clearActivity, countClearable, exportActivityRows, listActivityPage } from '@/features/security/activityStore'
import { changeActionForTest } from '@/features/security/hooks'

function sqliteD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql)
      const statement = (values: unknown[]) => ({
        bind: (...more: unknown[]) => statement([...values, ...more]),
        run: async () => {
          stmt.run(...(values as never[]))
          return {}
        },
        all: async () => ({ results: stmt.all(...(values as never[])) }),
        first: async () => stmt.get(...(values as never[])) ?? null,
      })
      return statement([])
    },
  }
}

let db: DatabaseSync

type Extra = Partial<Record<'actor_id' | 'actor_email' | 'collection_slug' | 'document_id' | 'detail', string | number | null>>
function seed(action: string, at: string, extra: Extra = {}): void {
  db.prepare('INSERT INTO eg_audit_log (action, actor_id, actor_email, collection_slug, document_id, ip, user_agent, detail, updated_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)').run(
    action, extra.actor_id ?? null, extra.actor_email ?? null, extra.collection_slug ?? null, extra.document_id ?? null, extra.detail ?? null, at, at,
  )
}

const noFilter = parseActivityFilter({})
const actions = (): string[] => (db.prepare('SELECT action FROM eg_audit_log ORDER BY id').all() as Array<{ action: string }>).map((r) => r.action)

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE eg_audit_log (id integer PRIMARY KEY NOT NULL, action text NOT NULL, actor_id numeric, actor_email text, collection_slug text, document_id text, ip text, user_agent text, detail text, updated_at text NOT NULL, created_at text NOT NULL)`)
  d1State.adapter = sqliteD1(db)
  seed('update', '2026-01-01T10:00:00.000Z', { actor_id: 1, actor_email: 'ann@x.test', collection_slug: 'pages', document_id: '5', detail: 'title: Home' })
  seed('publish', '2026-01-02T10:00:00.000Z', { actor_id: 1, actor_email: 'ann@x.test', collection_slug: 'pages', document_id: '5' })
  seed('delete', '2026-01-03T10:00:00.000Z', { actor_id: 2, actor_email: 'bob@x.test', collection_slug: 'posts', document_id: '9' })
  seed('login.success', '2026-01-04T10:00:00.000Z', { actor_id: 2, actor_email: 'bob@x.test' })
  seed('consent.update', '2026-01-05T10:00:00.000Z', { detail: '{"analytics":true}' })
  seed('privacy.erase', '2026-01-06T10:00:00.000Z', { actor_id: 2, actor_email: 'bob@x.test' })
  seed('probe.blocked', '2026-01-07T10:00:00.000Z')
})

describe('activity filters', () => {
  it('lists edits and sign-ins newest first and hides consent and probe noise', async () => {
    const { rows } = await listActivityPage(noFilter)
    expect(rows.map((r) => r.action)).toEqual(['privacy.erase', 'login.success', 'delete', 'publish', 'update'])
  })

  it('filters by person (email part or id), collection, event and date', async () => {
    expect((await listActivityPage(parseActivityFilter({ person: 'ann' }))).rows).toHaveLength(2)
    expect((await listActivityPage(parseActivityFilter({ person: '2' }))).rows.map((r) => r.action)).toEqual(['privacy.erase', 'login.success', 'delete'])
    expect((await listActivityPage(parseActivityFilter({ collection: 'posts' }))).rows).toHaveLength(1)
    expect((await listActivityPage(parseActivityFilter({ action: 'publish' }))).rows).toHaveLength(1)
    expect((await listActivityPage(parseActivityFilter({ from: '2026-01-02', to: '2026-01-03' }))).rows.map((r) => r.action)).toEqual(['delete', 'publish'])
  })

  it('treats typed wildcards literally and drops bad input', () => {
    const { binds } = buildActivitySelect(parseActivityFilter({ person: '100%_x' }))
    expect(binds).toContain('%100\\%\\_x%')
    expect(parseActivityFilter({ action: "x'; DROP", from: 'nope', page: '-3' })).toMatchObject({ action: null, from: null, page: 1 })
  })

  it('keeps the filters in page links', () => {
    expect(activityPageHref(parseActivityFilter({ person: 'ann@x.test', from: '2026-01-01' }), 2)).toBe('?person=ann%40x.test&from=2026-01-01&page=2')
  })
})

describe('CSV export', () => {
  it('exports filtered rows and neutralises spreadsheet formulas', async () => {
    seed('update', '2026-01-08T10:00:00.000Z', { actor_email: 'eve@x.test', detail: '=HYPERLINK("http://evil")' })
    const csv = activityRowsToCsv(await exportActivityRows(parseActivityFilter({ person: 'eve' })))
    expect(csv.split('\n')[0]).toBe('id,when_utc,event,actor_id,actor_email,collection,item,detail,ip,browser')
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`)
  })
})

describe('clear', () => {
  it('parses scopes strictly', () => {
    expect(parseClearScope({ mode: 'older', days: 30 })).toEqual({ mode: 'older', days: 30 })
    expect(parseClearScope({ mode: 'older', days: 0 })).toBeNull()
    expect(parseClearScope({ mode: 'person', person: ' ' })).toBeNull()
    expect(parseClearScope({ mode: 'wipe' })).toBeNull()
  })

  it('clear all keeps consent, privacy and clear records and writes its own record', async () => {
    expect(await countClearable({ mode: 'all' })).toBe(5)
    const removed = await clearActivity({ mode: 'all' }, { id: 7, email: 'root@x.test', ip: '1.2.3.4', userAgent: 'ua' })
    expect(removed).toBe(5)
    expect(actions()).toEqual(['consent.update', 'privacy.erase', 'activity.cleared'])
    const record = db.prepare("SELECT actor_email, detail FROM eg_audit_log WHERE action = 'activity.cleared'").get() as { actor_email: string; detail: string }
    expect(record).toMatchObject({ actor_email: 'root@x.test', detail: 'cleared 5 entries (all entries)' })
    // A second clear keeps the first record.
    await clearActivity({ mode: 'all' }, { id: 7, email: 'root@x.test', ip: null, userAgent: null })
    expect(actions().filter((a) => a === 'activity.cleared')).toHaveLength(2)
  })

  it('clears one person only, by email or by id', async () => {
    await clearActivity({ mode: 'person', person: 'ANN@x.test' }, { id: 7, email: 'root@x.test', ip: null, userAgent: null })
    expect(actions()).toEqual(['delete', 'login.success', 'consent.update', 'privacy.erase', 'probe.blocked', 'activity.cleared'])
    await clearActivity({ mode: 'person', person: '2' }, { id: 7, email: 'root@x.test', ip: null, userAgent: null })
    expect(actions()).toEqual(['consent.update', 'privacy.erase', 'probe.blocked', 'activity.cleared', 'activity.cleared'])
  })

  it('clears by age', async () => {
    db.exec('DELETE FROM eg_audit_log')
    seed('update', new Date(Date.now() - 100 * 86_400_000).toISOString(), { actor_email: 'old@x.test' })
    seed('create', new Date(Date.now() - 86_400_000).toISOString(), { actor_email: 'new@x.test' })
    await clearActivity({ mode: 'older', days: 90 }, { id: 7, email: null, ip: null, userAgent: null })
    expect(actions()).toEqual(['create', 'activity.cleared'])
  })

  it('needs the typed word', () => {
    expect(CLEAR_CONFIRM_WORD).toBe('CLEAR')
  })
})

describe('publish and unpublish', () => {
  it('names a status change as publish or unpublish', () => {
    expect(changeActionForTest('create', { _status: 'published' }, {})).toBe('create')
    expect(changeActionForTest('update', { _status: 'published' }, { _status: 'draft' })).toBe('publish')
    expect(changeActionForTest('update', { _status: 'draft' }, { _status: 'published' })).toBe('unpublish')
    expect(changeActionForTest('update', { _status: 'published' }, { _status: 'published' })).toBe('update')
  })
})
