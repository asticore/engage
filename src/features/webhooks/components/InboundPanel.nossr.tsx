'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const RetentionPanel = dynamic(() => import('./InboundPanel').then((mod) => mod.RetentionPanel), { ssr: false, loading: () => null })
export const InboundPanel = dynamic(() => import('./InboundPanel').then((mod) => mod.InboundPanel), { ssr: false, loading: () => null })
