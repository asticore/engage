'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { suggestTests, type AbIdea } from '@/features/abTesting/suggestions'
import type { SectionNode } from '@/lib/sectionTree'

type Test = { id: number; name: string; status: string; variants: Array<{ key: string; label: string; isControl: boolean; templateId: number | null }> }

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
  const [goalType, setGoalType] = useState<'page-visited' | 'element-clicked'>('element-clicked')
  const [goalValue, setGoalValue] = useState('')
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
              <button type="button" className="ve-btn" onClick={() => { setOpen(idea); setName(idea.title.replace(/[“”]/g, '"').slice(0, 100)); setGoalValue('') }}>Create test</button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form
          className="ve-checks__item"
          onSubmit={(e) => {
            e.preventDefault()
            void post({ action: 'create', pageId, blockId: open.sectionId, name, goal: goalType === 'page-visited' ? { type: goalType, path: goalValue } : { type: goalType, selector: goalValue } }).then((ok) => { if (ok) setOpen(null) })
          }}
        >
          <label>Name <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
          <label>What counts as a win
            <select value={goalType} onChange={(e) => setGoalType(e.target.value as typeof goalType)}>
              <option value="element-clicked">A button or link is clicked</option>
              <option value="page-visited">A page is visited</option>
            </select>
          </label>
          <label>{goalType === 'page-visited' ? 'Page path (for example /thank-you)' : 'Button selector (for example .hero .btn)'}
            <input value={goalValue} onChange={(e) => setGoalValue(e.target.value)} />
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
