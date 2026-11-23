/**
 * Keyed weather providers (OpenWeather, WeatherAPI, Tomorrow.io) normalised to the same shape as Open-Meteo, so
 * the Weather element does not care where the data came from. Server only. Parsers are pure and tested; the
 * fetch goes through a per-place cache so visitors never reach a provider directly.
 */
import { getJson, hourIn, hourLabel, loadWeather, resolvePlace, type WeatherData, type WeatherDay, type WeatherHour, type WeatherUnits } from './openMeteo'
import { weatherKeyFor, effectiveWeatherProvider, type MapsWeatherConfig, type WeatherProvider } from '@/features/mapsWeather/config'
import { countWeatherCall } from '@/features/mapsWeather/store'

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const r = (v: unknown): number => Math.round(num(v))

/** OpenWeather condition id to the WMO code `describeCode` understands. */
export function owCode(id: number): number {
  if (id >= 200 && id < 300) return 95
  if (id >= 300 && id < 400) return 51
  if (id >= 500 && id < 600) return id >= 520 ? 80 : 61
  if (id >= 600 && id < 700) return 71
  if (id >= 700 && id < 800) return 45
  if (id === 800) return 0
  if (id === 801 || id === 802) return 1
  return 3
}

/** WeatherAPI condition code to WMO. */
export function waCode(c: number): number {
  if (c === 1000) return 0
  if (c === 1003) return 1
  if (c === 1006 || c === 1009) return 3
  if ([1030, 1135, 1147].includes(c)) return 45
  if ([1150, 1153, 1168, 1171].includes(c)) return 51
  if ([1087, 1273, 1276, 1279, 1282].includes(c)) return 95
  if ([1066, 1069, 1072, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(c)) return 71
  if (c >= 1063) return 61
  return 3
}

/** Tomorrow.io weather code to WMO. */
export function tmCode(c: number): number {
  if (c === 1000 || c === 10000) return 0
  if (c === 1100 || c === 1101) return 1
  if (c === 1102 || c === 1001) return 3
  if (c === 2000 || c === 2100) return 45
  if (c === 4000) return 51
  if (c >= 4001 && c < 5000) return 61
  if (c >= 5000 && c < 6000) return 71
  if (c >= 6000 && c < 7000) return 67
  if (c >= 7000 && c < 8000) return 71
  if (c === 8000) return 95
  return 3
}

type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => (v && typeof v === 'object' ? (v as Raw) : {})
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : [])

export function parseOpenWeather(current: unknown, forecast: unknown, units: WeatherUnits, place: string): WeatherData | null {
  const c = obj(current)
  const main = obj(c.main)
  if (typeof main.temp !== 'number') return null
  const wind = num(obj(c.wind).speed)
  const first = obj(arr(c.weather)[0])
  const byDay = new Map<string, { max: number; min: number; code: number }>()
  for (const item of arr(obj(forecast).list)) {
    const date = String(item.dt_txt ?? '').slice(0, 10)
    if (!date) continue
    const m = obj(item.main)
    const cur = byDay.get(date)
    const code = owCode(num(obj(arr(item.weather)[0]).id))
    byDay.set(date, { max: Math.max(cur?.max ?? -Infinity, num(m.temp_max)), min: Math.min(cur?.min ?? Infinity, num(m.temp_min)), code: cur ? (String(item.dt_txt).includes('12:00') ? code : cur.code) : code })
  }
  const days: WeatherDay[] = [...byDay.entries()].slice(0, 5).map(([date, d]) => ({ date, max: r(d.max), min: r(d.min), code: d.code }))
  // 3 hour steps; the city offset (seconds) turns the UTC instant into the place's local hour.
  const offset = num(obj(obj(forecast).city).timezone)
  const hours: WeatherHour[] = arr(obj(forecast).list).slice(0, 8).map((item) => ({ label: hourIn(new Date((num(item.dt) + offset) * 1000).toISOString()), temp: r(obj(item.main).temp), code: owCode(num(obj(arr(item.weather)[0]).id)) }))
  return { place, units, now: { temp: r(main.temp), code: owCode(num(first.id)), wind: Math.round(units === 'metric' ? wind * 3.6 : wind) }, days, hours }
}

export function parseWeatherApi(j: unknown, units: WeatherUnits, place: string): WeatherData | null {
  const root = obj(j)
  const cur = obj(root.current)
  const metric = units === 'metric'
  if (typeof (metric ? cur.temp_c : cur.temp_f) !== 'number') return null
  const days: WeatherDay[] = arr(obj(root.forecast).forecastday).slice(0, 5).map((d) => {
    const day = obj(d.day)
    return { date: String(d.date ?? ''), max: r(metric ? day.maxtemp_c : day.maxtemp_f), min: r(metric ? day.mintemp_c : day.mintemp_f), code: waCode(num(obj(day.condition).code)) }
  })
  const local = String(obj(root.location).localtime ?? '').replace(' ', 'T').slice(0, 13)
  const hours: WeatherHour[] = arr(obj(root.forecast).forecastday)
    .flatMap((d) => arr(d.hour))
    .filter((h) => String(h.time ?? '').replace(' ', 'T').slice(0, 13) >= local)
    .slice(0, 12)
    .map((h) => ({ label: hourLabel(String(h.time ?? '')), temp: r(metric ? h.temp_c : h.temp_f), code: waCode(num(obj(h.condition).code)) }))
  return { place, units, now: { temp: r(metric ? cur.temp_c : cur.temp_f), code: waCode(num(obj(cur.condition).code)), wind: r(metric ? cur.wind_kph : cur.wind_mph) }, days, hours }
}

export function parseTomorrow(j: unknown, units: WeatherUnits, place: string, timeZone?: string): WeatherData | null {
  const t = obj(obj(j).timelines)
  const hour = obj(obj(arr(t.hourly)[0]).values)
  if (typeof hour.temperature !== 'number') return null
  const days: WeatherDay[] = arr(t.daily).slice(0, 5).map((d) => {
    const v = obj(d.values)
    return { date: String(d.time ?? '').slice(0, 10), max: r(v.temperatureMax), min: r(v.temperatureMin), code: tmCode(num(v.weatherCodeMax ?? v.weatherCodeMin)) }
  })
  const wind = num(hour.windSpeed)
  const hours: WeatherHour[] = arr(t.hourly).slice(0, 12).map((h) => ({ label: hourIn(String(h.time ?? ''), timeZone), temp: r(obj(h.values).temperature), code: tmCode(num(obj(h.values).weatherCode)) }))
  return { place, units, now: { temp: r(hour.temperature), code: tmCode(num(hour.weatherCode)), wind: Math.round(units === 'metric' ? wind * 3.6 : wind) }, days, hours }
}

const mem = new Map<string, { at: number; data: WeatherData }>()

async function fetchKeyed(provider: Exclude<WeatherProvider, 'open-meteo'>, key: string, place: string, units: WeatherUnits, lang: string, ttl: number): Promise<WeatherData | null> {
  const where = await resolvePlace(place)
  if (!where) return null
  const { lat, lon, name, timezone } = where
  const imperial = units === 'imperial'
  await countWeatherCall(provider)
  if (provider === 'openweather') {
    const q = `lat=${lat}&lon=${lon}&units=${imperial ? 'imperial' : 'metric'}&lang=${encodeURIComponent(lang)}&appid=${encodeURIComponent(key)}`
    const [c, f] = await Promise.all([getJson(`https://api.openweathermap.org/data/2.5/weather?${q}`, ttl), getJson(`https://api.openweathermap.org/data/2.5/forecast?${q}`, ttl)])
    return parseOpenWeather(c, f, units, name)
  }
  if (provider === 'weatherapi') {
    return parseWeatherApi(await getJson(`https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(key)}&q=${lat},${lon}&days=5&lang=${encodeURIComponent(lang)}`, ttl), units, name)
  }
  return parseTomorrow(await getJson(`https://api.tomorrow.io/v4/weather/forecast?location=${lat},${lon}&units=${imperial ? 'imperial' : 'metric'}&apikey=${encodeURIComponent(key)}`, ttl), units, name, timezone)
}

/** The weather for a place through the provider chosen in settings; a provider with no key falls back to Open-Meteo. */
export async function loadConfiguredWeather(config: MapsWeatherConfig, place: string, unitsOverride?: WeatherUnits, cacheOverride?: number): Promise<WeatherData | null> {
  const provider = effectiveWeatherProvider(config)
  const units = unitsOverride ?? config.weather.units
  const minutes = Math.min(Math.max(Math.trunc(cacheOverride ?? config.weather.cacheMinutes) || 30, 5), 1440)
  if (provider === 'open-meteo') return loadWeather(place, units, minutes)
  const ttl = minutes * 60
  const key = `${provider}|${place.trim().toLowerCase()}|${units}|${config.weather.language}`
  const hit = mem.get(key)
  if (hit && Date.now() - hit.at < ttl * 1000) return hit.data
  try {
    const data = await fetchKeyed(provider, weatherKeyFor(config, provider), place, units, config.weather.language, ttl)
    if (!data) return null
    mem.set(key, { at: Date.now(), data })
    if (mem.size > 200) mem.delete(mem.keys().next().value as string)
    return data
  } catch {
    return null
  }
}

/** Test button: one live call with the saved settings. */
export async function testWeather(config: MapsWeatherConfig): Promise<{ ok: boolean; message: string }> {
  const provider = effectiveWeatherProvider(config)
  const asked = config.weather.provider
  if (asked !== provider) return { ok: false, message: `No key saved for ${asked}, so the site uses Open-Meteo.` }
  try {
    const place = 'London'
    const data = provider === 'open-meteo' ? await loadWeather(place, config.weather.units, 5) : await fetchKeyed(provider, weatherKeyFor(config, provider), place, config.weather.units, config.weather.language, 60)
    return data ? { ok: true, message: `Works: ${data.place} is ${data.now.temp}${data.units === 'imperial' ? ' F' : ' C'} now.` } : { ok: false, message: 'The provider did not return a forecast. Check the key.' }
  } catch {
    return { ok: false, message: 'The provider refused the request. Check the key.' }
  }
}
