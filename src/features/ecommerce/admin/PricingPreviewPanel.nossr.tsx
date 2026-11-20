'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const PricingPreviewPanel = dynamic(() => import('./PricingPreviewPanel').then((mod) => mod.PricingPreviewPanel), { ssr: false, loading: () => null })
