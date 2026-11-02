'use client'

import dynamic from 'next/dynamic'

/** The form code (field views, validation) loads only on pages that carry a form; it is still rendered on the server. */
export const FormRendererLazy = dynamic(() => import('./FormRenderer').then((mod) => mod.FormRenderer))
