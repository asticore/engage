'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const WholesalePanel = dynamic(() => import('./WholesalePanel').then((mod) => mod.WholesalePanel), { ssr: false, loading: () => null })
