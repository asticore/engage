'use client'

import React, { useEffect, useState } from 'react'

import { adminCollectionPath } from '@/admin/adminPaths'
import { useAdminHref } from '@/admin/adminRoute/AdminRouteProvider'

import { DIAGRAM, PAGE_STATUSES, addPage, diagramLayout, movePage, nextToFill, progress, removePage, reorderPage, shiftPage, treeOrder, updatePage, updateSettings, type Plan } from './plan'

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
  const [templates, setTemplates] = useState<Array<{ id: number; name: string }>>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const adminHref = useAdminHref()
  const [message, setMessage] = useState('')

  const load = async () => {
    const { ok, data } = await call('GET', '')
    if (ok) {
      setPlans(data.plans as Summary[])
      setAiReady(data.aiReady === true)
    } else setMessage(String(data.error ?? 'The planner could not load.'))
  }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    void call('GET', '?templates=1').then(({ ok, data }) => { if (ok) setTemplates(data.templates as Array<{ id: number; name: string }>) })
  }, [])

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
    const { ok, data } = await call('POST', '', { action: 'questions', idea: current?.idea, brandVoice: current?.plan.brandVoice })
    if (ok) { setQuestions(data.questions as string[]); setAnswerList([]) } else setMessage(String(data.error))
  })
  const generate = () => run('generate', async () => {
    const answers = answersText()
    const { ok, data } = await call('POST', '', { action: 'generate', idea: current?.idea, answers, brandVoice: current?.plan.brandVoice })
    if (ok) { patch({ plan: updateSettings(data.plan as Plan, { brandVoice: current?.plan.brandVoice, templateId: current?.plan.templateId }), answers }); setMessage('Plan made. Edit it, then save.') } else setMessage(String(data.error))
  })
  const suggest = () => run('suggest', async () => {
    const { ok, data } = await call('POST', '', { action: 'suggest', idea: current?.idea, plan: current?.plan, brandVoice: current?.plan.brandVoice })
    if (ok) { setPlan(data.plan as Plan); setMessage(`${String(data.added)} pages suggested and added. Remove any you do not want.`) } else setMessage(String(data.error))
  })
  const suggestSections = (pageId: string) => run(`sections-${pageId}`, async () => {
    if (!current) return
    const { ok, data } = await call('POST', '', { action: 'sections', idea: current.idea, plan: current.plan, pageId, brandVoice: current.plan.brandVoice })
    if (ok) { setPlan(updatePage(current.plan, pageId, { sections: data.sections as string[] })); setMessage('Sections suggested. Edit them if you like.') } else setMessage(String(data.error))
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

      <h2>Brand voice and template</h2>
      <p><label>Brand voice for this plan<br /><textarea rows={2} cols={70} maxLength={500} value={current.plan.brandVoice ?? ''} onChange={(e) => setPlan(updateSettings(current.plan, { brandVoice: e.target.value }))} placeholder="Leave empty to use the brand voice from Integrations, Build with AI." /></label></p>
      <p><label>Start every draft page from this template <select value={current.plan.templateId ?? ''} onChange={(e) => setPlan(updateSettings(current.plan, { templateId: e.target.value ? Number(e.target.value) : null }))}><option value="">Blank page</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></p>

      <h2>Pages ({stats.total})</h2>
      <p>{stats.idea} idea, {stats.briefed} briefed, {stats.drafted} draft pages made, {stats.done} done.{next ? ` Next to fill: ${next.title}.` : ''}</p>
      {order.map((p) => (
        <fieldset
          key={p.id}
          draggable
          onDragStart={() => setDragId(p.id)}
          onDragEnd={() => setDragId(null)}
          onDragOver={(e) => { if (dragId && dragId !== p.id) e.preventDefault() }}
          onDrop={(e) => {
            e.preventDefault()
            if (!dragId) return
            const box = e.currentTarget.getBoundingClientRect()
            setPlan(reorderPage(current.plan, dragId, p.id, e.clientY < box.top + box.height / 2 ? 'before' : 'after'))
            setDragId(null)
          }}
          style={{ marginLeft: p.depth * 24, marginBottom: 8, opacity: dragId === p.id ? 0.5 : 1 }}
        >
          <legend>{p.title} <code>{p.path}</code></legend>
          <p style={{ margin: 0 }}>
            Drag to reorder, or{' '}
            <button type="button" aria-label={`Move ${p.title} up`} onClick={() => setPlan(shiftPage(current.plan, p.id, -1))}>Move up</button>{' '}
            <button type="button" aria-label={`Move ${p.title} down`} onClick={() => setPlan(shiftPage(current.plan, p.id, 1))}>Move down</button>
          </p>
          <label>Title <input type="text" value={p.title} onChange={(e) => setPlan(updatePage(current.plan, p.id, { title: e.target.value }))} /></label>{' '}
          <label>Status <select value={p.status} onChange={(e) => setPlan(updatePage(current.plan, p.id, { status: e.target.value as (typeof PAGE_STATUSES)[number] }))}>{PAGE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>{' '}
          <label>Under <select value={p.parentId ?? ''} onChange={(e) => setPlan(movePage(current.plan, p.id, e.target.value || null))}><option value="">Top level</option>{current.plan.pages.filter((o) => o.id !== p.id).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
          <p><label>Brief<br /><textarea rows={2} cols={70} value={p.brief} onChange={(e) => setPlan(updatePage(current.plan, p.id, { brief: e.target.value }))} /></label></p>
          <p><label>Sections (one per line)<br /><textarea rows={3} cols={50} value={p.sections.join('\n')} onChange={(e) => setPlan(updatePage(current.plan, p.id, { sections: e.target.value.split('\n') }))} /></label></p>
          <button type="button" onClick={() => suggestSections(p.id)} disabled={!aiReady || busy !== ''}>{busy === `sections-${p.id}` ? 'Thinking...' : 'Suggest sections'}</button>{' '}
          {p.pageId ? <a href={`${adminCollectionPath('pages')}/${p.pageId}`}>Open the page</a> : null}{' '}
          {p.pageId && current.id ? <a href={`${adminHref(`/visual-editor/collection/pages/${p.pageId}`)}?aiPlan=${current.id}&aiPage=${p.id}`}>Fill this page with AI</a> : null}{' '}
          <button type="button" onClick={() => setPlan(removePage(current.plan, p.id))}>Remove</button>
        </fieldset>
      ))}
      <p>
        <label>Add a page <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /></label>{' '}
        <button type="button" onClick={() => { setPlan(addPage(current.plan, newTitle, null)); setNewTitle('') }} disabled={!newTitle.trim()}>Add</button>{' '}
        <button type="button" onClick={suggest} disabled={!aiReady || busy !== '' || stats.total === 0}>{busy === 'suggest' ? 'Thinking...' : 'Suggest more pages'}</button>
      </p>
      <PlanDiagram plan={current.plan} />
      <p>
        <button type="button" className="btn" onClick={save} disabled={busy !== ''}>{busy === 'save' ? 'Saving...' : 'Save plan'}</button>{' '}
        <button type="button" onClick={createPages} disabled={busy !== '' || stats.total === 0}>{busy === 'create' ? 'Creating...' : 'Create draft pages'}</button>
      </p>
    </div>
  )
}


/** The plan as a tree diagram: one box per page, a line from each parent to its children, the box edge showing the status. */
function PlanDiagram({ plan }: { plan: Plan }): React.ReactElement | null {
  if (plan.pages.length === 0) return null
  const { nodes, edges, width, height } = diagramLayout(plan)
  const at = new Map(nodes.map((n) => [n.id, n]))
  const { nodeWidth, nodeHeight } = DIAGRAM
  const label = (title: string) => (title.length > 18 ? `${title.slice(0, 17)}\u2026` : title)
  return (
    <section aria-labelledby="planner-diagram-heading">
      <h2 id="planner-diagram-heading">Plan diagram</h2>
      <div style={{ overflowX: 'auto' }}>
        <svg role="img" aria-label={`Site plan with ${nodes.length} pages`} width={width} height={height + 2} viewBox={`0 0 ${width} ${height + 2}`} style={{ maxWidth: 'none' }}>
          {edges.map((e) => {
            const a = at.get(e.from)!
            const b = at.get(e.to)!
            const x1 = a.x + nodeWidth / 2
            const y1 = a.y + nodeHeight
            const x2 = b.x + nodeWidth / 2
            const mid = (y1 + b.y) / 2
            return <path key={`${e.from}-${e.to}`} d={`M${x1} ${y1} V${mid} H${x2} V${b.y}`} fill="none" stroke="currentColor" strokeOpacity={0.5} />
          })}
          {nodes.map((n) => (
            <g key={n.id}>
              <title>{`${n.title}: ${STATUS_LABEL[n.status]}`}</title>
              <rect x={n.x} y={n.y} width={nodeWidth} height={nodeHeight} rx={6} fill="none" stroke="currentColor" strokeWidth={n.status === 'idea' ? 1 : 2.5} strokeDasharray={n.status === 'idea' ? '4 3' : undefined} />
              <text x={n.x + nodeWidth / 2} y={n.y + nodeHeight / 2 - 3} textAnchor="middle" fontSize={12} fill="currentColor">{label(n.title)}</text>
              <text x={n.x + nodeWidth / 2} y={n.y + nodeHeight / 2 + 11} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.7}>{STATUS_LABEL[n.status]}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  )
}
