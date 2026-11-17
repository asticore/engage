'use client'

import { useEffect, useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { postJson, requestJson } from '@/features/media/admin/mediaApi'

import { pathOf, type Tag } from './logic'

/** Tag field on a file's edit screen. Hidden when Media tags is off. Each tick saves at once. */
export function MediaTagsEdit({ id }: { id: number }) {
  const t = useAdminT()
  const [tags, setTags] = useState<Tag[] | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [error, setError] = useState('')

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

  if (!tags) return null

  const toggle = async (tagId: number, on: boolean) => {
    setError('')
    const r = await postJson<{ ok: boolean }>('/api/admin-media-tags', { action: 'assign', mediaIds: [id], tagIds: [tagId], remove: !on })
    if (r.ok !== true) return setError(r.error)
    setSelected((cur) => (on ? [...cur, tagId] : cur.filter((x) => x !== tagId)))
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
      {error ? <p role="alert" className="m-0 text-[12px] text-[var(--theme-error-500,#c00)]">{error}</p> : null}
    </section>
  )
}
