'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import type { LiveChatSettings } from '../core'
import type { CannedRow, InboxRow, Message } from '../store'

type Filter = 'active' | 'mine' | 'unassigned' | 'offline' | 'closed'
const FILTERS: Array<[Filter, string]> = [
  ['active', 'Open'],
  ['mine', 'Mine'],
  ['unassigned', 'Unassigned'],
  ['offline', 'Offline messages'],
  ['closed', 'Closed'],
]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
type Person = { id: number; email: string; name: string }
type Loaded = {
  inbox: InboxRow[]
  counts: { active: number; unread: number; offline: number }
  canned: CannedRow[]
  people: Person[]
  online: number
  me: { id: number; isAdmin: boolean }
  settings?: LiveChatSettings
  chat?: InboxRow
  messages?: Message[]
}

const POLL_MS = 5000

/** Staff inbox for live chat: list, thread, assign, notes, canned replies, transcript, and (admin) settings. English only. */
export const LiveChatPanel: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('active')
  const [data, setData] = useState<Loaded | null>(null)
  const [openId, setOpenId] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [note, setNote] = useState(false)
  const [message, setMessage] = useState('')
  const [settings, setSettings] = useState<LiveChatSettings | null>(null)
  const [cannedDraft, setCannedDraft] = useState({ id: 0, title: '', body: '' })
  const last = useRef(0)
  const openRef = useRef(0)
  openRef.current = openId

  const load = useCallback(
    async (reset = false) => {
      const chat = openRef.current
      const after = reset ? 0 : last.current
      const res = await fetch(`/api/admin-livechat?filter=${filter}${chat ? `&chat=${chat}&after=${after}` : ''}`)
      const out = (await res.json().catch((): null => null)) as (Loaded & { error?: string }) | null
      if (!res.ok || !out) return setMessage(out?.error ?? 'Could not load the inbox.')
      setData(out)
      setSettings((cur) => cur ?? out.settings ?? null)
      if (chat && out.messages) {
        const fresh = out.messages
        if (fresh.length > 0) last.current = fresh[fresh.length - 1]!.id
        setMessages((prev) => (reset ? fresh : [...prev, ...fresh.filter((m) => !prev.some((p) => p.id === m.id))]))
      }
    },
    [filter],
  )
  useEffect(() => {
    void load(true)
    const t = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(t)
  }, [load])
  useEffect(() => {
    if (!data) return
    const unread = data.counts.unread
    document.title = unread > 0 ? `(${unread}) Live chat` : 'Live chat'
  }, [data])

  const post = async (body: Record<string, unknown>, ok = ''): Promise<boolean> => {
    const res = await fetch('/api/admin-livechat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = (await res.json().catch((): null => null)) as { error?: string; removed?: number } | null
    if (!res.ok) {
      setMessage(out?.error ?? 'That did not work.')
      return false
    }
    setMessage(typeof out?.removed === 'number' ? `Removed ${out.removed} old chats.` : ok)
    await load()
    return true
  }
  const open = (id: number) => {
    last.current = 0
    setMessages([])
    setOpenId(id)
    openRef.current = id
    void load(true)
  }
  const set = (patch: Partial<LiveChatSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s))

  if (!data) return <p role="status">{message || 'Loading…'}</p>
  const chat = data.chat && data.chat.id === openId ? data.chat : null
  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}
      <p>
        {data.online > 0 ? `${data.online} staff online (people with this inbox open).` : 'No staff online.'} Visitors only see Talk to a person while someone has this screen open. {data.counts.unread} chats with new messages, {data.counts.offline} offline messages.
      </p>

      <div role="tablist" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(14rem, 22rem) 1fr', gap: '1rem', alignItems: 'start' }}>
        <ul aria-label="Chats" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.25rem' }}>
          {data.inbox.length === 0 && <li>No chats here.</li>}
          {data.inbox.map((c) => (
            <li key={c.id}>
              <button type="button" aria-current={c.id === openId} onClick={() => open(c.id)} style={{ width: '100%', textAlign: 'left', fontWeight: c.unread > 0 ? 700 : 400 }}>
                {c.name || c.email || `Visitor ${c.id}`}
                {c.status === 'offline' ? ' (offline message)' : ''}
                {c.unread > 0 ? ` · ${c.unread} new` : ''}
                <br />
                <small>
                  {c.preview} · {c.updatedAt.slice(5, 16).replace('T', ' ')}
                  {c.assignedTo ? ` · ${data.people.find((p) => p.id === c.assignedTo)?.name || 'assigned'}` : ' · unassigned'}
                </small>
              </button>
            </li>
          ))}
        </ul>

        <section aria-label="Conversation">
          {!chat ? (
            <p>Pick a chat to read and reply.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <h2 style={{ margin: 0 }}>
                {chat.name || 'Visitor'} {chat.email ? <small>({chat.email})</small> : null} {chat.userId ? <small>· signed-in customer {chat.userId}</small> : null}
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <label>
                  Assigned to{' '}
                  <select value={chat.assignedTo ?? ''} onChange={(e) => void post({ action: 'assign', chat: chat.id, to: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Nobody</option>
                    {data.people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.email}
                      </option>
                    ))}
                  </select>
                </label>
                {chat.status === 'closed' ? (
                  <button type="button" onClick={() => void post({ action: 'status', chat: chat.id, status: chat.email ? 'offline' : 'open' }, 'Reopened.')}>
                    Reopen
                  </button>
                ) : (
                  <button type="button" onClick={() => void post({ action: 'status', chat: chat.id, status: 'closed' }, 'Closed.')}>
                    Close chat
                  </button>
                )}
                {chat.email && (
                  <button type="button" onClick={() => void post({ action: 'transcript', chat: chat.id }, 'Transcript sent.')}>
                    Email transcript
                  </button>
                )}
                {data.me.isAdmin && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (await post({ action: 'delete', chat: chat.id }, 'Deleted.')) setOpenId(0)
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div role="log" aria-live="polite" style={{ border: '1px solid var(--color-line, #ddd)', padding: '0.75rem', maxHeight: '24rem', overflowY: 'auto', display: 'grid', gap: '0.5rem' }}>
                {messages.map((m) => (
                  <p key={m.id} style={{ margin: 0, whiteSpace: 'pre-line', background: m.note ? 'var(--color-line, #fff7d6)' : undefined, padding: m.note ? '0.25rem 0.5rem' : undefined }}>
                    <strong>{m.sender === 'visitor' ? chat.name || 'Visitor' : m.sender === 'system' ? 'System' : m.name || 'Staff'}</strong>
                    {m.note ? ' (internal note)' : ''} <small>{m.createdAt.slice(5, 16).replace('T', ' ')}</small>
                    <br />
                    {m.content}
                  </p>
                ))}
              </div>
              {chat.status === 'offline' && <p>This visitor is not on the page. Your reply is sent to {chat.email || 'no address'} by email.</p>}
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (await post({ action: note ? 'note' : 'reply', chat: chat.id, content: text }, note ? 'Note added.' : 'Sent.')) setText('')
                }}
                style={{ display: 'grid', gap: '0.5rem' }}
              >
                <label>
                  <span className="sr-only" style={{ position: 'absolute', left: '-9999px' }}>
                    Message
                  </span>
                  <textarea required rows={3} maxLength={1000} style={{ width: '100%' }} value={text} onChange={(e) => setText(e.target.value)} placeholder={note ? 'Internal note, the visitor never sees it' : 'Reply to the visitor'} />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="submit">{note ? 'Add note' : 'Send reply'}</button>
                  <label>
                    <input type="checkbox" checked={note} onChange={(e) => setNote(e.target.checked)} /> Internal note
                  </label>
                  {data.canned.length > 0 && (
                    <label>
                      Canned reply{' '}
                      <select value="" onChange={(e) => setText(data.canned.find((c) => c.id === Number(e.target.value))?.body ?? text)}>
                        <option value="">Choose…</option>
                        {data.canned.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </form>
            </div>
          )}
        </section>
      </div>

      {data.me.isAdmin && settings && (
        <>
          <section aria-labelledby="canned-title">
            <h2 id="canned-title">Canned replies</h2>
            <p>Use {'{name}'} to insert the visitor’s first name.</p>
            <ul>
              {data.canned.map((c) => (
                <li key={c.id}>
                  <strong>{c.title}</strong>: {c.body}{' '}
                  <button type="button" onClick={() => setCannedDraft({ id: c.id, title: c.title, body: c.body })}>
                    Edit
                  </button>{' '}
                  <button type="button" onClick={() => void post({ action: 'canned-delete', id: c.id }, 'Deleted.')}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (await post({ action: 'canned', ...cannedDraft }, 'Saved.')) setCannedDraft({ id: 0, title: '', body: '' })
              }}
              style={{ display: 'grid', gap: '0.5rem', maxWidth: '36rem' }}
            >
              <label>
                Title
                <br />
                <input required maxLength={60} value={cannedDraft.title} onChange={(e) => setCannedDraft({ ...cannedDraft, title: e.target.value })} />
              </label>
              <label>
                Reply
                <br />
                <textarea required rows={3} maxLength={1000} style={{ width: '100%' }} value={cannedDraft.body} onChange={(e) => setCannedDraft({ ...cannedDraft, body: e.target.value })} />
              </label>
              <button type="submit">{cannedDraft.id ? 'Save reply' : 'Add reply'}</button>
            </form>
          </section>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void post({ action: 'settings', settings }, 'Settings saved.')
            }}
            style={{ display: 'grid', gap: '0.75rem', maxWidth: '40rem' }}
          >
            <h2>Settings</h2>
            <label>
              <input type="checkbox" checked={settings.useSchedule} onChange={(e) => set({ useSchedule: e.target.checked })} /> Only offer live chat during opening hours
            </label>
            {settings.useSchedule && (
              <fieldset>
                <legend>Opening hours</legend>
                {DAYS.map((d, i) => (
                  <label key={d} style={{ marginRight: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={settings.schedule.days.includes(i)}
                      onChange={(e) => set({ schedule: { ...settings.schedule, days: e.target.checked ? [...settings.schedule.days, i].sort() : settings.schedule.days.filter((x) => x !== i) } })}
                    />{' '}
                    {d}
                  </label>
                ))}
                <br />
                <label>
                  From <input type="time" value={settings.schedule.from} onChange={(e) => set({ schedule: { ...settings.schedule, from: e.target.value } })} />
                </label>{' '}
                <label>
                  to <input type="time" value={settings.schedule.to} onChange={(e) => set({ schedule: { ...settings.schedule, to: e.target.value } })} />
                </label>{' '}
                <label>
                  Time zone (for example Europe/London) <input value={settings.schedule.timezone} onChange={(e) => set({ schedule: { ...settings.schedule, timezone: e.target.value } })} />
                </label>
              </fieldset>
            )}
            <label>
              Welcome message
              <br />
              <input style={{ width: '100%' }} maxLength={300} value={settings.welcome} onChange={(e) => set({ welcome: e.target.value })} />
            </label>
            <label>
              Message when nobody is available
              <br />
              <textarea rows={2} style={{ width: '100%' }} maxLength={400} value={settings.offlineMessage} onChange={(e) => set({ offlineMessage: e.target.value })} />
            </label>
            <label>
              Email new chats and offline messages to (empty uses the shop admin address)
              <br />
              <input type="email" style={{ width: '100%' }} maxLength={200} value={settings.notifyEmail} onChange={(e) => set({ notifyEmail: e.target.value })} />
            </label>
            <label>
              <input type="checkbox" checked={settings.notifyPush} onChange={(e) => set({ notifyPush: e.target.checked })} /> Send a web push to subscribed admin devices
            </label>
            <label>
              Close idle chats after hours (0 never)
              <br />
              <input type="number" min={0} max={720} value={settings.autoCloseHours} onChange={(e) => set({ autoCloseHours: Number(e.target.value) })} />
            </label>
            <label>
              Delete closed chats after days (0 keeps them until erased)
              <br />
              <input type="number" min={0} max={3650} value={settings.retentionDays} onChange={(e) => set({ retentionDays: Number(e.target.value) })} />
            </label>
            <label>
              Messages per visitor per hour
              <br />
              <input type="number" min={1} max={200} value={settings.ratePerHour} onChange={(e) => set({ ratePerHour: Number(e.target.value) })} />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit">Save settings</button>
              <button type="button" onClick={() => void post({ action: 'purge' })}>
                Delete old closed chats now
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
