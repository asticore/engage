'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const OptionsForm = dynamic(() => import('./OptionsForm').then((mod) => mod.OptionsForm), { ssr: false, loading: () => null })
