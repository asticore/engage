'use client'

import React, { useEffect, useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { usePortalText } from '@/features/accounts/components/PortalText'

import {
  apiKeyScopeChoicesAction,
  assignApiCategoryAction,
  deleteApiCategoryAction,
  saveApiCategoryAction,
  unassignApiCategoryAction,
  type CategoryActionResult,
  type CategoryView,
} from '../actions'
import type { ScopeCollection } from '../core'
import { buildScopes, type ScopeMode } from '../scopePicker'

/**
 * Admin screen block: access categories. Each category holds the scopes its people may use, a rate limit
 * per key and a cap on keys, and lists who is in it (people by email, customer organisations by id).
 * The scope picker is the same one the key form uses.
 */

type Draft = { id?: number; name: string; description: string; mode: ScopeMode; picked: Record<string, { read: boolean; write: boolean }>; ratePerMinute: string; maxKeys: string }

const emptyDraft = (): Draft => ({ name: '', description: '', mode: 'read-all', picked: {}, ratePerMinute: '120', maxKeys: '5' })

/** Turns a stored scope list back into the picker's state. */
function draftFrom(c: CategoryView): Draft {
  const scopes = c.scopes
  let mode: ScopeMode = 'custom'
  const picked: Draft['picked'] = {}
  if (scopes.length === 1 && (scopes[0] === '*' || scopes[0] === '*:*')) mode = 'all'
  else if (scopes.length === 1 && (scopes[0] === '*:read' || scopes[0] === 'read')) mode = 'read-all'
  else {
    for (const scope of scopes) {
      const [collection, action] = scope.split(':')
      if (!collection || collection === '*') continue
      const row = picked[collection] ?? { read: false, write: false }
      if (action === 'read' || action === '*') row.read = true
      if (action === 'write' || action === '*') row.write = true
      picked[collection] = row
    }
  }
  return { id: c.id, name: c.name, description: c.description, mode, picked, ratePerMinute: String(c.ratePerMinute), maxKeys: String(c.maxKeys) }
}

export const ApiCategoriesPanel: React.FC<{ initial: CategoryView[] }> = ({ initial }) => {
  const t = useAdminT()
  const tx = usePortalText()
  const [categories, setCategories] = useState<CategoryView[]>(initial)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [collections, setCollections] = useState<ScopeCollection[]>([])
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [person, setPerson] = useState<Record<number, string>>({})
  const [org, setOrg] = useState<Record<number, string>>({})

  useEffect(() => {
    let cancelled = false
    apiKeyScopeChoicesAction()
      .then((list) => {
        if (!cancelled) setCollections(list)
      })
      .catch((): undefined => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const apply = (result: CategoryActionResult, okText: string): boolean => {
    if (result.ok && result.categories) {
      setCategories(result.categories)
      setNotice({ tone: 'ok', text: okText })
      return true
    }
    setNotice({ tone: 'error', text: result.error ?? t('apiKeys.cat.failed') })
    return false
  }

  const save = async () => {
    if (!draft) return
    setBusy(true)
    const result = await saveApiCategoryAction({
      id: draft.id,
      name: draft.name,
      description: draft.description,
      scopes: buildScopes(draft.mode, draft.picked),
      ratePerMinute: draft.ratePerMinute,
      maxKeys: draft.maxKeys,
    })
    setBusy(false)
    if (apply(result, t('apiKeys.cat.saved'))) setDraft(null)
  }

  const remove = async (c: CategoryView) => {
    if (!window.confirm(t('apiKeys.cat.deleteConfirm'))) return
    setBusy(true)
    apply(await deleteApiCategoryAction(c.id), t('apiKeys.cat.deleted'))
    setBusy(false)
  }

  const add = async (c: CategoryView, subjectType: 'user' | 'organization') => {
    const value = (subjectType === 'user' ? person[c.id] : org[c.id])?.trim()
    if (!value) return
    setBusy(true)
    const ok = apply(await assignApiCategoryAction({ categoryId: c.id, subjectType, subject: value }), t('apiKeys.cat.saved'))
    setBusy(false)
    if (ok) (subjectType === 'user' ? setPerson : setOrg)((prev) => ({ ...prev, [c.id]: '' }))
  }

  const unassign = async (memberId: number) => {
    setBusy(true)
    apply(await unassignApiCategoryAction(memberId), t('apiKeys.cat.saved'))
    setBusy(false)
  }

  const scopes = draft ? buildScopes(draft.mode, draft.picked) : []

  return (
    <section className="api-categories" style={{ display: 'grid', gap: '0.75rem' }}>
      <h2>{t('apiKeys.cat.heading')}</h2>
      <p>{t('apiKeys.cat.intro')}</p>
      {notice && (
        <p role="status" style={notice.tone === 'error' ? { color: 'var(--theme-error-500, #b00020)' } : undefined}>
          {notice.text}
        </p>
      )}

      {categories.length === 0 && !draft && <p>{t('apiKeys.cat.none')}</p>}

      {categories.map((c) => (
        <div key={c.id} style={{ border: '1px solid var(--theme-elevation-150, #ddd)', padding: '0.75rem', display: 'grid', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <strong>{c.name}</strong>
            <span>{t('apiKeys.cat.summary', { rate: String(c.ratePerMinute), keys: String(c.maxKeys) })}</span>
            <code>{c.scopes.join(', ')}</code>
            <button type="button" disabled={busy} onClick={() => setDraft(draftFrom(c))}>
              {t('apiKeys.cat.edit')}
            </button>
            <button type="button" disabled={busy} onClick={() => void remove(c)}>
              {t('apiKeys.cat.delete')}
            </button>
          </div>
          {c.description && <small>{c.description}</small>}
          <strong>{t('apiKeys.cat.members')}</strong>
          {c.members.length === 0 ? (
            <small>{t('apiKeys.cat.noMembers')}</small>
          ) : (
            <ul style={{ margin: 0 }}>
              {c.members.map((m) => (
                <li key={m.id}>
                  {m.subjectType === 'user' ? t('apiKeys.cat.typePerson') : t('apiKeys.cat.typeOrg')}: {m.label}{' '}
                  <button type="button" disabled={busy} onClick={() => void unassign(m.id)}>
                    {t('apiKeys.cat.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label>
              {t('apiKeys.cat.addPerson')}{' '}
              <input type="email" value={person[c.id] ?? ''} onChange={(e) => setPerson((prev) => ({ ...prev, [c.id]: e.target.value }))} />
            </label>
            <button type="button" disabled={busy} onClick={() => void add(c, 'user')}>
              {t('apiKeys.cat.add')}
            </button>
            <label>
              {t('apiKeys.cat.addOrg')} <input value={org[c.id] ?? ''} onChange={(e) => setOrg((prev) => ({ ...prev, [c.id]: e.target.value }))} />
            </label>
            <button type="button" disabled={busy} onClick={() => void add(c, 'organization')}>
              {t('apiKeys.cat.add')}
            </button>
          </div>
        </div>
      ))}

      {!draft && (
        <div>
          <button type="button" onClick={() => setDraft(emptyDraft())}>
            {t('apiKeys.cat.new')}
          </button>
        </div>
      )}

      {draft && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          style={{ display: 'grid', gap: '0.5rem' }}
        >
          <label>
            {t('apiKeys.cat.name')} <input value={draft.name} maxLength={60} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label>
            {t('apiKeys.cat.description')} <input value={draft.description} maxLength={300} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label>
            {t('apiKeys.cat.rate')} <input type="number" min={1} max={6000} value={draft.ratePerMinute} onChange={(e) => setDraft({ ...draft, ratePerMinute: e.target.value })} />
          </label>
          <label>
            {t('apiKeys.cat.maxKeys')} <input type="number" min={1} max={50} value={draft.maxKeys} onChange={(e) => setDraft({ ...draft, maxKeys: e.target.value })} />
          </label>
          <fieldset className="api-scopes">
            <legend>{t('apiKeys.cat.scopes')}</legend>
            <label className="api-scopes__mode">
              <input type="radio" name="cat-scope-mode" checked={draft.mode === 'read-all'} onChange={() => setDraft({ ...draft, mode: 'read-all' })} /> {tx('panel.akReadAll')} (<code>*:read</code>)
            </label>
            <label className="api-scopes__mode">
              <input type="radio" name="cat-scope-mode" checked={draft.mode === 'all'} onChange={() => setDraft({ ...draft, mode: 'all' })} /> {tx('panel.akAll')} (<code>*</code>)
            </label>
            <label className="api-scopes__mode">
              <input type="radio" name="cat-scope-mode" checked={draft.mode === 'custom'} onChange={() => setDraft({ ...draft, mode: 'custom' })} /> {tx('panel.akPerCollection')}
            </label>
            {draft.mode === 'custom' && (
              <table className="api-scopes__table">
                <thead>
                  <tr>
                    <th>{tx('panel.akCollection')}</th>
                    <th>{tx('panel.akRead')}</th>
                    <th>{tx('panel.akWrite')}</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map((c) => (
                    <tr key={c.slug}>
                      <td>
                        {c.label} <code>{c.slug}</code>
                      </td>
                      {(['read', 'write'] as const).map((action) => (
                        <td key={action}>
                          <input
                            type="checkbox"
                            aria-label={`${c.slug}:${action}`}
                            checked={draft.picked[c.slug]?.[action] ?? false}
                            onChange={(e) =>
                              setDraft({ ...draft, picked: { ...draft.picked, [c.slug]: { read: draft.picked[c.slug]?.read ?? false, write: draft.picked[c.slug]?.write ?? false, [action]: e.target.checked } } })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="api-scopes__summary">{tx('panel.akSummary', { scopes: scopes.length === 0 ? tx('panel.akNoneChosen') : scopes.join(', ') })}</p>
          </fieldset>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={busy || scopes.length === 0}>
              {t('apiKeys.cat.save')}
            </button>
            <button type="button" onClick={() => setDraft(null)}>
              {t('apiKeys.cat.cancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
