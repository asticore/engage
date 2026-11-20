'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ApiKeyForCustomer = dynamic(() => import('./ApiKeyForCustomer').then((mod) => mod.ApiKeyForCustomer), { ssr: false, loading: () => null })
