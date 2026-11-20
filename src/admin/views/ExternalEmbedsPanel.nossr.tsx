'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ExternalEmbedsPanel = dynamic(() => import('./ExternalEmbedsPanel').then((mod) => mod.ExternalEmbedsPanel), { ssr: false, loading: () => null })
export const NewEmbedForm = dynamic(() => import('./ExternalEmbedsPanel').then((mod) => mod.NewEmbedForm), { ssr: false, loading: () => null })
