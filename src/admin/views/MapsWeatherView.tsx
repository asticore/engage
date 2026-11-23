import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { MapsWeatherPanel } from '@/features/mapsWeather/components/MapsWeatherPanel.nossr'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

/** /admin/maps-weather: map and weather providers and keys. Admin only. */
export async function MapsWeatherView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can change the map and weather settings.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Maps and weather</h1>
        <p className="settings-page__description">Choose where the Map and Weather elements get their data. Both work with no key; add a key to use Google Maps, MapTiler, Mapbox, OpenWeather, WeatherAPI or Tomorrow.io.</p>
      </div>
      <MapsWeatherPanel />
    </div>
  )
}

export default MapsWeatherView
