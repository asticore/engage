'use client'

import React, { useState } from 'react'

import { useAdminHref } from '@/admin/adminRoute/AdminRouteProvider'
import { siteTemplateEditorPath, templateButtonClass } from '@/features/siteTemplates/admin/NewTemplate'
import type { Entry } from '../entryPoints'

/**
 * Buttons that open the header, footer, blog, shop, product, event, search and 404 templates in the visual builder.
 * A kind with no template yet creates a switched-off draft from its starter first, so the button always lands in the editor.
 */
export const TemplateEntryButtons: React.FC<{ entries: Entry[] }> = ({ entries }) => {
  const adminHref = useAdminHref()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const open = async (entry: Entry) => {
    if (entry.id !== null) {
      window.location.assign(adminHref(siteTemplateEditorPath(entry.id)))
      return
    }
    setBusy(entry.kind)
    setError('')
    try {
      const list = (await fetch('/api/admin-template-starters', { credentials: 'include' }).then((r) => r.json()).catch(() => ({}))) as { starters?: Array<{ id: string; kind: string }> }
      const starter = (list.starters ?? []).find((s) => s.kind === entry.kind)
      const res = await fetch('/api/admin-template-starters', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(starter ? { starterId: starter.id } : { kind: entry.kind }) })
      const data = (await res.json().catch(() => ({}))) as { id?: number | string; editorUrl?: string; error?: string }
      if (!res.ok || data.id === undefined) throw new Error(data.error || 'Could not create the template.')
      window.location.assign(data.editorUrl ?? adminHref(siteTemplateEditorPath(data.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the template.')
      setBusy(null)
    }
  }

  return (
    <section aria-label="Edit templates in the visual builder" style={{ margin: '0 0 12px' }}>
      <strong style={{ fontSize: 13 }}>Edit in the visual builder</strong>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {entries.map((entry) => (
          <button key={entry.kind} type="button" className={templateButtonClass} disabled={busy !== null} onClick={() => void open(entry)} title={entry.id === null ? 'No template yet: a draft is made from a starter' : entry.inUse ? 'Opens the template in use' : 'This template is switched off'}>
            {busy === entry.kind ? 'Creating...' : `${entry.label}${entry.id === null ? ' (create)' : ''}`}
          </button>
        ))}
      </div>
      {error ? <p role="alert" style={{ color: '#b91c1c', margin: '6px 0 0', fontSize: 13 }}>{error}</p> : null}
    </section>
  )
}

export default TemplateEntryButtons
