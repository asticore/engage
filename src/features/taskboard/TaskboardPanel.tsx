'use client'

import { useCallback, useEffect, useState } from 'react'

import { PRIORITIES, isOverdue, myTasks, type Board, type Card, type Person } from './logic'
import type { Activity, Column, Comment } from './store'

type Data = { boards: Board[]; me: { id: number; isAdmin: boolean }; people: Person[]; board?: Board; columns?: Column[]; cards?: Card[]; activity?: Activity[]; assignable?: Person[]; comments?: Comment[] }
type Draft = { cardId?: number; columnId: number; title: string; description: string; assigneeId: string; dueDate: string; labels: string; priority: string }

const API = '/api/admin-taskboard'
const personName = (people: Person[], id: number | null): string => (id === null ? 'Nobody' : (people.find((p) => p.id === id)?.name || people.find((p) => p.id === id)?.email || `User ${id}`))
const ACTIVITY_LABEL: Record<string, string> = { 'card.created': 'added', 'card.moved': 'moved', 'card.assigned': 'assigned', 'card.commented': 'commented on', 'card.deleted': 'deleted', 'board.created': 'created the board' }

/** The Kanban taskboard: pick a board, drag cards between columns, open a card to edit, assign and comment. */
export function TaskboardPanel() {
  const [data, setData] = useState<Data | null>(null)
  const [boardId, setBoardId] = useState<number | null>(null)
  const [mine, setMine] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState('')
  const [dragId, setDragId] = useState<number | null>(null)
  const [settings, setSettings] = useState<{ name: string; memberIds: number[]; columns: { id?: number; name: string }[] } | null>(null)

  const load = useCallback(async (id: number | null, cardId?: number) => {
    const query = new URLSearchParams()
    if (id) query.set('board', String(id))
    if (cardId) query.set('card', String(cardId))
    const res = await fetch(`${API}?${query}`, { cache: 'no-store' })
    const body = (await res.json().catch(() => ({}))) as Data & { error?: string }
    if (!res.ok) {
      setMessage(body.error ?? 'Could not load the taskboard.')
      return
    }
    setData(body)
    if (cardId) setComments(body.comments ?? [])
    if (!id && body.boards[0]) setBoardId(body.boards[0].id)
  }, [])
  useEffect(() => {
    void load(boardId)
  }, [load, boardId])

  const post = async (payload: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    setMessage('')
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boardId, ...payload }) })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      setMessage(String(body.error ?? 'That did not work.'))
      return null
    }
    await load(boardId)
    return body
  }

  if (!data) return <p className="text-muted">{message || 'Loading…'}</p>
  const people = data.people
  const columns = data.columns ?? []
  const cards = mine ? myTasks(data.cards ?? [], data.me.id) : (data.cards ?? [])
  const today = new Date().toISOString().slice(0, 10)

  const openCard = (card: Card): void => {
    setDraft({ cardId: card.id, columnId: card.columnId, title: card.title, description: card.description, assigneeId: card.assigneeId ? String(card.assigneeId) : '', dueDate: card.dueDate ?? '', labels: card.labels.join(', '), priority: card.priority })
    setComment('')
    setComments([])
    void load(boardId, card.id)
  }
  const saveCard = async (): Promise<void> => {
    if (!draft) return
    const { cardId, columnId, assigneeId, ...rest } = draft
    const ok = await post({ action: 'save-card', cardId, columnId, card: { ...rest, assigneeId: assigneeId ? Number(assigneeId) : null } })
    if (ok) setDraft(null)
  }
  const drop = async (columnId: number, index: number): Promise<void> => {
    if (dragId === null) return
    const id = dragId
    setDragId(null)
    await post({ action: 'move-card', cardId: id, columnId, index })
  }

  return (
    <div className="stack">
      {message ? <p role="alert" className="badge">{message}</p> : null}
      <div className="cluster">
        <select className="select" aria-label="Board" value={boardId ?? ''} onChange={(e) => setBoardId(Number(e.target.value) || null)}>
          {data.boards.length === 0 ? <option value="">No boards yet</option> : null}
          {data.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label className="cluster"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> My tasks</label>
        {data.me.isAdmin ? (
          <>
            <button type="button" className="btn" onClick={() => { const name = window.prompt('Board name'); if (name) void post({ action: 'create-board', boardId: undefined, name }).then((b) => b && setBoardId(Number(b.id))) }}>New board</button>
            {data.board ? <button type="button" className="btn" onClick={() => setSettings({ name: data.board!.name, memberIds: data.board!.memberIds, columns: columns.map((c) => ({ id: c.id, name: c.name })) })}>Board settings</button> : null}
          </>
        ) : null}
      </div>

      {data.board ? (
        <div className="cluster" style={{ alignItems: 'flex-start', overflowX: 'auto', flexWrap: 'nowrap', gap: 12 }}>
          {columns.map((column) => {
            const inColumn = cards.filter((c) => c.columnId === column.id)
            return (
              <section key={column.id} className="card" style={{ minWidth: 260, flex: '0 0 260px' }} aria-label={column.name} onDragOver={(e) => e.preventDefault()} onDrop={() => void drop(column.id, inColumn.length)}>
                <div className="card-body stack">
                  <strong>{column.name} <span className="badge">{inColumn.length}</span></strong>
                  {inColumn.map((card, index) => (
                    <article key={card.id} className="card" draggable onDragStart={() => setDragId(card.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); void drop(column.id, index) }}>
                      <button type="button" className="card-body stack" style={{ textAlign: 'left', width: '100%', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => openCard(card)}>
                        <span>{card.title}</span>
                        <span className="cluster">
                          {card.priority !== 'normal' ? <span className="badge">{card.priority}</span> : null}
                          {card.labels.map((l) => <span key={l} className="badge">{l}</span>)}
                          {card.dueDate ? <span className={isOverdue(card, today) ? 'badge' : 'text-muted'}>{isOverdue(card, today) ? 'Overdue ' : 'Due '}{card.dueDate}</span> : null}
                        </span>
                        <span className="text-muted">{personName(people, card.assigneeId)}</span>
                      </button>
                    </article>
                  ))}
                  <button type="button" className="btn" onClick={() => { setComments([]); setDraft({ columnId: column.id, title: '', description: '', assigneeId: '', dueDate: '', labels: '', priority: 'normal' }) }}>Add task</button>
                </div>
              </section>
            )
          })}
        </div>
      ) : <p className="text-muted">{data.me.isAdmin ? 'Add a board to get started.' : 'No boards are shared with you yet.'}</p>}

      {draft ? (
        <div className="card" role="dialog" aria-label="Task">
          <div className="card-body stack">
            <label className="field">Title<input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            <label className="field">Description<textarea className="textarea" rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <div className="cluster">
              <label className="field">Assigned to
                <select className="select" value={draft.assigneeId} onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}>
                  <option value="">Nobody</option>
                  {(data.assignable ?? people).map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
                </select>
              </label>
              <label className="field">Due date<input className="input" type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></label>
              <label className="field">Priority
                <select className="select" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
              </label>
              {draft.cardId ? (
                <label className="field">Column
                  <select className="select" value={draft.columnId} onChange={(e) => { const columnId = Number(e.target.value); setDraft({ ...draft, columnId }); void post({ action: 'move-card', cardId: draft.cardId, columnId, index: 9999 }) }}>
                    {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            <label className="field">Labels (separate with commas)<input className="input" value={draft.labels} onChange={(e) => setDraft({ ...draft, labels: e.target.value })} /></label>
            <div className="cluster">
              <button type="button" className="btn" onClick={() => void saveCard()}>Save task</button>
              <button type="button" className="btn" onClick={() => setDraft(null)}>Close</button>
              {draft.cardId ? <button type="button" className="btn" onClick={() => { if (window.confirm('Delete this task?')) void post({ action: 'delete-card', cardId: draft.cardId }).then(() => setDraft(null)) }}>Delete</button> : null}
            </div>
            {draft.cardId ? (
              <div className="stack">
                <strong>Comments</strong>
                {comments.length === 0 ? <p className="text-muted">No comments yet.</p> : comments.map((c) => <p key={c.id}><strong>{personName(people, c.userId)}</strong> <span className="text-muted">{c.createdAt.slice(0, 16).replace('T', ' ')}</span><br />{c.body}</p>)}
                <div className="cluster">
                  <input className="input" aria-label="New comment" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <button type="button" className="btn" onClick={() => void post({ action: 'add-comment', cardId: draft.cardId, body: comment }).then((ok) => { if (ok) { setComment(''); void load(boardId, draft.cardId) } })}>Comment</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {settings && data.board ? (
        <div className="card" role="dialog" aria-label="Board settings">
          <div className="card-body stack">
            <label className="field">Board name<input className="input" value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} /></label>
            <fieldset className="field">
              <legend>Who can open this board (leave all unticked for every admin and staff user)</legend>
              {people.map((p) => (
                <label key={p.id} className="cluster"><input type="checkbox" checked={settings.memberIds.includes(p.id)} onChange={(e) => setSettings({ ...settings, memberIds: e.target.checked ? [...settings.memberIds, p.id] : settings.memberIds.filter((m) => m !== p.id) })} /> {p.name || p.email}</label>
              ))}
            </fieldset>
            <strong>Columns</strong>
            {settings.columns.map((c, i) => (
              <div key={c.id ?? `new-${i}`} className="cluster">
                <input className="input" aria-label={`Column ${i + 1}`} value={c.name} onChange={(e) => setSettings({ ...settings, columns: settings.columns.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <button type="button" className="btn" disabled={i === 0} onClick={() => { const next = [...settings.columns]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; setSettings({ ...settings, columns: next }) }}>Up</button>
                <button type="button" className="btn" disabled={settings.columns.length < 2} onClick={() => setSettings({ ...settings, columns: settings.columns.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => setSettings({ ...settings, columns: [...settings.columns, { name: '' }] })}>Add column</button>
            <div className="cluster">
              <button type="button" className="btn" onClick={() => void post({ action: 'update-board', name: settings.name, memberIds: settings.memberIds, columns: settings.columns }).then((ok) => ok && setSettings(null))}>Save board</button>
              <button type="button" className="btn" onClick={() => setSettings(null)}>Close</button>
              <button type="button" className="btn" onClick={() => { if (window.confirm('Delete this board and all its tasks?')) void post({ action: 'delete-board' }).then(() => { setSettings(null); setBoardId(null) }) }}>Delete board</button>
            </div>
          </div>
        </div>
      ) : null}

      {data.board && (data.activity?.length ?? 0) > 0 ? (
        <div className="stack">
          <strong>Recent activity</strong>
          {data.activity!.slice(0, 15).map((a) => <p key={a.id} className="text-muted">{personName(people, a.userId)} {ACTIVITY_LABEL[a.action] ?? a.action}: {a.detail} · {a.createdAt.slice(0, 16).replace('T', ' ')}</p>)}
        </div>
      ) : null}
    </div>
  )
}
