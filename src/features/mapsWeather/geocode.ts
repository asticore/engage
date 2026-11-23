import { rawD1 } from '@/features/ecommerce/server/db'

import { parseLatLng } from './mapView'

/**
 * Address to coordinates through OpenStreetMap's Nominatim, once per address: the answer is stored in `eg_kv`
 * (`geo:<address>`), so a page never makes a lookup per visit. A failed lookup is stored as a miss for a day so a
 * bad address is not retried on every render. Server only.
 */
const norm = (a: string): string => a.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200)

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const direct = parseLatLng(address)
  if (direct) return direct
  const text = norm(address)
  if (!text) return null
  const key = `geo:${text}`
  try {
    const d1 = await rawD1()
    const row = await d1.prepare('SELECT `data` FROM `eg_kv` WHERE `key` = ?').bind(key).first<{ data: string }>()
    if (row?.data) {
      const hit = JSON.parse(row.data) as { lat?: number; lng?: number; miss?: string }
      if (typeof hit.lat === 'number' && typeof hit.lng === 'number') return { lat: hit.lat, lng: hit.lng }
      if (hit.miss && Date.now() - Date.parse(hit.miss) < 86_400_000) return null
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(text)}`, { headers: { Accept: 'application/json', 'User-Agent': 'engage-site-map/1.0' } })
    const list = res.ok ? ((await res.json()) as Array<{ lat?: string; lon?: string }>) : []
    const first = list[0]
    const lat = Number(first?.lat)
    const lng = Number(first?.lon)
    const found = Number.isFinite(lat) && Number.isFinite(lng) && first ? { lat, lng } : null
    await d1.prepare('INSERT OR REPLACE INTO `eg_kv` (`key`, `data`) VALUES (?, ?)').bind(key, JSON.stringify(found ?? { miss: new Date().toISOString() })).run()
    return found
  } catch {
    return null
  }
}
