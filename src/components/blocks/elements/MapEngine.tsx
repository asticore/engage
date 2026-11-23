'use client'

import React, { useEffect, useRef, useState } from 'react'

import type { MapEngineSpec } from '@/features/mapsWeather/mapView'

/** MapLibre GL, loaded from jsDelivr only when a visitor opens a map (never bundled, never hosted by the site). */
export const MAPLIBRE_VERSION = '4.7.1'
const BASE = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/`
const JS_SRI = 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj'
const CSS_SRI = 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V'

type Lib = {
  Map: new (o: Record<string, unknown>) => MapInstance
  Marker: new (o: Record<string, unknown>) => { setLngLat(c: [number, number]): unknown; setPopup(p: unknown): unknown; addTo(m: unknown): unknown }
  Popup: new (o: Record<string, unknown>) => { setText(t: string): unknown }
  NavigationControl: new () => unknown
}
type MapInstance = {
  on(ev: string, fn: (e?: unknown) => void): void
  addControl(c: unknown, pos?: string): void
  addSource(id: string, s: Record<string, unknown>): void
  addLayer(l: Record<string, unknown>): void
  getSource(id: string): { getClusterExpansionZoom(id: number): Promise<number> } | undefined
  queryRenderedFeatures(p: unknown, o: Record<string, unknown>): Array<{ properties?: Record<string, unknown>; geometry?: { coordinates?: [number, number] } }>
  easeTo(o: Record<string, unknown>): void
  remove(): void
}

let loading: Promise<Lib> | null = null
function loadLib(): Promise<Lib> {
  const w = window as unknown as { maplibregl?: Lib }
  if (w.maplibregl) return Promise.resolve(w.maplibregl)
  if (loading) return loading
  loading = new Promise<Lib>((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = `${BASE}maplibre-gl.css`
    css.integrity = CSS_SRI
    css.crossOrigin = 'anonymous'
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.src = `${BASE}maplibre-gl.js`
    js.integrity = JS_SRI
    js.crossOrigin = 'anonymous'
    js.async = true
    js.onload = () => (w.maplibregl ? resolve(w.maplibregl) : reject(new Error('no map library')))
    js.onerror = () => {
      loading = null
      reject(new Error('map library blocked'))
    }
    document.head.appendChild(js)
  })
  return loading
}

/** The interactive map: tiles from the chosen provider, markers with popups, clusters, and two-finger or ctrl-scroll zoom. */
export const MapEngine = ({ spec, title, onFail }: { spec: MapEngineSpec; title: string; onFail: () => void }) => {
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let map: MapInstance | null = null
    let dead = false
    loadLib()
      .then((lib) => {
        if (dead || !box.current) return
        map = new lib.Map({
          container: box.current,
          center: [spec.centre.lng, spec.centre.lat],
          zoom: Math.max(spec.zoom - 1, 0),
          cooperativeGestures: spec.lockScroll,
          attributionControl: { compact: true, customAttribution: spec.attribution },
          style: { version: 8, sources: { base: { type: 'raster', tiles: [spec.tiles], tileSize: 256, maxzoom: 19 } }, layers: [{ id: 'base', type: 'raster', source: 'base' }] },
        })
        map.addControl(new lib.NavigationControl(), 'top-right')
        const m = map
        const colour = `#${spec.colour}`
        if (spec.cluster && spec.markers.length > 3) {
          m.on('load', () => {
            m.addSource('pins', { type: 'geojson', cluster: true, clusterRadius: 50, clusterMaxZoom: 14, data: { type: 'FeatureCollection', features: spec.markers.map((p) => ({ type: 'Feature', properties: { label: p.label }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) } })
            m.addLayer({ id: 'clusters', type: 'circle', source: 'pins', filter: ['has', 'point_count'], paint: { 'circle-color': colour, 'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28], 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } })
            m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'pins', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13 }, paint: { 'text-color': '#ffffff' } })
            m.addLayer({ id: 'unclustered', type: 'circle', source: 'pins', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': colour, 'circle-radius': 8, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } })
            m.on('click', (e) => {
              const ev = e as { point: unknown; lngLat: { lng: number; lat: number } }
              const hit = m.queryRenderedFeatures(ev.point, { layers: ['clusters'] })[0]
              const id = hit?.properties?.cluster_id
              const at = hit?.geometry?.coordinates
              if (typeof id === 'number' && at) void m.getSource('pins')?.getClusterExpansionZoom(id).then((z) => m.easeTo({ center: at, zoom: z }))
            })
          })
        } else {
          for (const p of spec.markers) {
            const el = document.createElement('button')
            el.type = 'button'
            el.setAttribute('aria-label', p.label || 'Map marker')
            if (spec.markerImage) {
              el.style.cssText = `width:32px;height:32px;border:0;padding:0;background:url("${spec.markerImage}") center/contain no-repeat;cursor:pointer`
            } else {
              el.style.cssText = `width:22px;height:22px;border:3px solid #fff;border-radius:50%;background:${colour};box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;padding:0`
            }
            const marker = new lib.Marker({ element: el }) as unknown as { setLngLat(c: [number, number]): unknown; setPopup(p: unknown): unknown; addTo(m: unknown): unknown }
            marker.setLngLat([p.lng, p.lat])
            if (p.label) marker.setPopup(new lib.Popup({ offset: 14 }).setText(p.label))
            marker.addTo(m)
          }
        }
        m.on('error', () => undefined)
        setReady(true)
      })
      .catch(() => {
        if (!dead) onFail()
      })
    return () => {
      dead = true
      map?.remove()
    }
  }, [spec, onFail])

  return (
    <div className="el-map__engine" role="region" aria-label={title} style={spec.filter ? ({ '--el-map-filter': spec.filter } as React.CSSProperties) : undefined}>
      <div ref={box} className="el-map__canvas" />
      {!ready && <span className="el-map__loading">Loading map...</span>}
    </div>
  )
}
