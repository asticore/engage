'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import {
  ADMIN_TOUR_START_EVENT,
  TOUR_BLOCKED_PATH,
  TOUR_STEPS,
  type TourStatus,
} from '@/features/adminTour/steps'

import { useFocusTrap } from './useFocusTrap'
import './adminTour.css'

export { ADMIN_TOUR_START_EVENT }

const SEEN_KEY = 'admin-tour-seen'
const GAP = 12
const MARGIN = 8

type Box = { top: number; left: number; width: number; height: number }

function seenThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markSeenThisSession(): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Private mode: the ref below still covers this page load.
  }
}

/** The element's box when it is on screen, else null (missing, hidden or off-canvas). */
function measureTarget(selector: string | null): Box | null {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return null
  if (r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)))

/**
 * First-login walkthrough of the admin (sidebar, Pages, visual editor,
 * Templates, Settings, Features). Starts by itself once per user account
 * (`autoStart` comes from the server, read from that user's saved
 * preference), and again whenever the Help button fires ADMIN_TOUR_START_EVENT.
 * Finishing, skipping or closing all count as seen and are saved once.
 */
export function AdminTour({ autoStart }: { autoStart: boolean }) {
  const t = useAdminT()
  const pathname = usePathname() ?? ''
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [layout, setLayout] = useState<{ box: Box; top: number; left: number } | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Set as soon as the save is sent, so the tour cannot start by itself again before the write lands.
  const seenRef = useRef(false)

  const step = TOUR_STEPS[index]
  const total = TOUR_STEPS.length
  const isLast = index === total - 1

  const start = useCallback(() => {
    setIndex(0)
    setActive(true)
  }, [])

  // Start by itself: only for a user who has never seen it, and not on sign-in, two-factor or visual editor routes.
  useEffect(() => {
    if (!autoStart || active || seenRef.current || seenThisSession()) return
    if (TOUR_BLOCKED_PATH.test(pathname)) return
    // Reads browser-only state (session flag, route), so it cannot be decided during render without a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    start()
    // Only the first eligible render may start it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, pathname])

  // Replay from the Help button.
  useEffect(() => {
    window.addEventListener(ADMIN_TOUR_START_EVENT, start)
    return () => window.removeEventListener(ADMIN_TOUR_START_EVENT, start)
  }, [start])

  const close = useCallback((status: TourStatus) => {
    setActive(false)
    if (seenRef.current || seenThisSession()) return
    seenRef.current = true
    markSeenThisSession()
    try {
      void fetch('/api/admin-tour', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).catch((): undefined => undefined)
    } catch {
      // Fire and forget: a failed save only means the tour may show once more.
    }
  }, [])

  const next = useCallback(() => {
    if (index >= total - 1) close('completed')
    else setIndex(index + 1)
  }, [index, total, close])

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useFocusTrap(dialogRef, active)

  // Escape skips. Arrow keys move through steps while focus is inside the dialog.
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close('skipped')
        return
      }
      if (!dialogRef.current?.contains(document.activeElement)) return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        next()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        back()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, close, next, back])

  // Bring the target into view, then follow it on resize and scroll. The card sits beside the
  // target (right, else below), kept inside the viewport; with no visible target it is centred.
  useLayoutEffect(() => {
    if (!active) return
    const selector = step.target
    const target = selector ? document.querySelector(selector) : null
    if (target && typeof (target as HTMLElement).scrollIntoView === 'function') {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ;(target as HTMLElement).scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    }
    const update = () => {
      const box = measureTarget(selector)
      if (!box) {
        setLayout(null)
        return
      }
      const card = dialogRef.current
      const w = card?.offsetWidth || 340
      const h = card?.offsetHeight || 200
      const vw = window.innerWidth
      const vh = window.innerHeight
      let top: number
      let left: number
      if (box.left + box.width + GAP + w <= vw - MARGIN) {
        left = box.left + box.width + GAP
        top = box.top
      } else {
        left = box.left
        top = box.top + box.height + GAP
        if (top + h > vh - MARGIN) top = box.top - GAP - h
      }
      setLayout({ box, top: clamp(top, MARGIN, vh - h - MARGIN), left: clamp(left, MARGIN, vw - w - MARGIN) })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [active, step])

  // Each step's heading takes focus so screen readers announce the new step.
  useEffect(() => {
    if (active) headingRef.current?.focus()
  }, [active, index])

  if (!active) return null

  const box = layout?.box ?? null
  const centred = !layout
  const titleId = 'admin-tour-title'
  const bodyId = 'admin-tour-body'

  return (
    <div className="admin-tour">
      <div className={`admin-tour__backdrop${centred ? ' admin-tour__backdrop--dim' : ''}`} />
      {box ? (
        <div
          aria-hidden="true"
          className="admin-tour__ring"
          style={{ top: box.top - 4, left: box.left - 4, width: box.width + 8, height: box.height + 8 }}
        />
      ) : null}
      <div
        aria-describedby={bodyId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`admin-tour__card${centred ? ' admin-tour__card--centred' : ''}`}
        ref={dialogRef}
        role="dialog"
        style={layout ? { top: layout.top, left: layout.left } : undefined}
        tabIndex={-1}
      >
        <p className="admin-tour__count">{t('tour.stepOf', { n: index + 1, total })}</p>
        <h2 className="admin-tour__title" id={titleId} ref={headingRef} tabIndex={-1}>
          {t(step.titleKey)}
        </h2>
        <p className="admin-tour__body" id={bodyId}>
          {t(step.bodyKey)}
        </p>
        <div className="admin-tour__actions">
          <button className="admin-tour__btn" disabled={index === 0} onClick={back} type="button">
            {t('tour.back')}
          </button>
          <button className="admin-tour__btn admin-tour__btn--primary" onClick={next} type="button">
            {isLast ? t('tour.finish') : t('tour.next')}
          </button>
          <button className="admin-tour__btn admin-tour__btn--link" onClick={() => close('skipped')} type="button">
            {t('tour.skip')}
          </button>
        </div>
        <button aria-label={t('tour.close')} className="admin-tour__close" onClick={() => close('skipped')} type="button">
          <span aria-hidden="true">{String.fromCharCode(215)}</span>
        </button>
      </div>
    </div>
  )
}

export default AdminTour
