'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const StoreCreditPanel = dynamic(() => import('./StoreCreditPanel').then((mod) => mod.StoreCreditPanel), { ssr: false, loading: () => null })
