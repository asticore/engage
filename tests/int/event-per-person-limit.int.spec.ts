import { describe, expect, it } from 'vitest'

import { perPersonRefusal } from '@/features/events/perPersonLimit'

const rows = [{ email: 'Sam+a@Example.com', guestCount: 2 }, { email: 'other@example.com', guestCount: 1 }]

describe('event places per person', () => {
  it('has no limit when blank or 0', () => {
    expect(perPersonRefusal(null, rows, 'sam@example.com', 5)).toBeNull()
    expect(perPersonRefusal(0, rows, 'sam@example.com', 5)).toBeNull()
  })
  it('counts the same person across case and +tags', () => {
    expect(perPersonRefusal(3, rows, 'sam@example.com', 1)).toBeNull()
    expect(perPersonRefusal(3, rows, 'sam@example.com', 2)).toContain('You can book 1 more')
    expect(perPersonRefusal(2, rows, 'SAM@example.com', 1)).toContain('already booked')
  })
  it('does not count other people', () => {
    expect(perPersonRefusal(1, rows, 'new@example.com', 1)).toBeNull()
  })
})
