'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

const VIEWER_SRC = 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js'
let loading: Promise<unknown> | null = null
const loadViewer = (): Promise<unknown> => {
  if (!loading) loading = import(/* webpackIgnore: true */ VIEWER_SRC).catch(() => { loading = null })
  return loading
}

/** model-viewer web component, fetched only when it scrolls near. Reduced motion never turns on its own. */
export const ModelViewerClient: React.FC<{ src: string; poster?: string; alt: string; height: number; autoRotate: boolean; ar: boolean }> = ({ src, poster, alt, height, autoRotate, ar }) => {
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const node = box.current
    if (!node) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        void loadViewer().then(() => setReady(true))
      }
    }, { rootMargin: '200px' })
    io.observe(node)
    return () => io.disconnect()
  }, [])
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const props: Record<string, unknown> = {
    src, alt, 'camera-controls': '', 'touch-action': 'pan-y', loading: 'lazy', style: { width: '100%', height },
    ...(poster ? { poster } : {}),
    ...(autoRotate && !reduced ? { 'auto-rotate': '' } : {}),
    ...(ar ? { ar: '', 'ar-modes': 'webxr scene-viewer quick-look' } : {}),
  }
  return (
    <div ref={box} className="be-el-3d" style={{ minHeight: height }}>
      {ready ? React.createElement('model-viewer', props) : poster ? <img src={poster} alt={alt} style={{ width: '100%', height, objectFit: 'contain' }} /> : <p className="be-el-3d__note">Loading the 3D model...</p>}
    </div>
  )
}

export type ConfigOption = { name: string; image: string; price: number }
export type ConfigGroup = { name: string; options: ConfigOption[] }
export type Hotspot = { x: number; y: number; label: string }

/** Layered picture configurator: each group picks one option, its picture is a layer, price adds up. */
export const ConfiguratorClient: React.FC<{ title: string; groups: ConfigGroup[]; basePrice: number; currency: string; exploded: boolean; hotspots: Hotspot[]; height: number }> = ({ title, groups, basePrice, currency, exploded, hotspots, height }) => {
  const [picked, setPicked] = useState<number[]>(() => groups.map(() => 0))
  const [spread, setSpread] = useState(false)
  const total = useMemo(() => groups.reduce((sum, g, i) => sum + (g.options[picked[i] ?? 0]?.price ?? 0), basePrice), [groups, picked, basePrice])
  const summary = groups.map((g, i) => `${g.name}: ${g.options[picked[i] ?? 0]?.name ?? ''}`).join(', ')
  return (
    <div className="be-el-cfg">
      {title ? <h3 className="be-el-cfg__title">{title}</h3> : null}
      <div className="be-el-cfg__stage" style={{ position: 'relative', height }}>
        {groups.map((g, i) => {
          const o = g.options[picked[i] ?? 0]
          if (!o?.image) return null
          return (
            // eslint-disable-next-line @next/next/no-img-element -- configurator layers are plain pictures
            <img
              key={g.name}
              src={o.image}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', transition: 'transform .4s ease', transform: spread ? `translateY(${(i - (groups.length - 1) / 2) * 18}%) scale(.8)` : 'none' }}
            />
          )
        })}
        {spread && hotspots.map((h) => (
          <span key={h.label} className="be-el-cfg__hotspot" style={{ position: 'absolute', left: `${h.x}%`, top: `${h.y}%` }} title={h.label} tabIndex={0}>
            <span aria-hidden="true">+</span>
            <span className="be-el-cfg__hotspot-label">{h.label}</span>
          </span>
        ))}
      </div>
      {exploded ? (
        <button type="button" className="be-el-cfg__btn" aria-pressed={spread} onClick={() => setSpread((s) => !s)}>{spread ? 'Assembled view' : 'Exploded view'}</button>
      ) : null}
      {groups.map((g, gi) => (
        <fieldset key={g.name} className="be-el-cfg__group">
          <legend>{g.name}</legend>
          {g.options.map((o, oi) => (
            <label key={o.name} className="be-el-cfg__opt">
              <input type="radio" name={`cfg-${title}-${gi}`} checked={(picked[gi] ?? 0) === oi} onChange={() => setPicked((p) => p.map((v, k) => (k === gi ? oi : v)))} />
              {` ${o.name}`}{o.price ? ` (${o.price > 0 ? '+' : ''}${currency}${o.price})` : ''}
            </label>
          ))}
        </fieldset>
      ))}
      {basePrice > 0 || groups.some((g) => g.options.some((o) => o.price)) ? <p className="be-el-cfg__total">{`Total: ${currency}${total.toFixed(2)}`}</p> : null}
      <p className="be-el-cfg__summary">{summary}</p>
    </div>
  )
}
