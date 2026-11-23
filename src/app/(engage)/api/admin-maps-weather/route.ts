import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { mergePosted, MAP_PROVIDER_LABELS, MAP_STYLES, WEATHER_PROVIDER_LABELS, redactConfig } from '@/features/mapsWeather/config'
import { readMapsWeather, readWeatherUsage, resetMapsWeatherCache, saveMapsWeather } from '@/features/mapsWeather/store'
import { audit, auditContext } from '@/features/security/auditLog'
import { readSecuritySettingsFromD1 } from '@/features/security/settings'
import { testWeather } from '@/features/weather/providers'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can change the map and weather settings.' }, 403) }
  return { context }
}

/** GET: the settings with every key hidden (only whether one is saved), the choices, and this month's weather calls. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  resetMapsWeatherCache()
  const config = await readMapsWeather()
  return json({ config: redactConfig(config), mapProviders: MAP_PROVIDER_LABELS, mapStyles: MAP_STYLES, weatherProviders: WEATHER_PROVIDER_LABELS, usage: await readWeatherUsage() })
}

/** POST { map, weather, clear }: saves. POST { test: true }: one live weather call with the saved settings. */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  resetMapsWeatherCache()
  const current = await readMapsWeather()
  if (body.test === true) return json(await testWeather(current))
  const next = mergePosted(current, body)
  try {
    await saveMapsWeather(next)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not save.' }, 500)
  }
  void audit({ action: 'maps-weather.save', detail: `map ${next.map.provider}, weather ${next.weather.provider}`, ...auditContext(request) }, await readSecuritySettingsFromD1())
  return json({ ok: true, config: redactConfig(next) })
}
