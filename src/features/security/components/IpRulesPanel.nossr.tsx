'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const IpRulesPanel = dynamic(() => import('./IpRulesPanel').then((mod) => mod.IpRulesPanel), { ssr: false, loading: () => null })
