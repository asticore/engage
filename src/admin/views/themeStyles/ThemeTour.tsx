'use client'

import { useEffect, useState } from 'react'

import { AdminTour } from '@/admin/ui/AdminTour'
import { THEME_TOUR_START_EVENT, THEME_TOUR_STEPS } from '@/features/adminTour/steps'

const SEEN = 'theme-tour-seen'

const readSeen = (): boolean => {
  try {
    return window.localStorage.getItem(SEEN) === '1'
  } catch {
    return false
  }
}

/**
 * The theme guide (Task 14, 33i): runs once on a new site's first visit to the theme page, then any time from the
 * Theme guide button. Reuses the admin tour; keeps no account preference, only a per-browser "seen" flag.
 */
export function ThemeTour({ saved }: { saved: boolean }) {
  const [auto, setAuto] = useState(false)
  useEffect(() => {
    // A site that already saved a theme has been through setup: the guide stays on the button.
    setAuto(!saved && !readSeen())
  }, [saved])
  return (
    <>
      <button type="button" className="ts-btn" onClick={() => window.dispatchEvent(new Event(THEME_TOUR_START_EVENT))}>Theme guide</button>
      <AdminTour
        autoStart={auto}
        steps={THEME_TOUR_STEPS}
        startEvent={THEME_TOUR_START_EVENT}
        persist={false}
        onClose={() => {
          try {
            window.localStorage.setItem(SEEN, '1')
          } catch {
            // Private window: the guide may show again, which is harmless.
          }
        }}
      />
    </>
  )
}
