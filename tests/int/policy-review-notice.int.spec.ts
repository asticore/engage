// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { policyPageEdited, policyReviewCanShow } from '@/features/privacy/notice/policyReview'
import { errorAlertSettingsFrom } from '@/features/errors/spikeAlert'

describe('policy review notice rule', () => {
  it('stays up when no policy page is linked', () => {
    expect(policyPageEdited(null)).toBe(false)
  })

  it('stays up for a page that was only created, even when saved right away', () => {
    expect(policyPageEdited({ createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:20.000Z' })).toBe(false)
  })

  it('goes away once the page is edited after it was created', () => {
    expect(policyPageEdited({ createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-03T09:00:00.000Z' })).toBe(true)
  })

  it('reads a page with bad timestamps as not edited', () => {
    expect(policyPageEdited({ createdAt: 'x', updatedAt: 'y' })).toBe(false)
  })

  it('is shown when no page is linked (the engine lookup fails soft)', async () => {
    const engine = { findGlobal: async (): Promise<null> => null, findByID: async (): Promise<null> => null }
    expect(await policyReviewCanShow(engine as never)).toBe(true)
  })

  it('is hidden when the linked page was edited', async () => {
    const engine = {
      findGlobal: async (): Promise<{ privacyPolicyPage: number }> => ({ privacyPolicyPage: 5 }),
      findByID: async (): Promise<{ createdAt: string; updatedAt: string }> => ({ createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z' }),
    }
    expect(await policyReviewCanShow(engine as never)).toBe(false)
  })

  it('keeps the error alert threshold to whole numbers from 1 to 1000', () => {
    expect(errorAlertSettingsFrom({ errorAlerts: { threshold: 0 } }).threshold).toBe(10)
    expect(errorAlertSettingsFrom({ errorAlerts: { threshold: 7.9 } }).threshold).toBe(7)
  })
})
