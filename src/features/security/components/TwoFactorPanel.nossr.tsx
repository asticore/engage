'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const TwoFactorPanel = dynamic(() => import('./TwoFactorPanel').then((mod) => mod.TwoFactorPanel), { ssr: false, loading: () => null })
