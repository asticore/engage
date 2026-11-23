import { describe, expect, it } from 'vitest'
import { parseSectionLayout } from '@/lib/sectionLayout'

describe('tab colour accepts theme tokens', () => {
  it('keeps hex, rgb and var(--token)', () => {
    expect(parseSectionLayout({ tabsColor: '#2563eb' })?.tabsColor).toBe('#2563eb')
    expect(parseSectionLayout({ tabsColor: 'var(--color-brand)' })?.tabsColor).toBe('var(--color-brand)')
  })
  it('drops unsafe values', () => {
    expect(parseSectionLayout({ tabsColor: 'red;}x{' })?.tabsColor).toBeUndefined()
  })
})
