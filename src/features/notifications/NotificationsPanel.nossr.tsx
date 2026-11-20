'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const NotificationsPanel = dynamic(() => import('./NotificationsPanel').then((mod) => mod.NotificationsPanel), { ssr: false, loading: () => null })
