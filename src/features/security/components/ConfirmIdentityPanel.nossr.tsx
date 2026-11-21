'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ConfirmIdentityPanel = dynamic(() => import('./ConfirmIdentityPanel').then((mod) => mod.ConfirmIdentityPanel), { ssr: false, loading: () => null })
