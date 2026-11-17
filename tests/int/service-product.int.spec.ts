import { describe, expect, it } from 'vitest'

import { durationText, isNonShipping, isService, serviceBadge, serviceDetail, serviceDetails } from '@/features/ecommerce/lib/service'

describe('service products', () => {
  it('formats a duration', () => {
    expect(durationText(60)).toBe('1 hour')
    expect(durationText(90)).toBe('1 hour 30 minutes')
    expect(durationText(45)).toBe('45 minutes')
    expect(durationText(150)).toBe('2 hours 30 minutes')
    expect(durationText(0)).toBe('')
    expect(durationText(null)).toBe('')
  })
  it('does not ship a service, a virtual product or a plain virtual flag', () => {
    expect(isService({ isService: true })).toBe(true)
    expect(isNonShipping({ isService: true })).toBe(true)
    expect(isNonShipping({ isVirtual: true })).toBe(true)
    expect(isNonShipping({ virtual: true })).toBe(true)
    expect(isNonShipping({})).toBe(false)
    expect(isNonShipping(null)).toBe(false)
  })
  it('adds a Duration row only for a service that states one', () => {
    expect(serviceDetail({ isService: true, serviceDuration: 60 })).toEqual({ name: 'Duration', values: ['1 hour'] })
    expect(serviceDetail({ isService: true })).toBeNull()
    expect(serviceDetail({ isService: false, serviceDuration: 60 })).toBeNull()
  })

  it('lists who does it and badges the card', () => {
    expect(serviceDetails({ isService: true, serviceDuration: 30, serviceStaff: ' Sam ' })).toEqual([
      { name: 'Duration', values: ['30 minutes'] },
      { name: 'With', values: ['Sam'] },
    ])
    expect(serviceDetails({ isService: false, serviceStaff: 'Sam' })).toEqual([])
    expect(serviceBadge({ isService: true, serviceDuration: 60 })).toBe('Service · 1 hour')
    expect(serviceBadge({ isService: true })).toBe('Service')
    expect(serviceBadge({})).toBe('')
  })
})
