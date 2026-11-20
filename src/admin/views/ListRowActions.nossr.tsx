'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ListRowActions = dynamic(() => import('./ListRowActions').then((mod) => mod.ListRowActions), { ssr: false, loading: () => null })
