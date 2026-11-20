'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const FeatureCleanupCard = dynamic(() => import('./DatabaseCleanupPanel').then((mod) => mod.FeatureCleanupCard), { ssr: false, loading: () => null })
export const IndexTidyCard = dynamic(() => import('./DatabaseCleanupPanel').then((mod) => mod.IndexTidyCard), { ssr: false, loading: () => null })
