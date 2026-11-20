'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const PriceTiersPanel = dynamic(() => import('./PriceTiersPanel').then((mod) => mod.PriceTiersPanel), { ssr: false, loading: () => null })
