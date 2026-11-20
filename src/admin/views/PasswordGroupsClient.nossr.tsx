'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const PasswordGroupsClient = dynamic(() => import('./PasswordGroupsClient').then((mod) => mod.PasswordGroupsClient), { ssr: false, loading: () => null })
