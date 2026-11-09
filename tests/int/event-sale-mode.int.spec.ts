import { describe, expect, it } from 'vitest'

import { eventSaleMode } from '@/features/editScreens/eventSales'

describe('eventSaleMode', () => {
  it('sends an outside registration link first', () => {
    expect(eventSaleMode({ externalRegistrationUrl: 'https://x.test', spotsRemaining: 0, hasTicketProduct: false })).toBe('external')
  })
  it('shows sold out when no places are left, paid or free', () => {
    expect(eventSaleMode({ eventType: 'paid', spotsRemaining: 0, hasTicketProduct: true })).toBe('sold-out')
    expect(eventSaleMode({ eventType: 'free', spotsRemaining: 0, hasTicketProduct: false })).toBe('sold-out')
  })
  it('sells a paid event through the ticket product', () => {
    expect(eventSaleMode({ eventType: 'paid', spotsRemaining: 3, hasTicketProduct: true })).toBe('buy')
    expect(eventSaleMode({ eventType: 'paid', spotsRemaining: null, hasTicketProduct: false })).toBe('buy-soon')
  })
  it('takes RSVPs for a free event with room or no capacity', () => {
    expect(eventSaleMode({ eventType: 'free', spotsRemaining: null, hasTicketProduct: false })).toBe('rsvp')
    expect(eventSaleMode({ eventType: 'free', spotsRemaining: 2, hasTicketProduct: false })).toBe('rsvp')
  })
})
