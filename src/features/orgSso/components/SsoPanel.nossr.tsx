'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const SsoPanel = dynamic(() => import('./SsoPanel').then((mod) => mod.SsoPanel), { ssr: false, loading: () => null })
