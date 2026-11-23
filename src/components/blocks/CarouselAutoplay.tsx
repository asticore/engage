'use client'

import React, { useEffect, useRef } from 'react'

/**
 * Moves a section carousel on by itself. Renders nothing visible: it finds the track next to it and scrolls one
 * slide width every `seconds`. It stops while the pointer is over the carousel, while it has keyboard focus,
 * when the tab is hidden and always for visitors who prefer reduced motion. With `loop` it returns to the start.
 */
export default function CarouselAutoplay({ seconds, loop }: { seconds: number; loop: boolean }): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const root = ref.current?.parentElement
    const track = root?.querySelector<HTMLElement>('.be-carousel__track')
    if (!root || !track) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let paused = false
    const stop = () => { paused = true }
    const go = () => { paused = false }
    root.addEventListener('mouseenter', stop)
    root.addEventListener('mouseleave', go)
    root.addEventListener('focusin', stop)
    root.addEventListener('focusout', go)
    const timer = window.setInterval(() => {
      if (paused || document.hidden) return
      const slide = track.querySelector<HTMLElement>('.be-carousel__slide')
      if (!slide) return
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0
      const step = slide.getBoundingClientRect().width + gap
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2
      if (atEnd) {
        if (loop) track.scrollTo({ left: 0 })
      } else {
        track.scrollBy({ left: step })
      }
    }, Math.max(1, seconds) * 1000)
    return () => {
      window.clearInterval(timer)
      root.removeEventListener('mouseenter', stop)
      root.removeEventListener('mouseleave', go)
      root.removeEventListener('focusin', stop)
      root.removeEventListener('focusout', go)
    }
  }, [seconds, loop])
  return <span ref={ref} hidden />
}
