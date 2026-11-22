'use client'

import React, { useEffect, useState } from 'react'

import { adminCollectionPath } from '@/admin/adminPaths'
import { useAdminHref } from '@/admin/adminRoute/AdminRouteProvider'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'

import { DIAGRAM, PAGE_STATUSES, addPage, diagramLayout, movePage, nextToFill, progress, removePage, reorderPage, shiftPage, treeOrder, updatePage, updateSettings, type Plan } from './plan'

type Summary = { id: number; name: string; updatedAt: string; pages: number }
type Saved = { id: number; name: string; idea: string; answers: string; plan: Plan }


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
  const t = useAdminT()
  const statusLabel = (s: string) => t(`planner.status.${s}` as 'planner.status.idea')
  const [message, setMessage] = useState('')

  const load = async () => {
    const { ok, data } = await call('GET', '')
    if (ok) {
      setPlans(data.plans as Summary[])
      setAiReady(data.aiReady === true)
    } else setMessage(String(data.error ?? t('planner.loadFailed')))
  }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    void call('GET', '?templates=1').then(({ ok, data }) => { if (ok) setTemplates(data.templates as Array<{ id: number; name: string }>) })
  }, [])

  const open = async (id: number) => {
    const { ok, data } = await call('GET', `?id=${id}`)
    if (ok) { setCurrent(data.plan as Saved); setQuestions([]); setAnswerList([]); setMessage('') }
  }
  const startNew = () => { setCurrent({ id: 0, name: t('planner.defaultName'), idea: '', answers: '', plan: { pages: [] } }); setQuestions([]); setAnswerList([]); setMessage('') }
  const patch = (p: Partial<Saved>) => setCurrent((c) => (c ? { ...c, ...p } : c))
  const setPlan = (plan: Plan) => patch({ plan })

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setMessage('')
    try { await fn() } catch { setMessage(t('planner.error')) } finally { setBusy('') }
  }
  const answersText = () => questions.map((q, i) => `${q}\n${answerList[i] ?? ''}`).join('\n\n') || current?.answers || ''

  const askQuestions = () => run('questions', async () => {
    const { ok, data } = await call('POST', '', { action: 'questions', idea: current?.idea, brandVoice: current?.plan.brandVoice })
    if (ok) { setQuestions(data.questions as string[]); setAnswerList([]) } else setMessage(String(data.error))
  })
  const generate = () => run('generate', async () => {
    const answers = answersText()
    const { ok, data } = await call('POST', '', { action: 'generate', idea: current?.idea, answers, brandVoice: current?.plan.brandVoice })
    if (ok) { patch({ plan: updateSettings(data.plan as Plan, { brandVoice: current?.plan.brandVoice, templateId: current?.plan.templateId }), answers }); setMessage(t('planner.planMade')) } else setMessage(String(data.error))
  })
  const suggest = () => run('suggest', async () => {
    const { ok, data } = await call('POST', '', { action: 'suggest', idea: current?.idea, plan: current?.plan, brandVoice: current?.plan.brandVoice })
    if (ok) { setPlan(data.plan as Plan); setMessage(t('planner.suggested', { count: String(data.added) })) } else setMessage(String(data.error))
  })
  const suggestSections = (pageId: string) => run(`sections-${pageId}`, async () => {
    if (!current) return
    const { ok, data } = await call('POST', '', { action: 'sections', idea: current.idea, plan: current.plan, pageId, brandVoice: current.plan.brandVoice })
    if (ok) { setPlan(updatePage(current.plan, pageId, { sections: data.sections as string[] })); setMessage(t('planner.sectionsSuggested')) } else setMessage(String(data.error))
  })
  const save = () => run('save', async () => {
    if (!current) return
    const { ok, data } = await call('POST', '', { action: 'save', id: current.id || undefined, name: current.name, idea: current.idea, answers: current.answers, plan: current.plan })
    if (ok) { patch({ id: Number(data.id) }); setMessage(t('planner.saved')); await load() } else setMessage(String(data.error))
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
      setMessage(failed.length ? t('planner.createdFailed', { count: String(data.created), list: failed.join(', ') }) : t('planner.created', { count: String(data.created) }))
      await load()
    } else setMessage(String(data.error))
  })
  const remove = async (id: number) => {
    if (!window.confirm(t('planner.confirmDelete'))) return
    await call('POST', '', { action: 'delete', id }); setCurrent(null); await load()
  }

  if (!current) {
    return (
      <div>
        {message && <p role="status">{message}</p>}
        <button type="button" className="btn" onClick={startNew}>{t('planner.new')}</button>
        {plans.length > 0 && (
          <ul>
            {plans.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => open(p.id)}>{p.name}</button> {t('planner.pageCount', { count: String(p.pages) })}
                {' '}<button type="button" onClick={() => remove(p.id)}>{t('planner.delete')}</button>
              </li>
            ))}
          </ul>
        )}
        {plans.length === 0 && <p>{t('planner.noPlans')}</p>}
      </div>
    )
  }

  const order = treeOrder(current.plan)
  const stats = progress(current.plan)
  const next = nextToFill(current.plan)
  return (
    <div>
      <p><button type="button" onClick={() => { setCurrent(null); void load() }}>{t('planner.back')}</button></p>
      {!aiReady && <p role="alert">{t('planner.noKey')}</p>}
      <label>{t('planner.planName')} <input type="text" value={current.name} onChange={(e) => patch({ name: e.target.value })} /></label>
      <p><label>{t('planner.describe')}<br /><textarea rows={4} cols={70} value={current.idea} onChange={(e) => patch({ idea: e.target.value })} placeholder={t('planner.describePlaceholder')} /></label></p>
      <p>
        <button type="button" onClick={askQuestions} disabled={!aiReady || busy !== '' || current.idea.trim().length < 10}>{busy === 'questions' ? t('planner.thinking') : t('planner.askQuestions')}</button>{' '}
        <button type="button" onClick={generate} disabled={!aiReady || busy !== '' || current.idea.trim().length < 10}>{busy === 'generate' ? t('planner.planning') : t('planner.makePlan')}</button>
      </p>
      {questions.map((q, i) => (
        <p key={q}><label>{q}<br /><input type="text" size={70} value={answerList[i] ?? ''} onChange={(e) => setAnswerList((a) => { const n = [...a]; n[i] = e.target.value; return n })} /></label></p>
      ))}
      {message && <p role="status">{message}</p>}

      <h2>{t('planner.brandHeading')}</h2>
      <p><label>{t('planner.brandVoice')}<br /><textarea rows={2} cols={70} maxLength={500} value={current.plan.brandVoice ?? ''} onChange={(e) => setPlan(updateSettings(current.plan, { brandVoice: e.target.value }))} placeholder={t('planner.brandVoicePlaceholder')} /></label></p>
      <p><label>{t('planner.template')} <select value={current.plan.templateId ?? ''} onChange={(e) => setPlan(updateSettings(current.plan, { templateId: e.target.value ? Number(e.target.value) : null }))}><option value="">{t('planner.blankPage')}</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></p>

      <h2>{t('planner.pagesHeading', { count: String(stats.total) })}</h2>
      <p>{t('planner.progress', { idea: String(stats.idea), briefed: String(stats.briefed), drafted: String(stats.drafted), done: String(stats.done) })}{next ? ` ${t('planner.nextToFill', { title: next.title })}` : ''}</p>
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
            {t('planner.dragOrMove')}{' '}
            <button type="button" aria-label={t('planner.moveUpLabel', { title: p.title })} onClick={() => setPlan(shiftPage(current.plan, p.id, -1))}>{t('planner.moveUp')}</button>{' '}
            <button type="button" aria-label={t('planner.moveDownLabel', { title: p.title })} onClick={() => setPlan(shiftPage(current.plan, p.id, 1))}>{t('planner.moveDown')}</button>
          </p>
          <label>{t('planner.title')} <input type="text" value={p.title} onChange={(e) => setPlan(updatePage(current.plan, p.id, { title: e.target.value }))} /></label>{' '}
          <label>{t('planner.status')} <select value={p.status} onChange={(e) => setPlan(updatePage(current.plan, p.id, { status: e.target.value as (typeof PAGE_STATUSES)[number] }))}>{PAGE_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></label>{' '}
          <label>{t('planner.under')} <select value={p.parentId ?? ''} onChange={(e) => setPlan(movePage(current.plan, p.id, e.target.value || null))}><option value="">{t('planner.topLevel')}</option>{current.plan.pages.filter((o) => o.id !== p.id).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
          <p><label>{t('planner.brief')}<br /><textarea rows={2} cols={70} value={p.brief} onChange={(e) => setPlan(updatePage(current.plan, p.id, { brief: e.target.value }))} /></label></p>
          <p><label>{t('planner.sections')}<br /><textarea rows={3} cols={50} value={p.sections.join('\n')} onChange={(e) => setPlan(updatePage(current.plan, p.id, { sections: e.target.value.split('\n') }))} /></label></p>
          <button type="button" onClick={() => suggestSections(p.id)} disabled={!aiReady || busy !== ''}>{busy === `sections-${p.id}` ? t('planner.thinking') : t('planner.suggestSections')}</button>{' '}
          {p.pageId ? <a href={`${adminCollectionPath('pages')}/${p.pageId}`}>{t('planner.openPage')}</a> : null}{' '}
          {p.pageId && current.id ? <a href={`${adminHref(`/visual-editor/collection/pages/${p.pageId}`)}?aiPlan=${current.id}&aiPage=${p.id}`}>{t('planner.fillWithAi')}</a> : null}{' '}
          <button type="button" onClick={() => setPlan(removePage(current.plan, p.id))}>{t('planner.remove')}</button>
        </fieldset>
      ))}
      <p>
        <label>{t('planner.addPage')} <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /></label>{' '}
        <button type="button" onClick={() => { setPlan(addPage(current.plan, newTitle, null)); setNewTitle('') }} disabled={!newTitle.trim()}>{t('planner.add')}</button>{' '}
        <button type="button" onClick={suggest} disabled={!aiReady || busy !== '' || stats.total === 0}>{busy === 'suggest' ? t('planner.thinking') : t('planner.suggestMore')}</button>
      </p>
      <PlanDiagram plan={current.plan} />
      <p>
        <button type="button" className="btn" onClick={save} disabled={busy !== ''}>{busy === 'save' ? t('planner.saving') : t('planner.savePlan')}</button>{' '}
        <button type="button" onClick={createPages} disabled={busy !== '' || stats.total === 0}>{busy === 'create' ? t('planner.creating') : t('planner.createDraft')}</button>
      </p>
    </div>
  )
}


/** The plan as a tree diagram: one box per page, a line from each parent to its children, the box edge showing the status. */
function PlanDiagram({ plan }: { plan: Plan }): React.ReactElement | null {
  const t = useAdminT()
  const statusLabel = (s: string) => t(`planner.status.${s}` as 'planner.status.idea')
  if (plan.pages.length === 0) return null
  const { nodes, edges, width, height } = diagramLayout(plan)
  const at = new Map(nodes.map((n) => [n.id, n]))
  const { nodeWidth, nodeHeight } = DIAGRAM
  const label = (title: string) => (title.length > 18 ? `${title.slice(0, 17)}\u2026` : title)
  return (
    <section aria-labelledby="planner-diagram-heading">
      <h2 id="planner-diagram-heading">{t('planner.diagram')}</h2>
      <div style={{ overflowX: 'auto' }}>
        <svg role="img" aria-label={t('planner.diagramLabel', { count: String(nodes.length) })} width={width} height={height + 2} viewBox={`0 0 ${width} ${height + 2}`} style={{ maxWidth: 'none' }}>
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
              <title>{`${n.title}: ${statusLabel(n.status)}`}</title>
              <rect x={n.x} y={n.y} width={nodeWidth} height={nodeHeight} rx={6} fill="none" stroke="currentColor" strokeWidth={n.status === 'idea' ? 1 : 2.5} strokeDasharray={n.status === 'idea' ? '4 3' : undefined} />
              <text x={n.x + nodeWidth / 2} y={n.y + nodeHeight / 2 - 3} textAnchor="middle" fontSize={12} fill="currentColor">{label(n.title)}</text>
              <text x={n.x + nodeWidth / 2} y={n.y + nodeHeight / 2 + 11} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.7}>{statusLabel(n.status)}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  )
}
