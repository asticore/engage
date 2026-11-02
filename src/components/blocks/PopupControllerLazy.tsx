'use client'

import dynamic from 'next/dynamic'

/** The popup script only matters on pages that have a popup section, so it loads after the page instead of with it. */
const PopupControllerLazy = dynamic(() => import('./PopupController'), { ssr: false })

export default PopupControllerLazy
