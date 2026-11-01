'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import './AdminProgressBar.css'

/** Longest the bar runs without an end signal, so a stuck request never leaves it on screen. */
const SAFETY_MS = 15000

type State = 'idle' | 'running' | 'done'

/**
 * A thin bar across the top of every admin screen (Task 12b). It starts when an
 * admin link is followed, a form is submitted, or a request that changes data
 * (POST, PUT, PATCH, DELETE) is sent to this site, and finishes when the page
 * changes or the last such request ends. No dependency: it listens to clicks,
 * submits and fetch, and reads the route with the Next hooks.
 */
export function AdminProgressBar() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  )
}

function Bar() {
  const pathname = usePathname()
  const search = useSearchParams()?.toString() ?? ''
  const route = `${pathname}?${search}`
  const [state, setState] = useState<State>('idle')
  const routeRef = useRef(route)
  const inFlight = useRef(0)
  const timers = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer)
    timers.current = []
  }, [])

  const finish = useCallback(() => {
    clearTimers()
    setState((current) => (current === 'idle' ? 'idle' : 'done'))
    timers.current.push(window.setTimeout(() => setState('idle'), 350))
  }, [clearTimers])

  const start = useCallback(() => {
    clearTimers()
    setState('running')
    timers.current.push(window.setTimeout(finish, SAFETY_MS))
  }, [clearTimers, finish])

  // A page change ends the bar.
  useEffect(() => {
    if (routeRef.current === route) return
    routeRef.current = route
    finish()
  }, [route, finish])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(target instanceof HTMLAnchorElement)) return
      if ((target.target && target.target !== '_self') || target.hasAttribute('download')) return
      let next: URL
      try {
        next = new URL(target.href)
      } catch {
        return
      }
      if (next.origin !== window.location.origin) return
      // Same page, or only the hash changes: nothing loads.
      if (next.pathname === window.location.pathname && next.search === window.location.search) return
      start()
    }

    const onSubmit = (event: Event) => {
      // A form that a handler stops itself (for example a fetch-based save) is covered by the fetch hook below.
      if (!event.defaultPrevented) start()
    }

    const originalFetch = window.fetch
    const trackedFetch: typeof window.fetch = async (input, init) => {
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href)
      const tracked = method !== 'GET' && method !== 'HEAD' && url.origin === window.location.origin
      if (tracked) {
        inFlight.current += 1
        start()
      }
      try {
        return await originalFetch(input, init)
      } finally {
        if (tracked) {
          inFlight.current -= 1
          if (inFlight.current === 0) finish()
        }
      }
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('submit', onSubmit)
    window.fetch = trackedFetch
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('submit', onSubmit)
      window.fetch = originalFetch
      clearTimers()
    }
  }, [start, finish, clearTimers])

  return (
    <div className="admin-progress" data-state={state} aria-hidden="true" data-testid="admin-progress">
      <div className="admin-progress__bar" />
    </div>
  )
}
