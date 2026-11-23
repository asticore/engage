'use client'

import { useRouter } from 'next/navigation'
import React, { useRef } from 'react'

type Chip = { label: string; href: string }

/**
 * The archive filter form. It is a plain GET form, so it works without JavaScript. With `instant` on and
 * JavaScript running, a change to a field applies the filters through a soft navigation (no full page reload,
 * the list swaps in place) and the form never loses its place. Active filters show as removable chips.
 */
export default function ArchiveFilterForm({ path, instant, chips, children }: { path: string; instant: boolean; chips: Chip[]; children: React.ReactNode }): React.ReactElement {
  const router = useRouter()
  const ref = useRef<HTMLFormElement>(null)
  const go = () => {
    const form = ref.current
    if (!form) return
    const params = new URLSearchParams()
    for (const [k, v] of new FormData(form).entries()) {
      if (typeof v === 'string' && v.trim() !== '') params.set(k, v.trim())
    }
    const qs = params.toString()
    router.push(qs ? `${path}?${qs}` : path, { scroll: false })
  }
  return (
    <>
      <form
        ref={ref}
        method="get"
        action={path}
        className="archive-filter"
        aria-label="Filter"
        onChange={instant ? (e) => { const field = e.target as unknown as HTMLInputElement; if (field.tagName !== 'INPUT' || field.type !== 'search') go() } : undefined}
        onSubmit={(e) => { e.preventDefault(); go() }}
      >
        {children}
      </form>
      {chips.length > 0 ? (
        <ul className="archive-filter__chips" aria-label="Active filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', listStyle: 'none', padding: 0, margin: '0.5rem 0' }}>
          {chips.map((c) => (
            <li key={c.label}>
              <a className="archive-filter__chip" href={c.href} aria-label={`Remove filter ${c.label}`}>
                {c.label} <span aria-hidden="true">&times;</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
