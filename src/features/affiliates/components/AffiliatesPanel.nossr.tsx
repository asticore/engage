'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const AffiliatesPanel = dynamic(() => import('./AffiliatesPanel').then((mod) => mod.AffiliatesPanel), { ssr: false, loading: () => null })
