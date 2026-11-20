'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const VersionsList = dynamic(() => import('./VersionsList').then((mod) => mod.VersionsList), { ssr: false, loading: () => null })
