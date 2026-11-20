'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const UnusedTablesPanel = dynamic(() => import('./UnusedTablesPanel').then((mod) => mod.UnusedTablesPanel), { ssr: false, loading: () => null })
