'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const UsersBulkBar = dynamic(() => import('./UsersBulkBar').then((mod) => mod.UsersBulkBar), { ssr: false, loading: () => null })
