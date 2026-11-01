'use client'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import type { UiStringKey } from '@/features/uiStrings'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { AuthorOption } from '../authors'
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from '@/features/ecommerce/lib/orderStatus'
import type { BulkAction, BulkCollection, BulkRowResult, CategoryMode } from '../bulk'
import './edit-screens.css'

export type BulkBarProps = {
  collection: BulkCollection
  /** The trash view lists trashed items only; its actions are Restore and Delete for good. */
  trashView: boolean
  canPublish: boolean
  canDelete: boolean
  canChangeAuthor: boolean
  /** Whether the user may edit the rows (status, tags, brand on the shop lists). */
  canUpdate: boolean
  /** Singular label for messages: "page", "post", "event", "product", "order". */
  noun: string
}

type NamedOption = { id: number; name: string }

type Choice = { value: BulkAction; labelKey: UiStringKey }

/** The actions offered, by view and permission. The server checks them again for the whole request and for every row. */
export function bulkChoices(props: Pick<BulkBarProps, 'collection' | 'trashView' | 'canPublish' | 'canDelete' | 'canChangeAuthor' | 'canUpdate'>): Choice[] {
  // Orders have no publish or trash: their only bulk action is the status.
  if (props.collection === 'orders') return props.canUpdate ? [{ value: 'setStatus', labelKey: 'bulk.action.setStatus' }] : []
  if (props.trashView) {
    const trashChoices: Choice[] = []
    if (props.canDelete) trashChoices.push({ value: 'restore', labelKey: 'bulk.action.restore' }, { value: 'delete', labelKey: 'trash.deletePermanently' })
    return trashChoices
  }
  const choices: Choice[] = []
  if (props.canPublish) choices.push({ value: 'publish', labelKey: 'common.publish' }, { value: 'unpublish', labelKey: 'edit.switchToDraft' })
  if (props.canDelete) choices.push({ value: 'trash', labelKey: 'edit.moveToTrash' })
  if (props.canChangeAuthor) choices.push({ value: 'changeAuthor', labelKey: 'bulk.action.changeAuthor' })
  if (props.collection === 'posts') choices.push({ value: 'changeCategory', labelKey: 'bulk.action.changeCategory' })
  if (props.collection === 'products' && props.canUpdate) {
    choices.push({ value: 'addTag', labelKey: 'bulk.action.addTag' }, { value: 'removeTag', labelKey: 'bulk.action.removeTag' }, { value: 'setBrand', labelKey: 'bulk.action.setBrand' })
  }
  return choices
}

const selectedBoxes = (): HTMLInputElement[] => Array.from(document.querySelectorAll<HTMLInputElement>('input[data-bulk-row]:checked'))

/**
 * Bulk actions above a list. The row checkboxes are plain inputs the list view
 * renders (`data-bulk-row`, one `data-bulk-all` in the header), so the table
 * itself stays a server component; this bar listens for changes to them.
 * Nothing runs until the user confirms; the result says how many rows changed
 * and lists each row that was refused with its reason.
 */
export function BulkActionsBar(props: BulkBarProps) {
  const t = useAdminT()
  const router = useRouter()
  const choices = bulkChoices(props)
  const [selected, setSelected] = useState<Array<{ id: number; label: string }>>([])
  const [action, setAction] = useState<BulkAction | ''>('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<{ message: string; failures: Array<{ label: string; error: string }> } | null>(null)
  const [authors, setAuthors] = useState<AuthorOption[] | null>(null)
  const [author, setAuthor] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [categoryMode, setCategoryMode] = useState<CategoryMode>('add')
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [tagOptions, setTagOptions] = useState<NamedOption[] | null>(null)
  const [brandOptions, setBrandOptions] = useState<NamedOption[] | null>(null)
  const [tagId, setTagId] = useState('')
  // '0' means "no brand"; a real brand id is a number as text.
  const [brandId, setBrandId] = useState('')

  useEffect(() => {
    const sync = (event: Event) => {
      const target = event.target as HTMLInputElement | null
      if (!target || target.tagName !== 'INPUT') return
      if (target.hasAttribute('data-bulk-all')) {
        for (const box of document.querySelectorAll<HTMLInputElement>('input[data-bulk-row]')) box.checked = target.checked
      } else if (!target.hasAttribute('data-bulk-row')) {
        return
      }
      setSelected(selectedBoxes().map((box) => ({ id: Number(box.value), label: box.getAttribute('data-bulk-label') ?? `#${box.value}` })))
      setConfirming(false)
    }
    document.addEventListener('change', sync)
    return () => document.removeEventListener('change', sync)
  }, [])

  if (choices.length === 0) return null

  // Loads the choices for a tag or brand picker. A failure is shown in the bar, not thrown.
  function loadOptions(collection: 'product-tags' | 'product-brands', set: (rows: NamedOption[]) => void) {
    fetch(`/api/${collection}?limit=500&depth=0&sort=name`, { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('failed')
        return (await response.json()) as { docs: Array<{ id: number; name?: string }> }
      })
      .then((body) => set(body.docs.map((doc) => ({ id: doc.id, name: doc.name ?? `#${doc.id}` }))))
      .catch(() => setError(t('bulk.optionsLoadError')))
  }

  const choose = (next: BulkAction | '') => {
    setAction(next)
    setConfirming(false)
    setError(null)
    if ((next === 'addTag' || next === 'removeTag') && tagOptions === null) {
      loadOptions('product-tags', setTagOptions)
    }
    if (next === 'setBrand' && brandOptions === null) {
      loadOptions('product-brands', setBrandOptions)
    }
    if (next === 'changeAuthor' && authors === null) {
      fetch(`/api/admin-authors?collection=${props.collection}`, { credentials: 'same-origin' })
        .then(async (response) => {
          if (!response.ok) throw new Error('forbidden')
          return (await response.json()) as { authors: AuthorOption[] }
        })
        .then((body) => setAuthors(body.authors))
        .catch(() => setError(t('bulk.authorsLoadError')))
    }
  }

  const chosen = choices.find((choice) => choice.value === action)
  const ready =
    selected.length > 0 &&
    action !== '' &&
    (action !== 'changeAuthor' || author !== '') &&
    (action !== 'changeCategory' || categoryName.trim() !== '') &&
    (action !== 'setStatus' || status !== '') &&
    ((action !== 'addTag' && action !== 'removeTag') || tagId !== '') &&
    (action !== 'setBrand' || brandId !== '')
  const tagName = tagOptions?.find((o) => String(o.id) === tagId)?.name ?? ''

  const count = selected.length
  const plural = selected.length === 1 ? props.noun : `${props.noun}s`
  const confirmText = (() => {
    switch (action) {
      case 'publish':
        return t('bulk.confirm.publish', { count, noun: plural })
      case 'unpublish':
        return t('bulk.confirm.unpublish', { count, noun: plural })
      case 'trash':
        return t('bulk.confirm.trash', { count, noun: plural })
      case 'restore':
        return t('bulk.confirm.restore', { count, noun: plural })
      case 'delete':
        return t('bulk.confirm.delete', { count, noun: plural })
      case 'changeAuthor':
        return t('bulk.confirm.changeAuthor', {
          count,
          noun: plural,
          name: authors?.find((a) => String(a.id) === author)?.name ?? t('bulk.chosenPerson'),
        })
      case 'changeCategory':
        return t('bulk.confirm.changeCategory', {
          verb: t(categoryMode === 'add' ? 'bulk.verb.add' : categoryMode === 'remove' ? 'bulk.verb.remove' : 'bulk.verb.replace'),
          name: categoryName.trim(),
          count,
          noun: plural,
        })
      case 'setStatus':
        return t('bulk.confirm.setStatus', { count, noun: plural, status: ORDER_STATUS_LABELS[status as OrderStatus] ?? status })
      case 'addTag':
      case 'removeTag':
        return t('bulk.confirm.tag', { verb: t(action === 'addTag' ? 'bulk.verb.add' : 'bulk.verb.remove'), name: tagName, count, noun: plural })
      case 'setBrand':
        return brandId === '0'
          ? t('bulk.confirm.clearBrand', { count, noun: plural })
          : t('bulk.confirm.setBrand', { count, noun: plural, name: brandOptions?.find((o) => String(o.id) === brandId)?.name ?? '' })
      default:
        return ''
    }
  })()

  const run = async () => {
    setBusy(true)
    setError(null)
    setReport(null)
    try {
      const body: Record<string, unknown> = { collection: props.collection, ids: selected.map((row) => row.id), action }
      if (action === 'changeAuthor') body.author = Number(author)
      if (action === 'changeCategory') body.category = { name: categoryName.trim(), mode: categoryMode }
      if (action === 'setStatus') body.status = status
      if (action === 'addTag' || action === 'removeTag') body.tag = Number(tagId)
      if (action === 'setBrand') body.brand = brandId === '0' ? null : Number(brandId)
      const response = await fetch('/api/admin-bulk', {
        body: JSON.stringify(body),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const data = (await response.json().catch((): null => null)) as { message?: string; error?: string; results?: BulkRowResult[] } | null
      if (!response.ok || !data) {
        setError(data?.error ?? t('bulk.changeFailed'))
        return
      }
      const labels = new Map(selected.map((row) => [row.id, row.label]))
      setReport({
        message: data.message ?? t('bulk.done'),
        failures: (data.results ?? []).filter((row) => !row.ok).map((row) => ({ label: labels.get(row.id) ?? `#${row.id}`, error: row.error ?? t('bulk.refused') })),
      })
      for (const box of document.querySelectorAll<HTMLInputElement>('input[data-bulk-row], input[data-bulk-all]')) box.checked = false
      setSelected([])
      setConfirming(false)
      setAction('')
      router.refresh()
    } catch {
      setError(t('bulk.changeFailedNetwork'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div aria-label={t('common.bulkActions')} className="es-bulk" role="region">
      <span className="es-bulk__count" aria-live="polite">
        {selected.length === 0 ? t('bulk.selectItems', { nouns: `${props.noun}s` }) : t('bulk.selectedCount', { count: selected.length })}
      </span>
      <label>
        <span className="es-sr">{t('bulk.actionLabel')}</span>
        <select disabled={busy} onChange={(event) => choose(event.target.value as BulkAction | '')} value={action}>
          <option value="">{t('bulk.chooseAction')}</option>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {t(choice.labelKey)}
            </option>
          ))}
        </select>
      </label>
      {action === 'changeAuthor' && (
        <label>
          <span className="es-sr">{t('bulk.newAuthor')}</span>
          <select disabled={busy || authors === null} onChange={(event) => setAuthor(event.target.value)} value={author}>
            <option value="">{authors === null ? t('bulk.loadingAuthors') : t('bulk.chooseAuthor')}</option>
            {(authors ?? []).map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {action === 'changeCategory' && (
        <>
          <label>
            <span className="es-sr">{t('bulk.whatToDo')}</span>
            <select disabled={busy} onChange={(event) => setCategoryMode(event.target.value as CategoryMode)} value={categoryMode}>
              <option value="add">{t('bulk.addCategory')}</option>
              <option value="replace">{t('bulk.replaceCategory')}</option>
              <option value="remove">{t('bulk.removeCategory')}</option>
            </select>
          </label>
          <label>
            <span className="es-sr">{t('bulk.categoryName')}</span>
            <input disabled={busy} maxLength={80} onChange={(event) => setCategoryName(event.target.value)} placeholder={t('bulk.categoryPlaceholder')} type="text" value={categoryName} />
          </label>
        </>
      )}
      {action === 'setStatus' && (
        <label>
          <span className="es-sr">{t('bulk.chooseStatus')}</span>
          <select disabled={busy} onChange={(event) => setStatus(event.target.value as OrderStatus | '')} value={status}>
            <option value="">{t('bulk.chooseStatus')}</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {ORDER_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      )}
      {(action === 'addTag' || action === 'removeTag') && (
        <label>
          <span className="es-sr">{t('bulk.chooseTag')}</span>
          <select disabled={busy || tagOptions === null} onChange={(event) => setTagId(event.target.value)} value={tagId}>
            <option value="">{tagOptions === null ? t('bulk.loadingOptions') : t('bulk.chooseTag')}</option>
            {(tagOptions ?? []).map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {action === 'setBrand' && (
        <label>
          <span className="es-sr">{t('bulk.chooseBrand')}</span>
          <select disabled={busy || brandOptions === null} onChange={(event) => setBrandId(event.target.value)} value={brandId}>
            <option value="">{brandOptions === null ? t('bulk.loadingOptions') : t('bulk.chooseBrand')}</option>
            <option value="0">{t('bulk.clearBrand')}</option>
            {(brandOptions ?? []).map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!confirming && (
        <button className="btn" disabled={!ready || busy} onClick={() => setConfirming(true)} type="button">
          {chosen ? t('bulk.applyWith', { label: t(chosen.labelKey) }) : t('common.apply')}
        </button>
      )}
      {confirming && ready && (
        <div className={`es-bulk__confirm${action === 'delete' ? ' es-bulk__confirm--danger' : ''}`} role="alertdialog" aria-label={t('bulk.confirmAria')}>
          <p style={{ margin: '0 0 8px 0' }}>{confirmText}</p>
          <button className={action === 'delete' ? 'btn btn--primary doc-link--danger' : 'btn btn--primary'} disabled={busy} onClick={run} type="button">
            {busy ? t('bulk.working') : t('bulk.confirmDo')}
          </button>{' '}
          <button className="btn" disabled={busy} onClick={() => setConfirming(false)} type="button">
            {t('common.cancel')}
          </button>
        </div>
      )}
      {error && (
        <p className="es-bulk__result" role="alert">
          {error}
        </p>
      )}
      {report && (
        <div className="es-bulk__result" role="status">
          {report.message}
          {report.failures.length > 0 && (
            <ul>
              {report.failures.map((failure, index) => (
                <li key={index}>
                  {failure.label}: {failure.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default BulkActionsBar
