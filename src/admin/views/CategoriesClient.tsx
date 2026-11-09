'use client'

import { useCallback, useState } from 'react'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import type { UiStringKey } from '@/features/uiStrings'
import { flattenTree, descendantIds, type CategoryRow, type CategoryScope } from '@/features/categories/tree'

type Props = {
  initial: Record<CategoryScope, CategoryRow[]>
  products: { id: number; title: string }[]
  shopEnabled: boolean
  blogEnabled: boolean
}

const ERRORS: Record<string, UiStringKey> = { cycle: 'cat.error.cycle', 'too-deep': 'cat.error.tooDeep', name: 'cat.error.name', missing: 'cat.error.missing' }

/** The category tree editor. Every change posts to /api/admin-categories, then the tree is re-read. */
export function CategoriesClient({ initial, products, shopEnabled, blogEnabled }: Props) {
  const t = useAdminT()
  const [scope, setScope] = useState<CategoryScope>(shopEnabled || !blogEnabled ? 'shop' : 'blog')
  const [rows, setRows] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [newParent, setNewParent] = useState('')
  const [renaming, setRenaming] = useState<{ id: number; name: string; slug: string } | null>(null)
  const [assign, setAssign] = useState<{ id: number; ids: number[] } | null>(null)

  const current = rows[scope]
  const flat = flattenTree(current)

  const reload = useCallback(async (s: CategoryScope) => {
    const res = await fetch(`/api/admin-categories?scope=${s}`)
    const data = (await res.json().catch(() => ({}))) as { rows?: CategoryRow[] }
    if (data.rows) setRows((prev) => ({ ...prev, [s]: data.rows as CategoryRow[] }))
  }, [])

  const send = async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, ...body }) })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(t(ERRORS[data.error ?? ''] ?? 'cat.error.generic'))
        return false
      }
      await reload(scope)
      return true
    } catch {
      setError(t('cat.error.generic'))
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    if (await send({ action: 'add', name: newName, parentId: newParent ? Number(newParent) : null })) setNewName('')
  }

  const openAssign = async (id: number) => {
    const res = await fetch(`/api/admin-categories?scope=shop&links=${id}`)
    const data = (await res.json().catch(() => ({}))) as { ids?: number[] }
    setAssign({ id, ids: data.ids ?? [] })
  }

  return (
    <div className="list-view">
      <div className="list-header">
        <h1>{t('cat.title')}</h1>
      </div>
      <p className="doc-muted">{t('cat.intro')}</p>
      <div className="list-toolbar" role="tablist" aria-label={t('cat.scope')}>
        {(['shop', 'blog'] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={scope === s} className="list-toolbar-btn" onClick={() => { setScope(s); setRenaming(null); setAssign(null); setError(null) }}>
            {t(s === 'shop' ? 'cat.scope.shop' : 'cat.scope.blog')}
          </button>
        ))}
      </div>
      {scope === 'blog' && <p className="doc-muted">{t('cat.blogNote')}</p>}
      {error && <p role="alert" className="doc-muted">{error}</p>}

      <form onSubmit={add} className="list-toolbar" aria-label={t('cat.add')}>
        <label htmlFor="cat-new-name">{t('cat.name')}</label>{' '}
        <input id="cat-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={120} required />{' '}
        <label htmlFor="cat-new-parent">{t('cat.parent')}</label>{' '}
        <select id="cat-new-parent" value={newParent} onChange={(e) => setNewParent(e.target.value)}>
          <option value="">{t('cat.topLevel')}</option>
          {flat.map((n) => <option key={n.id} value={n.id}>{'- '.repeat(n.depth)}{n.name}</option>)}
        </select>{' '}
        <button type="submit" className="list-toolbar-btn" disabled={busy}>{t('cat.add')}</button>
      </form>

      {flat.length === 0 ? (
        <p role="status">{t('cat.empty')}</p>
      ) : (
        <div className="lst-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="lst-table">
            <thead>
              <tr>
                <th scope="col">{t('cat.name')}</th>
                <th scope="col">{t('cat.slug')}</th>
                <th scope="col">{t('cat.move')}</th>
                <th scope="col">{t('cat.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {flat.map((node) => {
                const blocked = new Set(descendantIds(current, node.id))
                return (
                  <tr key={node.id}>
                    <td style={{ paddingInlineStart: `${node.depth * 1.5 + 0.5}rem` }}>
                      {renaming?.id === node.id ? (
                        <>
                          <input aria-label={t('cat.name')} value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} maxLength={120} />{' '}
                          <input aria-label={t('cat.slug')} value={renaming.slug} onChange={(e) => setRenaming({ ...renaming, slug: e.target.value })} maxLength={120} />{' '}
                          <button type="button" className="list-toolbar-btn" disabled={busy} onClick={async () => { if (await send({ action: 'rename', id: node.id, name: renaming.name, slug: renaming.slug })) setRenaming(null) }}>{t('cat.save')}</button>
                        </>
                      ) : node.name}
                    </td>
                    <td><code>{node.slug}</code></td>
                    <td>
                      <select aria-label={`${t('cat.move')}: ${node.name}`} value={node.parentId ?? ''} disabled={busy} onChange={(e) => send({ action: 'move', id: node.id, parentId: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">{t('cat.topLevel')}</option>
                        {flat.filter((n) => !blocked.has(n.id)).map((n) => <option key={n.id} value={n.id}>{'- '.repeat(n.depth)}{n.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <button type="button" className="list-toolbar-btn" disabled={busy} onClick={() => send({ action: 'reorder', id: node.id, direction: 'up' })} aria-label={`${t('cat.up')}: ${node.name}`}>{t('cat.up')}</button>{' '}
                      <button type="button" className="list-toolbar-btn" disabled={busy} onClick={() => send({ action: 'reorder', id: node.id, direction: 'down' })} aria-label={`${t('cat.down')}: ${node.name}`}>{t('cat.down')}</button>{' '}
                      <button type="button" className="list-toolbar-btn" onClick={() => setRenaming({ id: node.id, name: node.name, slug: node.slug })}>{t('cat.rename')}</button>{' '}
                      {scope === 'shop' && products.length > 0 && <><button type="button" className="list-toolbar-btn" onClick={() => openAssign(node.id)}>{t('cat.products')}</button>{' '}</>}
                      <button type="button" className="list-toolbar-btn" disabled={busy} onClick={() => { if (window.confirm(t('cat.confirmDelete'))) void send({ action: 'delete', id: node.id }) }}>{t('cat.delete')}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {assign && scope === 'shop' && (
        <fieldset>
          <legend>{t('cat.productsIn')}</legend>
          <p className="doc-muted">{t('cat.productsHint')}</p>
          <div style={{ maxHeight: '18rem', overflowY: 'auto' }}>
            {products.map((p) => (
              <label key={p.id} style={{ display: 'block' }}>
                <input type="checkbox" checked={assign.ids.includes(p.id)} onChange={(e) => setAssign({ ...assign, ids: e.target.checked ? [...assign.ids, p.id] : assign.ids.filter((n) => n !== p.id) })} /> {p.title}
              </label>
            ))}
          </div>
          <button type="button" className="list-toolbar-btn" disabled={busy} onClick={async () => { if (await send({ action: 'links', id: assign.id, docIds: assign.ids })) setAssign(null) }}>{t('cat.save')}</button>{' '}
          <button type="button" className="list-toolbar-btn" onClick={() => setAssign(null)}>{t('cat.cancel')}</button>
        </fieldset>
      )}
    </div>
  )
}
