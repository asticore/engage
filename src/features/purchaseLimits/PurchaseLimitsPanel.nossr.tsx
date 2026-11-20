'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const PurchaseLimitsPanel = dynamic(() => import('./PurchaseLimitsPanel').then((mod) => mod.PurchaseLimitsPanel), { ssr: false, loading: () => null })
