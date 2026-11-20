'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const PrivacyPanel = dynamic(() => import('./PrivacyPanel').then((mod) => mod.PrivacyPanel), { ssr: false, loading: () => null })
