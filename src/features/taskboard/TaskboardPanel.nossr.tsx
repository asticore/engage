'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const TaskboardPanel = dynamic(() => import('./TaskboardPanel').then((mod) => mod.TaskboardPanel), { ssr: false, loading: () => null })
