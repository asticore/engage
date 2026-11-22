'use client'

import React, { useEffect, useRef, useState } from 'react'

/**
 * Native Lottie player. The player script (a small web component) is fetched from a CDN only when the
 * animation scrolls into view, so pages without one load no extra JavaScript. Modes: autoplay, hover
 * (plays while pointed at or focused) and scroll (the animation follows the scroll position).
 * Reduced motion never autoplays: the first frame shows and hover or scroll still work on request.
 */
const PLAYER_SRC = 'https://unpkg.com/@dotlottie/player-component@2.7.12/dist/dotlottie-player.mjs'

type PlayerEl = HTMLElement & { play?: () => void; pause?: () => void; seek?: (v: number | string) => void }

let loading: Promise<unknown> | null = null
const loadPlayer = (): Promise<unknown> => {
  if (!loading) loading = import(/* webpackIgnore: true */ PLAYER_SRC).catch(() => { loading = null })
  return loading
}

export const LottieClient: React.FC<{ src: string; mode: 'autoplay' | 'hover' | 'scroll'; loop: boolean; label: string; height: number }> = ({ src, mode, loop, label, height }) => {
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const node = box.current
    if (!node) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        void loadPlayer().then(() => setReady(true))
      }
    }, { rootMargin: '200px' })
    io.observe(node)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!ready || mode !== 'scroll') return
    const node = box.current
    const player = node?.querySelector('dotlottie-player') as PlayerEl | null
    if (!node || !player) return
    const onScroll = () => {
      const r = node.getBoundingClientRect()
      const pct = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight + r.height)))
      try { player.seek?.(`${Math.round(pct * 100)}%`) } catch { /* player not ready yet */ }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ready, mode])

  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const hoverProps = mode === 'hover' ? {
    onMouseEnter: () => (box.current?.querySelector('dotlottie-player') as PlayerEl | null)?.play?.(),
    onMouseLeave: () => (box.current?.querySelector('dotlottie-player') as PlayerEl | null)?.pause?.(),
    onFocus: () => (box.current?.querySelector('dotlottie-player') as PlayerEl | null)?.play?.(),
    onBlur: () => (box.current?.querySelector('dotlottie-player') as PlayerEl | null)?.pause?.(),
    tabIndex: 0,
  } : {}

  return (
    <div ref={box} className="be-lottie" role="img" aria-label={label} style={{ minHeight: height }} {...hoverProps}>
      {ready && React.createElement('dotlottie-player', {
        src,
        style: { width: '100%', height },
        ...(mode === 'autoplay' && !reduced ? { autoplay: true } : {}),
        ...(loop ? { loop: true } : {}),
      })}
    </div>
  )
}
