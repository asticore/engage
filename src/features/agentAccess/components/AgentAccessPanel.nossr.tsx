'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const AgentAccessPanel = dynamic(() => import('./AgentAccessPanel').then((mod) => mod.AgentAccessPanel), { ssr: false, loading: () => null })
