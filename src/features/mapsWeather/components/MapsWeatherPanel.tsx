'use client'

import React, { useCallback, useEffect, useState } from 'react'

type Redacted = {
  map: { provider: string; style: string; googleKeySaved: boolean; googleEmbedApi: boolean; maptilerKeySaved: boolean; mapboxKeySaved: boolean }
  weather: { provider: string; units: string; language: string; cacheMinutes: number; openweatherKeySaved: boolean; weatherapiKeySaved: boolean; tomorrowKeySaved: boolean }
}
type Loaded = { config?: Redacted; mapProviders?: Record<string, string>; mapStyles?: string[]; weatherProviders?: Record<string, string>; usage?: Record<string, number>; error?: string }

const KEYS: Array<{ name: string; label: string; group: 'map' | 'weather'; saved: (c: Redacted) => boolean; help: string }> = [
  { name: 'googleKey', label: 'Google Maps key', group: 'map', saved: (c) => c.map.googleKeySaved, help: 'Used only when the Maps Embed API box below is ticked. Restrict the key to your site address in Google Cloud.' },
  { name: 'maptilerKey', label: 'MapTiler key', group: 'map', saved: (c) => c.map.maptilerKeySaved, help: 'From cloud.maptiler.com. Restrict it to your site address.' },
  { name: 'mapboxKey', label: 'Mapbox access token', group: 'map', saved: (c) => c.map.mapboxKeySaved, help: 'A public token (pk...) restricted to your site address.' },
  { name: 'openweatherKey', label: 'OpenWeather key', group: 'weather', saved: (c) => c.weather.openweatherKeySaved, help: 'From openweathermap.org.' },
  { name: 'weatherapiKey', label: 'WeatherAPI key', group: 'weather', saved: (c) => c.weather.weatherapiKeySaved, help: 'From weatherapi.com.' },
  { name: 'tomorrowKey', label: 'Tomorrow.io key', group: 'weather', saved: (c) => c.weather.tomorrowKeySaved, help: 'From tomorrow.io.' },
]

/** Admin screen: map and weather providers and keys. English only. Keys are never shown after saving. */
export const MapsWeatherPanel: React.FC = () => {
  const [data, setData] = useState<Loaded>({})
  const [form, setForm] = useState<{ map: Record<string, string | boolean>; weather: Record<string, string | number> }>({ map: {}, weather: {} })
  const [clear, setClear] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [testMsg, setTestMsg] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-maps-weather')
    const d = (await res.json().catch((): null => null)) as Loaded | null
    if (!res.ok || !d?.config) return setMessage(d?.error ?? 'Could not load the settings.')
    setData(d)
    setForm({ map: { provider: d.config.map.provider, style: d.config.map.style, googleEmbedApi: d.config.map.googleEmbedApi }, weather: { provider: d.config.weather.provider, units: d.config.weather.units, language: d.config.weather.language, cacheMinutes: d.config.weather.cacheMinutes } })
    setClear([])
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const set = (group: 'map' | 'weather', name: string, value: string | number | boolean) => setForm((f) => ({ ...f, [group]: { ...f[group], [name]: value } }))

  const save = async () => {
    const res = await fetch('/api/admin-maps-weather', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, clear }) })
    const d = (await res.json().catch((): null => null)) as { error?: string } | null
    if (!res.ok) return setMessage(d?.error ?? 'That did not work.')
    setMessage('Saved. Public pages pick it up within about 30 seconds.')
    await load()
  }
  const test = async () => {
    setTestMsg('Testing...')
    const res = await fetch('/api/admin-maps-weather', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }) })
    const d = (await res.json().catch((): null => null)) as { ok?: boolean; message?: string; error?: string } | null
    setTestMsg(d?.message ?? d?.error ?? 'No answer.')
  }

  const config = data.config
  if (!config) return <p role="status">{message || 'Loading...'}</p>
  const keyField = (k: (typeof KEYS)[number]) => (
    <label key={k.name} style={{ display: 'grid', gap: '0.25rem', maxWidth: '36rem' }}>
      {k.label} {k.saved(config) && !clear.includes(k.name) ? '(saved)' : '(not saved)'}
      <input type="password" autoComplete="off" placeholder={k.saved(config) ? 'Leave blank to keep the saved key' : 'Paste the key'} onChange={(e) => set(k.group, k.name, e.target.value)} />
      <small>{k.help}</small>
      {k.saved(config) && (
        <span>
          <label><input type="checkbox" checked={clear.includes(k.name)} onChange={(e) => setClear(e.target.checked ? [...clear, k.name] : clear.filter((n) => n !== k.name))} /> Remove the saved key</label>
        </span>
      )}
    </label>
  )

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}
      <section style={{ display: 'grid', gap: '0.75rem', maxWidth: '48rem' }}>
        <h2>Maps</h2>
        <p>OpenStreetMap needs no key and is the default. A provider with no saved key falls back to OpenStreetMap, so a map never breaks. Each Map element can override the provider and style.</p>
        <label>Default provider<br />
          <select value={String(form.map.provider ?? 'osm')} onChange={(e) => set('map', 'provider', e.target.value)}>
            {Object.entries(data.mapProviders ?? {}).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Default style<br />
          <select value={String(form.map.style ?? 'light')} onChange={(e) => set('map', 'style', e.target.value)}>
            {(data.mapStyles ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {KEYS.filter((k) => k.group === 'map').map(keyField)}
        <label>
          <input type="checkbox" checked={form.map.googleEmbedApi === true} onChange={(e) => set('map', 'googleEmbedApi', e.target.checked)} />{' '}
          My Google key has the Maps Embed API and Maps Static API enabled (leave off to use the keyless Google map)
        </label>
        <p>Addresses are looked up once through OpenStreetMap and the answer is stored, so visitors cause no lookups. The map itself loads only after a visitor presses Show map.</p>
      </section>
      <section style={{ display: 'grid', gap: '0.75rem', maxWidth: '48rem' }}>
        <h2>Weather</h2>
        <p>Open-Meteo is free and needs no key. Responses are saved on the server for the time below, so visitors never call the provider.</p>
        <label>Provider<br />
          <select value={String(form.weather.provider ?? 'open-meteo')} onChange={(e) => set('weather', 'provider', e.target.value)}>
            {Object.entries(data.weatherProviders ?? {}).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Units<br />
          <select value={String(form.weather.units ?? 'metric')} onChange={(e) => set('weather', 'units', e.target.value)}>
            <option value="metric">Metric (Celsius, km/h)</option>
            <option value="imperial">Imperial (Fahrenheit, mph)</option>
          </select>
        </label>
        <label>Language (two letters, for providers that translate)<br />
          <input type="text" maxLength={2} value={String(form.weather.language ?? 'en')} onChange={(e) => set('weather', 'language', e.target.value.toLowerCase())} />
        </label>
        <label>Keep each answer for (minutes, 5 to 1440)<br />
          <input type="number" min={5} max={1440} value={Number(form.weather.cacheMinutes ?? 30)} onChange={(e) => set('weather', 'cacheMinutes', Number(e.target.value))} />
        </label>
        {KEYS.filter((k) => k.group === 'weather').map(keyField)}
        <p>Calls made to keyed providers this month: {Object.keys(data.usage ?? {}).length ? Object.entries(data.usage ?? {}).map(([p, n]) => `${p} ${n}`).join(', ') : 'none yet'}.</p>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void test()}>Test the saved settings</button>
          {testMsg && <span role="status">{testMsg}</span>}
        </div>
      </section>
      <div><button type="button" onClick={() => void save()}>Save</button></div>
    </div>
  )
}
