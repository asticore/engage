'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ShopReportsPanel = dynamic(() => import('./ShopReportsPanel').then((mod) => mod.ShopReportsPanel), { ssr: false, loading: () => null })
