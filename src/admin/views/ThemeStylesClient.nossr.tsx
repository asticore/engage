'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ThemeStylesClient = dynamic(() => import('./ThemeStylesClient').then((mod) => mod.ThemeStylesClient), { ssr: false, loading: () => null })
