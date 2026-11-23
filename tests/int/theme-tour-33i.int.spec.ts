// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { THEME_TOUR_STEPS, TOUR_STEPS } from '@/features/adminTour/steps'

describe('theme guide (33i)', () => {
  it('covers pick, colours, logo, header and footer, preview and publish, with text on every step', () => {
    expect(THEME_TOUR_STEPS.map((s) => s.id)).toEqual(['theme-welcome', 'theme-pick', 'theme-colours', 'theme-logo', 'theme-chrome', 'theme-preview', 'theme-done'])
    for (const s of THEME_TOUR_STEPS) expect(s.title && s.body, s.id).toBeTruthy()
    expect(THEME_TOUR_STEPS.at(-1)?.body).toMatch(/Published/)
  })

  it('leaves the admin tour on translation keys', () => {
    for (const s of TOUR_STEPS) expect(s.titleKey && s.bodyKey, s.id).toBeTruthy()
  })
})
