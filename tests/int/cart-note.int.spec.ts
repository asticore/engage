import { describe, expect, it } from 'vitest'

import { composeOrderNote, EMPTY_NOTE, GIFT_MAX, NOTE_MAX, parseCartNote } from '@/features/ecommerce/lib/cartNote'

describe('parseCartNote', () => {
  it('is empty for missing or broken input', () => {
    expect(parseCartNote(null)).toEqual(EMPTY_NOTE)
    expect(parseCartNote('nope')).toEqual(EMPTY_NOTE)
  })
  it('keeps valid values and caps the length', () => {
    const out = parseCartNote(JSON.stringify({ note: 'x'.repeat(900), gift: true, giftMessage: 'y'.repeat(900) }))
    expect(out.note).toHaveLength(NOTE_MAX)
    expect(out.giftMessage).toHaveLength(GIFT_MAX)
    expect(out.gift).toBe(true)
  })
  it('ignores values of the wrong type', () => {
    expect(parseCartNote(JSON.stringify({ note: 5, gift: 'yes' }))).toEqual(EMPTY_NOTE)
  })
})

describe('composeOrderNote', () => {
  it('is empty with nothing to say', () => {
    expect(composeOrderNote(EMPTY_NOTE)).toBe('')
  })
  it('joins the note and the gift message', () => {
    expect(composeOrderNote({ note: ' Leave at door ', gift: true, giftMessage: 'Happy birthday' })).toBe('Leave at door\nGift message: Happy birthday')
  })
  it('marks a gift without a message', () => {
    expect(composeOrderNote({ note: '', gift: true, giftMessage: '' })).toBe('This order is a gift.')
  })
  it('ignores the gift message when it is not a gift', () => {
    expect(composeOrderNote({ note: 'a', gift: false, giftMessage: 'hidden' })).toBe('a')
  })
})
