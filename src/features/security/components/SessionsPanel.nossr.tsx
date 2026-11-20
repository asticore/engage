'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const SessionsPanel = dynamic(() => import('./SessionsPanel').then((mod) => mod.SessionsPanel), { ssr: false, loading: () => null })
