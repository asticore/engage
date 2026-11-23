import { describe, expect, it } from 'vitest'
import { SKIP_SLUG_REDIRECT_HEADER, slugRedirectAfterChange } from '@/features/redirects/slugChange'

describe('slug redirect decline header', () => {
  it('writes nothing when the editor saved without a redirect', async () => {
    const hook = slugRedirectAfterChange('posts')
    const doc = { id: 1, slug: 'new', _status: 'published' }
    const req = { headers: new Headers({ [SKIP_SLUG_REDIRECT_HEADER]: '1' }) }
    const out = await hook({ doc, previousDoc: { id: 1, slug: 'old', _status: 'published' }, operation: 'update', req, context: {} } as never)
    expect(out).toBe(doc)
  })
})
