'use client'

import dynamic from 'next/dynamic'

/** Only a signed-in admin sees the picker, so visitors never download it. */
export const TrackingPickerLazy = dynamic(() => import('./TrackingPicker').then((mod) => mod.TrackingPicker))
