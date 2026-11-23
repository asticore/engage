import { rawD1 } from '@/features/ecommerce/server/db'
import { decryptSecret, encryptSecret } from '@/utilities/secretField'

import { DEFAULT_MAPS_WEATHER, normaliseConfig, SECRET_FIELD_NAMES, type MapsWeatherConfig } from './config'

/** One row in `eg_kv` (no table of its own). Keys are stored encrypted and come back decrypted here, server only. */
export const MAPS_WEATHER_KEY = 'maps-weather'

let cached: { at: number; config: MapsWeatherConfig } | null = null
export const resetMapsWeatherCache = (): void => {
  cached = null
}

const transform = (config: MapsWeatherConfig, fn: (v: unknown) => unknown): MapsWeatherConfig => {
  const copy = { map: { ...config.map }, weather: { ...config.weather } } as MapsWeatherConfig
  for (const k of SECRET_FIELD_NAMES) {
    if (k in copy.map) (copy.map as Record<string, unknown>)[k] = fn((copy.map as Record<string, unknown>)[k])
    else (copy.weather as Record<string, unknown>)[k] = fn((copy.weather as Record<string, unknown>)[k])
  }
  return copy
}

/** Never throws: a read problem means the defaults (OpenStreetMap and Open-Meteo, no keys). */
export async function readMapsWeather(): Promise<MapsWeatherConfig> {
  const now = Date.now()
  if (cached && now - cached.at < 30_000) return cached.config
  let config = DEFAULT_MAPS_WEATHER
  try {
    const d1 = await rawD1()
    const row = await d1.prepare('SELECT `data` FROM `eg_kv` WHERE `key` = ?').bind(MAPS_WEATHER_KEY).first<{ data: string }>()
    if (row?.data) {
      const parsed = JSON.parse(row.data) as MapsWeatherConfig
      // normaliseConfig would drop an encrypted value (it is not a plain token), so decrypt first.
      config = normaliseConfig(transform(parsed, (v) => decryptSecret(v)))
    }
  } catch {
    config = DEFAULT_MAPS_WEATHER
  }
  cached = { at: now, config }
  return config
}

export async function saveMapsWeather(config: MapsWeatherConfig): Promise<void> {
  const d1 = await rawD1()
  const data = JSON.stringify(transform(config, (v) => encryptSecret(v)))
  const updated = await d1.prepare('UPDATE `eg_kv` SET `data` = ? WHERE `key` = ?').bind(data, MAPS_WEATHER_KEY).run()
  if (!updated.meta?.changes) await d1.prepare('INSERT INTO `eg_kv` (`key`, `data`) VALUES (?, ?)').bind(MAPS_WEATHER_KEY, data).run()
  resetMapsWeatherCache()
}

/** Counts one provider call for the usage figure on the admin screen (one row per provider and month). */
export async function countWeatherCall(provider: string): Promise<void> {
  try {
    const d1 = await rawD1()
    const key = `weather-usage:${provider}:${new Date().toISOString().slice(0, 7)}`
    const updated = await d1.prepare('UPDATE `eg_kv` SET `data` = CAST(CAST(`data` AS INTEGER) + 1 AS TEXT) WHERE `key` = ?').bind(key).run()
    if (!updated.meta?.changes) await d1.prepare('INSERT OR IGNORE INTO `eg_kv` (`key`, `data`) VALUES (?, ?)').bind(key, '1').run()
  } catch {
    /* a counter must never break a page */
  }
}

export async function readWeatherUsage(): Promise<Record<string, number>> {
  try {
    const d1 = await rawD1()
    const month = new Date().toISOString().slice(0, 7)
    const res = await d1.prepare('SELECT `key`, `data` FROM `eg_kv` WHERE `key` LIKE ?').bind(`weather-usage:%:${month}`).all<{ key: string; data: string }>()
    const out: Record<string, number> = {}
    for (const r of res.results ?? []) out[r.key.split(':')[1] ?? r.key] = Number(r.data) || 0
    return out
  } catch {
    return {}
  }
}
