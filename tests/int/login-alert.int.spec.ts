import { describe, expect, it } from 'vitest'

import { alertText, cleanCountry, decideAlert } from '@/features/security/loginAlert'

describe('sign-in alerts', () => {
  const seen = [{ device: 'Chrome on Windows', country: 'GB' }]
  it('stays quiet for a first sign-in and a known pair', () => {
    expect(decideAlert([], { device: 'Chrome on Windows', country: 'GB' })).toBeNull()
    expect(decideAlert(seen, { device: 'Chrome on Windows', country: 'GB' })).toBeNull()
  })
  it('flags a new device and a new country', () => {
    expect(decideAlert(seen, { device: 'Safari on iOS', country: 'GB' })).toBe('new-device')
    expect(decideAlert(seen, { device: 'Chrome on Windows', country: 'DE' })).toBe('new-country')
    expect(decideAlert(seen, { device: 'Safari on iOS', country: 'DE' })).toBe('new-country')
  })
  it('ignores an unknown country', () => {
    expect(cleanCountry('xx')).toBe('')
    expect(cleanCountry('de')).toBe('DE')
    expect(decideAlert(seen, { device: 'Chrome on Windows', country: '' })).toBeNull()
  })
  it('words the email', () => {
    expect(alertText('new-country', { device: 'Safari on iOS', country: 'DE', at: 'x' }).text).toContain('Germany')
  })
})
