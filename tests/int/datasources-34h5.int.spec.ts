import { describe, expect, it } from 'vitest'

import { applyDatasources, cleanSlug, parseItems } from '@/features/datasources/core'

describe('34h5 datasources', () => {
  it('cleans names', () => {
    expect(cleanSlug('Sizes')).toBe('sizes')
    expect(cleanSlug('bad name')).toBeNull()
  })
  it('parses lines with and without values, dropping duplicates', () => {
    expect(parseItems('Small | s\nMedium\nSmall | s\n\nExtra Large')).toEqual([
      { label: 'Small', value: 's' }, { label: 'Medium', value: 'medium' }, { label: 'Extra Large', value: 'extra_large' },
    ])
  })
  it('fills options in fields and layout, in two forms from one list', () => {
    const lists = { sizes: [{ label: 'S', value: 's' }] }
    const a = applyDatasources({ fields: [{ type: 'select', datasource: 'sizes', options: [{ label: 'old', value: 'old' }] }] }, lists)
    const b = applyDatasources({ layout: [{ columns: [{ blocks: [{ type: 'radio', datasource: 'sizes' }] }] }] }, lists)
    expect(a.fields[0].options).toEqual([{ label: 'S', value: 's' }])
    expect((b.layout[0].columns[0].blocks[0] as unknown as { options: unknown }).options).toEqual([{ label: 'S', value: 's' }])
  })
  it('keeps own options when the list is unknown', () => {
    const f = applyDatasources({ datasource: 'gone', options: [{ label: 'x', value: 'x' }] }, {})
    expect(f.options).toEqual([{ label: 'x', value: 'x' }])
  })
})
