// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { grantsAdmin, hasValidStepUp, issueStepUp, readCookie, STEP_UP_MAX_AGE_S } from '@/features/security/stepUp'

const SECRET = 'test-secret'

describe('step-up confirmation', () => {
  it('accepts a fresh value for the same user only', async () => {
    const value = await issueStepUp(7, SECRET, 1_000)
    expect(await hasValidStepUp(value, 7, SECRET, 2_000)).toBe(true)
    expect(await hasValidStepUp(value, 8, SECRET, 2_000)).toBe(false)
  })

  it('rejects expired, tampered, wrong-secret and empty values', async () => {
    const value = await issueStepUp(7, SECRET, 1_000)
    expect(await hasValidStepUp(value, 7, SECRET, 1_000 + STEP_UP_MAX_AGE_S * 1000 + 1)).toBe(false)
    expect(await hasValidStepUp(value.replace(/\.\d+\./, '.99999999999999.'), 7, SECRET, 2_000)).toBe(false)
    expect(await hasValidStepUp(value, 7, 'other', 2_000)).toBe(false)
    expect(await hasValidStepUp(null, 7, SECRET)).toBe(false)
    expect(await hasValidStepUp(value, 7, '', 2_000)).toBe(false)
  })

  it('knows when a write adds the admin role', () => {
    expect(grantsAdmin(undefined, ['admin'])).toBe(true)
    expect(grantsAdmin(['editor'], ['editor', 'admin'])).toBe(true)
    expect(grantsAdmin(['admin'], ['admin', 'editor'])).toBe(false)
    expect(grantsAdmin(['admin'], ['editor'])).toBe(false)
    expect(grantsAdmin(['customer'], undefined)).toBe(false)
  })

  it('reads a named cookie', () => {
    expect(readCookie('a=1; engage-stepup=x.y.z; b=2', 'engage-stepup')).toBe('x.y.z')
    expect(readCookie(null, 'engage-stepup')).toBeNull()
  })
})
