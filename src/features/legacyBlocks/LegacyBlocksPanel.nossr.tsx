'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const LegacyBlocksPanel = dynamic(() => import('./LegacyBlocksPanel').then((mod) => mod.LegacyBlocksPanel), { ssr: false, loading: () => null })
