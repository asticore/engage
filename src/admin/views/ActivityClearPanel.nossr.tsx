'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ActivityClearPanel = dynamic(() => import('./ActivityClearPanel').then((mod) => mod.ActivityClearPanel), { ssr: false, loading: () => null })
