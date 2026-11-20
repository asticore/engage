'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const MediaSearchPanel = dynamic(() => import('./MediaSearchPanel').then((mod) => mod.MediaSearchPanel), { ssr: false, loading: () => null })
