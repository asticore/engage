'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const PasskeysPanel = dynamic(() => import('./PasskeysPanel').then((mod) => mod.PasskeysPanel), { ssr: false, loading: () => null })
