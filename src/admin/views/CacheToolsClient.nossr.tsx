'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const CacheToolsClient = dynamic(() => import('./CacheToolsClient').then((mod) => mod.CacheToolsClient), { ssr: false, loading: () => null })
