import { describe, expect, it } from 'vitest'

import { DEFAULT_MAPS_WEATHER, effectiveMapProvider, effectiveWeatherProvider, mergePosted, normaliseConfig, redactConfig } from '@/features/mapsWeather/config'
import { buildMapView, cleanImage, osmTileUrl, parseLatLng, parseMarkers } from '@/features/mapsWeather/mapView'
import { owCode, parseOpenWeather, parseTomorrow, parseWeatherApi, tmCode, waCode } from '@/features/weather/providers'
import { resolveTags } from '@/lib/dynamicTags'

const withKeys = normaliseConfig({ map: { provider: 'maptiler', maptilerKey: 'abcdef123456', googleKey: 'AIzaSyABCDEFGH123', mapboxKey: 'pk.abcdefgh12345' }, weather: { provider: 'weatherapi', weatherapiKey: 'wxkey12345678' } })
const base = { config: withKeys, address: '1 Test St', point: { lat: 51.5, lng: -0.12 }, zoom: 14, width: 800, height: 320, markers: [] as ReturnType<typeof parseMarkers> }

describe('maps and weather settings', () => {
  it('defaults to OpenStreetMap and Open-Meteo with no keys', () => {
    expect(DEFAULT_MAPS_WEATHER.map.provider).toBe('osm')
    expect(DEFAULT_MAPS_WEATHER.weather.provider).toBe('open-meteo')
  })
  it('drops unknown values and keys that are not plain tokens', () => {
    const c = normaliseConfig({ map: { provider: 'evil', style: 'x', googleKey: '"><script>' }, weather: { provider: 'nope', units: 'x', cacheMinutes: 99999, language: 'english' } })
    expect(c.map.provider).toBe('osm')
    expect(c.map.googleKey).toBe('')
    expect(c.weather.provider).toBe('open-meteo')
    expect(c.weather.cacheMinutes).toBe(1440)
    expect(c.weather.language).toBe('en')
  })
  it('falls back to the free provider when a keyed one has no key', () => {
    expect(effectiveMapProvider(DEFAULT_MAPS_WEATHER, 'google')).toBe('osm')
    expect(effectiveMapProvider(withKeys, 'google')).toBe('google')
    expect(effectiveMapProvider(withKeys)).toBe('maptiler')
    expect(effectiveWeatherProvider(normaliseConfig({ weather: { provider: 'tomorrow' } }))).toBe('open-meteo')
    expect(effectiveWeatherProvider(withKeys)).toBe('weatherapi')
  })
  it('never returns a key to the browser', () => {
    const json = JSON.stringify(redactConfig(withKeys))
    expect(json).not.toContain('abcdef123456')
    expect(json).not.toContain('wxkey12345678')
    expect(redactConfig(withKeys).map.maptilerKeySaved).toBe(true)
  })
  it('keeps a saved key when the form leaves it blank and removes it on request', () => {
    const kept = mergePosted(withKeys, { map: { maptilerKey: '', provider: 'osm' } })
    expect(kept.map.maptilerKey).toBe('abcdef123456')
    expect(kept.map.provider).toBe('osm')
    const cleared = mergePosted(withKeys, { clear: ['maptilerKey', 'weatherapiKey'] })
    expect(cleared.map.maptilerKey).toBe('')
    expect(cleared.weather.weatherapiKey).toBe('')
    expect(cleared.map.googleKey).toBe('AIzaSyABCDEFGH123')
  })
})

describe('map views', () => {
  it('parses coordinates and marker lines', () => {
    expect(parseLatLng('51.5, -0.12')).toEqual({ lat: 51.5, lng: -0.12 })
    expect(parseLatLng('91,0')).toBeNull()
    expect(parseMarkers('51.5,-0.12 | Shop\nnot a point\n-27.4,153.0')).toEqual([{ lat: 51.5, lng: -0.12, label: 'Shop' }, { lat: -27.4, lng: 153, label: '' }])
  })
  it('uses OpenStreetMap with no key', () => {
    const v = buildMapView({ ...base, config: DEFAULT_MAPS_WEATHER })
    expect(v.provider).toBe('osm')
    expect(v.embedSrc).toContain('openstreetmap.org/export/embed.html')
    expect(v.staticSrc).toBeNull()
    expect(v.directionsUrl).toContain('openstreetmap.org/directions')
  })
  it('uses the keyless Google embed by default, with no static picture', () => {
    const v = buildMapView({ ...base, provider: 'google', style: 'satellite' })
    expect(v.provider).toBe('google')
    expect(v.embedSrc).toContain('https://www.google.com/maps?q=')
    expect(v.embedSrc).toContain('&t=k')
    expect(v.embedSrc).not.toContain('embed/v1')
    expect(v.staticSrc).toBeNull()
  })
  it('uses the keyed Embed API and Static picture only when the setting is on', () => {
    const keyedConfig = normaliseConfig({ map: { provider: 'google', googleKey: 'AIzaSyABCDEFGH123', googleEmbedApi: true } })
    const v = buildMapView({ ...base, config: keyedConfig, provider: 'google', style: 'satellite' })
    expect(v.embedSrc).toContain('https://www.google.com/maps/embed/v1/place?key=AIzaSyABCDEFGH123')
    expect(v.embedSrc).toContain('&q=51.5%2C-0.12')
    expect(v.embedSrc).toContain('&maptype=satellite')
    expect(v.staticSrc).toContain('staticmap')
    expect(v.staticSrc).toContain('key=AIzaSyABCDEFGH123')
    const noKey = normaliseConfig({ map: { provider: 'google', googleEmbedApi: true } })
    expect(buildMapView({ ...base, config: noKey, provider: 'google' }).embedSrc).not.toContain('embed/v1')
  })
  it('keeps the Google setting through save, redaction and normalising', () => {
    expect(normaliseConfig({ map: { googleEmbedApi: 'true' } }).map.googleEmbedApi).toBe(true)
    expect(normaliseConfig(DEFAULT_MAPS_WEATHER).map.googleEmbedApi).toBe(false)
    expect(redactConfig(withKeys).map.googleEmbedApi).toBe(false)
    expect(mergePosted(withKeys, { map: { googleEmbedApi: true } }).map.googleEmbedApi).toBe(true)
    expect(mergePosted({ ...withKeys, map: { ...withKeys.map, googleEmbedApi: true } }, { map: { googleEmbedApi: false } }).map.googleEmbedApi).toBe(false)
  })
  it('builds MapTiler and Mapbox pictures with the style, colour and every marker', () => {
    const m = buildMapView({ ...base, provider: 'maptiler', style: 'dark', markers: parseMarkers('51.5,-0.12\n51.6,-0.1'), markerColour: '#112233' })
    expect(m.embedSrc).toContain('api.maptiler.com/maps/streets-v2-dark/')
    expect(m.staticSrc).toContain('markers=-0.12,51.5|-0.1,51.6|color:%23112233')
    const b = buildMapView({ ...base, provider: 'mapbox', style: 'terrain' })
    expect(b.embedSrc).toBeNull()
    expect(b.staticSrc).toContain('outdoors-v12')
    expect(b.staticSrc).toContain('access_token=')
  })
  it('with no position falls back to the keyless Google embed for words', () => {
    const v = buildMapView({ ...base, point: null })
    expect(v.embedSrc).toContain('https://www.google.com/maps?q=1%20Test%20St')
  })
})

describe('interactive map engine', () => {
  it('OpenStreetMap runs on the engine with a style filter and a scripts-blocked tile', () => {
    const v = buildMapView({ ...base, config: DEFAULT_MAPS_WEATHER, style: 'dark' })
    expect(v.engine?.tiles).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(v.engine?.filter).toContain('invert')
    expect(v.engine?.lockScroll).toBe(true)
    expect(v.noscriptSrc).toMatch(/^https:\/\/tile\.openstreetmap\.org\/14\/\d+\/\d+\.png$/)
  })
  it('keyed providers get raster tiles with their key, and switches turn the engine off or change it', () => {
    expect(buildMapView({ ...base, provider: 'maptiler', style: 'satellite' }).engine?.tiles).toContain('maps/hybrid/256/')
    expect(buildMapView({ ...base, provider: 'mapbox' }).engine?.tiles).toContain('access_token=')
    expect(buildMapView({ ...base, provider: 'maptiler', interactive: false }).engine).toBeUndefined()
    const e = buildMapView({ ...base, provider: 'maptiler', cluster: 'false', lockScroll: false, markerImage: 'https://example.com/pin.png', markers: parseMarkers('51.5,-0.12 | A') }).engine
    expect(e?.cluster).toBe(false)
    expect(e?.lockScroll).toBe(false)
    expect(e?.markerImage).toBe('https://example.com/pin.png')
    expect(e?.markers).toHaveLength(1)
  })
  it('accepts only https marker pictures and computes the tile', () => {
    expect(cleanImage('http://x.test/a.png')).toBe('')
    expect(cleanImage('javascript:alert(1)')).toBe('')
    expect(cleanImage('https://u:p@x.test/a.png')).toBe('')
    expect(osmTileUrl(0, 0, 1)).toBe('https://tile.openstreetmap.org/1/1/1.png')
  })
})

describe('hourly weather', () => {
  it('OpenWeather uses the city offset for local hours', () => {
    const w = parseOpenWeather({ main: { temp: 1 }, wind: {}, weather: [{ id: 800 }] }, { city: { timezone: 3600 }, list: [{ dt: Date.UTC(2026, 10, 23, 12) / 1000, dt_txt: '2026-11-23 12:00:00', main: { temp: 7.4, temp_max: 8, temp_min: 6 }, weather: [{ id: 800 }] }] }, 'metric', 'x')
    expect(w?.hours).toEqual([{ label: '13:00', temp: 7, code: 0 }])
  })
  it('WeatherAPI starts at the current local hour and crosses midnight', () => {
    const hr = (time: string, c: number) => ({ time, temp_c: c, temp_f: c, condition: { code: 1000 } })
    const j = { location: { localtime: '2026-11-23 22:40' }, current: { temp_c: 9, temp_f: 48, condition: { code: 1000 } }, forecast: { forecastday: [{ date: '2026-11-23', day: { condition: {} }, hour: [hr('2026-11-23 21:00', 1), hr('2026-11-23 22:00', 2), hr('2026-11-23 23:00', 3)] }, { date: '2026-11-24', day: { condition: {} }, hour: [hr('2026-11-24 00:00', 4)] }] } }
    expect(parseWeatherApi(j, 'metric', 'x')?.hours?.map((h) => `${h.label}=${h.temp}`)).toEqual(['22:00=2', '23:00=3', '00:00=4'])
  })
  it('Tomorrow.io labels hours in the place time zone', () => {
    const j = { timelines: { hourly: [{ time: '2026-11-23T12:00:00Z', values: { temperature: 3.2, weatherCode: 1000, windSpeed: 1 } }], daily: [] as unknown[] } }
    expect(parseTomorrow(j, 'metric', 'x', 'Australia/Brisbane')?.hours).toEqual([{ label: '22:00', temp: 3, code: 0 }])
    expect(parseTomorrow(j, 'metric', 'x')?.hours?.[0]?.label).toBe('12:00')
  })
})

describe('weather providers', () => {
  it('maps condition codes to WMO groups', () => {
    expect(owCode(800)).toBe(0)
    expect(owCode(501)).toBe(61)
    expect(waCode(1000)).toBe(0)
    expect(waCode(1195)).toBe(61)
    expect(tmCode(8000)).toBe(95)
  })
  it('normalises OpenWeather', () => {
    const w = parseOpenWeather(
      { main: { temp: 20.4 }, wind: { speed: 5 }, weather: [{ id: 800 }] },
      { list: [{ dt_txt: '2026-11-23 12:00:00', main: { temp_max: 22, temp_min: 14 }, weather: [{ id: 500 }] }, { dt_txt: '2026-11-23 15:00:00', main: { temp_max: 24, temp_min: 15 }, weather: [{ id: 800 }] }] },
      'metric', 'London',
    )
    expect(w?.now).toEqual({ temp: 20, code: 0, wind: 18 })
    expect(w?.days).toEqual([{ date: '2026-11-23', max: 24, min: 14, code: 61 }])
    expect(parseOpenWeather({}, {}, 'metric', 'x')).toBeNull()
  })
  it('normalises WeatherAPI in both units', () => {
    const j = { current: { temp_c: 10.2, temp_f: 50.4, wind_kph: 12, wind_mph: 7, condition: { code: 1003 } }, forecast: { forecastday: [{ date: '2026-11-23', day: { maxtemp_c: 12, mintemp_c: 5, maxtemp_f: 54, mintemp_f: 41, condition: { code: 1183 } } }] } }
    expect(parseWeatherApi(j, 'metric', 'Paris')?.now).toEqual({ temp: 10, code: 1, wind: 12 })
    expect(parseWeatherApi(j, 'imperial', 'Paris')?.days[0]).toEqual({ date: '2026-11-23', max: 54, min: 41, code: 61 })
  })
  it('normalises Tomorrow.io', () => {
    const j = { timelines: { hourly: [{ values: { temperature: 8.6, weatherCode: 1000, windSpeed: 2 } }], daily: [{ time: '2026-11-23T00:00:00Z', values: { temperatureMax: 11, temperatureMin: 4, weatherCodeMax: 4001 } }] } }
    const w = parseTomorrow(j, 'metric', 'Oslo')
    expect(w?.now).toEqual({ temp: 9, code: 0, wind: 7 })
    expect(w?.days[0]).toEqual({ date: '2026-11-23', max: 11, min: 4, code: 61 })
  })
  it('fills the weather merge tags and escapes them', () => {
    expect(resolveTags('{{weather.temp}} in {{weather.place}}: {{weather.condition}}', { weather: { temp: '21°C', place: '<b>Oslo</b>', condition: 'Clear' } })).toBe('21°C in &lt;b&gt;Oslo&lt;/b&gt;: Clear')
    expect(resolveTags('{{weather.temp}}', {})).toBe('')
  })
})
