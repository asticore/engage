/**
 * Builds the pieces of one map for a provider: the interactive embed address, a static picture (the placeholder
 * shown before the visitor asks for the map, and the fallback when scripts are blocked), a directions link and
 * the markers. Pure: no network, no database. Keys only ever appear in addresses the provider expects them in.
 */
import { effectiveMapProvider, mapKeyFor, MAP_STYLES, type MapProvider, type MapsWeatherConfig, type MapStyle } from './config'

export type MapMarker = { lat: number; lng: number; label: string }
export type MapEngineSpec = {
  tiles: string
  attribution: string
  centre: { lat: number; lng: number }
  zoom: number
  markers: MapMarker[]
  colour: string
  cluster: boolean
  lockScroll: boolean
  markerImage: string
  /** CSS filter that gives the OpenStreetMap tiles a dark or grayscale look when no keyed style is available. */
  filter: string
}
export type MapView = {
  provider: MapProvider
  embedSrc: string | null
  staticSrc: string | null
  directionsUrl: string | null
  /** Set when the map can run on the interactive engine (OpenStreetMap, MapTiler, Mapbox). */
  engine?: MapEngineSpec
  /** One OpenStreetMap tile at the centre, shown with scripts blocked. */
  noscriptSrc?: string | null
}

export const MARKER_COLOURS = /^#?[0-9a-fA-F]{6}$/

/** "lat,lng" in range, or null. */
export function parseLatLng(v: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(v)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

/** Marker lines: "lat,lng | Label" per line, up to 25. Lines that are not coordinates are skipped. */
export function parseMarkers(v: unknown): MapMarker[] {
  if (typeof v !== 'string') return []
  const out: MapMarker[] = []
  for (const line of v.split('\n').slice(0, 25)) {
    const [pos, ...rest] = line.split('|')
    const ll = parseLatLng(pos ?? '')
    if (ll) out.push({ ...ll, label: rest.join('|').trim().slice(0, 80) })
  }
  return out
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi)
export const cleanStyle = (v: unknown): MapStyle | '' => (typeof v === 'string' && (MAP_STYLES as readonly string[]).includes(v) ? (v as MapStyle) : '')
export const cleanColour = (v: unknown): string => (typeof v === 'string' && MARKER_COLOURS.test(v.trim()) ? v.trim().replace('#', '').toLowerCase() : 'd9382b')

const MAPTILER_STYLE: Record<MapStyle, string> = { light: 'streets-v2', dark: 'streets-v2-dark', grayscale: 'streets-v2-light', satellite: 'hybrid', terrain: 'outdoor-v2' }
const MAPBOX_STYLE: Record<MapStyle, string> = { light: 'streets-v12', dark: 'dark-v11', grayscale: 'light-v11', satellite: 'satellite-streets-v12', terrain: 'outdoors-v12' }
const GOOGLE_TYPE: Record<MapStyle, string> = { light: 'roadmap', dark: 'roadmap', grayscale: 'roadmap', satellite: 'satellite', terrain: 'roadmap' }

export type MapInput = {
  config: MapsWeatherConfig
  /** Per element provider; blank means the site default. */
  provider?: unknown
  style?: unknown
  address: string
  /** Resolved position of the address (from the geocode cache), or null. */
  point: { lat: number; lng: number } | null
  zoom: number
  width: number
  height: number
  markers: MapMarker[]
  markerColour?: unknown
  /** Interactive engine switches from the element. `interactive` false keeps the plain embed. */
  interactive?: unknown
  cluster?: unknown
  lockScroll?: unknown
  markerImage?: unknown
}

const truthy = (v: unknown, fallback: boolean): boolean => (v === undefined || v === '' || v === null ? fallback : v === true || v === 'true')
/** Only an https address is accepted as a marker picture. */
export const cleanImage = (v: unknown): string => {
  if (typeof v !== 'string') return ''
  try {
    const u = new URL(v.trim())
    return u.protocol === 'https:' && !u.username && !u.password && u.toString().length <= 500 ? u.toString() : ''
  } catch {
    return ''
  }
}

/** The OpenStreetMap tile that holds a point, as a picture address. */
export function osmTileUrl(lat: number, lng: number, zoom: number): string {
  const z = Math.round(clamp(zoom, 1, 17))
  const n = 2 ** z
  const x = Math.min(n - 1, Math.max(0, Math.floor(((lng + 180) / 360) * n)))
  const rad = (lat * Math.PI) / 180
  const y = Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)))
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
}

const OSM_FILTER: Record<MapStyle, string> = { light: '', dark: 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9)', grayscale: 'grayscale(1)', satellite: '', terrain: '' }

/** OpenStreetMap's embed takes one marker and a box; this converts a centre and zoom to the box. */
export function osmEmbed(lat: number, lng: number, zoom: number): string {
  const d = 0.02 * Math.pow(2, 14 - clamp(zoom, 1, 20))
  const bbox = [lng - d, lat - d / 2, lng + d, lat + d / 2].map((n) => n.toFixed(5)).join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`
}

export function buildMapView(input: MapInput): MapView {
  const provider = effectiveMapProvider(input.config, input.provider)
  const style = cleanStyle(input.style) || input.config.map.style
  const zoom = Math.round(clamp(input.zoom, 1, 20))
  const w = Math.round(clamp(input.width, 100, 1280))
  const h = Math.round(clamp(input.height, 100, 1280))
  const key = mapKeyFor(input.config, provider)
  const centre = input.point ?? input.markers[0] ?? null
  const q = input.address.trim().slice(0, 200)
  const colour = cleanColour(input.markerColour)
  const pins = input.markers.length ? input.markers : centre ? [{ lat: centre.lat, lng: centre.lng, label: '' }] : []

  const directionsUrl = centre
    ? `https://www.openstreetmap.org/directions?to=${encodeURIComponent(`${centre.lat},${centre.lng}`)}`
    : q
      ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`
      : null

  if (provider === 'google') {
    const place = centre ? `${centre.lat},${centre.lng}` : q
    if (!place) return { provider, embedSrc: null, staticSrc: null, directionsUrl }
    // Keyless embed: the keyed Embed API shows a grey box unless that API is enabled and the key allows this site.
    const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(place)}&z=${zoom}&t=${style === 'satellite' ? 'k' : style === 'terrain' ? 'p' : 'm'}&output=embed`
    const marks = pins.map((p) => `${p.lat},${p.lng}`).join('|')
    const staticSrc = centre ? `https://maps.googleapis.com/maps/api/staticmap?center=${centre.lat},${centre.lng}&zoom=${zoom}&size=${Math.min(w, 640)}x${Math.min(h, 640)}&maptype=${GOOGLE_TYPE[style]}&markers=color:0x${colour}|${encodeURIComponent(marks)}&key=${encodeURIComponent(key)}` : null
    return { provider, embedSrc, staticSrc, directionsUrl: centre ? `https://www.google.com/maps/dir/?api=1&destination=${centre.lat},${centre.lng}` : directionsUrl }
  }

  if (!centre) {
    // Text only, no position: only the keyless Google embed can search by words, and it is offered as the fallback for OSM.
    const embedSrc = q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&output=embed` : null
    return { provider: 'osm', embedSrc, staticSrc: null, directionsUrl }
  }

  const wantEngine = truthy(input.interactive, true)
  const engineBase = {
    centre: { lat: centre.lat, lng: centre.lng },
    zoom,
    markers: pins,
    colour,
    cluster: truthy(input.cluster, true),
    lockScroll: truthy(input.lockScroll, true),
    markerImage: cleanImage(input.markerImage),
  }

  if (provider === 'maptiler') {
    const s = MAPTILER_STYLE[style]
    const marks = pins.map((p) => `${p.lng},${p.lat}`).join('|')
    return {
      provider,
      embedSrc: `https://api.maptiler.com/maps/${s}/?key=${encodeURIComponent(key)}#${zoom}/${centre.lat}/${centre.lng}`,
      staticSrc: `https://api.maptiler.com/maps/${s}/static/${centre.lng},${centre.lat},${zoom}/${Math.min(w, 2048)}x${Math.min(h, 2048)}.png?key=${encodeURIComponent(key)}&markers=${marks}|color:%23${colour}`,
      directionsUrl,
      engine: wantEngine ? { ...engineBase, tiles: `https://api.maptiler.com/maps/${s}/256/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`, attribution: '\u00a9 MapTiler \u00a9 OpenStreetMap contributors', filter: '' } : undefined,
    }
  }

  if (provider === 'mapbox') {
    const s = MAPBOX_STYLE[style]
    const marks = pins.map((p) => `pin-s+${colour}(${p.lng},${p.lat})`).join(',')
    const staticSrc = `https://api.mapbox.com/styles/v1/mapbox/${s}/static/${marks}/${centre.lng},${centre.lat},${zoom}/${Math.min(w, 1280)}x${Math.min(h, 1280)}?access_token=${encodeURIComponent(key)}`
    return {
      provider,
      embedSrc: null,
      staticSrc,
      directionsUrl,
      engine: wantEngine ? { ...engineBase, tiles: `https://api.mapbox.com/styles/v1/mapbox/${s}/tiles/256/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(key)}`, attribution: '\u00a9 Mapbox \u00a9 OpenStreetMap contributors', filter: '' } : undefined,
    }
  }

  return {
    provider: 'osm',
    embedSrc: osmEmbed(centre.lat, centre.lng, zoom),
    staticSrc: null,
    directionsUrl,
    noscriptSrc: osmTileUrl(centre.lat, centre.lng, zoom),
    engine: wantEngine ? { ...engineBase, tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '\u00a9 OpenStreetMap contributors', filter: OSM_FILTER[style] } : undefined,
  }
}
