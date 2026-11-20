'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const RateRulesPanel = dynamic(() => import('./RateRulesPanel').then((mod) => mod.RateRulesPanel), { ssr: false, loading: () => null })
