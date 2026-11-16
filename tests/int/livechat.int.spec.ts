// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'

import { ownerOfTable } from '@/features/featureTables'
import {
  availability,
  buildTranscript,
  cleanCanned,
  cleanEmail,
  cleanMessage,
  cleanSettings,
  DEFAULT_LIVECHAT_SETTINGS,
  fillCanned,
  inSchedule,
  isIdle,
  retentionCutoff,
  STAFF_ONLINE_SECONDS,
  staffCutoff,
} from '@/features/livechat/core'
import * as store from '@/features/livechat/store'
import { LIVECHAT_STATEMENTS } from '@/migrations/20270316_425000_livechat'

describe('live chat rules', () => {
  it('cleans settings and keeps safe defaults', () => {
    expect(cleanSettings(null)).toEqual(DEFAULT_LIVECHAT_SETTINGS)
    const s = cleanSettings({ useSchedule: true, schedule: { days: [1, 1, 9, -1, 6], from: '25:00', to: '18:30', timezone: 'Nowhere/Land' }, notifyEmail: 'nope', autoCloseHours: 99999, ratePerHour: 0 })
    expect(s.schedule).toEqual({ days: [1, 6], from: '09:00', to: '18:30', timezone: 'UTC' })
    expect(s.notifyEmail).toBe('')
    expect(s.autoCloseHours).toBe(24)
    expect(s.ratePerHour).toBe(15)
    expect(cleanSettings({ notifyPush: false }).notifyPush).toBe(false)
  })
  it('knows opening hours in a time zone, including overnight', () => {
    const office = { days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', timezone: 'America/New_York' }
    expect(inSchedule(new Date('2027-03-16T15:00:00Z'), office)).toBe(true) // Tue 11:00 in New York
    expect(inSchedule(new Date('2027-03-16T23:00:00Z'), office)).toBe(false) // Tue 19:00
    expect(inSchedule(new Date('2027-03-14T15:00:00Z'), office)).toBe(false) // Sunday
    const night = { days: [5], from: '22:00', to: '02:00', timezone: 'UTC' }
    expect(inSchedule(new Date('2027-03-19T23:00:00Z'), night)).toBe(true)
    expect(inSchedule(new Date('2027-03-19T12:00:00Z'), night)).toBe(false)
  })
  it('is online only with staff present and inside hours when hours are on', () => {
    const now = new Date('2027-03-16T15:00:00Z')
    expect(availability(now, DEFAULT_LIVECHAT_SETTINGS, 1)).toEqual({ online: true, reason: 'online' })
    expect(availability(now, DEFAULT_LIVECHAT_SETTINGS, 0).reason).toBe('no-staff')
    const hours = cleanSettings({ useSchedule: true, schedule: { days: [0], from: '09:00', to: '10:00', timezone: 'UTC' } })
    expect(availability(now, hours, 3)).toEqual({ online: false, reason: 'outside-hours' })
    expect(Date.parse(staffCutoff(now))).toBe(now.getTime() - STAFF_ONLINE_SECONDS * 1000)
  })
  it('cleans messages, emails and canned replies', () => {
    expect(cleanMessage('  hi   there \r\n ok ')).toBe('hi there \n ok')
    expect(cleanMessage('x'.repeat(2000))).toHaveLength(1000)
    expect(cleanEmail(' A@B.CO ')).toBe('a@b.co')
    expect(cleanEmail('nope')).toBe('')
    expect(cleanCanned({ title: ' Hello ', body: 'Hi {name}' })).toEqual({ title: 'Hello', body: 'Hi {name}' })
    expect(cleanCanned({ title: '', body: 'x' })).toBeNull()
    expect(fillCanned('Hi {name}, thanks', 'Sam Smith')).toBe('Hi Sam, thanks')
    expect(fillCanned('Hi {name}', '')).toBe('Hi there')
  })
  it('never puts notes or system lines in a transcript', () => {
    const t = buildTranscript('Acme', [
      { sender: 'visitor', name: 'Sam', content: 'Hello', at: '2027-03-16T10:00:00Z' },
      { sender: 'staff', name: 'Ada', content: 'Secret', at: '2027-03-16T10:01:00Z', note: true },
      { sender: 'system', name: '', content: 'Earlier chat', at: '2027-03-16T10:01:00Z' },
      { sender: 'staff', name: 'Ada', content: 'Hi Sam', at: '2027-03-16T10:02:00Z' },
    ])
    expect(t).toContain('Chat transcript from Acme')
    expect(t).toContain('Sam: Hello')
    expect(t).toContain('Ada: Hi Sam')
    expect(t).not.toContain('Secret')
    expect(t).not.toContain('Earlier chat')
  })
  it('works out idle chats and retention', () => {
    const now = new Date('2027-03-16T12:00:00Z')
    expect(isIdle('2027-03-15T10:00:00Z', 24, now)).toBe(true)
    expect(isIdle('2027-03-16T11:00:00Z', 24, now)).toBe(false)
    expect(isIdle('2020-01-01T00:00:00Z', 0, now)).toBe(false)
    expect(retentionCutoff(now, 0)).toBeNull()
    expect(retentionCutoff(now, 1)).toBe('2027-03-15T12:00:00.000Z')
  })
  it('is a lazy section that owns its tables', () => {
    for (const t of ['eg_livechat_settings', 'eg_livechat_chats', 'eg_livechat_messages', 'eg_livechat_canned', 'eg_livechat_staff']) expect(ownerOfTable(t)).toBe('livechat')
  })
})

function setup() {
  const raw = new DatabaseSync(':memory:')
  for (const statement of LIVECHAT_STATEMENTS) raw.exec(statement)
  raw.exec('CREATE TABLE eg_chatbot_conversations (id integer primary key, token text); CREATE TABLE eg_chatbot_messages (id integer primary key autoincrement, conversation_id integer, role text, content text);')
  const d1: store.D1 = {
    prepare: (query) => ({
      bind: (...args) => ({
        all: async <T,>() => ({ results: raw.prepare(query).all(...(args as never[])) as T[] }),
        run: async () => {
          const r = raw.prepare(query).run(...(args as never[]))
          return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }
        },
      }),
    }),
  }
  return { raw, d1 }
}

const T0 = '2027-03-16T10:00:00.000Z'

describe('live chat store', () => {
  let ctx: ReturnType<typeof setup>
  beforeEach(() => {
    ctx = setup()
  })

  it('counts staff as online only after a recent check-in', async () => {
    await store.heartbeat(ctx.d1, 1, 'Ada', '2027-03-16T10:00:00.000Z')
    await store.heartbeat(ctx.d1, 2, 'Ed', '2027-03-16T09:00:00.000Z')
    expect(await store.staffOnline(ctx.d1, '2027-03-16T09:59:00.000Z')).toBe(1)
    await store.heartbeat(ctx.d1, 1, 'Ada B', '2027-03-16T10:05:00.000Z')
    expect((ctx.raw.prepare('SELECT name FROM eg_livechat_staff WHERE user_id = 1').get() as { name: string }).name).toBe('Ada B')
  })

  it('keeps visitor messages, hides notes from the visitor, and tracks unread', async () => {
    const id = await store.createChat(ctx.d1, { token: 'tok-aaaaaaaaaaaaaaaa', userId: null, name: 'Sam', email: 'sam@x.test', status: 'open' }, T0)
    await store.addMessage(ctx.d1, { chatId: id, sender: 'visitor', name: 'Sam', content: 'Hello' }, T0)
    await store.addMessage(ctx.d1, { chatId: id, sender: 'staff', staffId: 1, name: 'Ada', content: 'internal', note: true }, T0)
    await store.addMessage(ctx.d1, { chatId: id, sender: 'staff', staffId: 1, name: 'Ada', content: 'Hi Sam' }, '2027-03-16T10:01:00.000Z')
    expect((await store.messagesAfter(ctx.d1, id, 0, false)).map((m) => m.content)).toEqual(['Hello', 'Hi Sam'])
    expect((await store.messagesAfter(ctx.d1, id, 0, true)).map((m) => m.content)).toEqual(['Hello', 'internal', 'Hi Sam'])
    expect((await store.messagesAfter(ctx.d1, id, 1, false)).map((m) => m.content)).toEqual(['Hi Sam'])
    let inbox = await store.listInbox(ctx.d1, 'active', 1)
    expect(inbox[0]).toMatchObject({ unread: 1, preview: 'Hi Sam', lastSender: 'staff' })
    expect(await store.inboxCounts(ctx.d1)).toEqual({ active: 1, unread: 1, offline: 0 })
    await store.markSeen(ctx.d1, id)
    inbox = await store.listInbox(ctx.d1, 'active', 1)
    expect(inbox[0]!.unread).toBe(0)
    expect((await store.chatByToken(ctx.d1, 'tok-aaaaaaaaaaaaaaaa'))?.id).toBe(id)
    expect(await store.chatByToken(ctx.d1, 'nope')).toBeNull()
  })

  it('filters the inbox by owner and state', async () => {
    const a = await store.createChat(ctx.d1, { token: 'a'.repeat(16), userId: null, name: 'A', email: '', status: 'open' }, T0)
    const b = await store.createChat(ctx.d1, { token: 'b'.repeat(16), userId: null, name: 'B', email: 'b@x.test', status: 'offline' }, T0)
    const c = await store.createChat(ctx.d1, { token: 'c'.repeat(16), userId: null, name: 'C', email: '', status: 'open' }, T0)
    await store.assign(ctx.d1, a, 7, T0)
    await store.setStatus(ctx.d1, c, 'closed', T0)
    const ids = async (f: 'active' | 'mine' | 'unassigned' | 'offline' | 'closed', me = 7) => (await store.listInbox(ctx.d1, f, me)).map((r) => r.id).sort()
    expect(await ids('active')).toEqual([a, b].sort())
    expect(await ids('mine')).toEqual([a])
    expect(await ids('mine', 8)).toEqual([])
    expect(await ids('unassigned')).toEqual([b])
    expect(await ids('offline')).toEqual([b])
    expect(await ids('closed')).toEqual([c])
  })

  it('closes idle open chats but leaves offline messages, then purges old closed chats', async () => {
    const open = await store.createChat(ctx.d1, { token: 'o'.repeat(16), userId: null, name: '', email: '', status: 'open' }, '2027-03-10T00:00:00.000Z')
    const off = await store.createChat(ctx.d1, { token: 'f'.repeat(16), userId: null, name: '', email: 'x@x.test', status: 'offline' }, '2027-03-10T00:00:00.000Z')
    await store.addMessage(ctx.d1, { chatId: open, sender: 'visitor', name: '', content: 'x' }, '2027-03-10T00:00:00.000Z')
    expect(await store.closeIdle(ctx.d1, '2027-03-15T00:00:00.000Z', T0)).toBe(1)
    expect((await store.getChat(ctx.d1, open))?.status).toBe('closed')
    expect((await store.getChat(ctx.d1, off))?.status).toBe('offline')
    expect(await store.purgeClosedBefore(ctx.d1, '2027-03-16T00:00:00.000Z')).toBe(0) // closed just now at T0 (after the cut-off)
    expect(await store.purgeClosedBefore(ctx.d1, '2027-03-17T00:00:00.000Z')).toBe(1)
    expect(await store.getChat(ctx.d1, open)).toBeNull()
    expect(ctx.raw.prepare('SELECT COUNT(*) AS n FROM eg_livechat_messages').get()).toEqual({ n: 0 })
    expect(await store.getChat(ctx.d1, off)).not.toBeNull()
  })

  it('erases by account or by email', async () => {
    await store.createChat(ctx.d1, { token: '1'.repeat(16), userId: 5, name: '', email: '', status: 'open' }, T0)
    await store.createChat(ctx.d1, { token: '2'.repeat(16), userId: null, name: '', email: 'Me@X.test', status: 'offline' }, T0)
    const other = await store.createChat(ctx.d1, { token: '3'.repeat(16), userId: 6, name: '', email: 'other@x.test', status: 'open' }, T0)
    expect(await store.eraseFor(ctx.d1, 5, 'me@x.test')).toBe(2)
    expect((await store.listInbox(ctx.d1, 'active', 1)).map((r) => r.id)).toEqual([other])
  })

  it('stores canned replies and settings', async () => {
    await store.saveCanned(ctx.d1, null, { title: 'Hello', body: 'Hi {name}' }, T0)
    const [row] = await store.listCanned(ctx.d1)
    await store.saveCanned(ctx.d1, row!.id, { title: 'Hello 2', body: 'Hey' }, T0)
    expect((await store.listCanned(ctx.d1))[0]).toMatchObject({ title: 'Hello 2', body: 'Hey' })
    expect(await store.countCanned(ctx.d1)).toBe(1)
    await store.deleteCanned(ctx.d1, row!.id)
    expect(await store.countCanned(ctx.d1)).toBe(0)
    await store.saveSettings(ctx.d1, cleanSettings({ welcome: 'Hi', notifyEmail: 'a@b.co' }), T0)
    expect(await store.getSettings(ctx.d1)).toMatchObject({ welcome: 'Hi', notifyEmail: 'a@b.co' })
  })

  it('reads the chatbot transcript from the database by its token, never from the visitor', async () => {
    ctx.raw.exec("INSERT INTO eg_chatbot_conversations VALUES (1,'bot-token-aaaaaaaa'); INSERT INTO eg_chatbot_messages (conversation_id, role, content) VALUES (1,'user','Where is my parcel?'),(1,'assistant','I am not sure.');")
    expect(await store.botContext(ctx.d1, 'bot-token-aaaaaaaa')).toBe('Visitor: Where is my parcel?\nBot: I am not sure.')
    expect(await store.botContext(ctx.d1, 'unknown')).toBe('')
  })
})
