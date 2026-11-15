import { describe, expect, it } from 'vitest'

import { canDisableJob, listDisabledJobs, nextRunAt, setJobEnabled } from '@/features/cron/jobState'

describe('cron job state', () => {
  it('the heartbeat job cannot be switched off, unknown jobs cannot either', () => {
    expect(canDisableJob('schedules')).toBe(false)
    expect(canDisableJob('no-such-job')).toBe(false)
  })
  it('five minute jobs run on the next five minute tick', () => {
    expect(nextRunAt('every 5 minutes', new Date('2027-03-15T10:02:30Z')).toISOString()).toBe('2027-03-15T10:05:00.000Z')
    expect(nextRunAt('every 5 minutes', new Date('2027-03-15T10:05:00Z')).toISOString()).toBe('2027-03-15T10:10:00.000Z')
  })
  it('hourly jobs run at the top of the next hour', () => {
    expect(nextRunAt('hourly', new Date('2027-03-15T10:02:30Z')).toISOString()).toBe('2027-03-15T11:00:00.000Z')
  })
  it('an unreadable table means every job is on', async () => {
    expect((await listDisabledJobs(null)).size).toBe(0)
    const broken = { prepare: () => { throw new Error('no table') } } as never
    expect((await listDisabledJobs(broken)).size).toBe(0)
  })
  it('refuses to switch off the heartbeat', async () => {
    await expect(setJobEnabled({} as never, 'schedules', false, 'now')).rejects.toThrow()
  })
})
