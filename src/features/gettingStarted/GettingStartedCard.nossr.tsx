'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const GettingStartedCard = dynamic(() => import('./GettingStartedCard').then((mod) => mod.GettingStartedCard), { ssr: false, loading: () => null })
