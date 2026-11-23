'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const MapsWeatherPanel = dynamic(() => import('./MapsWeatherPanel').then((mod) => mod.MapsWeatherPanel), { ssr: false, loading: () => null })
