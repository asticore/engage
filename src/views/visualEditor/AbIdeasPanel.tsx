'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { goalChoices, resultIdeas, suggestTests, type AbIdea, type PastTest } from '@/features/abTesting/suggestions'
import type { SectionNode } from '@/lib/sectionTree'

type Test = { id: number; name: string; status: string; scope?: string; outcome?: PastTest['outcome']; variants: Array<{ key: string; label: string; weight?: number; isControl: boolean; templateId: number | null; pageId?: number | null }> }

/**
 * "A/B tests" under the Checks list: ideas for this page, a form to turn one into a draft section test (the section is
 * copied into a template that becomes variant B), and the page's tests with Edit variant, Start, Stop and Results.
 * Editing a variant opens its template in this same editor.
 */
const WHOLE_PAGE_IDEA: AbIdea = { id: 'whole-page', kind: 'layout', sectionId: 'page', sectionIndex: 0, title: 'Whole page', reason: '', impact: '' }

/**
 * Shown while editing a variant (a section template or a copied page): says which test it belongs to and links back to the original page.
 */
export const AbVariantNotice: React.FC<{ templateId?: number; variantPageId?: number }> = ({ templateId, variantPageId }) => {
  const [info, setInfo] = useState<{ testName: string; label: string; pageId: number | null } | null>(null)
  useEffect(() => {
    const q = templateId ? `templateId=${templateId}` : `variantPageId=${variantPageId}`
    void fetch(`/api/admin-ab-quick?${q}`, { credentials: 'include' })
      .then((r): Promise<{ variantOf?: { testName: string; label: string; pageId: number | null } | null }> => (r.ok ? r.json() : Promise.resolve({})))
      .then((j) => setInfo(j.variantOf ?? null))
      .catch((): void => undefined)
  }, [templateId, variantPageId])
  if (!info?.pageId) return null
  const back = window.location.pathname.replace(/\/visual-editor\/collection\/[^/]+\/[^/]+/, `/visual-editor/collection/pages/${info.pageId}`)
  return (
    <p className="ve-checks__none">
      You are editing {info.label} of the test “{info.testName}”. <a href={back}>Back to the original page</a>
    </p>
  )
}

export const AbIdeasPanel: React.FC<{ tree: SectionNode[]; pageId: number }> = ({ tree, pageId }) => {
  const ideas = useMemo(() => suggestTests(tree), [tree])
  const [tests, setTests] = useState<Test[]>([])
  const fromResults = useMemo(() => resultIdeas(tests.map((t) => ({ name: t.name, status: t.status, outcome: t.outcome ?? null }))), [tests])
  const [error, setError] = useState('')
  const [open, setOpen] = useState<AbIdea | null>(null)
  const [name, setName] = useState('')
  const choices = useMemo(() => goalChoices(tree), [tree])
  const [goalType, setGoalType] = useState<'page-visited' | 'element-clicked'>('element-clicked')
  const [goalValue, setGoalValue] = useState('')
  const [picked, setPicked] = useState('')
  const [weightB, setWeightB] = useState(50)
  const [busy, setBusy] = useState(false)
  const [off, setOff] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin-ab-quick?pageId=${pageId}`, { credentials: 'include' })
    const body = (await res.json().catch(() => ({}))) as { tests?: Test[]; error?: string }
    if (res.status === 409 || res.status === 403 || res.status === 401) return setOff(true)
    if (res.ok) setTests(body.tests ?? [])
  }, [pageId])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (payload: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    setError('')
    const res = await fetch('/api/admin-ab-quick', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    setBusy(false)
    if (!res.ok) {
      setError(body.error ?? 'That did not work.')
      return false
    }
    await load()
    return true
  }

  if (off) return null
  const editHref = (templateId: number) => window.location.pathname.replace(/\/visual-editor\/collection\/[^/]+\/[^/]+/, `/visual-editor/collection/page-templates/${templateId}`)
  const editPageHref = (id: number) => window.location.pathname.replace(/\/visual-editor\/collection\/[^/]+\/[^/]+/, `/visual-editor/collection/pages/${id}`)
  const resultsHref = (id: number) => window.location.pathname.replace(/\/visual-editor\/.*$/, `/collections/ab-tests/${id}`)

  return (
    <details className="ve-checks">
      <summary className="ve-checks__summary">
        A/B tests
        <span className="ve-checks__badge">{tests.length}</span>
      </summary>
      {error ? <p role="alert" className="ve-checks__none">{error}</p> : null}
      {tests.length > 0 ? (
        <ul className="ve-checks__list">
          {tests.map((t) => {
            const variants = t.variants.filter((v) => !v.isControl)
            const share = Math.round(variants.reduce((sum, v) => sum + (v.weight || 0), 0))
            return (
              <li key={t.id} className="ve-checks__item">
                <strong>{t.name}</strong> <span>({t.status}{t.scope === 'page' ? ', whole page' : ''})</span>{' '}
                {variants.map((v) => {
                  const href = t.scope === 'page' ? (v.pageId ? editPageHref(v.pageId) : '') : v.templateId ? editHref(v.templateId) : ''
                  return href ? <span key={v.key}><a href={href}>Edit {v.label}</a>{' '}</span> : null
                })}
                {t.status !== 'running' ? <button type="button" className="ve-btn" disabled={busy} onClick={() => void post({ action: 'start', testId: t.id })}>Start</button> : <button type="button" className="ve-btn" disabled={busy} onClick={() => void post({ action: 'stop', testId: t.id })}>Stop</button>}{' '}
                {t.status !== 'running' && t.variants.length < 4 ? <button type="button" className="ve-btn" disabled={busy} onClick={() => void post({ action: 'addVariant', testId: t.id })}>Add a variant</button> : null}{' '}
                <a href={resultsHref(t.id)}>Open</a>
                {t.outcome ? <div>{t.outcome.visitors} visitors{t.outcome.winner ? `, ${t.outcome.winner} is winning` : t.outcome.leader ? `, ${t.outcome.leader} is ahead but it is not clear yet` : ''}</div> : null}
                {variants.length > 0 && t.status !== 'running' ? (
                  <label className="ve-checks__none" style={{ display: 'block' }}>
                    Variants share {share || 50}% of visitors
                    <input type="range" min={5} max={95} step={5} defaultValue={share || 50} disabled={busy} onMouseUp={(e) => void post({ action: 'split', testId: t.id, weightB: Number((e.target as HTMLInputElement).value) })} onTouchEnd={(e) => void post({ action: 'split', testId: t.id, weightB: Number((e.target as HTMLInputElement).value) })} onKeyUp={(e) => void post({ action: 'split', testId: t.id, weightB: Number((e.target as HTMLInputElement).value) })} />
                  </label>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      <p className="ve-checks__none">Ideas for this page</p>
      {ideas.length === 0 ? <p className="ve-checks__none">Nothing obvious to test yet. Add a heading and a button first.</p> : (
        <ul className="ve-checks__list">
          {ideas.map((idea) => (
            <li key={idea.id} className="ve-checks__item">
              <strong>{idea.title}</strong>
              <div>{idea.reason}</div>
              <div><em>{idea.impact}</em></div>
              <button type="button" className="ve-btn" onClick={() => { setOpen(idea); setName(idea.title.replace(/[“”]/g, '"').slice(0, 100)); setGoalValue(''); setPicked(''); setWeightB(50) }}>Create test</button>
            </li>
          ))}
        </ul>
      )}
      {fromResults.length > 0 ? (
        <>
          <p className="ve-checks__none">From your past results</p>
          <ul className="ve-checks__list">
            {fromResults.map((idea) => (
              <li key={idea.id} className="ve-checks__item">
                <strong>{idea.title}</strong>
                <div>{idea.reason}</div>
                <div><em>{idea.impact}</em></div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="ve-checks__none">
        <button type="button" className="ve-btn" onClick={() => { setOpen(WHOLE_PAGE_IDEA); setName('Whole page test'); setGoalValue(''); setPicked(''); setWeightB(50) }}>Test the whole page</button>
      </p>
      {open ? (
        <form
          className="ve-checks__item"
          onSubmit={(e) => {
            e.preventDefault()
            const chosen = choices.find((c) => c.id === picked)
            void post({ action: 'create', pageId, blockId: open.sectionId, ...(open.id === 'whole-page' ? { scope: 'page' } : {}), name, weightB, goal: chosen ? chosen.goal : goalType === 'page-visited' ? { type: goalType, path: goalValue } : { type: goalType, selector: goalValue } }).then((ok) => { if (ok) setOpen(null) })
          }}
        >
          <label>Name <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
          {choices.length > 0 ? (
            <label>Pick a win from this page
              <select value={picked} onChange={(e) => setPicked(e.target.value)}>
                <option value="">Type one myself</option>
                {choices.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
          ) : null}
          {picked ? null : <label>What counts as a win
            <select value={goalType} onChange={(e) => setGoalType(e.target.value as typeof goalType)}>
              <option value="element-clicked">A button or link is clicked</option>
              <option value="page-visited">A page is visited</option>
            </select>
          </label>}
          {picked ? null : <label>{goalType === 'page-visited' ? 'Page path (for example /thank-you)' : 'Button selector (for example .hero .btn)'}
            <input value={goalValue} onChange={(e) => setGoalValue(e.target.value)} />
          </label>}
          <label>Variant B gets {weightB}% of visitors (the original gets {100 - weightB}%)
            <input type="range" min={5} max={95} step={5} value={weightB} onChange={(e) => setWeightB(Number(e.target.value))} />
          </label>
          {open.sectionId ? null : <p role="alert">Save the page first so this section has an id.</p>}
          <p>{open.id === 'whole-page' ? 'This copies the whole page as a draft page for Variant B (it is never published on its own). Edit it, then press Start. Nothing is split until then.' : 'This copies the section as Variant B. Edit it, then press Start. Nothing is split until then.'}</p>
          <button type="submit" className="ve-btn" disabled={busy || !open.sectionId}>Create draft test</button>{' '}
          <button type="button" className="ve-btn" onClick={() => setOpen(null)}>Cancel</button>
        </form>
      ) : null}
    </details>
  )
}
