'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const SeoAuditClient = dynamic(() => import('./SeoAuditClient').then((mod) => mod.SeoAuditClient), { ssr: false, loading: () => null })
