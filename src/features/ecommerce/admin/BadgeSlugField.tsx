'use client'

import React, { useEffect, useState } from 'react'
import { useField } from '@/engine/ui'
import type { Field } from '@/engine'

import { fieldLabel } from '@/admin/fields/shared'

type Option = { slug: string; name: string }

/** Product kinds a "category" badge rule can match (the product's own Category select). */
const CATEGORY_OPTIONS: Option[] = [
  { slug: 'digital', name: 'Digital' },
  { slug: 'physical', name: 'Physical' },
]

/**
 * Picker for a promo badge "tag" or "category" rule. The value stays the same slug text the old plain field held, so badges
 * saved before keep working. Tags come from Product tags (search and pick); categories are the product kinds. A typed slug
 * that is not in the list is kept and marked, so nothing saved earlier is lost.
 */
export function BadgeSlugField({ field, path, kind }: { field: Field; path: string; kind?: 'tag' | 'category' }) {
  const { value, setValue } = useField<string | undefined | null>({ path })
  const mode = kind ?? (field.name === 'category' ? 'category' : 'tag')
  const [options, setOptions] = useState<Option[]>(mode === 'category' ? CATEGORY_OPTIONS : [])
  const [failed, setFailed] = useState(false)
  const current = String(value ?? '').trim()
  const label = fieldLabel(field)

  useEffect(() => {
    if (mode === 'category') return
    let live = true
    fetch('/api/product-tags?limit=500&depth=0&sort=name', { credentials: 'include' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { docs?: Array<{ slug?: string; name?: string }> }
        if (live) setOptions((body.docs ?? []).filter((t) => typeof t.slug === 'string' && t.slug).map((t) => ({ slug: t.slug as string, name: t.name || (t.slug as string) })))
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [mode])

  const known = current === '' || options.some((o) => o.slug === current)
  const listId = `${path}-options`.replace(/[^a-zA-Z0-9_-]/g, '-')
  return (
    <div className="field">
      <span className="label">{typeof label === 'string' ? label : field.name}</span>
      <input className="input" list={listId} value={current} placeholder={mode === 'tag' ? 'Search tags' : 'Pick a category'} onChange={(e) => setValue(e.target.value.trim() || null)} />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>{o.name}</option>
        ))}
      </datalist>
      {!known && options.length > 0 && <p className="hint">&quot;{current}&quot; matches no {mode} in the list. The badge only shows if a product has that slug.</p>}
      {failed && <p className="hint">Tags could not be loaded. You can still type a slug.</p>}
    </div>
  )
}
