'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const WebhooksPanel = dynamic(() => import('./WebhooksPanel').then((mod) => mod.WebhooksPanel), { ssr: false, loading: () => null })
