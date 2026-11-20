'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const NotFoundsTab = dynamic(() => import('./NotFoundsTab').then((mod) => mod.NotFoundsTab), { ssr: false, loading: () => null })
