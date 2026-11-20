'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ApiKeysPanel = dynamic(() => import('./ApiKeysPanel').then((mod) => mod.ApiKeysPanel), { ssr: false, loading: () => null })
