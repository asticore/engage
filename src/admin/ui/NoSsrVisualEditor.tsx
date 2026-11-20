'use client'

import dynamic from 'next/dynamic'

/**
 * The visual editor shows only a loading state until the browser has hydrated, so server-rendering it
 * does nothing useful. Loading it with `ssr: false` keeps its whole module graph out of the Worker's
 * server-render copy; the browser downloads it as a static chunk instead.
 */
export const NoSsrVisualEditor = dynamic(() => import('@/views/VisualEditor').then((mod) => mod.VisualEditorView), {
  ssr: false,
  loading: () => null,
})
