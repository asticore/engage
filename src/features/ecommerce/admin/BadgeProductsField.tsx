'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useField } from '@/engine/ui'
import type { Field } from '@/engine'

import { fieldLabel } from '@/admin/fields/shared'

type Product = { id: number | string; title?: string; slug?: string }

const slugsOf = (value: unknown): string[] =>
  String(value ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

/**
 * Product picker for a promo badge "Chosen products" rule. Search, tick the products, and the slugs are stored as the
 * same comma separated text the old textarea held, so badges saved before keep working and nothing needs migrating.
 * A slug that matches no product (typed before, or the product was renamed) is still shown, marked, and can be removed.
 */
export function BadgeProductsField({ field, path }: { field: Field; path: string }) {
  const { value, setValue } = useField<string | undefined | null>({ path })
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [failed, setFailed] = useState(false)
  const chosen = slugsOf(value)
  const label = fieldLabel(field)

  useEffect(() => {
    let live = true
    fetch('/api/products?limit=500&depth=0&sort=title', { credentials: 'include' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { docs?: Product[] }
        if (live) setProducts((body.docs ?? []).filter((p) => typeof p.slug === 'string' && p.slug))
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])

  const bySlug = useMemo(() => new Map(products.map((p) => [p.slug as string, p])), [products])
  const shown = products.filter((p) => !query.trim() || `${p.title ?? ''} ${p.slug ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 50)
  const toggle = (slug: string) => setValue((chosen.includes(slug) ? chosen.filter((s) => s !== slug) : [...chosen, slug]).join(', ') || null)

  return (
    <div className="field">
      <span className="label">{typeof label === 'string' ? label : field.name}</span>
      {chosen.length > 0 && (
        <ul className="cluster list-none">
          {chosen.map((slug) => (
            <li key={slug}>
              <button type="button" className={bySlug.has(slug) || products.length === 0 ? 'btn btn-sm btn-soft' : 'btn btn-sm btn-outline'} onClick={() => toggle(slug)} aria-label={`Remove ${slug}`}>
                {bySlug.get(slug)?.title ?? slug} x
              </button>
            </li>
          ))}
        </ul>
      )}
      <input className="input" type="search" placeholder="Search products" value={query} onChange={(e) => setQuery(e.target.value)} />
      {failed && <p className="hint">Products could not be loaded. You can still remove chosen ones above.</p>}
      <ul className="list-none stack" style={{ maxHeight: '14rem', overflow: 'auto' }}>
        {shown.map((p) => (
          <li key={p.id}>
            <label className="cluster">
              <input type="checkbox" className="checkbox" checked={chosen.includes(p.slug as string)} onChange={() => toggle(p.slug as string)} />
              <span>{p.title || p.slug}</span> <span className="text-xs text-muted">{p.slug}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
