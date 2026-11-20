'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ListToolbar = dynamic(() => import('./ListToolbar').then((mod) => mod.ListToolbar), { ssr: false, loading: () => null })
