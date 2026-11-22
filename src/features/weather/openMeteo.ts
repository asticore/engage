/**
 * Weather from Open-Meteo (free, no key). Server only. Responses are cached per place and unit in the Worker's
 * Cache API (and a small in-memory map as a fallback), so visitors never reach the provider directly.
 */

export type WeatherUnits = 'metric' | 'imperial'
export type WeatherNow = { temp: number; code: number; wind: number }
export type WeatherDay = { date: string; max: number; min: number; code: number }
export type WeatherData = { place: string; units: WeatherUnits; now: WeatherNow; days: WeatherDay[] }

const GEO = 'https://geocoding-api.open-meteo.com/v1/search'
const API = 'https://api.open-meteo.com/v1/forecast'

/** A decimal latitude and longitude pair in range, or null. */
export function parseCoords(v: string): { lat: number; lon: number } | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(v)
  if (!m) return null
  const lat = Number(m[1]), lon = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null
}

/** Words and icon for a WMO weather code. */
export function describeCode(code: number): { label: string; icon: string } {
  const e = (cp: number) => String.fromCodePoint(cp)
  if (code === 0) return { label: 'Clear', icon: e(0x2600) }
  if (code <= 2) return { label: 'Partly cloudy', icon: e(0x26c5) }
  if (code === 3) return { label: 'Cloudy', icon: e(0x2601) }
  if (code === 45 || code === 48) return { label: 'Fog', icon: e(0x1f32b) }
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: e(0x1f326) }
  if (code >= 61 && code <= 67) return { label: 'Rain', icon: e(0x1f327) }
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: e(0x1f328) }
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: e(0x1f326) }
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: e(0x1f328) }
  if (code >= 95) return { label: 'Thunderstorm', icon: e(0x26c8) }
  return { label: 'Unknown', icon: e(0x2753) }
}

const mem = new Map<string, { at: number; data: WeatherData }>()

async function getJson(url: string, ttlSeconds: number): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cf: { cacheTtl: ttlSeconds, cacheEverything: true } } as RequestInit)
  if (!res.ok) throw new Error(`weather ${res.status}`)
  return res.json()
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Current conditions and a 5 day forecast for a place name or "lat,lon". Null when the place or the provider fails. */
export async function loadWeather(place: string, units: WeatherUnits, cacheMinutes: number): Promise<WeatherData | null> {
  const key = `${place.trim().toLowerCase()}|${units}`
  const ttl = Math.min(Math.max(Math.trunc(cacheMinutes) || 30, 5), 1440) * 60
  const hit = mem.get(key)
  if (hit && Date.now() - hit.at < ttl * 1000) return hit.data
  try {
    let lat: number, lon: number, name = place.trim()
    const c = parseCoords(place)
    if (c) { lat = c.lat; lon = c.lon } else {
      if (!name || name.length > 80) return null
      const g = (await getJson(`${GEO}?name=${encodeURIComponent(name)}&count=1&format=json`, 86400)) as { results?: Array<{ latitude: number; longitude: number; name: string }> }
      const r = g.results?.[0]
      if (!r) return null
      lat = r.latitude; lon = r.longitude; name = r.name
    }
    const imperial = units === 'imperial'
    const url = `${API}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto${imperial ? '&temperature_unit=fahrenheit&wind_speed_unit=mph' : ''}`
    const j = (await getJson(url, ttl)) as {
      current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number }
      daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[] }
    }
    if (!j.current || !j.daily?.time) return null
    const d = j.daily
    const data: WeatherData = {
      place: name, units,
      now: { temp: Math.round(num(j.current.temperature_2m)), code: num(j.current.weather_code), wind: Math.round(num(j.current.wind_speed_10m)) },
      days: d.time!.map((date, i) => ({ date, max: Math.round(num(d.temperature_2m_max?.[i])), min: Math.round(num(d.temperature_2m_min?.[i])), code: num(d.weather_code?.[i]) })),
    }
    mem.set(key, { at: Date.now(), data })
    if (mem.size > 200) mem.delete(mem.keys().next().value as string)
    return data
  } catch {
    return null
  }
}
