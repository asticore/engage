'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const LiveChatPanel = dynamic(() => import('./LiveChatPanel').then((mod) => mod.LiveChatPanel), { ssr: false, loading: () => null })
