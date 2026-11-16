'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { CommentSettings, CommentStatus } from '../core'
import type { AdminComment } from '../store'

type Tab = CommentStatus | 'all'
const TABS: Tab[] = ['pending', 'approved', 'spam', 'trash', 'all']

/** Admin screen for comments: filter, bulk actions, reply and settings. English only. */
export const CommentsPanel: React.FC = () => {
  const [tab, setTab] = useState<Tab>('pending')
  const [rows, setRows] = useState<AdminComment[]>([])
  const [counts, setCounts] = useState<Record<CommentStatus, number>>({ pending: 0, approved: 0, spam: 0, trash: 0 })
  const [settings, setSettings] = useState<CommentSettings | null>(null)
  const [picked, setPicked] = useState<number[]>([])
  const [replyTo, setReplyTo] = useState<AdminComment | null>(null)
  const [reply, setReply] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin-comments?status=${tab}`)
    const data = (await res.json().catch((): null => null)) as { comments?: AdminComment[]; counts?: Record<CommentStatus, number>; settings?: CommentSettings; error?: string } | null
    if (!res.ok) return setMessage(data?.error ?? 'Could not load comments.')
    setRows(data?.comments ?? [])
    if (data?.counts) setCounts(data.counts)
    setSettings(data?.settings ?? null)
    setPicked([])
  }, [tab])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok = ''): Promise<boolean> => {
    const res = await fetch('/api/admin-comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch((): null => null)) as { error?: string } | null
    if (!res.ok) {
      setMessage(data?.error ?? 'That did not work.')
      return false
    }
    setMessage(ok)
    await load()
    return true
  }
  const set = (patch: Partial<CommentSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s))
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const bulk = (status: CommentStatus) => post({ action: 'status', ids: picked, status }, 'Done.')

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}
      {settings && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void post({ action: 'settings', settings }, 'Settings saved.')
          }}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}
        >
          <label>Approval<br />
            <select value={settings.mode} onChange={(e) => set({ mode: e.target.value as CommentSettings['mode'] })}>
              <option value="all">Hold every comment</option>
              <option value="first">Hold a person&apos;s first comment</option>
              <option value="rules">Hold comments with links</option>
              <option value="open">Publish at once</option>
            </select>
          </label>
          <label><input type="checkbox" checked={settings.signedInAuto} onChange={(e) => set({ signedInAuto: e.target.checked })} /> Publish signed-in people at once</label>
          <label>Reply levels<br /><input type="number" min={1} max={5} value={settings.maxDepth} onChange={(e) => set({ maxDepth: Number(e.target.value) })} /></label>
          <label>Close after days (0 never)<br /><input type="number" min={0} max={3650} value={settings.closeAfterDays} onChange={(e) => set({ closeAfterDays: Number(e.target.value) })} /></label>
          <label style={{ flexBasis: '100%' }}>Blocked words, one per line (a match is marked spam)<br />
            <textarea rows={3} style={{ width: '100%' }} maxLength={2000} value={settings.blockedWords} onChange={(e) => set({ blockedWords: e.target.value })} />
          </label>
          <button type="submit">Save settings</button>
        </form>
      )}

      <div role="tablist" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{ fontWeight: tab === t ? 700 : 400 }}>
            {t === 'all' ? 'All' : `${t.charAt(0).toUpperCase()}${t.slice(1)} (${counts[t]})`}
          </button>
        ))}
      </div>

      {picked.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span>{picked.length} selected</span>
          <button type="button" onClick={() => void bulk('approved')}>Approve</button>
          <button type="button" onClick={() => void bulk('spam')}>Mark as spam</button>
          <button type="button" onClick={() => void bulk('trash')}>Trash</button>
          <button type="button" onClick={() => void post({ action: 'delete', ids: picked }, 'Deleted.')}>Delete for good</button>
        </div>
      )}

      {rows.length === 0 ? (
        <p>No comments here.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col"><span className="visually-hidden">Select</span></th>
              <th scope="col">Comment</th>
              <th scope="col">Post</th>
              <th scope="col">Status</th>
              <th scope="col">Date</th>
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><input type="checkbox" aria-label={`Select comment from ${c.name}`} checked={picked.includes(c.id)} onChange={() => toggle(c.id)} /></td>
                <td>
                  <strong>{c.name}</strong> {c.email && <small>{c.email}</small>}
                  <br />
                  <span style={{ whiteSpace: 'pre-line' }}>{c.content}</span>
                </td>
                <td>{c.postTitle || `#${c.refId}`}</td>
                <td>{c.status}</td>
                <td>{c.createdAt.slice(0, 10)}</td>
                <td><button type="button" onClick={() => { setReplyTo(c); setReply('') }}>Reply</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {replyTo && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (await post({ action: 'reply', parent: replyTo.id, post: replyTo.refId, content: reply }, 'Reply posted.')) setReplyTo(null)
          }}
          style={{ display: 'grid', gap: '0.5rem', maxWidth: '36rem' }}
        >
          <label>Reply to {replyTo.name} as the site team<br /><textarea rows={4} style={{ width: '100%' }} value={reply} onChange={(e) => setReply(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit">Post reply</button>
            <button type="button" onClick={() => setReplyTo(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
