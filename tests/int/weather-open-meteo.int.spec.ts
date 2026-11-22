import { afterEach, describe, expect, it, vi } from 'vitest'

import { describeCode, loadWeather, parseCoords } from '@/features/weather/openMeteo'

afterEach(() => vi.unstubAllGlobals())

describe('open-meteo weather', () => {
  it('parses coordinates', () => {
    expect(parseCoords('-27.47,153.03')).toEqual({ lat: -27.47, lon: 153.03 })
    expect(parseCoords('91,0')).toBeNull()
    expect(parseCoords('Brisbane')).toBeNull()
  })
  it('describes weather codes', () => {
    expect(describeCode(0).label).toBe('Clear')
    expect(describeCode(63).label).toBe('Rain')
    expect(describeCode(96).label).toBe('Thunderstorm')
  })
  it('geocodes, fetches once and caches', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url)
      const body = url.includes('geocoding')
        ? { results: [{ latitude: 1, longitude: 2, name: 'Testville' }] }
        : { current: { temperature_2m: 21.6, weather_code: 3, wind_speed_10m: 9.2 }, daily: { time: ['2026-11-23'], weather_code: [0], temperature_2m_max: [25.4], temperature_2m_min: [15.1] } }
      return new Response(JSON.stringify(body), { status: 200 })
    })
    const a = await loadWeather('Testville', 'metric', 30)
    expect(a?.now).toEqual({ temp: 22, code: 3, wind: 9 })
    expect(a?.days[0]).toEqual({ date: '2026-11-23', max: 25, min: 15, code: 0 })
    await loadWeather('testville', 'metric', 30)
    expect(calls).toHaveLength(2)
  })
  it('returns null on a failing provider', async () => {
    vi.stubGlobal('fetch', async () => new Response('x', { status: 500 }))
    expect(await loadWeather('Nowhere-1', 'metric', 30)).toBeNull()
  })
})
