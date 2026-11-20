'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const DisplayCurrenciesPanel = dynamic(() => import('./DisplayCurrenciesPanel').then((mod) => mod.DisplayCurrenciesPanel), { ssr: false, loading: () => null })
