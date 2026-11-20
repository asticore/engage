'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const ChatbotPanel = dynamic(() => import('./ChatbotPanel').then((mod) => mod.ChatbotPanel), { ssr: false, loading: () => null })
