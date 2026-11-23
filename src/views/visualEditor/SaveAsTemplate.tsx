'use client'

import React, { useEffect, useState } from 'react'

import { makeParametric, PARAM_TYPES, PARAMS_ELEMENT, type ParamRow, type ParamType } from '@/lib/sectionParams'
import type { SectionNode } from '@/lib/sectionTree'

import { TEMPLATES_CHANGED_EVENT } from './TemplateBrowser'
import { TEMPLATE_CATEGORY_OPTIONS, type TemplateKind } from './templatePresets'
import { stripEditorIds } from './treeOps'

/**
 * The "Save as template" dialog: stores the whole page, or the selected top-level section, as a Page Template
 * (kind + category) so it shows up under "My templates" in the Templates tab. Editor ids and section locks are
 * not copied: the saved copy gets fresh ids whenever it is inserted.
 *
 * "Reusable section with inputs" (Task 13 / 32c) saves the selection as a reusable section instead: each input row
 * names a text, link, image, colour, number or choice that is in the section now, and every place that exact value
 * appears becomes {{param:key}}. Each use then sets its own values; a layout change in the source updates every use.
 */
export const SaveAsTemplateDialog: React.FC<{
  pageBlocks: SectionNode[]
  /** The selected top-level section, when there is one. */
  selectedSection?: SectionNode
  defaultName?: string
  onClose: () => void
  onSaved: () => void
}> = ({ pageBlocks, selectedSection, defaultName, onClose, onSaved }) => {
  const [scope, setScope] = useState<'section' | 'page'>(selectedSection ? 'section' : 'page')
  const [kind, setKind] = useState<TemplateKind>(selectedSection ? 'section' : 'page')
  const [name, setName] = useState(defaultName || '')
  const [category, setCategory] = useState<string>('other')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asReusable, setAsReusable] = useState(false)
  const [rows, setRows] = useState<ParamRow[]>([{ key: '', label: '', type: 'text', find: '' }])
  const setRow = (i: number, patch: Partial<ParamRow>) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  // Escape closes the dialog, like the other editor dialogs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const chooseScope = (next: 'section' | 'page') => {
    setScope(next)
    setKind(next)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the example a name.')
      return
    }
    const source = scope === 'section' && selectedSection ? [selectedSection] : pageBlocks
    if (source.length === 0) {
      setError('There is nothing on the page to save yet.')
      return
    }
    let endpoint = '/api/page-templates'
    let payload: Record<string, unknown> = { name: trimmed, kind, category, blocks: stripEditorIds(source) }
    if (asReusable) {
      const used = rows.filter((r) => r.key.trim() !== '')
      if (used.length === 0) {
        setError('Add at least one input, or untick the reusable section option.')
        return
      }
      const made = makeParametric(stripEditorIds(source), used)
      if (made.decls.length === 0) {
        setError('Each input needs a key of lower case letters, digits and _, starting with a letter.')
        return
      }
      const missing = made.decls.filter((d) => !made.replaced[d.key])
      if (missing.length > 0 && used.some((r) => r.find?.trim())) {
        setError(`Not found in the section: ${missing.map((d) => d.label).join(', ')}. Type the value exactly as it is in the section.`)
        return
      }
      endpoint = '/api/reusable-sections'
      payload = {
        name: trimmed,
        description: 'Reusable section with inputs',
        blocks: [{ blockType: 'element', elementType: PARAMS_ELEMENT, props: { params: made.decls } }, ...(made.blocks as SectionNode[])],
      }
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 401 || res.status === 403) throw new Error('You do not have permission to save examples.')
      if (!res.ok) {
        const json = (await res.json().catch((): null => null)) as { errors?: Array<{ message?: string }> } | null
        throw new Error(json?.errors?.[0]?.message || `The example could not be saved (${res.status}).`)
      }
      window.dispatchEvent(new CustomEvent(TEMPLATES_CHANGED_EVENT))
      onSaved()
    } catch (err) {
      setError((err as Error)?.message || 'The example could not be saved.')
      setBusy(false)
    }
  }

  return (
    <div className="ve-modal-overlay" role="presentation" onClick={onClose}>
      <div className="ve-modal ve-tpl-dialog" role="dialog" aria-modal="true" aria-labelledby="ve-tpl-dialog-title" onClick={(e) => e.stopPropagation()}>
        <div className="ve-modal__header">
          <strong id="ve-tpl-dialog-title">Save as example</strong>
          <button type="button" className="ve-btn ve-btn--ghost ve-btn--icon" aria-label="Close" onClick={onClose}>
            x
          </button>
        </div>
        <form className="ve-modal__body ve-tpl-dialog__form" onSubmit={submit}>
          {selectedSection && (
            <label>
              What to save
              <select value={scope} onChange={(e) => chooseScope(e.target.value as 'section' | 'page')}>
                <option value="section">The selected section</option>
                <option value="page">The whole page</option>
              </select>
            </label>
          )}
          <label>
            Name
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
          </label>
          <label>
            <input type="checkbox" checked={asReusable} onChange={(e) => setAsReusable(e.target.checked)} /> Save as a reusable section with inputs
          </label>
          {asReusable && (
            <fieldset className="ve-tpl-dialog__params">
              <legend>Inputs: a value in the section that each use can change</legend>
              {rows.map((row, i) => (
                <div key={i} className="ve-col-row__custom">
                  <input type="text" value={row.key} placeholder="key, e.g. price" aria-label={`Input ${i + 1} key`} maxLength={32} onChange={(e) => setRow(i, { key: e.target.value })} />
                  <input type="text" value={row.label ?? ''} placeholder="label" aria-label={`Input ${i + 1} label`} maxLength={60} onChange={(e) => setRow(i, { label: e.target.value })} />
                  <select value={row.type} aria-label={`Input ${i + 1} type`} onChange={(e) => setRow(i, { type: e.target.value as ParamType })}>
                    {PARAM_TYPES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <input type="text" value={row.find ?? ''} placeholder="value in the section now" aria-label={`Input ${i + 1} current value`} onChange={(e) => setRow(i, { find: e.target.value })} />
                  {row.type === 'choice' && <input type="text" value={row.choices ?? ''} placeholder="choices, comma separated" aria-label={`Input ${i + 1} choices`} onChange={(e) => setRow(i, { choices: e.target.value })} />}
                  <button type="button" className="ve-btn ve-btn--ghost" aria-label={`Remove input ${i + 1}`} onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}>
                    x
                  </button>
                </div>
              ))}
              {rows.length < 12 && (
                <button type="button" className="ve-btn" onClick={() => setRows((prev) => [...prev, { key: '', label: '', type: 'text', find: '' }])}>
                  Add input
                </button>
              )}
            </fieldset>
          )}
          <label>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value as TemplateKind)}>
              <option value="section">Section (dropped into a page)</option>
              <option value="page">Page (a whole layout)</option>
            </select>
          </label>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {TEMPLATE_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p className="ve-error" role="alert">
              {error}
            </p>
          )}
          <div className="ve-tpl-dialog__actions">
            <button type="button" className="ve-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="ve-btn ve-btn--primary" disabled={busy}>
              {busy ? 'Saving' : 'Save example'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
