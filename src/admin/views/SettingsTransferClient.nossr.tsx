'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const SettingsTransferClient = dynamic(() => import('./SettingsTransferClient').then((mod) => mod.SettingsTransferClient), { ssr: false, loading: () => null })
