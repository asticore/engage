// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { buildEntries } from '@/features/templatesHub/entryPoints'

describe('template entry points (33h)', () => {
  it('opens the template in use, else any, else offers to create', () => {
    const entries = buildEntries([
      { id: 1, kind: 'archive-blog', enabled: false, blocks: [{}] },
      { id: 2, kind: 'archive-blog', enabled: true, priority: 1, blocks: [{}] },
      { id: 3, kind: 'archive-blog', enabled: true, priority: 9, blocks: [{}] },
      { id: 4, kind: 'footer', enabled: false, blocks: [] },
    ])
    const by = Object.fromEntries(entries.map((e) => [e.kind, e]))
    expect(by['archive-blog']).toMatchObject({ id: 3, inUse: true })
    expect(by.footer).toMatchObject({ id: 4, inUse: false })
    expect(by['archive-shop']).toMatchObject({ id: null, inUse: false })
    expect(entries.map((e) => e.label)).toContain('Product page')
  })
})
