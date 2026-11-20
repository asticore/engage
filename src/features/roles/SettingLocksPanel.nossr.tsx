'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const SettingLocksPanel = dynamic(() => import('./SettingLocksPanel').then((mod) => mod.SettingLocksPanel), { ssr: false, loading: () => null })
