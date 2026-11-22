'use client'

import React, { useEffect, useRef, useState } from 'react'

/*
 * Interactive parts of the wave-49 gallery. The markup is rendered on the server by Wave49Elements.tsx and passed in
 * as children, so nothing here is needed to see the pictures:
 *  - GalleryCarousel: the track scrolls by touch, wheel or keyboard with no script. Buttons and autoplay need script.
 *  - GalleryLightbox: each picture is a real link to the full image, so without script it just opens that image.
 *    With script the link opens a dialog instead (focus trapped, Escape closes, focus goes back to the link).
 * Only components are exported from this module, so the server can import the element module safely.
 */

/** A picture the lightbox can show. Plain data, so it crosses from the server render. */
export type GalleryItem = { url: string; alt: string; srcSet?: string }

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
const AUTOPLAY_MS = 6000

/** True while the visitor has asked for reduced motion. Starts false so the first render matches the server markup. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia(REDUCED_QUERY)
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return reduced
}

/** Scrolls the track one viewful forward or back, wrapping at either end. */
function pageBy(el: HTMLElement | null, dir: 1 | -1, smooth: boolean) {
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  let left = el.scrollLeft + dir * el.clientWidth
  if (dir > 0 && el.scrollLeft >= max - 2) left = 0
  if (dir < 0 && el.scrollLeft <= 2) left = max
  el.scrollTo({ left: Math.max(0, Math.min(max, left)), behavior: smooth ? 'smooth' : 'auto' })
}

/** Carousel: a scroll-snapped track (children are the slides), prev and next buttons, and autoplay with a pause button. */
export const GalleryCarousel: React.FC<{ autoplay: boolean; label: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ autoplay, label, style, children }) => {
  const reduced = useReducedMotion()
  const track = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const canAutoplay = autoplay && !reduced
  const running = canAutoplay && !paused

  useEffect(() => {
    if (!running) return undefined
    const id = window.setInterval(() => pageBy(track.current, 1, true), AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [running])

  return (
    <div className="be-el-49-car" style={style}>
      <div className="be-el-49-car__track" ref={track} role="region" aria-roledescription="carousel" aria-label={label} tabIndex={0}>
        {children}
      </div>
      <div className="be-el-49-car__controls">
        {canAutoplay && (
          <button type="button" className="be-el-49-car__btn" aria-label={running ? 'Pause slideshow' : 'Play slideshow'} onClick={() => setPaused((p) => !p)}>
            {running ? 'Pause' : 'Play'}
          </button>
        )}
        <button type="button" className="be-el-49-car__btn" aria-label="Previous pictures" onClick={() => pageBy(track.current, -1, !reduced)}>
          &larr;
        </button>
        <button type="button" className="be-el-49-car__btn" aria-label="Next pictures" onClick={() => pageBy(track.current, 1, !reduced)}>
          &rarr;
        </button>
      </div>
    </div>
  )
}

