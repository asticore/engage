'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ProductFeedsPanel = dynamic(() => import('./ProductFeedsPanel').then((mod) => mod.ProductFeedsPanel), { ssr: false, loading: () => null })
