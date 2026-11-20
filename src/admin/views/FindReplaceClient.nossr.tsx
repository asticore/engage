'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const FindReplaceClient = dynamic(() => import('./FindReplaceClient').then((mod) => mod.FindReplaceClient), { ssr: false, loading: () => null })
