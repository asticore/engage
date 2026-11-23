import React from 'react'

import { geocodeAddress } from '@/features/mapsWeather/geocode'
import { buildMapView, parseMarkers } from '@/features/mapsWeather/mapView'
import { readMapsWeather } from '@/features/mapsWeather/store'

import { mapEmbedSrc, num, str } from './elementUtil'
import { MapFacade } from './MapFacade'

type P = Record<string, unknown>

/**
 * `map` on the published page (server). The provider and style come from Settings > Maps and weather unless the
 * element overrides them. The address is looked up once and stored. A pasted embed link still wins. Anything that
 * fails falls back to the old keyless embed, so a page with a map never breaks.
 */
export async function MapServerElement(p: P): Promise<React.ReactElement> {
  const height = num(p.height, 320, 120, 800)
  const zoom = num(p.zoom, 14, 1, 20)
  const title = str(p.title, 'Map')
  const address = str(p.address).trim()
  const label = address || title
  const pasted = mapEmbedSrc('', p.embedUrl, zoom)
  if (pasted) return <MapFacade src={pasted} title={title} label={label} height={height} />
  let view
  try {
    const config = await readMapsWeather()
    const point = address ? await geocodeAddress(address) : null
    view = buildMapView({ config, provider: p.provider, style: p.style, address, point, zoom, width: 1000, height, markers: parseMarkers(p.markers), markerColour: p.markerColour, interactive: p.interactive, cluster: p.cluster, lockScroll: p.lockScroll, markerImage: p.markerImage })
  } catch {
    view = null
  }
  const src = view?.embedSrc ?? mapEmbedSrc(address, '', zoom)
  const directions = p.showDirections === false || p.showDirections === 'false' ? null : view?.directionsUrl ?? null
  if (!src && !view?.staticSrc && !view?.engine) return <div className="el-placeholder" style={{ height }}>Enter an address for the map</div>
  return <MapFacade src={src ?? ''} title={title} label={label} height={height} preview={view?.staticSrc ?? undefined} directions={directions ?? undefined} engine={view?.engine} noscriptSrc={view?.noscriptSrc ?? undefined} />
}
