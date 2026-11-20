'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const DemosPanel = dynamic(() => import('./DemosPanel').then((mod) => mod.DemosPanel), { ssr: false, loading: () => null })
