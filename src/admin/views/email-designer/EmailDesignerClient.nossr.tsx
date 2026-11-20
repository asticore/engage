'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const EmailDesignerClient = dynamic(() => import('./EmailDesignerClient').then((mod) => mod.EmailDesignerClient), { ssr: false, loading: () => null })
