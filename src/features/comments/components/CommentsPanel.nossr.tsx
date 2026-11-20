'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const CommentsPanel = dynamic(() => import('./CommentsPanel').then((mod) => mod.CommentsPanel), { ssr: false, loading: () => null })
