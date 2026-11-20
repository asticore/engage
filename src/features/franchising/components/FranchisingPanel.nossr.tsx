'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const FranchisingPanel = dynamic(() => import('./FranchisingPanel').then((mod) => mod.FranchisingPanel), { ssr: false, loading: () => null })
