'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ClientReportsPanel = dynamic(() => import('./ClientReportsPanel').then((mod) => mod.ClientReportsPanel), { ssr: false, loading: () => null })
