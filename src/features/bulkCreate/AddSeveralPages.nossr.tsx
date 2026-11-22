'use client'

import dynamic from 'next/dynamic'

// Browser only, so the Worker carries no server-render copy of the dialog.
export const AddSeveralPages = dynamic(() => import('./AddSeveralPages').then((mod) => mod.AddSeveralPages), { ssr: false, loading: () => null })
