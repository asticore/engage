'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ApiBuilderPanel = dynamic(() => import('./ApiBuilderPanel').then((mod) => mod.ApiBuilderPanel), { ssr: false, loading: () => null })
