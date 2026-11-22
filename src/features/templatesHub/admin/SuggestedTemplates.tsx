'use client'

import React, { useState } from 'react'

import { NewTemplate, siteTemplateEditorPath, templateButtonClass } from '@/features/siteTemplates/admin/NewTemplate'
import { TemplateImport } from '@/features/siteTemplates/admin/TemplateImport'
import { useAdminHref } from '@/admin/adminRoute/AdminRouteProvider'
import { KIND_LABELS, type SiteTemplateKind } from '@/features/siteTemplates/kinds'

export type SuggestionWarning = {
  code: 'missing' | 'partial' | 'overlap'
  kind: SiteTemplateKind
  message: string
}

const panel = 'rounded-[6px] border border-[var(--theme-elevation-150,#cac7d1)] p-[12px]'

/**
 * "Suggested missing" under the hub table. Missing kinds get a Create button that opens the
 * New template flow (starter or Blank) with the type preselected. Partial and overlap notes are
 * listed as text only: they need a judgement about which template to change.
 */
export const SuggestedTemplates: React.FC<{ warnings: SuggestionWarning[]; showCoverageOk: boolean }> = ({ warnings, showCoverageOk }) => {
  const [creating, setCreating] = useState<SiteTemplateKind | null>(null)
  const [oneClick, setOneClick] = useState<SiteTemplateKind | null>(null)
  const [error, setError] = useState('')
  const adminHref = useAdminHref()

  /** One click: the first starter for the type (or a blank template when there is none), then the visual builder. */
  const createNow = async (kind: SiteTemplateKind) => {
    setOneClick(kind)
    setError('')
    try {
      type StarterList = { starters?: Array<{ id: string; kind: string }> }
      const list: StarterList = await fetch('/api/admin-template-starters', { credentials: 'include' })
        .then((r): Promise<StarterList> | StarterList => (r.ok ? (r.json() as Promise<StarterList>) : {}))
        .catch((): StarterList => ({}))
      const starter = (list.starters ?? []).find((item) => item.kind === kind)
      const res = await fetch('/api/admin-template-starters', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(starter ? { starterId: starter.id } : { kind }),
      })
      const data = (await res.json().catch(() => ({}))) as { id?: number | string; editorUrl?: string; error?: string }
      if (!res.ok || data.id === undefined) throw new Error(data.error || 'Could not create the template.')
      window.location.assign(data.editorUrl ?? adminHref(siteTemplateEditorPath(data.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the template.')
      setOneClick(null)
    }
  }
  const missing = warnings.filter((w) => w.code === 'missing')
  const notes = warnings.filter((w) => w.code !== 'missing')

  return (
    <section aria-label="Suggested missing" className={panel} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <strong>Suggested missing</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button type="button" className={templateButtonClass} onClick={() => setCreating(creating ?? 'header')}>
            New site template
          </button>
          <TemplateImport />
        </div>
      </div>

      {creating ? <NewTemplate key={creating} initialKind={creating} onClose={() => setCreating(null)} /> : null}

      {missing.length === 0 && notes.length === 0 && showCoverageOk ? (
        <p style={{ margin: 0, fontSize: 13 }}>Every site template type has a template in use, and none overlap.</p>
      ) : null}

      {missing.length > 0 ? (
        <ul aria-label="Missing site templates" style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          {missing.map((w) => (
            <li key={w.kind} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span>{w.message}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button type="button" className={templateButtonClass} disabled={oneClick !== null} onClick={() => void createNow(w.kind)} aria-label={`Create ${KIND_LABELS[w.kind]} template now`}>
                  {oneClick === w.kind ? 'Creating...' : 'Create now'}
                </button>
                <button type="button" className={templateButtonClass} onClick={() => setCreating(w.kind)} aria-label={`Create ${KIND_LABELS[w.kind]} template`}>
                  Choose starter
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p role="alert" style={{ color: '#b91c1c', margin: 0, fontSize: 13 }}>{error}</p> : null}

      {notes.length > 0 ? (
        <ul aria-label="Other coverage notes" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          {notes.map((w, i) => (
            <li key={`${w.code}-${w.kind}-${i}`}>{w.message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export default SuggestedTemplates
