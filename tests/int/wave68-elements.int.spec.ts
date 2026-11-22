import { describe, expect, it } from 'vitest'

import { currentStep, formatClock, handAngles, parseZones, zoneTime } from '@/components/blocks/elements/Wave68Elements'
import { getElementDef } from '@/lib/elements/registry'

describe('wave68 elements', () => {
  it('registers the elements', () => {
    for (const t of ['world-clock', 'progress-tracker', 'dark-mode-toggle']) expect(getElementDef(t)).toBeTruthy()
  })
  it('parses zones and skips bad ones', () => {
    const z = parseZones('Sydney | Australia/Sydney\nNowhere | Not/AZone\n| UTC\nLondon | Europe/London')
    expect(z.map((x) => x.city)).toEqual(['Sydney', 'London'])
  })
  it('reads time in a zone and formats it', () => {
    const t = zoneTime(new Date('2026-10-21T23:30:15Z'), 'UTC')
    expect(t).toEqual({ h: 23, m: 30, s: 15 })
    expect(formatClock(t, false, true)).toBe('23:30:15')
    expect(formatClock(t, true, false)).toBe('11:30 PM')
    expect(formatClock({ h: 0, m: 5, s: 0 }, true, false)).toBe('12:05 AM')
  })
  it('computes hand angles', () => {
    expect(handAngles({ h: 3, m: 0, s: 0 })).toEqual({ hour: 90, minute: 0, second: 0 })
  })
  it('clamps the current step and honours the query parameter', () => {
    expect(currentStep(4, 2, '', '')).toBe(1)
    expect(currentStep(4, 9, '', '')).toBe(3)
    expect(currentStep(4, 1, 'step', '?step=3')).toBe(2)
    expect(currentStep(4, 1, 'step', '?step=abc')).toBe(0)
  })
})
