'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Load more for the Loop element (Task 9, 28c). Server markup is a plain "?page=N" link, so with no script the
 * visitor just follows it. With script the next page is fetched, its items are appended to this loop and the link
 * moves on (or goes away on the last page). Mode "scroll" does the same when the link scrolls into view.
 */
export function LoadMoreLink({ href, label, auto }: { href: string; label: string; auto?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const [next, setNext] = useState<string | null>(href)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const link = ref.current
    if (!link || !next || busy) return
    const loop = link.closest('.be-el-50-loop')
    const list = loop?.querySelector('ul.be-el-50-loop__items')
    if (!loop || !list) return
    setBusy(true)
    try {
      const url = new URL(next, window.location.href)
      if (url.origin !== window.location.origin) return
      const index = Array.from(document.querySelectorAll('.be-el-50-loop')).indexOf(loop)
      const res = await fetch(url.toString(), { headers: { accept: 'text/html' } })
      if (!res.ok) throw new Error('bad status')
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
      const remote = doc.querySelectorAll('.be-el-50-loop')[index]
      if (!remote) throw new Error('loop missing')
      remote.querySelectorAll('ul.be-el-50-loop__items > li').forEach((li) => list.appendChild(document.importNode(li, true)))
      const more = remote.querySelector('a.be-el-50-loop__next, a.be-el-50-loop__more')
      setNext(more?.getAttribute('href') ?? null)
    } catch {
      window.location.href = next
    } finally {
      setBusy(false)
    }
  }, [next, busy])

  useEffect(() => {
    const link = ref.current
    if (!auto || !link || !next || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void load()
    }, { rootMargin: '200px' })
    io.observe(link)
    return () => io.disconnect()
  }, [auto, next, load])

  if (!next) return null
  return (
    <a
      ref={ref}
      className="be-el-50-loop__next be-el-50-loop__more"
      href={next}
      rel="next"
      aria-busy={busy}
      onClick={(e) => {
        e.preventDefault()
        void load()
      }}
    >
      {label}
    </a>
  )
}
