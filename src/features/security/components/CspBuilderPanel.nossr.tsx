'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const CspBuilderPanel = dynamic(() => import('./CspBuilderPanel').then((mod) => mod.CspBuilderPanel), { ssr: false, loading: () => null })
