'use client'
import { revealCardForField } from '@/admin/components/collapseStore'
import { adminCollectionPath } from '@/admin/adminPaths'

/**
 * Save/publish/duplicate/delete requests for the document edit screen.
 *
 * Shared by the plain save bar (globals and non-drafts collections, in
 * EditForm.tsx) and the right-hand DocumentPanel (collections), so the wire
 * rules live in exactly one place:
 *
 *   - Save draft: `_status: 'draft'` in the body AND `?draft=true`. On an
 *     update that writes only a new version row and leaves the live row
 *     alone; on a create it lets validation skip incomplete required fields.
 *   - Publish / Update: `_status: 'published'`, no query flag.
 *   - Unpublish: `_status: 'draft'`, NO query flag, so the live row itself
 *     goes back to draft.
 *   - Globals are POSTed, never PATCHed, and never have drafts in this app.
 *
 * See `src/localapi/rest.ts` for the response shapes relied on here
 * (`{doc, message}` for create/update, `{result, message}` for globals).
 */

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useDocumentEvents, useFormFields, useResetFormModified } from '@/admin/context'
import { unflattenFields } from '@/admin/fields/shared'

export type SaveTarget = {
  collectionSlug?: string
  globalSlug?: string
  id?: number
  draftsEnabled?: boolean
  /**
   * Globals only: the `updatedAt` the page loaded. Sent with the save so the server refuses
   * (409) when another tab or admin has changed the global since, instead of overwriting it.
   */
  expectedUpdatedAt?: string | null
}

export type SaveStatus = 'draft' | 'published' | 'unpublish'

function saveRequest({ collectionSlug, globalSlug, id }: SaveTarget, draftFlag: boolean): { url: string; method: 'POST' | 'PATCH' } {
  const suffix = draftFlag ? '?draft=true' : ''
  if (globalSlug) return { url: `/api/globals/${globalSlug}`, method: 'POST' }
  if (id) return { url: `/api/${collectionSlug}/${id}${suffix}`, method: 'PATCH' }
  return { url: `/api/${collectionSlug}${suffix}`, method: 'POST' }
}

export function extractErrorMessage(body: unknown, fallback = 'Save failed.'): string {
  const errors = (body as { errors?: Array<{ message?: string }> } | null)?.errors
  return errors?.[0]?.message || fallback
}

export type BusyAction = SaveStatus | 'duplicate' | 'delete' | 'trash' | 'restore'

export function useDocumentSave(target: SaveTarget) {
  const router = useRouter()
  const resetModified = useResetFormModified()
  const { reportUpdate } = useDocumentEvents()
  const fields = useFormFields(([f]) => f)
  const [busy, setBusy] = useState<BusyAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  // The version this page last loaded or saved. A save moves it on, so two quick saves do not conflict with themselves.
  const expectedRef = useRef<string | null>(target.expectedUpdatedAt ?? null)
  useEffect(() => {
    expectedRef.current = target.expectedUpdatedAt ?? null
  }, [target.expectedUpdatedAt])

  const entitySlug = target.collectionSlug ?? target.globalSlug ?? ''

  /** Resolves true when the document was saved, false when it was not (the error is in `error`). */
  const save = async (status: SaveStatus): Promise<boolean> => {
    setBusy(status)
    setError(null)
    try {
      const data = unflattenFields(fields)
      if (target.draftsEnabled) data._status = status === 'published' ? 'published' : 'draft'
      // Only "Save draft" carries the flag; unpublish must write the live row.
      const { url, method } = saveRequest(target, status === 'draft')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (target.globalSlug && expectedRef.current) headers['X-Expected-Updated-At'] = expectedRef.current
      const response = await fetch(url, {
        body: JSON.stringify(data),
        credentials: 'include',
        headers,
        method,
      })
      const body: unknown = await response.json().catch((): unknown => null)
      if (!response.ok) {
        setError(extractErrorMessage(body))
        // A card folded shut must not hide the field that failed: open the card that holds it.
        const firstPath = (body as { errors?: Array<{ path?: unknown }> } | null)?.errors?.[0]?.path
        if (typeof firstPath === 'string') revealCardForField(firstPath)
        return false
      }

      const savedVersion = (body as { result?: { updatedAt?: unknown } } | null)?.result?.updatedAt
      if (typeof savedVersion === 'string') expectedRef.current = savedVersion
      resetModified()
      setSavedAt(Date.now())
      reportUpdate({ entitySlug, updatedAt: new Date().toISOString() })

      // A successful CREATE moves to the new document's own edit route.
      if (target.collectionSlug && !target.id) {
        const newId = (body as { doc?: { id?: number } } | null)?.doc?.id
        if (newId !== undefined) {
          router.push(`${adminCollectionPath(target.collectionSlug)}/${newId}`)
          return true
        }
      }
      router.refresh()
      return true
    } catch {
      setError('Save failed - check your connection and try again.')
      return false
    } finally {
      setBusy(null)
    }
  }

  /** Creates a draft copy of the current form values and opens it. */
  const duplicate = async () => {
    if (!target.collectionSlug || !target.id) return
    setBusy('duplicate')
    setError(null)
    try {
      const data = unflattenFields(fields)
      delete data.id
      delete data.slug // regenerated from the new title by the slug hook
      delete data.createdAt
      delete data.updatedAt
      if ('isHomepage' in data) data.isHomepage = false
      for (const key of ['title', 'name']) {
        if (typeof data[key] === 'string' && data[key]) {
          data[key] = `${data[key]} (copy)`
          break
        }
      }
      if (target.draftsEnabled) data._status = 'draft'
      const response = await fetch(`/api/${target.collectionSlug}${target.draftsEnabled ? '?draft=true' : ''}`, {
        body: JSON.stringify(data),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const body: unknown = await response.json().catch((): unknown => null)
      if (!response.ok) {
        setError(extractErrorMessage(body, 'Could not duplicate.'))
        return
      }
      const newId = (body as { doc?: { id?: number } } | null)?.doc?.id
      reportUpdate({ entitySlug, updatedAt: new Date().toISOString() })
      router.push(newId !== undefined ? `${adminCollectionPath(target.collectionSlug)}/${newId}` : `${adminCollectionPath(target.collectionSlug)}`)
    } catch {
      setError('Could not duplicate - check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!target.collectionSlug || !target.id) return
    setBusy('delete')
    setError(null)
    try {
      const response = await fetch(`/api/${target.collectionSlug}/${target.id}`, { credentials: 'include', method: 'DELETE' })
      if (!response.ok) {
        const body: unknown = await response.json().catch((): unknown => null)
        setError(extractErrorMessage(body, 'Could not delete.'))
        return
      }
      resetModified()
      reportUpdate({ entitySlug, updatedAt: new Date().toISOString() })
      router.push(`${adminCollectionPath(target.collectionSlug)}`)
      router.refresh()
    } catch {
      setError('Could not delete - check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  /** Moves the document to the trash, or takes it out again. Goes through the bulk route so the Delete permission and the row checks apply. */
  const setTrashed = async (action: 'trash' | 'restore') => {
    if (!target.collectionSlug || !target.id) return
    setBusy(action)
    setError(null)
    try {
      const response = await fetch('/api/admin-bulk', {
        body: JSON.stringify({ collection: target.collectionSlug, ids: [target.id], action }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const body = (await response.json().catch((): null => null)) as { error?: string; results?: Array<{ ok: boolean; error?: string }> } | null
      const row = body?.results?.[0]
      if (!response.ok || !row?.ok) {
        setError(body?.error ?? row?.error ?? (action === 'trash' ? 'Could not move to the trash.' : 'Could not restore.'))
        return
      }
      resetModified()
      reportUpdate({ entitySlug, updatedAt: new Date().toISOString() })
      if (action === 'trash') router.push(`${adminCollectionPath(target.collectionSlug)}`)
      router.refresh()
    } catch {
      setError('Could not do that - check your connection and try again.')
    } finally {
      setBusy(null)
    }
  }

  return { busy, duplicate, error, remove, save, savedAt, setTrashed }
}