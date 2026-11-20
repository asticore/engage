'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const FrontendAssetsPanel = dynamic(() => import('./FrontendAssetsPanel').then((mod) => mod.FrontendAssetsPanel), { ssr: false, loading: () => null })
