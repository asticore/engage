'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const GoogleConnectionClient = dynamic(() => import('./GoogleConnectionClient').then((mod) => mod.GoogleConnectionClient), { ssr: false, loading: () => null })
