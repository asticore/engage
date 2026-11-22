'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { goalChoices, suggestTests, type AbIdea } from '@/features/abTesting/suggestions'
import type { SectionNode } from '@/lib/sectionTree'

type Test = { id: number; name: string; status: string; variants: Array<{ key: string; label: string; weight?: number; isControl: boolean; templateId: number | null }> }

/**
 * "A/B tests" under the Checks list: ideas for this page, a form to turn one into a draft section test (the section is
 * copied into a template that becomes variant B), and the page's tests with Edit variant, Start, Stop and Results.
 * Editing a variant opens its template in this same editor.
 */
export const AbIdeasPanel: React.FC<{ tree: SectionNode[]; pageId: number }> = ({ tree, pageId }) => {
  const ideas = useMemo(() => suggestTests(tree), [tree])
  const [tests, setTests] = useState<Test[]>([])
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
            const variant = t.variants.find((v) => !v.isControl)
            return (
              <li key={t.id} className="ve-checks__item">
                <strong>{t.name}</strong> <span>({t.status})</span>{' '}
                {variant?.templateId ? <a href={editHref(variant.templateId)}>Edit variant</a> : null}{' '}
                {t.status !== 'running' ? <button type="button" className="ve-btn" disabled={busy} onClick={() => void post({ action: 'start', testId: t.id })}>Start</button> : <button type="button" className="ve-btn" disabled={busy} onClick={() => void post({ action: 'stop', testId: t.id })}>Stop</button>}{' '}
                <a href={resultsHref(t.id)}>Open</a>
                {variant && t.status !== 'running' ? (
                  <label className="ve-checks__none" style={{ display: 'block' }}>
                    Variant gets {variant.weight || 50}% of visitors
                    <input type="range" min={5} max={95} step={5} defaultValue={variant.weight || 50} disabled={busy} onMouseUp={(e) => void post({ action: 'split', testId: t.id, weightB: Number((e.target as HTMLInputElement).value) })} onTouchEnd={(e) => void post({ action: 'split', testId: t.id, weightB: Number((e.target as HTMLInputElement).value) })} onKeyUp={(e) => void post({ action: 'split', testId: t.id, weightB: Number((e.target as HTMLInputElement).value) })} />
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
      {open ? (
        <form
          className="ve-checks__item"
          onSubmit={(e) => {
            e.preventDefault()
            const chosen = choices.find((c) => c.id === picked)
            void post({ action: 'create', pageId, blockId: open.sectionId, name, weightB, goal: chosen ? chosen.goal : goalType === 'page-visited' ? { type: goalType, path: goalValue } : { type: goalType, selector: goalValue } }).then((ok) => { if (ok) setOpen(null) })
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
          <p>This copies the section as Variant B. Edit it, then press Start. Nothing is split until then.</p>
          <button type="submit" className="ve-btn" disabled={busy || !open.sectionId}>Create draft test</button>{' '}
          <button type="button" className="ve-btn" onClick={() => setOpen(null)}>Cancel</button>
        </form>
      ) : null}
    </details>
  )
}
