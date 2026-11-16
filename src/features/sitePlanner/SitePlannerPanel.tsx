'use client'

import React, { useEffect, useState } from 'react'

import { adminCollectionPath } from '@/admin/adminPaths'

import { PAGE_STATUSES, addPage, movePage, nextToFill, progress, removePage, treeOrder, updatePage, type Plan } from './plan'

type Summary = { id: number; name: string; updatedAt: string; pages: number }
type Saved = { id: number; name: string; idea: string; answers: string; plan: Plan }

const STATUS_LABEL: Record<string, string> = { idea: 'Idea', briefed: 'Briefed', drafted: 'Draft page made', done: 'Done' }

async function call(method: 'GET' | 'POST', query: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(`/api/admin-site-planner${query}`, { method, cache: 'no-store', ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> }
}

/** Plan a whole site: idea, questions, page tree with briefs, draft pages, status per page. */
export function SitePlannerPanel(): React.ReactElement {
  const [plans, setPlans] = useState<Summary[]>([])
  const [aiReady, setAiReady] = useState(true)
  const [current, setCurrent] = useState<Saved | null>(null)
  const [questions, setQuestions] = useState<string[]>([])
  const [answerList, setAnswerList] = useState<string[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    const { ok, data } = await call('GET', '')
    if (ok) {
      setPlans(data.plans as Summary[])
      setAiReady(data.aiReady === true)
    } else setMessage(String(data.error ?? 'The planner could not load.'))
  }
  useEffect(() => { void load() }, [])

  const open = async (id: number) => {
    const { ok, data } = await call('GET', `?id=${id}`)
    if (ok) { setCurrent(data.plan as Saved); setQuestions([]); setAnswerList([]); setMessage('') }
  }
  const startNew = () => { setCurrent({ id: 0, name: 'My site plan', idea: '', answers: '', plan: { pages: [] } }); setQuestions([]); setAnswerList([]); setMessage('') }
  const patch = (p: Partial<Saved>) => setCurrent((c) => (c ? { ...c, ...p } : c))
  const setPlan = (plan: Plan) => patch({ plan })

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setMessage('')
    try { await fn() } catch { setMessage('Something went wrong. Try again.') } finally { setBusy('') }
  }
  const answersText = () => questions.map((q, i) => `${q}\n${answerList[i] ?? ''}`).join('\n\n') || current?.answers || ''

  const askQuestions = () => run('questions', async () => {
    const { ok, data } = await call('POST', '', { action: 'questions', idea: current?.idea })
    if (ok) { setQuestions(data.questions as string[]); setAnswerList([]) } else setMessage(String(data.error))
  })
  const generate = () => run('generate', async () => {
    const answers = answersText()
    const { ok, data } = await call('POST', '', { action: 'generate', idea: current?.idea, answers })
    if (ok) { patch({ plan: data.plan as Plan, answers }); setMessage('Plan made. Edit it, then save.') } else setMessage(String(data.error))
  })
  const suggest = () => run('suggest', async () => {
    const { ok, data } = await call('POST', '', { action: 'suggest', idea: current?.idea, plan: current?.plan })
    if (ok) { setPlan(data.plan as Plan); setMessage(`${String(data.added)} pages suggested and added. Remove any you do not want.`) } else setMessage(String(data.error))
  })
  const save = () => run('save', async () => {
    if (!current) return
    const { ok, data } = await call('POST', '', { action: 'save', id: current.id || undefined, name: current.name, idea: current.idea, answers: current.answers, plan: current.plan })
    if (ok) { patch({ id: Number(data.id) }); setMessage('Saved.'); await load() } else setMessage(String(data.error))
  })
  const createPages = () => run('create', async () => {
    if (!current) return
    const id = current.id || undefined
    const saved = await call('POST', '', { action: 'save', id, name: current.name, idea: current.idea, answers: current.answers, plan: current.plan })
    const planId = Number(saved.data.id)
    const { ok, data } = await call('POST', '', { action: 'create-pages', id: planId })
    if (ok) {
      patch({ id: planId, plan: data.plan as Plan })
      const failed = data.failed as string[]
      setMessage(`${String(data.created)} draft pages created.${failed.length ? ` Not created: ${failed.join(', ')}.` : ''} Nothing is published.`)
      await load()
    } else setMessage(String(data.error))
  })
  const remove = async (id: number) => {
    if (!window.confirm('Delete this plan? Pages already created stay.')) return
    await call('POST', '', { action: 'delete', id }); setCurrent(null); await load()
  }

  if (!current) {
    return (
      <div>
        {message && <p role="status">{message}</p>}
        <button type="button" className="btn" onClick={startNew}>New site plan</button>
        {plans.length > 0 && (
          <ul>
            {plans.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => open(p.id)}>{p.name}</button> ({p.pages} pages)
                {' '}<button type="button" onClick={() => remove(p.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
        {plans.length === 0 && <p>No plans yet.</p>}
      </div>
    )
  }

  const order = treeOrder(current.plan)
  const stats = progress(current.plan)
  const next = nextToFill(current.plan)
  return (
    <div>
      <p><button type="button" onClick={() => { setCurrent(null); void load() }}>Back to plans</button></p>
      {!aiReady && <p role="alert">No Claude or OpenAI key is set in Integrations. You can still build and edit a plan by hand.</p>}
      <label>Plan name <input type="text" value={current.name} onChange={(e) => patch({ name: e.target.value })} /></label>
      <p><label>Describe the site<br /><textarea rows={4} cols={70} value={current.idea} onChange={(e) => patch({ idea: e.target.value })} placeholder="What the business does, who it is for, and what visitors should do." /></label></p>
      <p>
        <button type="button" onClick={askQuestions} disabled={!aiReady || busy !== '' || current.idea.trim().length < 10}>{busy === 'questions' ? 'Thinking...' : 'Ask me questions first'}</button>{' '}
        <button type="button" onClick={generate} disabled={!aiReady || busy !== '' || current.idea.trim().length < 10}>{busy === 'generate' ? 'Planning...' : 'Make the page plan'}</button>
      </p>
      {questions.map((q, i) => (
        <p key={q}><label>{q}<br /><input type="text" size={70} value={answerList[i] ?? ''} onChange={(e) => setAnswerList((a) => { const n = [...a]; n[i] = e.target.value; return n })} /></label></p>
      ))}
      {message && <p role="status">{message}</p>}

      <h2>Pages ({stats.total})</h2>
      <p>{stats.idea} idea, {stats.briefed} briefed, {stats.drafted} draft pages made, {stats.done} done.{next ? ` Next to fill: ${next.title}.` : ''}</p>
      {order.map((p) => (
        <fieldset key={p.id} style={{ marginLeft: p.depth * 24, marginBottom: 8 }}>
          <legend>{p.title} <code>{p.path}</code></legend>
          <label>Title <input type="text" value={p.title} onChange={(e) => setPlan(updatePage(current.plan, p.id, { title: e.target.value }))} /></label>{' '}
          <label>Status <select value={p.status} onChange={(e) => setPlan(updatePage(current.plan, p.id, { status: e.target.value as (typeof PAGE_STATUSES)[number] }))}>{PAGE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>{' '}
          <label>Under <select value={p.parentId ?? ''} onChange={(e) => setPlan(movePage(current.plan, p.id, e.target.value || null))}><option value="">Top level</option>{current.plan.pages.filter((o) => o.id !== p.id).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
          <p><label>Brief<br /><textarea rows={2} cols={70} value={p.brief} onChange={(e) => setPlan(updatePage(current.plan, p.id, { brief: e.target.value }))} /></label></p>
          <p><label>Sections (one per line)<br /><textarea rows={3} cols={50} value={p.sections.join('\n')} onChange={(e) => setPlan(updatePage(current.plan, p.id, { sections: e.target.value.split('\n') }))} /></label></p>
          {p.pageId ? <a href={`${adminCollectionPath('pages')}/${p.pageId}`}>Open the page</a> : null}{' '}
          <button type="button" onClick={() => setPlan(removePage(current.plan, p.id))}>Remove</button>
        </fieldset>
      ))}
      <p>
        <label>Add a page <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /></label>{' '}
        <button type="button" onClick={() => { setPlan(addPage(current.plan, newTitle, null)); setNewTitle('') }} disabled={!newTitle.trim()}>Add</button>{' '}
        <button type="button" onClick={suggest} disabled={!aiReady || busy !== '' || stats.total === 0}>{busy === 'suggest' ? 'Thinking...' : 'Suggest more pages'}</button>
      </p>
      <p>
        <button type="button" className="btn" onClick={save} disabled={busy !== ''}>{busy === 'save' ? 'Saving...' : 'Save plan'}</button>{' '}
        <button type="button" onClick={createPages} disabled={busy !== '' || stats.total === 0}>{busy === 'create' ? 'Creating...' : 'Create draft pages'}</button>
      </p>
    </div>
  )
}
