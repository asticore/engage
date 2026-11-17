'use client'

import { useEffect, useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { postJson, requestJson } from '@/features/media/admin/mediaApi'

import { pathOf, type Tag } from './logic'

type Provider = 'claude' | 'openai'

/** Tag field on a file's edit screen. Hidden when Media tags is off. Each tick saves at once. */
export function MediaTagsEdit({ id }: { id: number }) {
  const t = useAdminT()
  const [tags, setTags] = useState<Tag[] | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [error, setError] = useState('')
  const [keys, setKeys] = useState<Record<Provider, boolean> | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    let alive = true
    void requestJson<{ tags: Tag[]; selected: number[] }>(`/api/admin-media-tags?media=${id}`).then((r) => {
      if (!alive || r.ok !== true) return
      setTags(r.data.tags)
      setSelected(r.data.selected)
    })
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    void requestJson<{ providers: Record<Provider, boolean> }>('/api/admin-media-ai-tags').then((r) => {
      if (r.ok === true) setKeys(r.data.providers)
    })
  }, [])

  if (!tags) return null

  const toggle = async (tagId: number, on: boolean) => {
    setError('')
    const r = await postJson<{ ok: boolean }>('/api/admin-media-tags', { action: 'assign', mediaIds: [id], tagIds: [tagId], remove: !on })
    if (r.ok !== true) return setError(r.error)
    setSelected((cur) => (on ? [...cur, tagId] : cur.filter((x) => x !== tagId)))
  }

  const provider: Provider | null = keys?.claude ? 'claude' : keys?.openai ? 'openai' : null
  const suggest = async () => {
    if (!provider) return
    setError('')
    setNote('')
    setBusy(true)
    const r = await postJson<{ results: Array<{ status: string; tagIds?: number[]; reason?: string }> }>('/api/admin-media-ai-tags', { ids: [id], provider, apply: true })
    setBusy(false)
    if (r.ok !== true) return setError(r.error)
    const item = r.data.results[0]
    if (item?.status === 'tagged') {
      setSelected((cur) => [...new Set([...cur, ...(item.tagIds ?? [])])])
      setNote(`Added ${item.tagIds?.length ?? 0} tag${item.tagIds?.length === 1 ? '' : 's'}. Untick any that do not fit.`)
    } else setError(item?.reason ?? 'No tags were suggested.')
  }

  return (
    <section aria-label={t('media.tags')} className="mb-[16px] flex flex-col gap-[8px] rounded-[6px] border border-[var(--theme-elevation-150)] p-[14px]">
      <strong className="text-[13px] text-[var(--theme-elevation-800)]">{t('media.tags')}</strong>
      {tags.length === 0 ? (
        <p className="m-0 text-[12px] text-[var(--theme-elevation-600)]">{t('media.tagsNone')}</p>
      ) : (
        <>
          <p className="m-0 text-[12px] text-[var(--theme-elevation-600)]">{t('media.tagsHelp')}</p>
          <div className="flex flex-wrap gap-[10px]">
            {tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-[5px] text-[12px] text-[var(--theme-elevation-800)]">
                <input type="checkbox" checked={selected.includes(tag.id)} onChange={(e) => void toggle(tag.id, e.target.checked)} />
                {pathOf(tags, tag.id)}
              </label>
            ))}
          </div>
        </>
      )}
      {tags.length > 0 && provider ? (
        <div>
          <button type="button" className="btn" disabled={busy} onClick={() => void suggest()}>
            {busy ? 'Suggesting...' : 'Suggest tags with AI'}
          </button>
        </div>
      ) : null}
      {note ? <p role="status" className="m-0 text-[12px] text-[var(--theme-elevation-600)]">{note}</p> : null}
      {error ? <p role="alert" className="m-0 text-[12px] text-[var(--theme-error-500,#c00)]">{error}</p> : null}
    </section>
  )
}
