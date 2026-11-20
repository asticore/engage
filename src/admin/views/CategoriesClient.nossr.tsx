'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const CategoriesClient = dynamic(() => import('./CategoriesClient').then((mod) => mod.CategoriesClient), { ssr: false, loading: () => null })
