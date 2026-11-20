'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const BulkCreatePanel = dynamic(() => import('./BulkCreatePanel').then((mod) => mod.BulkCreatePanel), { ssr: false, loading: () => null })
