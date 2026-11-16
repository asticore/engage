import { describe, expect, it } from 'vitest'

import { flagFor, switcherLabel, switcherOptions } from '@/features/multilingual/switcherStyle'

describe('language switcher style', () => {
  it('defaults to the old look and ignores unknown values', () => {
    expect(switcherOptions({})).toEqual({ display: 'name', layout: 'row', hover: 'underline', align: 'start' })
    expect(switcherOptions({ display: 'emoji', layout: 'grid', hover: 'spin', align: 'left' })).toEqual({ display: 'name', layout: 'row', hover: 'underline', align: 'start' })
  })
  it('makes flags from the region or the usual country', () => {
    expect(flagFor('en-AU')).toBe('\u{1F1E6}\u{1F1FA}')
    expect(flagFor('fr')).toBe('\u{1F1EB}\u{1F1F7}')
    expect(flagFor('xx')).toBe('')
  })
  it('labels by the chosen display', () => {
    expect(switcherLabel('de', 'Deutsch', 'code')).toEqual({ text: 'DE', flag: '' })
    expect(switcherLabel('de', 'Deutsch', 'name')).toEqual({ text: 'Deutsch', flag: '' })
    expect(switcherLabel('de', 'Deutsch', 'flag-name')).toMatchObject({ text: 'Deutsch' })
    expect(switcherLabel('de', 'Deutsch', 'flag').text).toBe('')
    expect(switcherLabel('xx', 'Xish', 'flag')).toEqual({ text: 'Xish', flag: '' })
  })
})
