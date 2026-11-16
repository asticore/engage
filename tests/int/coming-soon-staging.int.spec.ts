import { describe, expect, it } from 'vitest'

import { timeLeft } from '@/features/site/countdown'
import { launchReached, normaliseSitePages, parseLaunch } from '@/features/site/pagesShape'
import { isStagingEnv } from '@/features/site/staging'

describe('staging flag', () => {
  it('is on only when the environment says so', () => {
    expect(isStagingEnv({})).toBe(false)
    expect(isStagingEnv({ SITE_ENV: 'production' })).toBe(false)
    expect(isStagingEnv({ SITE_ENV: ' Staging ' })).toBe(true)
    expect(isStagingEnv({ STAGING: '1' })).toBe(true)
    expect(isStagingEnv({ STAGING: 'true' })).toBe(false)
  })
})

describe('coming soon', () => {
  it('reads the mode and launch date, defaulting to maintenance', () => {
    expect(normaliseSitePages({}).maintenance).toMatchObject({ mode: 'maintenance', launchAt: null })
    const m = normaliseSitePages({ maintenance: { enabled: true, mode: 'comingSoon', launchDate: '2027-01-01T00:00:00.000Z' } }).maintenance
    expect(m).toMatchObject({ mode: 'comingSoon', launchAt: '2027-01-01T00:00:00.000Z' })
    expect(parseLaunch('not a date')).toBeNull()
  })
  it('opens the site by itself at the launch time, only in coming soon mode', () => {
    const at = '2027-01-01T00:00:00.000Z'
    expect(launchReached('comingSoon', at, new Date('2026-12-31T23:59:59Z'))).toBe(false)
    expect(launchReached('comingSoon', at, new Date('2027-01-01T00:00:00Z'))).toBe(true)
    expect(launchReached('maintenance', at, new Date('2028-01-01T00:00:00Z'))).toBe(false)
    expect(launchReached('comingSoon', null, new Date())).toBe(false)
  })
  it('counts down in days, hours, minutes and seconds and stops at zero', () => {
    expect(timeLeft('2027-01-02T01:02:03Z', new Date('2027-01-01T00:00:00Z'))).toEqual({ days: 1, hours: 1, minutes: 2, seconds: 3, done: false })
    expect(timeLeft('2027-01-01T00:00:00Z', new Date('2027-02-01T00:00:00Z'))).toMatchObject({ days: 0, seconds: 0, done: true })
  })
})
