/**
 * Site-wide settings for the Map and Weather elements: which provider each one uses and the keys for the keyed
 * providers. Pure (no database, no request), shared by the admin screen, the elements and the tests.
 * Stored as one JSON row in `eg_kv`; keys are encrypted there and never sent back to the browser.
 */

export const MAP_PROVIDERS = ['osm', 'google', 'maptiler', 'mapbox'] as const
export type MapProvider = (typeof MAP_PROVIDERS)[number]
export const MAP_STYLES = ['light', 'dark', 'grayscale', 'satellite', 'terrain'] as const
export type MapStyle = (typeof MAP_STYLES)[number]
export const WEATHER_PROVIDERS = ['open-meteo', 'openweather', 'weatherapi', 'tomorrow'] as const
export type WeatherProvider = (typeof WEATHER_PROVIDERS)[number]
export type WeatherUnitsSetting = 'metric' | 'imperial'

export const MAP_PROVIDER_LABELS: Record<MapProvider, string> = { osm: 'OpenStreetMap (no key)', google: 'Google Maps (key)', maptiler: 'MapTiler (key)', mapbox: 'Mapbox (key)' }
export const WEATHER_PROVIDER_LABELS: Record<WeatherProvider, string> = { 'open-meteo': 'Open-Meteo (free, no key)', openweather: 'OpenWeather (key)', weatherapi: 'WeatherAPI (key)', tomorrow: 'Tomorrow.io (key)' }

export type MapsWeatherConfig = {
  map: { provider: MapProvider; style: MapStyle; googleKey: string; maptilerKey: string; mapboxKey: string }
  weather: {
    provider: WeatherProvider
    openweatherKey: string
    weatherapiKey: string
    tomorrowKey: string
    units: WeatherUnitsSetting
    /** Two letter language code sent to the providers that support it. */
    language: string
    cacheMinutes: number
  }
}

export const DEFAULT_MAPS_WEATHER: MapsWeatherConfig = {
  map: { provider: 'osm', style: 'light', googleKey: '', maptilerKey: '', mapboxKey: '' },
  weather: { provider: 'open-meteo', openweatherKey: '', weatherapiKey: '', tomorrowKey: '', units: 'metric', language: 'en', cacheMinutes: 30 },
}

const SECRET_KEYS = ['googleKey', 'maptilerKey', 'mapboxKey', 'openweatherKey', 'weatherapiKey', 'tomorrowKey'] as const
export type SecretKey = (typeof SECRET_KEYS)[number]

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback)
const KEY_SHAPE = /^[A-Za-z0-9._~+/=:-]{8,200}$/

/** A key as typed, or an empty string when it is not a plain token (so it can never smuggle markup or a URL). */
export const cleanKey = (v: unknown): string => {
  const t = text(v, 200)
  return KEY_SHAPE.test(t) ? t : ''
}

/** Drops anything that is not a plain value, so a stored or posted value cannot smuggle structure. */
export function normaliseConfig(input: unknown): MapsWeatherConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as { map?: Record<string, unknown>; weather?: Record<string, unknown> }
  const m = raw.map ?? {}
  const w = raw.weather ?? {}
  const cache = Math.trunc(Number(w.cacheMinutes))
  return {
    map: {
      provider: oneOf(m.provider, MAP_PROVIDERS, 'osm'),
      style: oneOf(m.style, MAP_STYLES, 'light'),
      googleKey: cleanKey(m.googleKey),
      maptilerKey: cleanKey(m.maptilerKey),
      mapboxKey: cleanKey(m.mapboxKey),
    },
    weather: {
      provider: oneOf(w.provider, WEATHER_PROVIDERS, 'open-meteo'),
      openweatherKey: cleanKey(w.openweatherKey),
      weatherapiKey: cleanKey(w.weatherapiKey),
      tomorrowKey: cleanKey(w.tomorrowKey),
      units: w.units === 'imperial' ? 'imperial' : 'metric',
      language: /^[a-z]{2}$/.test(text(w.language, 2)) ? text(w.language, 2) : 'en',
      cacheMinutes: Number.isFinite(cache) ? Math.min(Math.max(cache, 5), 1440) : 30,
    },
  }
}

/** The key a provider needs, or '' when it has none or none is saved. */
export function mapKeyFor(config: MapsWeatherConfig, provider: MapProvider): string {
  return provider === 'google' ? config.map.googleKey : provider === 'maptiler' ? config.map.maptilerKey : provider === 'mapbox' ? config.map.mapboxKey : ''
}
export function weatherKeyFor(config: MapsWeatherConfig, provider: WeatherProvider): string {
  return provider === 'openweather' ? config.weather.openweatherKey : provider === 'weatherapi' ? config.weather.weatherapiKey : provider === 'tomorrow' ? config.weather.tomorrowKey : ''
}

/** A provider that needs a key but has none falls back to the free one, so a page never breaks. */
export function effectiveMapProvider(config: MapsWeatherConfig, wanted?: unknown): MapProvider {
  const p = oneOf(wanted, MAP_PROVIDERS, config.map.provider)
  return p === 'osm' || mapKeyFor(config, p) ? p : 'osm'
}
export function effectiveWeatherProvider(config: MapsWeatherConfig): WeatherProvider {
  const p = config.weather.provider
  return p === 'open-meteo' || weatherKeyFor(config, p) ? p : 'open-meteo'
}

/** What the browser may see: every key replaced by whether it is saved. */
export function redactConfig(config: MapsWeatherConfig): { map: Omit<MapsWeatherConfig['map'], SecretKey> & Record<string, boolean | string>; weather: Record<string, unknown> } {
  const saved = (k: SecretKey): boolean => Boolean((config.map as Record<string, string>)[k] ?? (config.weather as Record<string, string | number>)[k])
  return {
    map: { provider: config.map.provider, style: config.map.style, googleKeySaved: saved('googleKey'), maptilerKeySaved: saved('maptilerKey'), mapboxKeySaved: saved('mapboxKey') },
    weather: { provider: config.weather.provider, units: config.weather.units, language: config.weather.language, cacheMinutes: config.weather.cacheMinutes, openweatherKeySaved: saved('openweatherKey'), weatherapiKeySaved: saved('weatherapiKey'), tomorrowKeySaved: saved('tomorrowKey') },
  }
}

/**
 * Merges a posted form into the saved config: a key left blank keeps the saved one, `clear:<name>` removes it.
 */
export function mergePosted(current: MapsWeatherConfig, posted: unknown): MapsWeatherConfig {
  const body = (posted && typeof posted === 'object' ? posted : {}) as { map?: Record<string, unknown>; weather?: Record<string, unknown>; clear?: unknown }
  const clear = new Set(Array.isArray(body.clear) ? body.clear.filter((x): x is string => typeof x === 'string') : [])
  const next = normaliseConfig({ map: { ...current.map, ...stripBlank(body.map) }, weather: { ...current.weather, ...stripBlank(body.weather) } })
  for (const k of SECRET_KEYS) {
    if (!clear.has(k)) continue
    if (k in next.map) (next.map as Record<string, string>)[k] = ''
    else (next.weather as Record<string, string | number>)[k] = ''
  }
  return next
}

function stripBlank(o: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o ?? {})) if (!(typeof v === 'string' && v.trim() === '' && k.endsWith('Key'))) out[k] = v
  return out
}

/** The keys that need encrypting before they are stored. */
export const SECRET_FIELD_NAMES = SECRET_KEYS
