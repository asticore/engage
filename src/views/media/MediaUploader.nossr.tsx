'use client'

import dynamic from 'next/dynamic'

// Loaded in the browser only, so the Worker does not carry a server-render copy of this screen.
export const MediaUploader = dynamic(() => import('./MediaUploader').then((mod) => mod.MediaUploader), { ssr: false, loading: () => null })
export const MediaPageUploader = dynamic(() => import('./MediaUploader').then((mod) => mod.MediaPageUploader), { ssr: false, loading: () => null })
