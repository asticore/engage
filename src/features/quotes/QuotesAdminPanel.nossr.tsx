'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const QuotesAdminPanel = dynamic(() => import('./QuotesAdminPanel').then((mod) => mod.QuotesAdminPanel), { ssr: false, loading: () => null })
