import { describe, expect, it } from 'vitest'

import { afterRetry, CLEARED, DUNNING_EMAILS, dunningWording, dueAction, inGrace, onPaymentFailed, parseRetryDays, stateOf, type DunningSettings, type DunningState } from '@/features/members/dunning'
import { grantsAccess } from '@/features/members/entitlement'

const SETTINGS: DunningSettings = { dunningRetryDays: [1, 3, 5, 7], dunningGraceDays: 10, dunningEndAction: 'expire' }
const DAY = 86_400_000
const t0 = new Date('2026-03-01T00:00:00Z')
const at = (days: number): Date => new Date(t0.getTime() + days * DAY + 60_000)

describe('dunning schedule', () => {
  it('reads retry days', () => {
    expect(parseRetryDays('1, 3,5 7')).toEqual([1, 3, 5, 7])
    expect(parseRetryDays('7,3,3,x,0,99,2')).toEqual([2, 3, 7])
    expect(parseRetryDays('')).toEqual([])
  })

  it('moves a failed payment through retries to the end, and recovery clears it', () => {
    // Day 0: first failure starts the run; a repeat failure seen the same day does not restart it.
    const first = onPaymentFailed(CLEARED, t0, SETTINGS, 1)
    expect(first.started).toBe(true)
    expect(first.state.attempts).toBe(1)
    expect(first.state.nextAt).toBe(new Date(t0.getTime() + DAY).toISOString())
    expect(first.state.graceEndsAt).toBe(new Date(t0.getTime() + 10 * DAY).toISOString())
    const again = onPaymentFailed(first.state, at(0), SETTINGS, 2)
    expect(again.started).toBe(false)
    expect(again.state.startedAt).toBe(first.state.startedAt)

    let state: DunningState = first.state
    expect(dueAction(state, t0)).toBe('none')
    const log: Array<[number, string]> = []
    // The sweep runs hourly; step a day at a time, which is enough for the schedule.
    for (let d = 1; d <= 11; d++) {
      const action = dueAction(state, at(d))
      if (action === 'retry') {
        state = afterRetry(state, SETTINGS)
        log.push([d, 'retry'])
      } else if (action === 'end') {
        log.push([d, 'end'])
        break
      }
    }
    // Retries on days 1, 3, 5 and 7; the grace period (10 days) ends the run on day 10.
    expect(log).toEqual([[1, 'retry'], [3, 'retry'], [5, 'retry'], [7, 'retry'], [10, 'end']])
    expect(state.attempts).toBe(5)
    expect(state.nextAt).toBeNull()
  })

  it('does not retry once the grace period is over, even if a retry was still scheduled', () => {
    const short = { ...SETTINGS, dunningGraceDays: 4 }
    const { state } = onPaymentFailed(CLEARED, t0, short, 1)
    const after = afterRetry(afterRetry(state, short), short) // days 3 and 5 would follow
    expect(dueAction({ ...after, nextAt: at(2).toISOString() }, at(4))).toBe('end')
  })

  it('does nothing without a run', () => {
    expect(dueAction(CLEARED, at(30))).toBe('none')
    expect(stateOf({ dunningStartedAt: null, dunningAttempts: undefined, dunningNextAt: null, graceEndsAt: null })).toEqual(CLEARED)
  })

  it('keeps access during the grace period only', () => {
    const grace = new Date(t0.getTime() + 10 * DAY).toISOString()
    const m = { status: 'past-due' as const, renewsAt: new Date(t0.getTime() - DAY).toISOString(), graceEndsAt: grace }
    expect(inGrace(m, at(5))).toBe(true)
    expect(grantsAccess(m, at(5))).toBe(true) // the paid period ended, the grace period has not
    expect(grantsAccess(m, at(11))).toBe(false)
    expect(grantsAccess({ status: 'past-due', renewsAt: null, graceEndsAt: null }, at(1))).toBe(false)
    expect(grantsAccess({ status: 'active', renewsAt: null, graceEndsAt: null }, at(1))).toBe(true)
  })

  it('with no retry days still gives a grace period and then ends', () => {
    const none: DunningSettings = { ...SETTINGS, dunningRetryDays: [] }
    const { state } = onPaymentFailed(CLEARED, t0, none, 1)
    expect(state.nextAt).toBeNull()
    expect(dueAction(state, at(5))).toBe('none')
    expect(dueAction(state, at(10))).toBe('end')
  })
})

describe('dunning wording', () => {
  it('uses the site wording and falls back to the built-in text', () => {
    expect(dunningWording('failed', {})).toEqual(DUNNING_EMAILS.failed)
    expect(dunningWording('failed', { dunningFailedSubject: ' Card trouble ', dunningFailedBody: '' })).toEqual({ subject: 'Card trouble', body: DUNNING_EMAILS.failed.body })
    expect(dunningWording('downgraded', { dunningDowngradedBody: 'Hi {{name}}' }).body).toBe('Hi {{name}}')
    expect(dunningWording('ended', null)).toEqual(DUNNING_EMAILS.ended)
  })
})
