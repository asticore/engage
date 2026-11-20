'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const RolesViewClient = dynamic(() => import('./RolesViewClient').then((mod) => mod.RolesViewClient), { ssr: false, loading: () => null })
