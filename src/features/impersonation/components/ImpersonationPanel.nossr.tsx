'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ImpersonationPanel = dynamic(() => import('./ImpersonationPanel').then((mod) => mod.ImpersonationPanel), { ssr: false, loading: () => null })
