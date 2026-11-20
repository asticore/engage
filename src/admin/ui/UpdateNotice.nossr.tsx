'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const UpdateNotice = dynamic(() => import('./UpdateNotice').then((mod) => mod.UpdateNotice), { ssr: false, loading: () => null })
