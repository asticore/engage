'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const TrackingConnectionsClient = dynamic(() => import('./TrackingConnectionsClient').then((mod) => mod.TrackingConnectionsClient), { ssr: false, loading: () => null })
